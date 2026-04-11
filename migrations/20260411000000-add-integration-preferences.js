'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('BankIntegrations', 'syncDaysBack', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30
    });

    await queryInterface.addColumn('BankIntegrations', 'unreadOnly', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('BankIntegrations', 'markAsRead', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('BankIntegrations', 'addLabel', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('BankIntegrations', 'syncDaysBack');
    await queryInterface.removeColumn('BankIntegrations', 'unreadOnly');
    await queryInterface.removeColumn('BankIntegrations', 'markAsRead');
    await queryInterface.removeColumn('BankIntegrations', 'addLabel');
  }
};
