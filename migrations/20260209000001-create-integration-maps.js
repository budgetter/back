'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('IntegrationMaps', {
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
            bankParameter: {
                type: Sequelize.STRING, // e.g., 'Bancolombia', 'Colpatria', 'Davivienda'
                allowNull: false
            },
            walletId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'Wallets',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            defaultCategoryId: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'categories',
                    key: 'id'
                },
                onDelete: 'SET NULL'
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

        await queryInterface.addIndex('IntegrationMaps', ['integrationId', 'bankParameter'], {
            unique: true,
            name: 'unique_integration_bank_map'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('IntegrationMaps');
    }
};
