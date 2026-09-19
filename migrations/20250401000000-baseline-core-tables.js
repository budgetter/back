'use strict';

// These 12 tables predate the migration system: they were originally created by
// Sequelize's sync() in an early version of this project and never captured as a
// migration. Existing dev/prod databases already have them, so this migration
// guards every createTable with tableExists and recreates each table in the
// EXACT pre-migration shape (no columns that a later migration adds), so that
// the 38 migrations that already run against real databases replay unchanged
// on a brand-new database. Do NOT add "final state" columns here — several
// later migrations (e.g. 20251221223534-add-walletId-to-transactions.js) add
// columns unconditionally and will fail with "Duplicate column" if this
// baseline already created them. See docs/WIKI.md for details.

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // --- roles ---
    if (!(await tableExists(queryInterface, 'roles'))) {
      await queryInterface.createTable('roles', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING, allowNull: false, unique: true },
        description: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- permissions ---
    if (!(await tableExists(queryInterface, 'permissions'))) {
      await queryInterface.createTable('permissions', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING, allowNull: false, unique: true },
        description: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- users ---
    if (!(await tableExists(queryInterface, 'users'))) {
      await queryInterface.createTable('users', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING, allowNull: false },
        email: { type: Sequelize.STRING, allowNull: false, unique: true },
        password: { type: Sequelize.STRING, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- groups (inviteCode/creatorId are added later by 20251222012000) ---
    if (!(await tableExists(queryInterface, 'groups'))) {
      await queryInterface.createTable('groups', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- role_permissions (Role <-> Permission through table) ---
    if (!(await tableExists(queryInterface, 'role_permissions'))) {
      await queryInterface.createTable('role_permissions', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        RoleId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'roles', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        PermissionId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'permissions', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- user_groups (User <-> Group through table, with roleId) ---
    if (!(await tableExists(queryInterface, 'user_groups'))) {
      await queryInterface.createTable('user_groups', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        UserId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        GroupId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'groups', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        roleId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'roles', key: 'id' },
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- categories (parentId/isSystem/sortOrder/translationKey/color1/color2
    //     are added later by 20260527000001-category-system-redesign.js) ---
    if (!(await tableExists(queryInterface, 'categories'))) {
      await queryInterface.createTable('categories', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING, allowNull: false },
        type: { type: Sequelize.ENUM('expense', 'income'), allowNull: false },
        description: { type: Sequelize.STRING, allowNull: true },
        icon: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- budgets ---
    if (!(await tableExists(queryInterface, 'budgets'))) {
      await queryInterface.createTable('budgets', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING, allowNull: false, defaultValue: 'New Budget' },
        ownerType: { type: Sequelize.ENUM('User', 'Group'), allowNull: false },
        ownerId: { type: Sequelize.UUID, allowNull: false },
        totalBudget: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        startDate: { type: Sequelize.DATEONLY, allowNull: false },
        endDate: { type: Sequelize.DATEONLY, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- budget_sections ---
    if (!(await tableExists(queryInterface, 'budget_sections'))) {
      await queryInterface.createTable('budget_sections', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        budgetId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'budgets', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        name: { type: Sequelize.STRING, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- recurrent_payments (walletId/description/type are added later by
    //     20251221223534-add-walletId-to-transactions.js; userCategoryId by
    //     20260527000001-category-system-redesign.js) ---
    if (!(await tableExists(queryInterface, 'recurrent_payments'))) {
      await queryInterface.createTable('recurrent_payments', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        frequency: {
          type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'yearly'),
          allowNull: false,
        },
        startDate: { type: Sequelize.DATEONLY, allowNull: false },
        endDate: { type: Sequelize.DATEONLY, allowNull: true },
        nextPaymentDate: { type: Sequelize.DATEONLY, allowNull: false },
        // No DB-level FK on categoryId/userId/groupId: 20260528000002 removes an
        // FK named "recurrent_payments_ibfk_1" by position, so adding a real FK
        // here would shift the auto-generated constraint numbering and cause
        // that migration to drop the wrong constraint.
        categoryId: { type: Sequelize.UUID, allowNull: true },
        userId: { type: Sequelize.UUID, allowNull: true },
        groupId: { type: Sequelize.UUID, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // --- transactions (walletId/source/isDuplicate/excludeFromBudget/userCategoryId
    //     and the 'transfer' type value are added later by other migrations) ---
    if (!(await tableExists(queryInterface, 'transactions'))) {
      await queryInterface.createTable('transactions', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        description: { type: Sequelize.STRING, allowNull: true },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        type: { type: Sequelize.ENUM('expense', 'income'), allowNull: false },
        // No DB-level FK on categoryId/UserId/GroupId/recurrentPaymentId:
        // 20260528000002 removes an FK named "transactions_ibfk_2" by position,
        // so adding real FKs here would shift the auto-generated constraint
        // numbering and cause that migration to drop the wrong constraint.
        categoryId: { type: Sequelize.UUID, allowNull: true },
        UserId: { type: Sequelize.UUID, allowNull: true },
        GroupId: { type: Sequelize.UUID, allowNull: true },
        recurrentPaymentId: { type: Sequelize.UUID, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      }, {
        indexes: [
          { fields: ['UserId'] },
          { fields: ['GroupId'] },
          { fields: ['categoryId'] },
          { fields: ['date'] },
        ],
      });
    }

    // --- budget_category_plans (disabled/userCategoryId are added later) ---
    if (!(await tableExists(queryInterface, 'budget_category_plans'))) {
      await queryInterface.createTable('budget_category_plans', {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        budgetId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'budgets', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        sectionId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'budget_sections', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        // No FK: everything now resolves categories via userCategoryId (added later).
        categoryId: { type: Sequelize.UUID, allowNull: false },
        plannedAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        type: { type: Sequelize.ENUM('income', 'expense'), allowNull: false },
        endDate: { type: Sequelize.DATEONLY, allowNull: true },
        fixed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },

  async down(queryInterface) {
    // Reverse dependency order.
    const tables = [
      'budget_category_plans',
      'transactions',
      'recurrent_payments',
      'budget_sections',
      'budgets',
      'categories',
      'user_groups',
      'role_permissions',
      'groups',
      'users',
      'permissions',
      'roles',
    ];
    for (const table of tables) {
      if (await tableExists(queryInterface, table)) {
        await queryInterface.dropTable(table);
      }
    }
  },
};
