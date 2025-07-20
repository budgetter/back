const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BudgetSection = sequelize.define(
  "BudgetSection",
  {
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
  },
  {
    tableName: "budget_sections",
    timestamps: true,
  }
);

BudgetSection.associate = (models) => {
  BudgetSection.belongsTo(models.Budget, {
    foreignKey: "budgetId",
    as: "budget",
  });
  BudgetSection.hasMany(models.BudgetCategoryPlan, {
    foreignKey: "sectionId",
    as: "BudgetCategoryPlans",
  });
};

module.exports = BudgetSection;
