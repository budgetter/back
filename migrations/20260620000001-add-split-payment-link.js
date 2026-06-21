'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'split_payment' to linkType ENUM on transaction_links
    await queryInterface.changeColumn('transaction_links', 'linkType', {
      type: Sequelize.ENUM('transfer', 'debt_payment', 'split_payment'),
      allowNull: false,
    });

    // Create split_payment_links table
    await queryInterface.createTable('split_payment_links', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      transactionLinkId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'transaction_links', key: 'id' },
        onDelete: 'CASCADE',
      },
      splitId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'transaction_splits', key: 'id' },
        onDelete: 'CASCADE',
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('split_payment_links');
    await queryInterface.changeColumn('transaction_links', 'linkType', {
      type: Sequelize.ENUM('transfer', 'debt_payment'),
      allowNull: false,
    });
  },
};
