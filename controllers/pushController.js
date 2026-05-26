const { PushSubscription } = require('../models');
const { v4: uuidv4 } = require('uuid');

const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Invalid subscription data' });
    }

    await PushSubscription.findOrCreate({
      where: { userId: req.user.id, endpoint },
      defaults: { id: uuidv4(), userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    return res.json({ message: 'Subscribed' });
  } catch (error) {
    console.error('Push subscribe error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.destroy({ where: { userId: req.user.id, endpoint } });
    return res.json({ message: 'Unsubscribed' });
  } catch (error) {
    console.error('Push unsubscribe error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getStatus = async (req, res) => {
  try {
    const count = await PushSubscription.count({ where: { userId: req.user.id } });
    return res.json({ subscribed: count > 0, count });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { subscribe, unsubscribe, getStatus };
