'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('OAuthNonces', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4
            },
            userId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'Users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            nonce: {
                type: Sequelize.STRING(64),
                allowNull: false,
                unique: true
            },
            expiresAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // Unique index on nonce for fast lookup during validation
        await queryInterface.addIndex('OAuthNonces', ['nonce'], {
            unique: true,
            name: 'unique_oauth_nonce'
        });

        // Index on expiresAt for cleanup queries
        await queryInterface.addIndex('OAuthNonces', ['expiresAt'], {
            name: 'idx_oauth_nonces_expires_at'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('OAuthNonces');
    }
};
