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
    if (!(await tableExists(queryInterface, 'GlobalCategoryMappings'))) {
      await queryInterface.createTable('GlobalCategoryMappings', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        country: {
          type: Sequelize.STRING(5),
          allowNull: false,
        },
        companyPattern: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        categoryName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    if (!(await indexExists(queryInterface, 'GlobalCategoryMappings', 'gcm_country_pattern_unique'))) {
      await queryInterface.addIndex('GlobalCategoryMappings', ['country', 'companyPattern'], {
        unique: true,
        name: 'gcm_country_pattern_unique',
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'GlobalCategoryMappings')) {
      await queryInterface.dropTable('GlobalCategoryMappings');
    }
  },
};
