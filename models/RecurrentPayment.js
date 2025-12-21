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
    type: DataTypes.ENUM(
      "daily",
      "weekly",
      "weekdays",
      "biweekly",
      "monthly",
      "bimonthly",
      "semiannually",
      "yearly"
    ),
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
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM("expense", "income"),
    allowNull: false,
    defaultValue: "expense",
  },
  walletId: {
    type: DataTypes.UUID,
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
