const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TransactionLink = sequelize.define('TransactionLink', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  transactionId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  linkType: {
    type: DataTypes.ENUM('transfer', 'debt_payment'),
    allowNull: false,
  },
  toWalletId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  debtId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'transaction_links',
  timestamps: true,
});

module.exports = TransactionLink;
