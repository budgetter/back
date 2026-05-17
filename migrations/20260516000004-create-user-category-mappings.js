'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

async function indexExists(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some(i => i.name === indexName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'UserCategoryMappings'))) {
      await queryInterface.createTable('UserCategoryMappings', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        companyPattern: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        categoryId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'categories', key: 'id' },
          onDelete: 'CASCADE',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!(await indexExists(queryInterface, 'UserCategoryMappings', 'ucm_user_pattern_unique'))) {
      await queryInterface.addIndex('UserCategoryMappings', ['userId', 'companyPattern'], {
        unique: true,
        name: 'ucm_user_pattern_unique',
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'UserCategoryMappings')) {
      await queryInterface.dropTable('UserCategoryMappings');
    }
  },
};
