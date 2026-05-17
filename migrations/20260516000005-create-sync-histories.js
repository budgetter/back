'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'SyncHistories'))) {
      await queryInterface.createTable('SyncHistories', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        integrationId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'BankIntegrations', key: 'id' },
          onDelete: 'CASCADE',
        },
        processed: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        created: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        skipped: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        failed: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        details: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        syncedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'SyncHistories')) {
      await queryInterface.dropTable('SyncHistories');
    }
  },
};
