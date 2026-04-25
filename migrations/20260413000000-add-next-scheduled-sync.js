'use strict';

async function columnExists(qi, table, col) {
  const desc = await qi.describeTable(table);
  return !!desc[col];
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'BankIntegrations', 'nextScheduledSync'))) {
      await queryInterface.addColumn('BankIntegrations', 'nextScheduledSync', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'BankIntegrations', 'nextScheduledSync')) {
      await queryInterface.removeColumn('BankIntegrations', 'nextScheduledSync');
    }
  }
};
