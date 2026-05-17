const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  type: {
    type: DataTypes.ENUM('expense', 'income'),
    allowNull: false,
  },
  walletId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  source: {
    type: DataTypes.ENUM('manual', 'email_sync'),
    allowNull: false,
    defaultValue: 'manual',
  },
  isDuplicate: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    { fields: ['UserId'] },
    { fields: ['GroupId'] },
    { fields: ['categoryId'] },
    { fields: ['walletId'] },
    { fields: ['date'] },
  ],
});

module.exports = Transaction;
