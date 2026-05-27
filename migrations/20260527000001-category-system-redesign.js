'use strict';

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(table);
}

async function columnExists(queryInterface, table, col) {
  const desc = await queryInterface.describeTable(table);
  return !!desc[col];
}

async function indexExists(queryInterface, table, indexName) {
  const indexes = await queryInterface.showIndex(table);
  return indexes.some(i => i.name === indexName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // --- 1. Add columns to categories table ---
    if (!(await columnExists(queryInterface, 'categories', 'parentId'))) {
      await queryInterface.addColumn('categories', 'parentId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!(await columnExists(queryInterface, 'categories', 'isSystem'))) {
      await queryInterface.addColumn('categories', 'isSystem', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!(await columnExists(queryInterface, 'categories', 'sortOrder'))) {
      await queryInterface.addColumn('categories', 'sortOrder', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!(await columnExists(queryInterface, 'categories', 'translationKey'))) {
      await queryInterface.addColumn('categories', 'translationKey', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'categories', 'color1'))) {
      await queryInterface.addColumn('categories', 'color1', {
        type: Sequelize.STRING(7),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'categories', 'color2'))) {
      await queryInterface.addColumn('categories', 'color2', {
        type: Sequelize.STRING(7),
        allowNull: true,
      });
    }

    // --- 2. Create user_categories table ---
    if (!(await tableExists(queryInterface, 'user_categories'))) {
      await queryInterface.createTable('user_categories', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        categoryId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'categories', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        customName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        customIcon: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        color1: {
          type: Sequelize.STRING(7),
          allowNull: true,
        },
        color2: {
          type: Sequelize.STRING(7),
          allowNull: true,
        },
        parentId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'user_categories', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        sortOrder: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        hidden: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    // --- 3. Indexes on user_categories ---
    if (!(await indexExists(queryInterface, 'user_categories', 'uc_userId'))) {
      await queryInterface.addIndex('user_categories', ['userId'], { name: 'uc_userId' });
    }
    if (!(await indexExists(queryInterface, 'user_categories', 'uc_userId_parentId'))) {
      await queryInterface.addIndex('user_categories', ['userId', 'parentId'], { name: 'uc_userId_parentId' });
    }
    if (!(await indexExists(queryInterface, 'user_categories', 'uc_userId_hidden'))) {
      await queryInterface.addIndex('user_categories', ['userId', 'hidden'], { name: 'uc_userId_hidden' });
    }

    // --- 4. Add userCategoryId to related tables ---
    const tables = ['transactions', 'budget_category_plans', 'recurrent_payments', 'debts'];
    for (const table of tables) {
      if (!(await columnExists(queryInterface, table, 'userCategoryId'))) {
        await queryInterface.addColumn(table, 'userCategoryId', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'user_categories', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        });
      }
    }
  },

  async down(queryInterface) {
    // Remove userCategoryId from related tables
    const tables = ['transactions', 'budget_category_plans', 'recurrent_payments', 'debts'];
    for (const table of tables) {
      if (await columnExists(queryInterface, table, 'userCategoryId')) {
        await queryInterface.removeColumn(table, 'userCategoryId');
      }
    }

    // Drop user_categories table
    if (await tableExists(queryInterface, 'user_categories')) {
      await queryInterface.dropTable('user_categories');
    }

    // Remove added columns from categories
    const cols = ['parentId', 'isSystem', 'sortOrder', 'translationKey', 'color1', 'color2'];
    for (const col of cols) {
      if (await columnExists(queryInterface, 'categories', col)) {
        await queryInterface.removeColumn('categories', col);
      }
    }
  },
};
