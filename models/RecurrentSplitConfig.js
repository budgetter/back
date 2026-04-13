const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RecurrentSplitConfig = sequelize.define(
    "RecurrentSplitConfig",
    {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },
        recurrentPaymentId: {
            type: DataTypes.UUID,
            allowNull: false,
            comment: "FK to RecurrentPayment",
        },
        splitMode: {
            type: DataTypes.ENUM("even", "custom"),
            allowNull: false,
            defaultValue: "even",
        },
        participants: {
            type: DataTypes.JSON,
            allowNull: false,
            comment: "Array of { userId?, email?, amount? }",
        },
    },
    {
        tableName: "recurrent_split_configs",
        timestamps: true,
    }
);

module.exports = RecurrentSplitConfig;
