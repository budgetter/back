const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  budgetSplitMode: {
    type: DataTypes.ENUM('total', 'split_only'),
    allowNull: false,
    defaultValue: 'total',
    comment: 'total = full amount counts in budget, split_only = only your split portion counts',
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // Additional profile fields can be added here.
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
