const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RecurrentPayment = sequelize.define('RecurrentPayment', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  frequency: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'),
    allowNull: false,
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  nextPaymentDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  tableName: 'recurrent_payments',
  timestamps: true,
});

module.exports = RecurrentPayment;
