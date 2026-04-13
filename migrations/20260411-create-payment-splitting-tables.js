'use strict';

/**
 * Helper: check if a table exists in the database.
 */
async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

/**
 * Helper: check if a column exists on a table.
 */
async function columnExists(queryInterface, tableName, columnName) {
  const description = await queryInterface.describeTable(tableName);
  return !!description[columnName];
}

/**
 * Helper: check if an index exists on a table.
 */
async function indexExists(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((idx) => idx.name === indexName);
}

module.exports = {
  up: async (queryInterface, Sequelize) => {

    // 1. Create split_invitations table
    if (!(await tableExists(queryInterface, 'split_invitations'))) {
      await queryInterface.createTable('split_invitations', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
        },
        transactionId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'transactions', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        email: { type: Sequelize.STRING, allowNull: false },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        splitMode: {
          type: Sequelize.ENUM('even', 'custom'),
          allowNull: false,
          defaultValue: 'even',
        },
        status: {
          type: Sequelize.ENUM('pending', 'resolved', 'cancelled'),
          allowNull: false,
          defaultValue: 'pending',
        },
        invitedBy: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        resolvedUserId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        resolvedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE },
      });
    }

    // 2. Create friend_contacts table
    if (!(await tableExists(queryInterface, 'friend_contacts'))) {
      await queryInterface.createTable('friend_contacts', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        contactUserId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        contactEmail: { type: Sequelize.STRING, allowNull: false },
        contactName: { type: Sequelize.STRING, allowNull: true },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE },
      });
    }

    // Add unique index on (userId, contactEmail)
    if (!(await indexExists(queryInterface, 'friend_contacts', 'unique_user_contact_email'))) {
      await queryInterface.addIndex('friend_contacts', ['userId', 'contactEmail'], {
        unique: true,
        name: 'unique_user_contact_email',
      });
    }

    // 3. Create recurrent_split_configs table
    if (!(await tableExists(queryInterface, 'recurrent_split_configs'))) {
      await queryInterface.createTable('recurrent_split_configs', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
        },
        recurrentPaymentId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'recurrent_payments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        splitMode: {
          type: Sequelize.ENUM('even', 'custom'),
          allowNull: false,
          defaultValue: 'even',
        },
        participants: { type: Sequelize.JSON, allowNull: false },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE },
      });
    }

    // 4. Alter transaction_splits table — add columns only if they don't exist
    if (!(await columnExists(queryInterface, 'transaction_splits', 'splitMode'))) {
      await queryInterface.addColumn('transaction_splits', 'splitMode', {
        type: Sequelize.ENUM('even', 'custom'),
        allowNull: false,
        defaultValue: 'even',
      });
    }

    if (!(await columnExists(queryInterface, 'transaction_splits', 'invitationId'))) {
      await queryInterface.addColumn('transaction_splits', 'invitationId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'split_invitations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // Make userId nullable (safe to run even if already nullable)
    await queryInterface.changeColumn('transaction_splits', 'userId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert transaction_splits alterations
    if (await columnExists(queryInterface, 'transaction_splits', 'invitationId')) {
      await queryInterface.removeColumn('transaction_splits', 'invitationId');
    }

    if (await columnExists(queryInterface, 'transaction_splits', 'splitMode')) {
      await queryInterface.removeColumn('transaction_splits', 'splitMode');
    }

    await queryInterface.changeColumn('transaction_splits', 'userId', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    // Drop tables in reverse dependency order
    if (await tableExists(queryInterface, 'recurrent_split_configs')) {
      await queryInterface.dropTable('recurrent_split_configs');
    }
    if (await tableExists(queryInterface, 'friend_contacts')) {
      await queryInterface.dropTable('friend_contacts');
    }
    if (await tableExists(queryInterface, 'split_invitations')) {
      await queryInterface.dropTable('split_invitations');
    }
  },
};
