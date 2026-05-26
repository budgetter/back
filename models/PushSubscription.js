const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushSubscription = sequelize.define('PushSubscription', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false },
  endpoint: { type: DataTypes.TEXT, allowNull: false },
  p256dh: { type: DataTypes.STRING, allowNull: false },
  auth: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'PushSubscriptions',
  timestamps: true,
});

module.exports = PushSubscription;
