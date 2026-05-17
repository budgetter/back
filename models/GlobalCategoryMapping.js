const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GlobalCategoryMapping = sequelize.define('GlobalCategoryMapping', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  country: {
    type: DataTypes.STRING(5),
    allowNull: false,
  },
  companyPattern: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  categoryName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'GlobalCategoryMappings',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['country', 'companyPattern'], name: 'gcm_country_pattern_unique' },
  ],
});

module.exports = GlobalCategoryMapping;
