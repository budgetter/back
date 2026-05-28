'use strict';

module.exports = {
  async up(queryInterface) {
    // Remove the FK constraint that points categoryId → categories.id
    // We now store user_categories.id in this column
    try {
      await queryInterface.removeConstraint('UserCategoryMappings', 'usercategorymappings_ibfk_2');
    } catch (e) {
      // Constraint name might differ, try alternate
      try {
        await queryInterface.removeConstraint('UserCategoryMappings', 'UserCategoryMappings_categoryId_foreign_idx');
      } catch (e2) {
        // List and remove any FK on categoryId
        const indexes = await queryInterface.showIndex('UserCategoryMappings');
        console.log('Indexes:', indexes.map(i => i.name));
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addConstraint('UserCategoryMappings', {
      fields: ['categoryId'],
      type: 'foreign key',
      name: 'usercategorymappings_ibfk_2',
      references: { table: 'categories', field: 'id' },
      onDelete: 'CASCADE',
    });
  },
};
