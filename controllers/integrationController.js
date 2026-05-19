const crypto = require('crypto');
const { google } = require("googleapis");
const passport = require("passport");
const { BankIntegration, IntegrationMap, ProcessedEmail, Transaction, Wallet, Category, OAuthNonce, sequelize } = require("../models");
const GmailService = require("../services/gmailService");
const BankParsers = require("../parsers/BankParsers");
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require("../utils/encryption");
const { performSync } = require("../services/performSync");

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

        // Determine Gmail scope based on user preferences or query param
        let gmailScope = 'https://www.googleapis.com/auth/gmail.modify';

        if (req.query.scope === 'readonly') {
            gmailScope = 'https://www.googleapis.com/auth/gmail.readonly';
        } else if (req.query.scope === 'modify') {
            gmailScope = 'https://www.googleapis.com/auth/gmail.modify';
        } else {
            // Check stored preferences: if both markAsRead and addLabel are false, use readonly
            const existingIntegration = await BankIntegration.findOne({
                where: { userId: req.user.id, provider: 'Gmail', isActive: true }
            });

            if (existingIntegration && !existingIntegration.markAsRead && !existingIntegration.addLabel) {
                gmailScope = 'https://www.googleapis.com/auth/gmail.readonly';
            }
        }

        const callbackUrl = `${req.protocol}://${req.get('host')}/api/integration/google/callback`;
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl
        );

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['profile', 'email', gmailScope],
            state: JSON.stringify({ userId: req.user.id, nonce })
        });

        res.redirect(authUrl);
    } catch (error) {
        console.error("Connect Gmail Error:", error);
        res.redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=error`);
    }
}

async function gmailCallback(req, res) {
    const { code, state } = req.query;

    try {
        console.log("Gmail callback hit. Protocol:", req.protocol, "Host:", req.get('host'), "GMAIL_INTEGRATION_CALLBACK_URL:", process.env.GMAIL_INTEGRATION_CALLBACK_URL ? "SET" : "NOT SET");
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

        const callbackUrl = `${req.protocol}://${req.get('host')}/api/integration/google/callback`;
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        // Encrypt refresh token
        const encryptedToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

        // Check for duplicate: active integration with same email for this user
        const existingIntegration = await BankIntegration.findOne({
            where: { userId, provider: 'Gmail', email: userInfo.data.email, isActive: true }
        });

        if (existingIntegration) {
            return res.redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=duplicate`);
        }

        // Create new integration record (multi-account support)
        await BankIntegration.create({
            userId,
            provider: 'Gmail',
            email: userInfo.data.email,
            refreshToken: encryptedToken || '',
            isActive: true
        });

        res.redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=success`);

    } catch (error) {
        console.error("Gmail Connect Error:", error.message, error.response?.data || '');
        const reason = encodeURIComponent(error.message || 'unknown');
        res.redirect(`${process.env.ORIGIN_URL}/settings/integrations?status=error&reason=${reason}`);
    }
}

async function getSettings(req, res) {
    try {
        const integrations = await BankIntegration.findAll({
            where: { userId: req.user.id, provider: 'Gmail', isActive: true },
            include: [{ model: IntegrationMap }]
        });

        if (!integrations || integrations.length === 0) {
            return res.json({ accounts: [], maps: [] });
        }

        // Build accounts array
        const accounts = integrations.map(integration => ({
            id: integration.id,
            email: integration.email,
            connected: true,
            isActive: integration.isActive,
            lastSync: integration.lastSync,
            nextScheduledSync: integration.nextScheduledSync,
            syncDaysBack: integration.syncDaysBack,
            unreadOnly: integration.unreadOnly,
            markAsRead: integration.markAsRead,
            addLabel: integration.addLabel
        }));

        // Collect maps from all integrations, deduplicated by bankParameter
        const seenBankParams = new Set();
        const maps = [];
        for (const integration of integrations) {
            for (const map of integration.IntegrationMaps) {
                if (!seenBankParams.has(map.bankParameter)) {
                    seenBankParams.add(map.bankParameter);
                    maps.push({
                        bankParameter: map.bankParameter,
                        walletId: map.walletId,
                        defaultCategoryId: map.defaultCategoryId
                    });
                }
            }
        }

        return res.json({ accounts, maps });
    } catch (error) {
        console.error("Get Settings Error:", error);
        res.status(500).json({ message: "Server error" });
    }
}

