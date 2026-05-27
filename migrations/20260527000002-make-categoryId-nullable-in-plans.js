'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('budget_category_plans', 'categoryId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('budget_category_plans', 'categoryId', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },
};
