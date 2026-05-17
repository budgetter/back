const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SyncHistory = sequelize.define('SyncHistory', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  integrationId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  processed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  created: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  skipped: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  failed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  syncedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'SyncHistories',
  timestamps: true,
});

module.exports = SyncHistory;
