const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SplitPaymentLink = sequelize.define('SplitPaymentLink', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  transactionLinkId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  splitId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'split_payment_links',
  timestamps: true,
});

module.exports = SplitPaymentLink;
