"use strict";

async function columnExists(queryInterface, tableName, columnName) {
  const desc = await queryInterface.describeTable(tableName);
  return !!desc[columnName];
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await columnExists(queryInterface, "debts", "bankName"))) {
      await queryInterface.addColumn("debts", "bankName", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, "debts", "totalDebt"))) {
      await queryInterface.addColumn("debts", "totalDebt", {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, "debts", "monthlyRate"))) {
      await queryInterface.addColumn("debts", "monthlyRate", {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, "debts", "annualRate"))) {
      await queryInterface.addColumn("debts", "annualRate", {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, "debts", "creditNumber"))) {
      await queryInterface.addColumn("debts", "creditNumber", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, "debts", "linkedWalletId"))) {
      await queryInterface.addColumn("debts", "linkedWalletId", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface) => {
    const cols = ["bankName", "totalDebt", "monthlyRate", "annualRate", "creditNumber", "linkedWalletId"];
    for (const col of cols) {
      if (await columnExists(queryInterface, "debts", col)) {
        await queryInterface.removeColumn("debts", col);
      }
    }
  },
};
