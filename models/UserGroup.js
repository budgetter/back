const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserGroup = sequelize.define('UserGroup', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  // The foreign keys (UserId and GroupId) will be added via associations.
  roleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'roles',
      key: 'id'
    }
  },
}, {
  tableName: 'user_groups',
  timestamps: true,
});

module.exports = UserGroup;
