const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FriendContact = sequelize.define(
    "FriendContact",
    {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            comment: "The owner of this contact",
        },
        contactUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            comment: "If contact is a registered user",
        },
        contactEmail: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: "Always stored, used for dedup",
        },
        contactName: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Display name for unregistered contacts",
        },
    },
    {
        tableName: "friend_contacts",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ["userId", "contactEmail"],
                name: "unique_user_contact_email",
            },
        ],
    }
);

module.exports = FriendContact;
