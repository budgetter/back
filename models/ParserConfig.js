const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ParserConfig = sequelize.define('ParserConfig', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  country: {
    type: DataTypes.STRING(5),
    allowNull: false,
  },
  bankName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  senderEmail: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  regexPatterns: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'ParserConfigs',
  timestamps: true,
});

module.exports = ParserConfig;
