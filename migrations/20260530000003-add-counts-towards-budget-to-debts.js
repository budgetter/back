"use strict";

async function columnExists(queryInterface, tableName, columnName) {
  const desc = await queryInterface.describeTable(tableName);
  return !!desc[columnName];
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await columnExists(queryInterface, "debts", "countsTowardsBudget"))) {
      await queryInterface.addColumn("debts", "countsTowardsBudget", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },
  down: async (queryInterface) => {
    if (await columnExists(queryInterface, "debts", "countsTowardsBudget")) {
      await queryInterface.removeColumn("debts", "countsTowardsBudget");
    }
  },
};
