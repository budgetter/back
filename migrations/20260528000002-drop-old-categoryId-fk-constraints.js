'use strict';

module.exports = {
  async up(queryInterface) {
    // Remove FK constraints on categoryId from all tables
    // These are no longer used - everything uses userCategoryId now
    const constraints = [
      { table: 'transactions', name: 'transactions_ibfk_2' },
      { table: 'budget_category_plans', name: 'budget_category_plans_ibfk_3' },
      { table: 'recurrent_payments', name: 'recurrent_payments_ibfk_1' },
    ];

    for (const { table, name } of constraints) {
      try {
        await queryInterface.removeConstraint(table, name);
        console.log(`Removed FK ${name} from ${table}`);
      } catch (e) {
        console.log(`FK ${name} on ${table} not found or already removed: ${e.message}`);
      }
    }
  },

  async down() {
    // Not reversible - constraints pointed to old system
  },
};
