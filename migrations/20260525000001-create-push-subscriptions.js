'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'PushSubscriptions'))) {
      await queryInterface.createTable('PushSubscriptions', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        endpoint: { type: Sequelize.TEXT, allowNull: false },
        p256dh: { type: Sequelize.STRING, allowNull: false },
        auth: { type: Sequelize.STRING, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'PushSubscriptions')) {
      await queryInterface.dropTable('PushSubscriptions');
    }
  },
};
