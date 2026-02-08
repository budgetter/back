const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  inviteCode: {
    type: DataTypes.STRING(6),
    allowNull: true,
    unique: true,
  },
  creatorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'groups',
  timestamps: true,
});

module.exports = Group;
