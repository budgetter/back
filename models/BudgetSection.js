const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BudgetSection = sequelize.define('BudgetSection', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  budgetId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'budget_sections',
  timestamps: true,
});

module.exports = BudgetSection;
