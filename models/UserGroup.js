const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserGroup = sequelize.define("UserGroup", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  // Foreign keys for User and Group will be added via associations
  // Plus a Role reference:
  roleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "Roles",
      key: "id",
    },
  },
});

module.exports = UserGroup;
