'use strict';

async function tableExists(qi, name) {
  return (await qi.showAllTables()).includes(name);
}
async function indexExists(qi, table, name) {
  return (await qi.showIndex(table)).some(i => i.name === name);
}

module.exports = {
    up: async (queryInterface, Sequelize) => {
        if (!(await tableExists(queryInterface, 'IntegrationMaps'))) {
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
                    references: { model: 'BankIntegrations', key: 'id' },
                    onDelete: 'CASCADE'
                },
                bankParameter: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                walletId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'wallets', key: 'id' },
                    onDelete: 'CASCADE'
                },
                defaultCategoryId: {
                    type: Sequelize.UUID,
                    allowNull: true,
                    references: { model: 'categories', key: 'id' },
                    onDelete: 'SET NULL'
                },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE }
            });
        }

        if (!(await indexExists(queryInterface, 'IntegrationMaps', 'unique_integration_bank_map'))) {
            await queryInterface.addIndex('IntegrationMaps', ['integrationId', 'bankParameter'], {
                unique: true,
                name: 'unique_integration_bank_map'
            });
        }
    },

    down: async (queryInterface) => {
        if (await tableExists(queryInterface, 'IntegrationMaps')) {
            await queryInterface.dropTable('IntegrationMaps');
        }
    }
};
