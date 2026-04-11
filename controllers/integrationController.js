const crypto = require('crypto');
const { google } = require("googleapis");
const passport = require("passport");
const { BankIntegration, IntegrationMap, ProcessedEmail, Transaction, Wallet, Category, OAuthNonce, sequelize } = require("../models");
const GmailService = require("../services/gmailService");
const BankParsers = require("../parsers/BankParsers");
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require("../utils/encryption");

async function connectGmail(req, res, next) {
    try {
        // Generate cryptographic nonce for CSRF protection
        const nonce = crypto.randomBytes(32).toString('hex');

        // Store nonce in OAuthNonce table with 10-minute expiry
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await OAuthNonce.create({
            userId: req.user.id,
            nonce,
            expiresAt,
        });

        passport.authenticate("google", {
            scope: ["profile", "email", "https://www.googleapis.com/auth/gmail.modify"],
            accessType: "offline",
            prompt: "consent",
            state: JSON.stringify({ userId: req.user.id, nonce })
        })(req, res, next);
    } catch (error) {
        console.error("Connect Gmail Error:", error);
        res.redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=error`);
    }
}

async function gmailCallback(req, res) {
    const { code, state } = req.query;

    try {
        // Validate callback URL uses HTTPS in production
        if (process.env.NODE_ENV === 'production' && !process.env.ORIGIN_URL?.startsWith('https://')) {
            console.error("OAuth callback rejected: ORIGIN_URL must use HTTPS in production");
            return res.redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=error`);
        }

        // Parse and validate state parameter
        if (!state) {
            return res.status(403).redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=error`);
        }

        const parsed = JSON.parse(state);
        const { userId, nonce } = parsed;

        if (!userId || !nonce) {
            return res.status(403).redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=error`);
        }

        // Validate nonce against OAuthNonce table
        const storedNonce = await OAuthNonce.findOne({
            where: { nonce, userId }
        });

        if (!storedNonce || storedNonce.expiresAt < new Date()) {
            // Nonce not found or expired — CSRF protection triggered
            if (storedNonce) {
                await storedNonce.destroy(); // Clean up expired nonce
            }
            console.error("OAuth callback rejected: invalid or expired nonce");
            return res.status(403).redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=error`);
        }

        // Delete nonce after successful validation to prevent replay attacks
        await storedNonce.destroy();

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.ORIGIN_URL}/api/integration/google/callback`
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        // Encrypt refresh token
        const encryptedToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

        // Save/Update Integration
        const [integration, created] = await BankIntegration.findOrCreate({
            where: { userId, provider: 'Gmail' },
            defaults: {
                email: userInfo.data.email,
                refreshToken: encryptedToken || '',
                isActive: true
            }
        });

        if (!created) {
            integration.email = userInfo.data.email;
            if (encryptedToken) integration.refreshToken = encryptedToken;
            integration.isActive = true;
            await integration.save();
        }

        res.redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=success`);

    } catch (error) {
        console.error("Gmail Connect Error:", error);
        res.redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=error`);
    }
}

async function getSettings(req, res) {
    try {
        const integration = await BankIntegration.findOne({
            where: { userId: req.user.id, provider: 'Gmail' },
            include: [{ model: IntegrationMap }]
        });

        if (!integration) return res.json({ connected: false });

        // Defense-in-depth: explicit ownership check
        if (integration.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }

        return res.json({
            connected: true,
            email: integration.email,
            lastSync: integration.lastSync,
            maps: integration.IntegrationMaps, // { bankParameter, walletId, defaultCategoryId }
            syncDaysBack: integration.syncDaysBack,
            unreadOnly: integration.unreadOnly,
            markAsRead: integration.markAsRead,
            addLabel: integration.addLabel
        });
    } catch (error) {
        console.error("Get Settings Error:", error);
        res.status(500).json({ message: "Server error" });
    }
}

