'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('ProcessedEmails', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4
            },
            integrationId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'BankIntegrations',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            messageId: {
                type: Sequelize.STRING,
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

        await queryInterface.addIndex('ProcessedEmails', ['integrationId', 'messageId'], {
            unique: true,
            name: 'unique_processed_email'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('ProcessedEmails');
    }
};
