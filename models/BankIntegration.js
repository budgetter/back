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
    },
    syncDaysBack: {
        type: DataTypes.INTEGER,
        defaultValue: 30,
        validate: {
            min: 1,
            max: 90,
        },
    },
    unreadOnly: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    markAsRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    addLabel: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    nextScheduledSync: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
    country: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: 'CO',
    }
}, {
    tableName: 'BankIntegrations',
    timestamps: true,
});

module.exports = BankIntegration;
