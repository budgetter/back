"use strict";

async function columnExists(queryInterface, tableName, columnName) {
  const desc = await queryInterface.describeTable(tableName);
  return !!desc[columnName];
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await columnExists(queryInterface, "debts", "paymentDay"))) {
      await queryInterface.addColumn("debts", "paymentDay", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface) => {
    if (await columnExists(queryInterface, "debts", "paymentDay")) {
      await queryInterface.removeColumn("debts", "paymentDay");
    }
  },
};
