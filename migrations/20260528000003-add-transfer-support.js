'use strict';

async function columnExists(queryInterface, table, column) {
  const desc = await queryInterface.describeTable(table);
  return !!desc[column];
}

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(table);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add 'transfer' to transactions.type ENUM
    await queryInterface.changeColumn('transactions', 'type', {
      type: Sequelize.ENUM('expense', 'income', 'transfer'),
      allowNull: false,
    });

    // 2. Add excludeFromBudget column
    if (!(await columnExists(queryInterface, 'transactions', 'excludeFromBudget'))) {
      await queryInterface.addColumn('transactions', 'excludeFromBudget', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    // 3. Create transaction_links table
    if (!(await tableExists(queryInterface, 'transaction_links'))) {
      await queryInterface.createTable('transaction_links', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        transactionId: {
          type: Sequelize.UUID,
          allowNull: false,
          unique: true,
          references: { model: 'transactions', key: 'id' },
          onDelete: 'CASCADE',
        },
        linkType: {
          type: Sequelize.ENUM('transfer', 'debt_payment'),
          allowNull: false,
        },
        toWalletId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'wallets', key: 'id' },
          onDelete: 'SET NULL',
        },
        debtId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'debts', key: 'id' },
          onDelete: 'SET NULL',
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transaction_links');

    if (await columnExists(queryInterface, 'transactions', 'excludeFromBudget')) {
      await queryInterface.removeColumn('transactions', 'excludeFromBudget');
    }

    await queryInterface.changeColumn('transactions', 'type', {
      type: Sequelize.ENUM('expense', 'income'),
      allowNull: false,
    });
  },
};
