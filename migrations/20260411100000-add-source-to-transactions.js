'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transactions', 'source', {
      type: Sequelize.ENUM('manual', 'email_sync'),
      allowNull: false,
      defaultValue: 'manual',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('transactions', 'source');
  }
};