async function updateSettings(req, res) {
    try {
        const { maps } = req.body; // Array of { bankParameter, walletId, defaultCategoryId }
        const integration = await BankIntegration.findOne({ where: { userId: req.user.id, provider: 'Gmail' } });

        if (!integration) return res.status(404).json({ message: "Integration not found" });

        // Defense-in-depth: explicit ownership check
        if (integration.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // Upsert maps
        for (const map of maps) {
            const existing = await IntegrationMap.findOne({
                where: { integrationId: integration.id, bankParameter: map.bankParameter }
            });

            if (existing) {
                existing.walletId = map.walletId;
                existing.defaultCategoryId = map.defaultCategoryId || null;
                await existing.save();
            } else {
                await IntegrationMap.create({
                    integrationId: integration.id,
                    bankParameter: map.bankParameter,
                    walletId: map.walletId,
                    defaultCategoryId: map.defaultCategoryId || null
                });
            }
        }

        return res.json({ message: "Settings updated" });
    } catch (error) {
        console.error("Update Settings Error:", error);
        res.status(500).json({ message: "Server error" });
    }
}

async function updatePreferences(req, res) {
    try {
        const { syncDaysBack, unreadOnly, markAsRead, addLabel } = req.body;

        // Validate syncDaysBack if provided
        if (syncDaysBack !== undefined) {
            if (!Number.isInteger(syncDaysBack) || syncDaysBack < 1 || syncDaysBack > 90) {
                return res.status(400).json({ message: "syncDaysBack must be between 1 and 90" });
            }
        }

        const integration = await BankIntegration.findOne({
            where: { userId: req.user.id, provider: 'Gmail' }
        });

        if (!integration) {
            return res.status(404).json({ message: "Integration not found" });
        }

        // Defense-in-depth: explicit ownership check
        if (integration.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // Update only provided fields
        if (syncDaysBack !== undefined) integration.syncDaysBack = syncDaysBack;
        if (unreadOnly !== undefined) integration.unreadOnly = unreadOnly;
        if (markAsRead !== undefined) integration.markAsRead = markAsRead;
        if (addLabel !== undefined) integration.addLabel = addLabel;

        await integration.save();

        return res.json({ message: "Preferences updated" });
    } catch (error) {
        console.error("Update Preferences Error:", error);
        res.status(500).json({ message: "Server error" });
    }
}


async function syncNow(req, res) {
    let processedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
        const integration = await BankIntegration.findOne({
            where: { userId: req.user.id, provider: 'Gmail' },
            include: [{ model: IntegrationMap }]
        });

        if (!integration || !integration.isActive || !integration.refreshToken) {
            return res.status(400).json({ message: "Integration not active" });
        }

        // Defense-in-depth: explicit ownership check
        if (integration.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }

        // Decrypt Token
        const refreshToken = decrypt(integration.refreshToken);
        if (!refreshToken) {
            return res.status(500).json({ message: "Failed to decrypt credentials" });
        }

        const gmailService = new GmailService(refreshToken);

        // Define search queries based on supported banks
        const baseQueries = [
            'from:colpatriaInforma@scotiabankcolpatria.com',
            'from:alertasynotificaciones@notificacionesbancolombia.com',
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

        // Collect all messages across queries, limit total to 50
        const MAX_MESSAGES = 50;
        let allMessages = [];

        for (const q of queries) {
            if (allMessages.length >= MAX_MESSAGES) break;

            let messages;
            try {
                const remaining = MAX_MESSAGES - allMessages.length;
                messages = await gmailService.listMessages(`${q} -label:TRASH`, remaining);
            } catch (listError) {
                // Token error detection: mark inactive and return requiresReauth
                if (gmailService.isTokenError(listError)) {
                    integration.isActive = false;
                    await integration.save();
                    return res.json({ requiresReauth: true, message: "Token expired or revoked. Please re-authorize." });
                }
                throw listError;
            }

            allMessages = allMessages.concat(messages);
        }

        // Enforce max 50 total
        allMessages = allMessages.slice(0, MAX_MESSAGES);

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
                if (parserFunc) {
                    const result = parserFunc(body, internalDate);

                    if (result) {
                        // Find Mapping for this bank
                        let map = integration.IntegrationMaps.find(m => m.bankParameter === result.parserId);

                        if (map && map.walletId) {
                            let categoryId = map.defaultCategoryId;

                            // Try to infer category from parser result
                            if (result.rawCategory && result.rawCategory !== 'Unknown') {
                                const cat = await Category.findOne({
                                    where: { name: result.rawCategory }
                                });
                                if (cat) categoryId = cat.id;
                            }

                            if (categoryId) {
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
                                        UserId: req.user.id,
                                        walletId: map.walletId,
                                        source: 'email_sync'
                                    }, { transaction: t });
                                });

                                createdCount++;
                                processedCount++;

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

                                return;
                            }
                        }
                    }
                }

                // No parser match, no mapping, or no category — still mark as processed
                await ProcessedEmail.create({
                    id: uuidv4(),
                    integrationId: integration.id,
                    messageId: msgMeta.id
                });
                processedCount++;
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
                    continue;
                }

                // Log error with message ID but never expose refresh token values
                const safeMessage = msgError.message ? msgError.message.replace(/refresh_token[^\s]*/gi, '[REDACTED]') : 'Unknown error';
                console.error(`Error processing message ${msgMeta.id}: ${safeMessage}`);
                failedCount++;
                // Continue processing remaining messages
            }
        }

        // Only update lastSync if at least one message was processed successfully
        if (processedCount > 0) {
            integration.lastSync = new Date();
            await integration.save();
        }

        return res.json({
            message: "Sync complete",
            processed: processedCount,
            created: createdCount,
            skipped: skippedCount,
            failed: failedCount
        });

    } catch (error) {
        // Outer catch: token error detection for any uncaught token errors
        const isTokenErr = (error.code === 401) || (error.message && error.message.includes('invalid_grant'));
        if (isTokenErr) {
            try {
                const integration = await BankIntegration.findOne({
                    where: { userId: req.user.id, provider: 'Gmail' }
                });
                if (integration) {
                    integration.isActive = false;
                    await integration.save();
                }
            } catch (saveErr) {
                console.error("Failed to deactivate integration:", saveErr.message);
            }
            return res.json({ requiresReauth: true, message: "Token expired or revoked. Please re-authorize." });
        }

        // Never log refresh token values
        const safeMessage = error.message ? error.message.replace(/refresh_token[^\s]*/gi, '[REDACTED]') : 'Unknown error';
        console.error("Sync Main Error:", safeMessage);
        res.status(500).json({ message: "Server error during sync" });
    }
}


module.exports = {
    connectGmail,
    gmailCallback,
    getSettings,
    updateSettings,
    updatePreferences,
    syncNow
};
