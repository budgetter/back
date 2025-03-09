const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Debt = sequelize.define('Debt', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  principal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  interestRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  term: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  monthlyPayment: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'debts',
  timestamps: true,
});

module.exports = Debt;
