'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wallets', 'isDefault', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('wallets', 'color', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('wallets', 'goalAmount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('wallets', 'isDefault');
    await queryInterface.removeColumn('wallets', 'color');
    await queryInterface.removeColumn('wallets', 'goalAmount');
  }
};
