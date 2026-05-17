const sequelize = require("../config/database");
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
const BudgetSection = require("./BudgetSection");
const Wallet = require("./Wallet");
const TransactionSplit = require("./TransactionSplit");
const OAuthNonce = require("./OAuthNonce");
const BankIntegration = require("./BankIntegration");
const IntegrationMap = require("./IntegrationMap");
const ProcessedEmail = require("./ProcessedEmail");
const SplitInvitation = require("./SplitInvitation");
const FriendContact = require("./FriendContact");
const RecurrentSplitConfig = require("./RecurrentSplitConfig");
const ParserConfig = require("./ParserConfig");
const GlobalCategoryMapping = require("./GlobalCategoryMapping");
const UserCategoryMapping = require("./UserCategoryMapping");
const SyncHistory = require("./SyncHistory");

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

// Group Creator association
Group.belongsTo(User, { as: "creator", foreignKey: "creatorId" });

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

Budget.hasMany(BudgetSection, { foreignKey: "budgetId", onDelete: "CASCADE", as: "sections" });
BudgetSection.belongsTo(Budget, { foreignKey: "budgetId" });

BudgetSection.hasMany(BudgetCategoryPlan, {
  foreignKey: "sectionId",
  onDelete: "CASCADE",
});
BudgetCategoryPlan.belongsTo(BudgetSection, { foreignKey: "sectionId" });

// Transaction associations
Transaction.belongsTo(Category, { foreignKey: "categoryId" });
Category.hasMany(Transaction, { foreignKey: "categoryId" });
Transaction.belongsTo(User, { foreignKey: "UserId" });
User.hasMany(Transaction, { foreignKey: "UserId" });
Transaction.belongsTo(Group, { foreignKey: "GroupId" });
Group.hasMany(Transaction, { foreignKey: "GroupId" });
Transaction.belongsTo(RecurrentPayment, { foreignKey: "recurrentPaymentId" });
RecurrentPayment.hasMany(Transaction, { foreignKey: "recurrentPaymentId" });
Transaction.belongsTo(Wallet, { foreignKey: "walletId" });
Wallet.hasMany(Transaction, { foreignKey: "walletId" });
RecurrentPayment.belongsTo(Wallet, { foreignKey: "walletId" });
Wallet.hasMany(RecurrentPayment, { foreignKey: "walletId" });

// Transaction Split associations
Transaction.hasMany(TransactionSplit, { foreignKey: "transactionId", onDelete: "CASCADE" });
TransactionSplit.belongsTo(Transaction, { foreignKey: "transactionId" });
TransactionSplit.belongsTo(User, { foreignKey: "userId", as: "debtor" }); // User who owes money

// RecurrentPayment associations
RecurrentPayment.belongsTo(Category, { foreignKey: "categoryId" });
Category.hasMany(RecurrentPayment, { foreignKey: "categoryId" });
RecurrentPayment.belongsTo(User, { foreignKey: "userId" });
User.hasMany(RecurrentPayment, { foreignKey: "userId" });
RecurrentPayment.belongsTo(Group, { foreignKey: "groupId" });
Group.hasMany(RecurrentPayment, { foreignKey: "groupId" });

// Debt associations
Debt.belongsTo(Category, { foreignKey: "categoryId" });
Category.hasMany(Debt, { foreignKey: "categoryId" });
Debt.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Debt, { foreignKey: "userId" });
Debt.belongsTo(Group, { foreignKey: "groupId" });
Group.hasMany(Debt, { foreignKey: "groupId" });

// Wallet associations
Wallet.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Wallet, { foreignKey: "userId" });

// OAuthNonce associations
OAuthNonce.belongsTo(User, { foreignKey: "userId" });
User.hasMany(OAuthNonce, { foreignKey: "userId" });

// BankIntegration associations
BankIntegration.belongsTo(User, { foreignKey: "userId" });
User.hasMany(BankIntegration, { foreignKey: "userId" });
BankIntegration.hasMany(IntegrationMap, { foreignKey: "integrationId" });
IntegrationMap.belongsTo(BankIntegration, { foreignKey: "integrationId" });
BankIntegration.hasMany(ProcessedEmail, { foreignKey: "integrationId" });
ProcessedEmail.belongsTo(BankIntegration, { foreignKey: "integrationId" });

// SplitInvitation associations
SplitInvitation.belongsTo(Transaction, { foreignKey: 'transactionId' });
Transaction.hasMany(SplitInvitation, { foreignKey: 'transactionId' });
SplitInvitation.belongsTo(User, { as: 'inviter', foreignKey: 'invitedBy' });
SplitInvitation.belongsTo(User, { as: 'resolvedUser', foreignKey: 'resolvedUserId' });

// FriendContact associations
FriendContact.belongsTo(User, { as: 'owner', foreignKey: 'userId' });
FriendContact.belongsTo(User, { as: 'contact', foreignKey: 'contactUserId' });
User.hasMany(FriendContact, { foreignKey: 'userId' });

// RecurrentSplitConfig associations
RecurrentSplitConfig.belongsTo(RecurrentPayment, { foreignKey: 'recurrentPaymentId' });
RecurrentPayment.hasOne(RecurrentSplitConfig, { foreignKey: 'recurrentPaymentId' });

// TransactionSplit -> SplitInvitation link
TransactionSplit.belongsTo(SplitInvitation, { foreignKey: 'invitationId' });
SplitInvitation.hasOne(TransactionSplit, { foreignKey: 'invitationId' });

// UserCategoryMapping associations
UserCategoryMapping.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(UserCategoryMapping, { foreignKey: 'userId' });
UserCategoryMapping.belongsTo(Category, { foreignKey: 'categoryId' });
Category.hasMany(UserCategoryMapping, { foreignKey: 'categoryId' });

// SyncHistory associations
SyncHistory.belongsTo(BankIntegration, { foreignKey: 'integrationId' });
BankIntegration.hasMany(SyncHistory, { foreignKey: 'integrationId' });

module.exports = {
  sequelize,
  User,
  Group,
  Role,
  UserGroup,
  Permission,
  RolePermission,
  Category,
  Budget,
  BudgetSection,
  BudgetCategoryPlan,
  Transaction,
  RecurrentPayment,
  Debt,
  Wallet,
  TransactionSplit,
  OAuthNonce,
  BankIntegration,
  IntegrationMap,
  ProcessedEmail,
  SplitInvitation,
  FriendContact,
  RecurrentSplitConfig,
  ParserConfig,
  GlobalCategoryMapping,
  UserCategoryMapping,
  SyncHistory,
};
