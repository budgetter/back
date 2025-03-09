const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BudgetCategoryPlan = sequelize.define('BudgetCategoryPlan', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  plannedAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'budget_category_plans',
  timestamps: true,
});

module.exports = BudgetCategoryPlan;
