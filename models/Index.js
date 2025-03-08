const User = require('./User');
const Group = require('./Group');
const Transaction = require('./Transaction');
const Role = require('./Role');
const UserGroup = require('./UserGroup');
const Permission = require('./Permission');         // Optional
const RolePermission = require('./RolePermission'); // Optional

// User <-> Group association through UserGroup with a Role
User.belongsToMany(Group, { through: UserGroup });
Group.belongsToMany(User, { through: UserGroup });

// Establish association for Role in the join table
Role.hasMany(UserGroup, { foreignKey: 'roleId' });
UserGroup.belongsTo(Role, { foreignKey: 'roleId' });

// One-to-Many: Group -> Transaction
Group.hasMany(Transaction);
Transaction.belongsTo(Group);

// One-to-Many: User -> Transaction
User.hasMany(Transaction);
Transaction.belongsTo(User);

// (Optional) Role <-> Permission many-to-many association
if (Permission && RolePermission) {
  Role.belongsToMany(Permission, { through: RolePermission });
  Permission.belongsToMany(Role, { through: RolePermission });
}

module.exports = { User, Group, Transaction, Role, UserGroup, Permission, RolePermission };
