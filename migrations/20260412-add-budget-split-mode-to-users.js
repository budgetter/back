'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const description = await queryInterface.describeTable(tableName);
  return !!description[columnName];
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await columnExists(queryInterface, 'users', 'budgetSplitMode'))) {
      await queryInterface.addColumn('users', 'budgetSplitMode', {
        type: Sequelize.ENUM('total', 'split_only'),
        allowNull: false,
        defaultValue: 'total',
      });
    }
  },

  down: async (queryInterface) => {
    if (await columnExists(queryInterface, 'users', 'budgetSplitMode')) {
      await queryInterface.removeColumn('users', 'budgetSplitMode');
    }
  },
};
