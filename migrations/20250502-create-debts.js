"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("debts", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      bankName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      totalDebt: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      monthlyPayment: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      monthlyRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
      },
      annualRate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
      },
      creditNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      linkedWalletId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("debts");
  },
};
