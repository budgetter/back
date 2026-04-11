const { google } = require("googleapis");
const passport = require("passport");
const { BankIntegration, IntegrationMap, ProcessedEmail, Transaction, Wallet, Category } = require("../models");
const GmailService = require("../services/gmailService");
const BankParsers = require("../parsers/BankParsers");
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require("../utils/encryption");

async function connectGmail(req, res, next) {
    passport.authenticate("google", {
        scope: ["profile", "email", "https://www.googleapis.com/auth/gmail.readonly"],
        accessType: "offline",
        prompt: "consent", // Force refresh token
        state: JSON.stringify({ userId: req.user.id, action: "connect_gmail" }) // Pass state to callback
    })(req, res, next);
}

async function gmailCallback(req, res) {
    const { code, state } = req.query;

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.ORIGIN_URL}/api/integration/google/callback`
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        let userId = null;
        if (state) {
            const parsed = JSON.parse(state);
            userId = parsed.userId;
        }

        if (!userId) throw new Error("User context lost");

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

        return res.json({
            connected: true,
            email: integration.email,
            lastSync: integration.lastSync,
            maps: integration.IntegrationMaps // { bankParameter, walletId, defaultCategoryId }
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

async function syncNow(req, res) {
    let processedCount = 0;
    let createdCount = 0;

    try {
        const integration = await BankIntegration.findOne({
            where: { userId: req.user.id, provider: 'Gmail' },
            include: [{ model: IntegrationMap }]
        });

        if (!integration || !integration.isActive || !integration.refreshToken) {
            return res.status(400).json({ message: "Integration not active" });
        }

        // Decrypt Token
        const refreshToken = decrypt(integration.refreshToken);
        if (!refreshToken) {
            return res.status(500).json({ message: "Failed to decrypt credentials" });
        }

        const gmailService = new GmailService(refreshToken);

        // Define search queries based on supported banks
        const queries = [
            'from:colpatriaInforma@scotiabankcolpatria.com',
            'from:alertasynotificaciones@notificacionesbancolombia.com',
            'from:alertasynotificaciones@bancolombia.com.co'
        ];

        for (const q of queries) {
            // Find messages. For now limiting to 20 recent
            const messages = await gmailService.listMessages(`${q} -label:TRASH`);

            for (const msgMeta of messages) {
                // Check if already processed
                const isProcessed = await ProcessedEmail.findOne({
                    where: { integrationId: integration.id, messageId: msgMeta.id }
                });

                if (isProcessed) continue;

                try {
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

                            // User needs to configure. If not configured, we can't create transaction safely (no wallet)
                            if (map && map.walletId) {
                                let categoryId = map.defaultCategoryId;

                                // Try to infer category from parser result
                                if (result.rawCategory && result.rawCategory !== 'Unknown') {
                                    // fuzzy match name? or exact?
                                    const cat = await Category.findOne({
                                        where: { name: result.rawCategory }
                                    });
                                    if (cat) categoryId = cat.id;
                                }

                                if (categoryId) {
                                    await Transaction.create({
                                        id: uuidv4(),
                                        amount: result.amount,
                                        description: result.description,
                                        date: result.date,
                                        type: result.type,
                                        categoryId: categoryId,
                                        UserId: req.user.id,
                                        walletId: map.walletId
                                    });
                                    createdCount++;
                                }
                            }
                        }
                    }

                    // Success or skipped (no parser/map), mark processed
                    await ProcessedEmail.create({
                        id: uuidv4(),
                        integrationId: integration.id,
                        messageId: msgMeta.id
                    });
                    processedCount++;

                } catch (innerError) {
                    console.error(`Error processing msg ${msgMeta.id}:`, innerError);
                    // Continue to next message
                }
            }
        }

        integration.lastSync = new Date();
        await integration.save();

        return res.json({
            message: "Sync complete",
            processed: processedCount,
            created: createdCount
        });

    } catch (error) {
        console.error("Sync Main Error:", error);
        res.status(500).json({ message: "Server error during sync" });
    }
}

module.exports = {
    connectGmail,
    gmailCallback,
    getSettings,
    updateSettings,
    syncNow
};
