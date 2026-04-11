const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProcessedEmail = sequelize.define('ProcessedEmail', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    integrationId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: 'unique_processed_email' // Composite unique constraint handled in migration
    }
}, {
    tableName: 'ProcessedEmails',
    timestamps: true,
});

module.exports = ProcessedEmail;
