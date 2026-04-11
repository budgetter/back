const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IntegrationMap = sequelize.define('IntegrationMap', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    integrationId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    bankParameter: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Identifier for the bank parser, e.g. Bancolombia, Colpatria'
    },
    walletId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    defaultCategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Default category if one cannot be inferred from the email'
    }
}, {
    tableName: 'IntegrationMaps',
    timestamps: true,
});

module.exports = IntegrationMap;
