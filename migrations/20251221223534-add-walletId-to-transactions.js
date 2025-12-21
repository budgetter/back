'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add walletId to transactions
    await queryInterface.addColumn('transactions', 'walletId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'wallets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add fields to recurrent_payments if they don't exist
    // Check for existence might be better but usually migration assumes they are missing
    await queryInterface.addColumn('recurrent_payments', 'walletId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'wallets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('recurrent_payments', 'description', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('recurrent_payments', 'type', {
      type: Sequelize.ENUM('expense', 'income'),
      allowNull: false,
      defaultValue: 'expense'
    });

    // Frequency enum was updated in the model, but DB might still have the old one.
    // In MySQL, modifying ENUM usually requires changeColumn.
    await queryInterface.changeColumn('recurrent_payments', 'frequency', {
      type: Sequelize.ENUM(
        "daily",
        "weekly",
        "weekdays",
        "biweekly",
        "monthly",
        "bimonthly",
        "semiannually",
        "yearly"
      ),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('transactions', 'walletId');
    await queryInterface.removeColumn('recurrent_payments', 'walletId');
    await queryInterface.removeColumn('recurrent_payments', 'description');
    await queryInterface.removeColumn('recurrent_payments', 'type');
    // Reverting ENUM is tricky, usually left as is or reverted to original
    await queryInterface.changeColumn('recurrent_payments', 'frequency', {
      type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'yearly'),
      allowNull: false
    });
  }
};
