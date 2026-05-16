const { ProcessedEmail, Transaction, Category, sequelize } = require("../models");
const GmailService = require("./gmailService");
const BankParsers = require("../parsers/BankParsers");
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
async function performSync(integration, userId) {
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

        // Define search queries based on supported banks
        const baseQueries = [
            'from:DAVIbankInforma@davibank.com',
            'from:alertasynotificaciones@an.notificacionesbancolombia.com',
            'from:alertasynotificaciones@bancolombia.com.co'
        ];

        // Compute date filter from syncDaysBack preference
        const syncDays = integration.syncDaysBack || 30;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - syncDays);
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

        // Collect all messages across queries, limit total to 50
        const MAX_MESSAGES = 50;
        let allMessages = [];

        for (const q of queries) {
            if (allMessages.length >= MAX_MESSAGES) break;

            let messages;
            try {
                const remaining = MAX_MESSAGES - allMessages.length;
                messages = await gmailService.listMessages(`${q} -label:TRASH`, remaining);
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

        // Enforce max 50 total
        allMessages = allMessages.slice(0, MAX_MESSAGES);
        console.log(`[Sync] Total messages found: ${allMessages.length}`);

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
        for (const msgMeta of allMessages) {
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

                // Parse
                const parserFunc = BankParsers.getParser(fromHeader);
                if (!parserFunc) {
                    // No parser for this sender
                    await ProcessedEmail.create({
                        id: uuidv4(),
                        integrationId: integration.id,
                        messageId: msgMeta.id
                    });
                    processedCount++;
                    details.push({
                        messageId: msgMeta.id,
                        status: 'no_parser',
                        description: 'Unknown sender'
                    });
                    return;
                }

                const result = parserFunc(body, internalDate);

                if (!result) {
                    // Parser returned null — could not extract data
                    await ProcessedEmail.create({
                        id: uuidv4(),
                        integrationId: integration.id,
                        messageId: msgMeta.id
                    });
                    processedCount++;
                    details.push({
                        messageId: msgMeta.id,
                        status: 'failed',
                        description: 'Parse returned no result'
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

                // Try to infer category from parser result
                if (result.rawCategory && result.rawCategory !== 'Unknown') {
                    const cat = await Category.findOne({
                        where: { name: result.rawCategory }
                    });
                    if (cat) categoryId = cat.id;
                }

                if (!categoryId) {
                    // No category available — still mark as processed but can't create transaction
                    await ProcessedEmail.create({
                        id: uuidv4(),
                        integrationId: integration.id,
                        messageId: msgMeta.id
                    });
                    processedCount++;
                    details.push({
                        messageId: msgMeta.id,
                        status: 'no_mapping',
                        description: `No category mapping for ${result.parserId}`
                    });
                    return;
                }

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
                        source: 'email_sync'
                    }, { transaction: t });
                });

                createdCount++;
                processedCount++;
                details.push({
                    messageId: msgMeta.id,
                    status: 'created',
                    description: result.description || 'Transaction created'
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
        }

        // Only update lastSync if at least one message was processed successfully
        if (processedCount > 0) {
            integration.lastSync = new Date();
            await integration.save();
        }

        return {
            processed: processedCount,
            created: createdCount,
            skipped: skippedCount,
            failed: failedCount,
            details,
            requiresReauth: false
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
