const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Debt = sequelize.define(
  "Debt",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    bankName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    totalDebt: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    monthlyPayment: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    monthlyRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    annualRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    creditNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    linkedWalletId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    paymentDay: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    countsTowardsBudget: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "debts",
    timestamps: true,
  }
);

module.exports = Debt;
