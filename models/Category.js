const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("expense", "income"),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    translationKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    color1: {
      type: DataTypes.STRING(7),
      allowNull: true,
    },
    color2: {
      type: DataTypes.STRING(7),
      allowNull: true,
    },
  },
  {
    tableName: "categories",
    timestamps: true,
  }
);

module.exports = Category;
