const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Wallet = sequelize.define(
  "Wallet",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    icon: {
      type: DataTypes.STRING, // Emoji or icon string
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    goalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
  },
  {
    tableName: "wallets",
    timestamps: true,
  }
);

module.exports = Wallet;
