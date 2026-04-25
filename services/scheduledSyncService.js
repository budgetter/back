const cron = require('node-cron');
const { BankIntegration, IntegrationMap } = require('../models');
const { Op } = require('sequelize');
const { performSync } = require('./performSync');

/**
 * Generates a random jitter value between 0 and 3,600,000 milliseconds (0 to 60 minutes).
 * Used to distribute Gmail API load across time so all integrations don't sync simultaneously.
 *
 * @returns {number} Random jitter in milliseconds, in the range [0, 3600000]
 */
function generateJitter() {
    return Math.floor(Math.random() * 3600001); // 0 to 3,600,000 inclusive
}

/**
 * Runs a single sync cycle for all eligible (active + has refresh token) integrations.
 * Each integration is processed independently with random jitter to distribute API load.
 * Failures in one integration do not block processing of others.
 */
async function runSyncCycle() {
    const cycleStartTime = new Date();
    console.log(`[ScheduledSync] Sync cycle started at ${cycleStartTime.toISOString()}`);

    let integrations;
    try {
        integrations = await BankIntegration.findAll({
            where: {
                isActive: true,
                refreshToken: {
                    [Op.and]: [
                        { [Op.ne]: '' },
                        { [Op.ne]: null }
                    ]
                }
            },
            include: [{ model: IntegrationMap }]
        });
    } catch (err) {
        console.error('[ScheduledSync] Failed to query integrations:', err.message);
        return;
    }

    console.log(`[ScheduledSync] Found ${integrations.length} eligible integration(s)`);

    if (integrations.length === 0) {
        console.log('[ScheduledSync] No eligible integrations. Cycle complete.');
        return;
    }

    // Schedule each integration with random jitter
    const syncPromises = integrations.map((integration) => {
        const jitter = generateJitter();
        console.log(`[ScheduledSync] Integration ${integration.id} (${integration.email}) scheduled with ${Math.round(jitter / 1000)}s jitter`);

        return new Promise((resolve) => {
            setTimeout(async () => {
                const integrationStartTime = new Date();
                console.log(`[ScheduledSync] Starting sync for integration ${integration.id} (${integration.email}) at ${integrationStartTime.toISOString()}`);

                try {
                    const result = await performSync(integration, integration.userId);
                    const integrationEndTime = new Date();

                    // Handle token errors — mark inactive and continue
                    if (result.requiresReauth) {
                        console.warn(`[ScheduledSync] Integration ${integration.id} (${integration.email}) requires reauth — marked inactive`);
                        // performSync already marks it inactive, just log
                    } else {
                        // Update lastSync and compute nextScheduledSync
                        const nextJitter = generateJitter();
                        const eightHoursMs = 8 * 60 * 60 * 1000;
                        const nextSync = new Date(Date.now() + eightHoursMs + nextJitter);

                        integration.lastSync = new Date();
                        integration.nextScheduledSync = nextSync;
                        await integration.save();
                    }

                    console.log(`[ScheduledSync] Sync complete for integration ${integration.id} (${integration.email}):`, {
                        startTime: integrationStartTime.toISOString(),
                        endTime: integrationEndTime.toISOString(),
                        durationMs: integrationEndTime - integrationStartTime,
                        processed: result.processed,
                        created: result.created,
                        skipped: result.skipped,
                        failed: result.failed,
                        requiresReauth: result.requiresReauth
                    });
                } catch (err) {
                    const integrationEndTime = new Date();
                    console.error(`[ScheduledSync] Error syncing integration ${integration.id} (${integration.email}):`, {
                        startTime: integrationStartTime.toISOString(),
                        endTime: integrationEndTime.toISOString(),
                        error: err.message
                    });
                }

                resolve();
            }, jitter);
        });
    });

    // Wait for all integrations to complete (each runs independently)
    await Promise.all(syncPromises);

    const cycleEndTime = new Date();
    console.log(`[ScheduledSync] Sync cycle completed at ${cycleEndTime.toISOString()} (duration: ${cycleEndTime - cycleStartTime}ms)`);
}

/**
 * Starts the scheduled sync cron job that runs every 8 hours.
 * Cron expression: '0 *​/8 * * *' — runs at minute 0 of every 8th hour (00:00, 08:00, 16:00).
 *
 * Should be called once during server startup after database initialization.
 */
function startScheduledSync() {
    try {
        cron.schedule('0 */8 * * *', () => {
            console.log('[ScheduledSync] Cron triggered — starting sync cycle');
            runSyncCycle().catch((err) => {
                console.error('[ScheduledSync] Unexpected error in sync cycle:', err.message);
            });
        });
        console.log('[ScheduledSync] Scheduled sync initialized — runs every 8 hours (0 */8 * * *)');
    } catch (err) {
        console.error('[ScheduledSync] Failed to start scheduled sync:', err.message);
    }
}

module.exports = { startScheduledSync, generateJitter, runSyncCycle };
