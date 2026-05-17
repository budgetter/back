'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'ParserConfigs'))) {
      await queryInterface.createTable('ParserConfigs', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        country: {
          type: Sequelize.STRING(5),
          allowNull: false,
        },
        bankName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        senderEmail: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        regexPatterns: {
          type: Sequelize.JSON,
          allowNull: false,
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'ParserConfigs')) {
      await queryInterface.dropTable('ParserConfigs');
    }
  },
};
