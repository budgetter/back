const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  // Foreign keys for Role and Permission will be added via associations.
}, {
  tableName: 'role_permissions',
  timestamps: true,
});

module.exports = RolePermission;
