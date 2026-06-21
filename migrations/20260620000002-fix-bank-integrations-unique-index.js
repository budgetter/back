'use strict';

async function indexExists(qi, table, name) {
  return (await qi.showIndex(table)).some(i => i.name === name);
}

module.exports = {
  up: async (queryInterface) => {
    // Create new index FIRST — MySQL requires an index starting with userId
    // to satisfy the FK constraint (userId → users.id). The new index covers this.
    if (!(await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_email_integration'))) {
      await queryInterface.addIndex('BankIntegrations', ['userId', 'provider', 'email'], {
        unique: true,
        name: 'unique_user_provider_email_integration'
      });
    }

    // Now safe to remove old index — new one satisfies the FK requirement
    if (await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_integration')) {
      await queryInterface.removeIndex('BankIntegrations', 'unique_user_provider_integration');
    }
  },

  down: async (queryInterface) => {
    // Restore old index first to satisfy FK before dropping new one
    if (!(await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_integration'))) {
      await queryInterface.addIndex('BankIntegrations', ['userId', 'provider'], {
        unique: true,
        name: 'unique_user_provider_integration'
      });
    }

    if (await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_email_integration')) {
      await queryInterface.removeIndex('BankIntegrations', 'unique_user_provider_email_integration');
    }
  }
};
