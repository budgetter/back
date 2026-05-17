'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const desc = await queryInterface.describeTable(tableName);
  return !!desc[columnName];
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'BankIntegrations', 'country'))) {
      await queryInterface.addColumn('BankIntegrations', 'country', {
        type: Sequelize.STRING(5),
        allowNull: false,
        defaultValue: 'CO',
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'BankIntegrations', 'country')) {
      await queryInterface.removeColumn('BankIntegrations', 'country');
    }
  },
};
