'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const desc = await queryInterface.describeTable(tableName);
  return !!desc[columnName];
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'users', 'isAdmin'))) {
      await queryInterface.addColumn('users', 'isAdmin', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'users', 'isAdmin')) {
      await queryInterface.removeColumn('users', 'isAdmin');
    }
  },
};
