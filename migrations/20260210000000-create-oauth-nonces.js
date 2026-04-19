'use strict';

async function tableExists(qi, name) {
  return (await qi.showAllTables()).includes(name);
}
async function indexExists(qi, table, name) {
  return (await qi.showIndex(table)).some(i => i.name === name);
}

module.exports = {
    up: async (queryInterface, Sequelize) => {
        if (!(await tableExists(queryInterface, 'OAuthNonces'))) {
            await queryInterface.createTable('OAuthNonces', {
                id: {
                    allowNull: false,
                    primaryKey: true,
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4
                },
                userId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                nonce: {
                    type: Sequelize.STRING(64),
                    allowNull: false,
                    unique: true
                },
                expiresAt: {
                    type: Sequelize.DATE,
                    allowNull: false
                },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE }
            });
        }

        if (!(await indexExists(queryInterface, 'OAuthNonces', 'unique_oauth_nonce'))) {
            await queryInterface.addIndex('OAuthNonces', ['nonce'], {
                unique: true,
                name: 'unique_oauth_nonce'
            });
        }

        if (!(await indexExists(queryInterface, 'OAuthNonces', 'idx_oauth_nonces_expires_at'))) {
            await queryInterface.addIndex('OAuthNonces', ['expiresAt'], {
                name: 'idx_oauth_nonces_expires_at'
            });
        }
    },

    down: async (queryInterface) => {
        if (await tableExists(queryInterface, 'OAuthNonces')) {
            await queryInterface.dropTable('OAuthNonces');
        }
    }
};