async function updateSettings(req, res) {
    try {
        const { maps } = req.body; // Array of { bankParameter, walletId, defaultCategoryId }
        const integration = await BankIntegration.findOne({ where: { userId: req.user.id, provider: 'Gmail', isActive: true } });

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
                    id: require('uuid').v4(),
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
        const { syncDaysBack, unreadOnly, markAsRead, addLabel, integrationId } = req.body;

        // Validate syncDaysBack if provided
        if (syncDaysBack !== undefined) {
            if (!Number.isInteger(syncDaysBack) || syncDaysBack < 1 || syncDaysBack > 90) {
                return res.status(400).json({ message: "syncDaysBack must be between 1 and 90" });
            }
        }

        let integration;

        if (integrationId) {
            // Target a specific account by ID
            integration = await BankIntegration.findOne({
                where: { id: integrationId, provider: 'Gmail' }
            });

            if (!integration) {
                return res.status(404).json({ message: "Integration not found" });
            }

            // Verify ownership
            if (integration.userId !== req.user.id) {
                return res.status(403).json({ message: "Forbidden" });
            }
        } else {
            // Backward compatibility: fall back to findOne for the user (active only)
            integration = await BankIntegration.findOne({
                where: { userId: req.user.id, provider: 'Gmail', isActive: true }
            });

            if (!integration) {
                return res.status(404).json({ message: "Integration not found" });
            }

            // Defense-in-depth: explicit ownership check
            if (integration.userId !== req.user.id) {
                return res.status(403).json({ message: "Forbidden" });
            }
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
    try {
        const integrations = await BankIntegration.findAll({
            where: { userId: req.user.id, provider: 'Gmail', isActive: true },
            include: [{ model: IntegrationMap }]
        });

        if (!integrations || integrations.length === 0) {
            return res.status(400).json({ message: "Integration not active" });
        }

        // Aggregate results across all active integrations
        let totalProcessed = 0;
        let totalCreated = 0;
        let totalSkipped = 0;
        let totalFailed = 0;
        let allDetails = [];
        let requiresReauth = false;
        let hasMore = false;
        let totalMessages = 0;
        let remainingMessages = 0;

        for (const integration of integrations) {
            try {
                const result = await performSync(integration, req.user.id);

                totalProcessed += result.processed;
                totalCreated += result.created;
                totalSkipped += result.skipped;
                totalFailed += result.failed;
                allDetails = allDetails.concat(result.details);

                if (result.requiresReauth) {
                    requiresReauth = true;
                }

                if (result.hasMore) {
                    hasMore = true;
                }

                totalMessages += result.total || 0;
                remainingMessages += result.remaining || 0;

                // Update nextScheduledSync to 8 hours from now with some jitter
                const jitter = Math.floor(Math.random() * 3600000); // 0-60 min
                integration.nextScheduledSync = new Date(Date.now() + 8 * 60 * 60 * 1000 + jitter);
                await integration.save();
            } catch (syncError) {
                const safeMessage = syncError.message ? syncError.message.replace(/refresh_token[^\s]*/gi, '[REDACTED]') : 'Unknown error';
                console.error(`Sync error for integration ${integration.id}: ${safeMessage}`);
                // Continue to next integration
            }
        }

        const response = {
            message: "Sync complete",
            processed: totalProcessed,
            created: totalCreated,
            skipped: totalSkipped,
            failed: totalFailed,
            details: allDetails,
            total: totalMessages,
            remaining: remainingMessages,
        };

        if (requiresReauth) {
            response.requiresReauth = true;
        }

        if (hasMore) {
            response.hasMore = true;
            response.message = "Sync partially complete — press Sync again to continue";
        }

        return res.json(response);

    } catch (error) {
        const safeMessage = error.message ? error.message.replace(/refresh_token[^\s]*/gi, '[REDACTED]') : 'Unknown error';
        console.error("Sync Main Error:", safeMessage);
        res.status(500).json({ message: "Server error during sync" });
    }
}


async function disconnectIntegration(req, res) {
    try {
        const integration = await BankIntegration.findByPk(req.params.id);

        if (!integration) {
            return res.status(404).json({ message: "Integration not found" });
        }

        if (integration.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }

        integration.isActive = false;
        integration.refreshToken = '';
        await integration.save();

        return res.status(200).json({ message: "Integration disconnected" });
    } catch (error) {
        console.error("Disconnect Integration Error:", error);
        res.status(500).json({ message: "Server error" });
    }
}

async function debugProcessedEmails(req, res) {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ message: "Forbidden" });
        }

        const integrations = await BankIntegration.findAll({
            where: { userId: req.user.id, provider: 'Gmail' }
        });

        if (!integrations || integrations.length === 0) {
            return res.json({ processedEmails: [] });
        }

        const integrationIds = integrations.map(i => i.id);

        const processedEmails = await ProcessedEmail.findAll({
            where: { integrationId: integrationIds },
            limit: 20,
            order: [['createdAt', 'DESC']],
            attributes: ['messageId', 'createdAt', 'integrationId']
        });

        return res.json({
            processedEmails: processedEmails.map(pe => ({
                messageId: pe.messageId,
                createdAt: pe.createdAt,
                integrationId: pe.integrationId
            }))
        });
    } catch (error) {
        console.error("Debug Processed Emails Error:", error);
        res.status(500).json({ message: "Server error" });
    }
}

