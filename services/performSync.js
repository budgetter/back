const { ProcessedEmail, Transaction, SyncHistory, ParserConfig, sequelize } = require("../models");
const GmailService = require("./gmailService");
const BankParsers = require("../parsers/BankParsers");
const { applyParser } = require("./parserEngine");
const categoryResolver = require("./categoryResolver");
const { v4: uuidv4 } = require("uuid");
const { decrypt } = require("../utils/encryption");
const { Op } = require("sequelize");

const CONCURRENT_FETCHES = 5;

/**
 * Fetch message bodies in parallel batches.
 */
async function fetchBodies(gmailService, ids) {
  const results = [];
  for (let i = 0; i < ids.length; i += CONCURRENT_FETCHES) {
    const batch = ids.slice(i, i + CONCURRENT_FETCHES);
    const settled = await Promise.allSettled(batch.map(id => gmailService.getMessage(id)));
    for (let j = 0; j < settled.length; j++) {
      results.push({
        id: batch[j],
        msg: settled[j].status === 'fulfilled' ? settled[j].value : null,
        error: settled[j].status === 'rejected' ? settled[j].reason : null,
      });
    }
    if (i + CONCURRENT_FETCHES < ids.length) await new Promise(r => setTimeout(r, 50));
  }
  return results;
}

/**
 * Performs a sync operation for a single BankIntegration instance.
 */
