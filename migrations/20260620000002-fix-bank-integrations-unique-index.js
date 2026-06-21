'use strict';

async function indexExists(qi, table, name) {
  return (await qi.showIndex(table)).some(i => i.name === name);
}

module.exports = {
  up: async (queryInterface) => {
    // Remove old unique index on (userId, provider)
    if (await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_integration')) {
      await queryInterface.removeIndex('BankIntegrations', 'unique_user_provider_integration');
    }

    // Add new unique index on (userId, provider, email)
    if (!(await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_email_integration'))) {
      await queryInterface.addIndex('BankIntegrations', ['userId', 'provider', 'email'], {
        unique: true,
        name: 'unique_user_provider_email_integration'
      });
    }
  },

  down: async (queryInterface) => {
    if (await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_email_integration')) {
      await queryInterface.removeIndex('BankIntegrations', 'unique_user_provider_email_integration');
    }

    if (!(await indexExists(queryInterface, 'BankIntegrations', 'unique_user_provider_integration'))) {
      await queryInterface.addIndex('BankIntegrations', ['userId', 'provider'], {
        unique: true,
        name: 'unique_user_provider_integration'
      });
    }
  }
};
