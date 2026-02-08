const { Group, User, UserGroup, Role, Budget, sequelize } = require("../models");
const { v4: uuidv4 } = require('uuid');

// Generate a random 6-character alphanumeric code
const generateInviteCode = async () => {
  let code;
  let exists = true;
  while (exists) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const group = await Group.findOne({ where: { inviteCode: code } });
    if (!group) exists = false;
  }
  return code;
};

exports.createGroupBudget = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { groupName, budgetName, budgetTotal, startDate, endDate } = req.body;
    const userId = req.user.id;

    // 1. Create Group
    const inviteCode = await generateInviteCode();
    const group = await Group.create({
      name: groupName,
      inviteCode,
      creatorId: userId
    }, { transaction: t });

    // 2. Ensure Admin Role exists (or find it)
    let adminRole = await Role.findOne({ where: { name: 'Admin' }, transaction: t });
    if (!adminRole) {
      adminRole = await Role.create({ name: 'Admin', description: 'Group Administrator' }, { transaction: t });
    }

    // 3. Add User to Group as Admin
    await UserGroup.create({
      UserId: userId,
      GroupId: group.id,
      roleId: adminRole.id
    }, { transaction: t });

    // 4. Create Shared Budget
    const budget = await Budget.create({
      name: budgetName,
      totalBudget: budgetTotal,
      startDate,
      endDate,
      ownerType: 'Group',
      ownerId: group.id
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      message: "Shared budget created successfully",
      group,
      budget,
      inviteCode
    });

  } catch (error) {
    await t.rollback();
    console.error("Error creating group budget:", error);
    res.status(500).json({ message: "Server error creating group budget" });
  }
};

exports.joinGroup = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    const group = await Group.findOne({ where: { inviteCode } });
    if (!group) {
      return res.status(404).json({ message: "Invalid invite code" });
    }

    // Check if already a member
    const existingMember = await UserGroup.findOne({
      where: { UserId: userId, GroupId: group.id }
    });

    if (existingMember) {
      return res.status(400).json({ message: "You are already a member of this group" });
    }

    // Assign Member Role
    let memberRole = await Role.findOne({ where: { name: 'Member' }, transaction: t });
    if (!memberRole) {
      memberRole = await Role.create({ name: 'Member', description: 'Standard Group Member' }, { transaction: t });
    }

    await UserGroup.create({
      UserId: userId,
      GroupId: group.id,
      roleId: memberRole.id
    }, { transaction: t });

    await t.commit();
    res.status(200).json({ message: "Joined group successfully", group });

  } catch (error) {
    await t.rollback();
    console.error("Error joining group:", error);
    res.status(500).json({ message: "Server error joining group" });
  }
};

exports.getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Simple verification that user belongs to group could be added here middleware-side

    const group = await Group.findByPk(groupId, {
      include: [{
        model: User,
        attributes: ['id', 'name', 'email', 'profileImage'], // Assuming profileImage exists or use gravatar later
        through: { attributes: ['roleId'] }
      }]
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(group.Users);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ message: "Server error fetching members" });
  }
};

exports.transferAdmin = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { groupId, newAdminId } = req.body;
    const currentAdminId = req.user.id;

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.creatorId !== currentAdminId) {
      return res.status(403).json({ message: "Only the group creator can transfer ownership" });
    }

    // Update Group Creator
    await group.update({ creatorId: newAdminId }, { transaction: t });

    // Swap Roles (Optional: if we strictly enforce Admin Role ID logic, we'd do it here)
    // For now, creatorId is the main source of truth for "Ownership"

    await t.commit();
    res.json({ message: "Group ownership transferred" });

  } catch (error) {
    await t.rollback();
    console.error("Error transferring admin:", error);
    res.status(500).json({ message: "Server error transferring admin" });
  }
};
