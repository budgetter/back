"use strict";

// The Debt model (back/models/Debt.js) declares categoryId and groupId, and
// existing databases have them (added by an old sequelize.sync() call before
// this table had migrations), but no migration ever created these columns.
// On a fresh database Debt.belongsTo(Category)/Debt.belongsTo(Group) fail
// because the columns don't exist. Same root cause as the missing baseline
// tables in 20250401000000-baseline-core-tables.js.

async function columnExists(queryInterface, tableName, columnName) {
  const desc = await queryInterface.describeTable(tableName);
  return !!desc[columnName];
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await columnExists(queryInterface, "debts", "categoryId"))) {
      await queryInterface.addColumn("debts", "categoryId", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, "debts", "groupId"))) {
      await queryInterface.addColumn("debts", "groupId", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface) => {
    if (await columnExists(queryInterface, "debts", "groupId")) {
      await queryInterface.removeColumn("debts", "groupId");
    }
    if (await columnExists(queryInterface, "debts", "categoryId")) {
      await queryInterface.removeColumn("debts", "categoryId");
    }
  },
};
