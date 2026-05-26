const webpush = require('web-push');
const { PushSubscription } = require('../models');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@budgetter.app'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Send push notification to all of a user's subscriptions.
 */
async function sendToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  const subscriptions = await PushSubscription.findAll({ where: { userId } });
  const message = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message
      );
    } catch (err) {
      // 410 Gone = subscription expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await sub.destroy();
      }
    }
  }
}

module.exports = { sendToUser };
