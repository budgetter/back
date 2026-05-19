const { ProcessedEmail, Transaction, Category, SyncHistory, ParserConfig, sequelize } = require("../models");
const GmailService = require("./gmailService");
const BankParsers = require("../parsers/BankParsers");
const { applyParser } = require("./parserEngine");
const categoryResolver = require("./categoryResolver");
const { v4: uuidv4 } = require("uuid");
const { decrypt } = require("../utils/encryption");

/**
 * Performs a sync operation for a single BankIntegration instance.
 *
 * Extracts the core sync logic from integrationController.syncNow so it can
 * be reused by both the manual sync endpoint and the scheduled sync service.
 *
 * @param {Object} integration - A BankIntegration instance with included IntegrationMaps
 * @param {string} userId - The ID of the user who owns this integration
 * @returns {Promise<Object>} Result object with shape:
 *   { processed, created, skipped, failed, details, requiresReauth }
 *   where details is an array of { messageId, status, description } entries.
 *   Status values: 'created', 'skipped', 'failed', 'no_parser', 'no_mapping'
 */
async function performSync(integration, userId, timeBudgetMs = 8000) {
    const syncStartTime = Date.now();
    let processedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const details = [];

    try {
        // Decrypt Token
        const refreshToken = decrypt(integration.refreshToken);
        if (!refreshToken) {
            console.log("[Sync] No refresh token after decrypt — requiresReauth");
            return {
                processed: 0,
                created: 0,
                skipped: 0,
                failed: 0,
                details: [],
                requiresReauth: true
            };
        }

        console.log(`[Sync] Integration ${integration.id} (${integration.email}) — token decrypted OK`);
        const gmailService = new GmailService(refreshToken);

        // Load active parser configs from DB for this country
        const country = integration.country || 'CO';
        const parserConfigs = await ParserConfig.findAll({
            where: { isActive: true, country },
        });

        // Build Gmail queries from parser configs (fall back to legacy if none configured)
        let baseQueries;
        if (parserConfigs.length > 0) {
            baseQueries = parserConfigs.map(pc => `from:${pc.senderEmail}`);
            console.log(`[Sync] Using ${parserConfigs.length} DB parser configs for country ${country}`);
        } else {
            baseQueries = [
                'from:DAVIbankInforma@davibank.com',
                'from:alertasynotificaciones@an.notificacionesbancolombia.com',
                'from:alertasynotificaciones@bancolombia.com.co'
            ];
            console.log(`[Sync] No DB parsers found, using legacy hardcoded queries`);
        }

        // Compute date filter: use lastSync if available, otherwise syncDaysBack
        // Cap at syncDaysBack (max 90) to avoid scanning too far back
        const syncDays = integration.syncDaysBack || 30;
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() - syncDays);

        let sinceDate;
        if (integration.lastSync) {
            sinceDate = new Date(integration.lastSync);
            // Don't go further back than syncDaysBack
            if (sinceDate < maxDate) sinceDate = maxDate;
        } else {
            sinceDate = maxDate;
        }

        const yyyy = sinceDate.getFullYear();
        const mm = String(sinceDate.getMonth() + 1).padStart(2, '0');
        const dd = String(sinceDate.getDate()).padStart(2, '0');
        const dateFilter = `after:${yyyy}/${mm}/${dd}`;

        // Build final queries with date filter and optional unread filter
        const queries = baseQueries.map(q => {
            let query = `${q} ${dateFilter}`;
            if (integration.unreadOnly === true) {
                query += ' is:unread';
            }
            return query;
        });

        console.log(`[Sync] Queries:`, queries);

        // Collect all messages across queries (no hard limit)
        let allMessages = [];

        for (const q of queries) {
            let messages;
            try {
                messages = await gmailService.listMessages(`${q} -label:TRASH`);
                console.log(`[Sync] Query "${q.substring(0, 40)}..." returned ${messages.length} messages`);
            } catch (listError) {
                console.error(`[Sync] listMessages error:`, listError.message);
                // Token error detection: mark inactive and return requiresReauth
                if (gmailService.isTokenError(listError)) {
                    integration.isActive = false;
                    await integration.save();
                    return {
                        processed: processedCount,
                        created: createdCount,
                        skipped: skippedCount,
                        failed: failedCount,
                        details,
                        requiresReauth: true
                    };
                }
                throw listError;
            }

            allMessages = allMessages.concat(messages);
        }

        // Deduplicate messages by ID (in case multiple queries return the same email)
        const seen = new Set();
        allMessages = allMessages.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });
        console.log(`[Sync] Total unique messages: ${allMessages.length}`);

        // Pre-fetch label ID if addLabel is enabled (once before the loop)
        let budgetterLabelId = null;
        if (integration.addLabel === true) {
            try {
                budgetterLabelId = await gmailService.getOrCreateLabel("Budgetter");
            } catch (labelError) {
                console.error("Failed to get/create Budgetter label, skipping labeling:", labelError.message);
                // Skip all labeling but continue sync
            }
        }

        // Process each message with per-message timeout and error isolation
        let hasMore = false;
        for (const msgMeta of allMessages) {
            // Time budget check — stop before serverless timeout
            if (Date.now() - syncStartTime > timeBudgetMs) {
                hasMore = true;
                console.log(`[Sync] Time budget reached (${timeBudgetMs}ms). Stopping with ${allMessages.length - processedCount - skippedCount} messages remaining.`);
                break;
            }

            const processMessage = async () => {
                // Check if already processed — skip if exists
                const isProcessed = await ProcessedEmail.findOne({
                    where: { integrationId: integration.id, messageId: msgMeta.id }
                });

                if (isProcessed) {
                    skippedCount++;
                    details.push({
                        messageId: msgMeta.id,
                        status: 'skipped',
                        description: 'Already processed'
                    });
                    return;
                }

                const msg = await gmailService.getMessage(msgMeta.id);
                const body = gmailService.extractBody(msg.payload);
                const internalDate = parseInt(msg.internalDate);

                // Get header From
                let fromHeader = '';
                if (msg.payload.headers) {
                    const h = msg.payload.headers.find(h => h.name === 'From');
                    if (h) fromHeader = h.value;
                }

                // Parse — try DB-driven parser first, fall back to legacy
                let result = null;
                const matchedConfig = parserConfigs.find(pc =>
                    fromHeader.toLowerCase().includes(pc.senderEmail.toLowerCase())
                );

                if (matchedConfig) {
                    result = applyParser(matchedConfig, body, internalDate);
                    if (!result) {
                        console.log(`[Sync] Parser "${matchedConfig.bankName}" returned null for message ${msgMeta.id}. Body snippet: ${body.substring(0, 200)}`);
                    }
                } else {
                    // Legacy fallback
                    const parserFunc = BankParsers.getParser(fromHeader);
                    if (parserFunc) {
                        result = parserFunc(body, internalDate);
                    }
                }

                if (!result) {
                    await ProcessedEmail.create({
                        id: uuidv4(),
                        integrationId: integration.id,
                        messageId: msgMeta.id
                    });
                    processedCount++;
                    details.push({
                        messageId: msgMeta.id,
                        status: 'no_parser',
                        description: matchedConfig ? 'Parse returned no result' : 'Unknown sender'
                    });
                    return;
                }

                // Find Mapping for this bank
                const map = integration.IntegrationMaps.find(m => m.bankParameter === result.parserId);

                if (!map || !map.walletId) {
                    // No wallet mapping for this bank
                    await ProcessedEmail.create({
                        id: uuidv4(),
                        integrationId: integration.id,
                        messageId: msgMeta.id
                    });
                    processedCount++;
                    details.push({
                        messageId: msgMeta.id,
                        status: 'no_mapping',
                        description: `No wallet mapping for ${result.parserId}`
                    });
                    return;
                }

                let categoryId = map.defaultCategoryId;

                // Category resolution chain: user override → global mapping → default
                const resolvedCategoryId = await categoryResolver.resolve(userId, result.description, country);
                if (resolvedCategoryId) {
                    categoryId = resolvedCategoryId;
                }

                if (!categoryId) {
                    // No category — still create transaction with null categoryId
                    console.log(`[Sync] No category resolved for "${result.description}" — creating with null categoryId`);
                }

                // Check for possible duplicate (same amount + date + similar description)
                const { Op } = require('sequelize');
                const existingTx = await Transaction.findOne({
                    where: {
                        UserId: userId,
                        amount: result.amount,
                        date: result.date,
                        type: result.type,
                    }
                });

                const isDuplicate = existingTx && existingTx.description &&
                    existingTx.description.toLowerCase().includes(result.description.toLowerCase().substring(0, 5));

                // Atomic write: ProcessedEmail + Transaction in a single transaction
                await sequelize.transaction(async (t) => {
                    await ProcessedEmail.create({
                        id: uuidv4(),
                        integrationId: integration.id,
                        messageId: msgMeta.id
                    }, { transaction: t });

                    await Transaction.create({
                        id: uuidv4(),
                        amount: result.amount,
                        description: result.description,
                        date: result.date,
                        type: result.type,
                        categoryId: categoryId,
                        UserId: userId,
                        walletId: map.walletId,
                        source: 'email_sync',
                        isDuplicate: isDuplicate || false
                    }, { transaction: t });
                });

                createdCount++;
                processedCount++;
                details.push({
                    messageId: msgMeta.id,
                    status: isDuplicate ? 'duplicate' : 'created',
                    description: isDuplicate
                        ? `⚠️ Possible duplicate: ${result.description}`
                        : (result.description || 'Transaction created')
                });

                // Post-processing: mark as read
                if (integration.markAsRead === true) {
                    try {
                        await gmailService.markAsRead(msgMeta.id);
                    } catch (markError) {
                        console.error(`Failed to mark message ${msgMeta.id} as read:`, markError.message);
                    }
                }

                // Post-processing: add Budgetter label
                if (integration.addLabel === true && budgetterLabelId) {
                    try {
                        await gmailService.addLabel(msgMeta.id, budgetterLabelId);
                    } catch (labelError) {
                        console.error(`Failed to add label to message ${msgMeta.id}:`, labelError.message);
                    }
                }
            };

            try {
                // Per-message 10-second timeout
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Message processing timeout')), 10000)
                );
                await Promise.race([processMessage(), timeoutPromise]);
            } catch (msgError) {
                // Handle unique constraint violations gracefully — skip, don't crash
                if (msgError.name === 'SequelizeUniqueConstraintError') {
                    skippedCount++;
                    details.push({
                        messageId: msgMeta.id,
                        status: 'skipped',
                        description: 'Duplicate detected'
                    });
                    continue;
                }

                // Log error with message ID but never expose refresh token values
                const safeMessage = msgError.message ? msgError.message.replace(/refresh_token[^\s]*/gi, '[REDACTED]') : 'Unknown error';
                console.error(`Error processing message ${msgMeta.id}: ${safeMessage}`);
                failedCount++;
                details.push({
                    messageId: msgMeta.id,
                    status: 'failed',
                    description: safeMessage
                });
                // Continue processing remaining messages
            }

            // Rate control: 100ms delay between messages to avoid API quota issues
            await new Promise(r => setTimeout(r, 100));
        }

        // Only update lastSync when fully complete (not mid-batch)
        if (processedCount > 0 && !hasMore) {
            integration.lastSync = new Date();
            await integration.save();
        }

        // Persist sync history
        try {
            await SyncHistory.create({
                id: uuidv4(),
                integrationId: integration.id,
                processed: processedCount,
                created: createdCount,
                skipped: skippedCount,
                failed: failedCount,
                details,
                syncedAt: new Date(),
            });
        } catch (histErr) {
            console.error('Failed to save sync history:', histErr.message);
        }

        return {
            processed: processedCount,
            created: createdCount,
            skipped: skippedCount,
            failed: failedCount,
            details,
            requiresReauth: false,
            hasMore
        };

    } catch (error) {
        // Outer catch: token error detection for any uncaught token errors
        const isTokenErr = (error.code === 401) || (error.message && error.message.includes('invalid_grant'));
        if (isTokenErr) {
            try {
                integration.isActive = false;
                await integration.save();
            } catch (saveErr) {
                console.error("Failed to deactivate integration:", saveErr.message);
            }
            return {
                processed: processedCount,
                created: createdCount,
                skipped: skippedCount,
                failed: failedCount,
                details,
                requiresReauth: true
            };
        }

        // Never log refresh token values
        const safeMessage = error.message ? error.message.replace(/refresh_token[^\s]*/gi, '[REDACTED]') : 'Unknown error';
        console.error("Sync Error:", safeMessage);
        throw error;
    }
}

module.exports = { performSync };
