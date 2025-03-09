const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('expense', 'income'),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'categories',
  timestamps: true,
});

module.exports = Category;