async function resetProcessedEmails(req, res) {
    try {
        const { deleteTransactions, fromDate, toDate } = req.body || {};

        const integrations = await BankIntegration.findAll({
            where: { userId: req.user.id, provider: 'Gmail' },
        });

        if (!integrations.length) return res.status(404).json({ message: 'No integrations found' });

        const integrationIds = integrations.map(i => i.id);

        // Delete ProcessedEmail records for user's integrations
        const where = { integrationId: integrationIds };
        if (fromDate || toDate) {
            const { Op } = require('sequelize');
            where.createdAt = {};
            if (fromDate) where.createdAt[Op.gte] = new Date(fromDate);
            if (toDate) where.createdAt[Op.lte] = new Date(toDate + 'T23:59:59');
        }

        const deleted = await ProcessedEmail.destroy({ where });

        // Optionally delete synced transactions in the date range
        let txDeleted = 0;
        if (deleteTransactions) {
            const txWhere = { UserId: req.user.id, source: 'email_sync' };
            if (fromDate || toDate) {
                const { Op } = require('sequelize');
                txWhere.date = {};
                if (fromDate) txWhere.date[Op.gte] = fromDate;
                if (toDate) txWhere.date[Op.lte] = toDate;
            }
            txDeleted = await Transaction.destroy({ where: txWhere });
        }

        // Clear lastSync so next sync uses syncDaysBack
        for (const integration of integrations) {
            integration.lastSync = null;
            await integration.save();
        }

        const msg = `Cleared ${deleted} processed records${txDeleted ? `, deleted ${txDeleted} transactions` : ''}. Next sync will re-process.`;
        return res.json({ message: msg, deletedEmails: deleted, deletedTransactions: txDeleted });
    } catch (error) {
        console.error('Reset processed emails error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}

async function getSyncHistory(req, res) {
    try {
        const integrations = await BankIntegration.findAll({
            where: { userId: req.user.id, provider: 'Gmail' },
            attributes: ['id'],
        });

        if (!integrations.length) return res.json([]);

        const { SyncHistory } = require('../models');
        const integrationIds = integrations.map(i => i.id);

        const history = await SyncHistory.findAll({
            where: { integrationId: integrationIds },
            order: [['syncedAt', 'DESC']],
            limit: 20,
        });

        return res.json(history);
    } catch (error) {
        console.error('Get sync history error:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
}

module.exports = {
    connectGmail,
    gmailCallback,
    getSettings,
    updateSettings,
    updatePreferences,
    syncNow,
    disconnectIntegration,
    debugProcessedEmails,
    getSyncHistory,
    resetProcessedEmails
};
