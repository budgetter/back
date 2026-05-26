const { schedule } = require("@netlify/functions");
const { Op } = require("sequelize");
const { BankIntegration, IntegrationMap } = require("../models");
const { performSync } = require("../services/performSync");

const handler = async () => {
  try {
    // Only sync integrations whose nextScheduledSync has passed (or is null = never synced)
    const integrations = await BankIntegration.findAll({
      where: {
        isActive: true,
        provider: "Gmail",
        [Op.or]: [
          { nextScheduledSync: { [Op.lte]: new Date() } },
          { nextScheduledSync: null },
        ],
      },
      include: [{ model: IntegrationMap }],
    });

    console.log(`[Scheduled Sync] ${integrations.length} integrations due for sync`);

    for (const integration of integrations) {
      try {
        const result = await performSync(integration, integration.userId);
        console.log(`[Scheduled Sync] ${integration.email}: created=${result.created}, skipped=${result.skipped}`);

        // Schedule next sync (8 hours + random jitter 0-60 min)
        const jitter = Math.floor(Math.random() * 3600000);
        integration.nextScheduledSync = new Date(Date.now() + 8 * 60 * 60 * 1000 + jitter);
        await integration.save();
      } catch (e) {
        console.error(`[Scheduled Sync] Error for ${integration.email}:`, e.message);
      }
    }
  } catch (error) {
    console.error("[Scheduled Sync] Fatal error:", error.message);
  }
};

// Check every hour for integrations that need syncing
exports.handler = schedule("0 * * * *", handler);
