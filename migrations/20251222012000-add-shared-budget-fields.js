'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Add columns to groups table
        const tableInfo = await queryInterface.describeTable('groups');

        if (!tableInfo.inviteCode) {
            await queryInterface.addColumn('groups', 'inviteCode', {
                type: Sequelize.STRING(6),
                allowNull: true,
                unique: true,
            });
        }

        if (!tableInfo.creatorId) {
            await queryInterface.addColumn('groups', 'creatorId', {
                type: Sequelize.UUID,
                allowNull: true, // Allow null for existing groups, we can fix this later if needed
            });
        }

        // 2. Create transaction_splits table
        await queryInterface.createTable('transaction_splits', {
            id: {
                type: Sequelize.UUID,
                primaryKey: true,
                defaultValue: Sequelize.UUIDV4,
            },
            transactionId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'transactions',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            userId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            isPaid: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            paidAt: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            proofOfPayment: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            }
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('transaction_splits');
        await queryInterface.removeColumn('groups', 'inviteCode');
        await queryInterface.removeColumn('groups', 'creatorId');
    }
};
