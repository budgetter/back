const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BudgetCategoryPlan = sequelize.define(
  "BudgetCategoryPlan",
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
    sectionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    plannedAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("income", "expense"),
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fixed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "budget_category_plans",
    timestamps: true,
  }
);

BudgetCategoryPlan.associate = (models) => {
  BudgetCategoryPlan.belongsTo(models.BudgetSection, {
    foreignKey: "sectionId",
    as: "section",
  });
};

module.exports = BudgetCategoryPlan;
