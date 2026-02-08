const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TransactionSplit = sequelize.define(
    "TransactionSplit",
    {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },
        transactionId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            comment: "The user who owes the money (debtor)",
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        isPaid: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        proofOfPayment: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        tableName: "transaction_splits",
        timestamps: true,
    }
);

module.exports = TransactionSplit;
