const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Budget = sequelize.define(
  "Budget",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "New Budget",
    },
    ownerType: {
      type: DataTypes.ENUM("User", "Group"),
      allowNull: false,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    totalBudget: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    tableName: "budgets",
    timestamps: true,
  }
);

Budget.associate = (models) => {
  Budget.hasMany(models.BudgetSection, {
    foreignKey: "budgetId",
    as: "sections",
  });
};

module.exports = Budget;
