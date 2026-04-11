const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OAuthNonce = sequelize.define('OAuthNonce', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    nonce: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
}, {
    tableName: 'OAuthNonces',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['nonce'],
        },
        {
            fields: ['expiresAt'],
        },
    ],
});

module.exports = OAuthNonce;
