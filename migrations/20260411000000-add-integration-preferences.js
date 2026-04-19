'use strict';

async function columnExists(qi, table, col) {
  const desc = await qi.describeTable(table);
  return !!desc[col];
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'BankIntegrations', 'syncDaysBack'))) {
      await queryInterface.addColumn('BankIntegrations', 'syncDaysBack', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30
      });
    }

    if (!(await columnExists(queryInterface, 'BankIntegrations', 'unreadOnly'))) {
      await queryInterface.addColumn('BankIntegrations', 'unreadOnly', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!(await columnExists(queryInterface, 'BankIntegrations', 'markAsRead'))) {
      await queryInterface.addColumn('BankIntegrations', 'markAsRead', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!(await columnExists(queryInterface, 'BankIntegrations', 'addLabel'))) {
      await queryInterface.addColumn('BankIntegrations', 'addLabel', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
  },

  async down(queryInterface) {
    for (const col of ['syncDaysBack', 'unreadOnly', 'markAsRead', 'addLabel']) {
      if (await columnExists(queryInterface, 'BankIntegrations', col)) {
        await queryInterface.removeColumn('BankIntegrations', col);
      }
    }
  }
};
