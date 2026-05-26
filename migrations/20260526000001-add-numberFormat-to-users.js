'use strict';

async function columnExists(queryInterface, table, col) {
  const desc = await queryInterface.describeTable(table);
  return !!desc[col];
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'users', 'numberFormat'))) {
      await queryInterface.addColumn('users', 'numberFormat', {
        type: Sequelize.ENUM('full', 'short', 'no_decimals'),
        allowNull: false,
        defaultValue: 'full',
        comment: 'full = 14,000.00 | short = 14K | no_decimals = 14,000',
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'users', 'numberFormat')) {
      await queryInterface.removeColumn('users', 'numberFormat');
    }
  },
};
