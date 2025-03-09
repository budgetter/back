const User = require("./User");
const Group = require("./Group");
const Role = require("./Role");
const UserGroup = require("./UserGroup");
const Permission = require("./Permission");
const RolePermission = require("./RolePermission");
const Category = require("./Category");
const Budget = require("./Budget");
const BudgetCategoryPlan = require("./BudgetCategoryPlan");
const Transaction = require("./Transaction");
const RecurrentPayment = require("./RecurrentPayment");
const Debt = require("./Debt");

/* 
   Users and Groups are linked via UserGroup, which includes a Role.
   Foreign keys for User and Group will be added by the association.
*/
User.belongsToMany(Group, {
  through: UserGroup,
  foreignKey: "UserId",
  otherKey: "GroupId",
});
Group.belongsToMany(User, {
  through: UserGroup,
  foreignKey: "GroupId",
  otherKey: "UserId",
});

// Link UserGroup to Role
UserGroup.belongsTo(Role, { foreignKey: "roleId" });
Role.hasMany(UserGroup, { foreignKey: "roleId" });

// Optional: Many-to-many between Role and Permission
if (Permission && RolePermission) {
  Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: "RoleId",
    otherKey: "PermissionId",
  });
  Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: "PermissionId",
    otherKey: "RoleId",
  });
}

// Budgeting associations
Budget.hasMany(BudgetCategoryPlan, {
  foreignKey: "budgetId",
  onDelete: "CASCADE",
});
BudgetCategoryPlan.belongsTo(Budget, { foreignKey: "budgetId" });
BudgetCategoryPlan.belongsTo(Category, { foreignKey: "categoryId" });
Category.hasMany(BudgetCategoryPlan, { foreignKey: "categoryId" });

// Transaction associations
Transaction.belongsTo(Category, { foreignKey: "categoryId" });
Category.hasMany(Transaction, { foreignKey: "categoryId" });
Transaction.belongsTo(User, { foreignKey: "UserId" });
User.hasMany(Transaction, { foreignKey: "UserId" });
Transaction.belongsTo(Group, { foreignKey: "GroupId" });
Group.hasMany(Transaction, { foreignKey: "GroupId" });
Transaction.belongsTo(RecurrentPayment, { foreignKey: "recurrentPaymentId" });
RecurrentPayment.hasMany(Transaction, { foreignKey: "recurrentPaymentId" });

// RecurrentPayment associations
RecurrentPayment.belongsTo(Category, { foreignKey: "categoryId" });
Category.hasMany(RecurrentPayment, { foreignKey: "categoryId" });
RecurrentPayment.belongsTo(User, { foreignKey: "UserId" });
User.hasMany(RecurrentPayment, { foreignKey: "UserId" });
RecurrentPayment.belongsTo(Group, { foreignKey: "GroupId" });
Group.hasMany(RecurrentPayment, { foreignKey: "GroupId" });

// Debt associations
Debt.belongsTo(Category, { foreignKey: "categoryId" });
Category.hasMany(Debt, { foreignKey: "categoryId" });
Debt.belongsTo(User, { foreignKey: "UserId" });
User.hasMany(Debt, { foreignKey: "UserId" });
Debt.belongsTo(Group, { foreignKey: "GroupId" });
Group.hasMany(Debt, { foreignKey: "GroupId" });

module.exports = {
  User,
  Group,
  Role,
  UserGroup,
  Permission,
  RolePermission,
  Category,
  Budget,
  BudgetCategoryPlan,
  Transaction,
  RecurrentPayment,
  Debt,
};
