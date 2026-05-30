"use strict";

async function columnExists(queryInterface, tableName, columnName) {
  const desc = await queryInterface.describeTable(tableName);
  return !!desc[columnName];
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await columnExists(queryInterface, "budget_category_plans", "disabled"))) {
      await queryInterface.addColumn("budget_category_plans", "disabled", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },
  down: async (queryInterface) => {
    if (await columnExists(queryInterface, "budget_category_plans", "disabled")) {
      await queryInterface.removeColumn("budget_category_plans", "disabled");
    }
  },
};
