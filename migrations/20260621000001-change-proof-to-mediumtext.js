'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('transaction_splits');
    if (!desc.proofOfPayment) return; // Column doesn't exist
    // Only alter if it's still VARCHAR
    if (desc.proofOfPayment.type.toLowerCase().includes('varchar')) {
      await queryInterface.changeColumn('transaction_splits', 'proofOfPayment', {
        type: Sequelize.TEXT('medium'),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('transaction_splits');
    if (!desc.proofOfPayment) return;
    await queryInterface.changeColumn('transaction_splits', 'proofOfPayment', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};