async function performSync(integration, userId, timeBudgetMs = 8000) {
  const syncStartTime = Date.now();
  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const details = [];

  try {
    const refreshToken = decrypt(integration.refreshToken);
    if (!refreshToken) {
      return { processed: 0, created: 0, skipped: 0, failed: 0, details: [], requiresReauth: true, hasMore: false, total: 0, remaining: 0 };
    }

    const gmailService = new GmailService(refreshToken);
    const country = integration.country || 'CO';
    const parserConfigs = await ParserConfig.findAll({ where: { isActive: true, country } });

    // Build queries
    let baseQueries;
    if (parserConfigs.length > 0) {
      baseQueries = parserConfigs.map(pc => `from:${pc.senderEmail}`);
    } else {
      baseQueries = [
        'from:DAVIbankInforma@davibank.com',
        'from:alertasynotificaciones@an.notificacionesbancolombia.com',
        'from:alertasynotificaciones@bancolombia.com.co'
      ];
    }

    // Date filter
    const syncDays = integration.syncDaysBack || 30;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() - syncDays);
    let sinceDate = integration.lastSync ? new Date(integration.lastSync) : maxDate;
    if (sinceDate < maxDate) sinceDate = maxDate;
    const dateFilter = `after:${sinceDate.getFullYear()}/${String(sinceDate.getMonth() + 1).padStart(2, '0')}/${String(sinceDate.getDate()).padStart(2, '0')}`;

    const queries = baseQueries.map(q => {
      let query = `${q} ${dateFilter}`;
      if (integration.unreadOnly) query += ' is:unread';
      return query;
    });

    // Step 1: Fetch all message IDs (lightweight)
    let allMessages = [];
    for (const q of queries) {
      try {
        const msgs = await gmailService.listMessages(`${q} -label:TRASH`, 500);
        allMessages = allMessages.concat(msgs);
      } catch (err) {
        if (gmailService.isTokenError(err)) {
          integration.isActive = false;
          await integration.save();
          return { processed: 0, created: 0, skipped: 0, failed: 0, details, requiresReauth: true, hasMore: false, total: 0, remaining: 0 };
        }
        throw err;
      }
    }

    // Deduplicate by message ID
    const seen = new Set();
    allMessages = allMessages.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
    const total = allMessages.length;

    // Step 2: Pre-filter already processed (check by messageId since unique constraint is on messageId)
    const messageIds = allMessages.map(m => m.id);
    const processedRows = await ProcessedEmail.findAll({
      where: { messageId: messageIds },
      attributes: ['messageId'], raw: true,
    });
    const processedSet = new Set(processedRows.map(p => p.messageId));
    const unprocessed = allMessages.filter(m => !processedSet.has(m.id));
    skippedCount = processedSet.size;

    console.log(`[Sync] Total: ${total}, Already processed: ${skippedCount}, To process: ${unprocessed.length}`);

    if (unprocessed.length === 0) {
      return { processed: 0, created: 0, skipped: skippedCount, failed: 0, details, requiresReauth: false, hasMore: false, total, remaining: 0 };
    }

    // Step 3: Determine batch size based on time budget
    const timeLeft = timeBudgetMs - (Date.now() - syncStartTime);
    const batchSize = Math.min(unprocessed.length, Math.max(3, Math.floor(timeLeft / 800)));
    const batch = unprocessed.slice(0, batchSize);
    const hasMore = unprocessed.length > batchSize;

    console.log(`[Sync] Batch: ${batch.length}, hasMore: ${hasMore}`);

    // Step 4: Fetch bodies in parallel
    const fetched = await fetchBodies(gmailService, batch.map(m => m.id));

    // Pre-fetch label
    let labelId = null;
    if (integration.addLabel) {
      try { labelId = await gmailService.getOrCreateLabel("Budgetter"); } catch (e) { /* skip */ }
    }

    // Step 5: Process each message individually (reliable — each write is independent)
    for (const item of fetched) {
      try {
        if (!item.msg) {
          // Mark as processed to avoid infinite retry
          await ProcessedEmail.create({ id: uuidv4(), integrationId: integration.id, messageId: item.id });
          failedCount++;
          details.push({ messageId: item.id, status: 'failed', description: 'Fetch failed' });
          continue;
        }

        const body = gmailService.extractBody(item.msg.payload);
        const internalDate = parseInt(item.msg.internalDate);
        let fromHeader = '';
        if (item.msg.payload?.headers) {
          const h = item.msg.payload.headers.find(h => h.name === 'From');
          if (h) fromHeader = h.value;
        }

        // Parse
        let result = null;
        const config = parserConfigs.find(pc => fromHeader.toLowerCase().includes(pc.senderEmail.toLowerCase()));
        if (config) {
          result = applyParser(config, body, internalDate);
        } else {
          const fn = BankParsers.getParser(fromHeader);
          if (fn) result = fn(body, internalDate);
        }

        if (!result) {
          await ProcessedEmail.create({ id: uuidv4(), integrationId: integration.id, messageId: item.id });
          console.log(`[Sync] Marked ${item.id} as no_parser`);
          details.push({ messageId: item.id, status: 'no_parser', description: config ? 'Parse returned no result' : 'Unknown sender' });
          continue;
        }

        // Wallet mapping
        const map = integration.IntegrationMaps.find(m => m.bankParameter === result.parserId);
        if (!map || !map.walletId) {
          await ProcessedEmail.create({ id: uuidv4(), integrationId: integration.id, messageId: item.id });
          console.log(`[Sync] Marked ${item.id} as no_mapping`);
          details.push({ messageId: item.id, status: 'no_mapping', description: `No wallet mapping for ${result.parserId}` });
          continue;
        }

        // Category resolution
        let categoryId = map.defaultCategoryId;
        const resolved = await categoryResolver.resolve(userId, result.description, country);
        if (resolved) categoryId = resolved;

        // Duplicate check: flag if same amount + date + type already exists for this user
        const existingTx = await Transaction.findOne({
          where: { UserId: userId, amount: result.amount, date: result.date, type: result.type },
        });
        const isDuplicate = !!existingTx;

        // Atomic write: ProcessedEmail + Transaction together
        await sequelize.transaction(async (t) => {
          await ProcessedEmail.create(
            { id: uuidv4(), integrationId: integration.id, messageId: item.id },
            { transaction: t }
          );
          await Transaction.create(
            { id: uuidv4(), amount: result.amount, description: result.description, date: result.date, type: result.type, categoryId, UserId: userId, walletId: map.walletId, source: 'email_sync', isDuplicate },
            { transaction: t }
          );
        });

        createdCount++;
        details.push({
          messageId: item.id,
          status: isDuplicate ? 'duplicate' : 'created',
          description: isDuplicate ? `⚠️ Possible duplicate: ${result.description}` : result.description,
        });

        // Post-processing (non-blocking)
        if (integration.markAsRead) gmailService.markAsRead(item.id).catch(() => {});
        if (integration.addLabel && labelId) gmailService.addLabel(item.id, labelId).catch(() => {});

      } catch (msgErr) {
        console.error(`[Sync] Message ${item.id} error:`, msgErr.name, msgErr.message, msgErr.fields || '', msgErr.sql || '');
        if (msgErr.parent) console.error(`[Sync] Parent error:`, msgErr.parent.sqlMessage || msgErr.parent.message);
        if (msgErr.name === 'SequelizeUniqueConstraintError') {
          // Message already processed (ProcessedEmail exists) — this is fine, just skip
          skippedCount++;
          details.push({ messageId: item.id, status: 'skipped', description: 'Already processed' });
          // Ensure it's in ProcessedEmail so pre-filter catches it next time
          await ProcessedEmail.findOrCreate({
            where: { integrationId: integration.id, messageId: item.id },
            defaults: { id: uuidv4(), integrationId: integration.id, messageId: item.id },
          }).catch(() => {});
        } else {
          failedCount++;
          details.push({ messageId: item.id, status: 'failed', description: msgErr.message || 'Unknown error' });
          // Mark as processed to avoid infinite retry
          await ProcessedEmail.findOrCreate({
            where: { integrationId: integration.id, messageId: item.id },
            defaults: { id: uuidv4(), integrationId: integration.id, messageId: item.id },
          }).catch(() => {});
        }
      }
    }

    // Update lastSync only when fully complete
    const processedCount = createdCount + failedCount + details.filter(d => d.status === 'no_parser' || d.status === 'no_mapping').length;
    if (processedCount > 0 && !hasMore) {
      integration.lastSync = new Date();
      await integration.save();
    }

    // Save sync history
    try {
      await SyncHistory.create({ id: uuidv4(), integrationId: integration.id, processed: processedCount, created: createdCount, skipped: skippedCount, failed: failedCount, details, syncedAt: new Date() });
    } catch (e) { /* non-critical */ }

    // Push notification: notify user of new transactions
    if (createdCount > 0 && !hasMore) {
      try {
        const pushService = require('./pushService');
        await pushService.sendToUser(userId, {
          type: 'sync_complete',
          title: 'Transactions Synced',
          body: `${createdCount} new transaction${createdCount > 1 ? 's' : ''} added`,
          url: '/',
        });
      } catch (e) { /* non-critical */ }
    }

    return { processed: processedCount, created: createdCount, skipped: skippedCount, failed: failedCount, details, requiresReauth: false, hasMore, total, remaining: hasMore ? unprocessed.length - batchSize : 0 };

  } catch (error) {
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      try { integration.isActive = false; await integration.save(); } catch (e) { /* */ }
      return { processed: 0, created: 0, skipped: skippedCount, failed: failedCount, details, requiresReauth: true, hasMore: false, total: 0, remaining: 0 };
    }
    console.error("Sync Error:", error.message?.replace(/refresh_token[^\s]*/gi, '[REDACTED]'));
    throw error;
  }
}

module.exports = { performSync };
