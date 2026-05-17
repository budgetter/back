const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserCategoryMapping = sequelize.define('UserCategoryMapping', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  companyPattern: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'UserCategoryMappings',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['userId', 'companyPattern'], name: 'ucm_user_pattern_unique' },
  ],
});

module.exports = UserCategoryMapping;
