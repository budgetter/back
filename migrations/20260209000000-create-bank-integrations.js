'use strict';

async function tableExists(qi, name) {
  return (await qi.showAllTables()).includes(name);
}
async function indexExists(qi, table, name) {
  return (await qi.showIndex(table)).some(i => i.name === name);
}

module.exports = {
    up: async (queryInterface, Sequelize) => {
        if (!(await tableExists(queryInterface, 'BankIntegrations'))) {
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
                    references: { model: 'users', key: 'id' },
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
                    type: Sequelize.TEXT,
                    allowNull: false
                },
                lastSync: { type: Sequelize.DATE },
                isActive: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: true
                },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE }
            });
        }

        if (!(await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_integration'))) {
            await queryInterface.addIndex('BankIntegrations', ['userId', 'provider'], {
                unique: true,
                name: 'unique_user_provider_integration'
            });
        }
    },

    down: async (queryInterface) => {
        if (await tableExists(queryInterface, 'BankIntegrations')) {
            await queryInterface.dropTable('BankIntegrations');
        }
    }
};
