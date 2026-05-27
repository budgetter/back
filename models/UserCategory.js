const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserCategory = sequelize.define(
  "UserCategory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    customName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    customIcon: {
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
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    hidden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "user_categories",
    timestamps: true,
  }
);

module.exports = UserCategory;
