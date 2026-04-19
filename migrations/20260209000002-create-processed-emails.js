'use strict';

async function tableExists(qi, name) {
  return (await qi.showAllTables()).includes(name);
}
async function indexExists(qi, table, name) {
  return (await qi.showIndex(table)).some(i => i.name === name);
}

module.exports = {
    up: async (queryInterface, Sequelize) => {
        if (!(await tableExists(queryInterface, 'ProcessedEmails'))) {
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
                    references: { model: 'BankIntegrations', key: 'id' },
                    onDelete: 'CASCADE'
                },
                messageId: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE }
            });
        }

        if (!(await indexExists(queryInterface, 'ProcessedEmails', 'unique_processed_email'))) {
            await queryInterface.addIndex('ProcessedEmails', ['integrationId', 'messageId'], {
                unique: true,
                name: 'unique_processed_email'
            });
        }
    },

    down: async (queryInterface) => {
        if (await tableExists(queryInterface, 'ProcessedEmails')) {
            await queryInterface.dropTable('ProcessedEmails');
        }
    }
};
