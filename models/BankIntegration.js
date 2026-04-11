const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BankIntegration = sequelize.define('BankIntegration', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    provider: {
        type: DataTypes.ENUM('Gmail'),
        allowNull: false,
        defaultValue: 'Gmail'
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    refreshToken: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    lastSync: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    }
}, {
    tableName: 'BankIntegrations',
    timestamps: true,
});

module.exports = BankIntegration;
