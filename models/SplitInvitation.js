const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SplitInvitation = sequelize.define(
    "SplitInvitation",
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
        email: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        splitMode: {
            type: DataTypes.ENUM("even", "custom"),
            allowNull: false,
            defaultValue: "even",
        },
        status: {
            type: DataTypes.ENUM("pending", "resolved", "cancelled"),
            allowNull: false,
            defaultValue: "pending",
        },
        invitedBy: {
            type: DataTypes.UUID,
            allowNull: false,
            comment: "The user who created the split (Split_Owner)",
        },
        resolvedUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: "Set when the invitee registers or logs in",
        },
        resolvedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        tableName: "split_invitations",
        timestamps: true,
    }
);

module.exports = SplitInvitation;
