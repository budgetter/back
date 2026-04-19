'use strict';

async function columnExists(qi, table, col) {
  const desc = await qi.describeTable(table);
  return !!desc[col];
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'transactions', 'source'))) {
      await queryInterface.addColumn('transactions', 'source', {
        type: Sequelize.ENUM('manual', 'email_sync'),
        allowNull: false,
        defaultValue: 'manual',
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'transactions', 'source')) {
      await queryInterface.removeColumn('transactions', 'source');
    }
  }
};
