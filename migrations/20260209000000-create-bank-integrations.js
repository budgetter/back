'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('BankIntegrations', {
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
            provider: {
                type: Sequelize.ENUM('Gmail'),
                allowNull: false
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false
            },
            refreshToken: {
                type: Sequelize.TEXT, // Should be encrypted in a real app
                allowNull: false
            },
            lastSync: {
                type: Sequelize.DATE
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
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

        // One integration per provider per user
        await queryInterface.addIndex('BankIntegrations', ['userId', 'provider'], {
            unique: true,
            name: 'unique_user_provider_integration'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('BankIntegrations');
    }
};
