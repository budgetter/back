const Group = require('../models/Group');
const UserGroup = require('../models/UserGroup');
const Role = require('../models/Role');

/**
 * Create a new group.
 * The authenticated user becomes the Leader (requires Leader role to exist).
 */
async function createGroup(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    const group = await Group.create({ name });

    // Assign the creator the "Leader" role.
    const leaderRole = await Role.findOne({ where: { name: 'Leader' } });
    if (!leaderRole) {
      return res.status(500).json({ message: 'Default leader role not configured' });
    }
    await UserGroup.create({
      UserId: req.user.id,
      GroupId: group.id,
      roleId: leaderRole.id,
    });

    return res.status(201).json({ message: 'Group created successfully', group });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Server error while creating group' });
  }
}

/**
 * Retrieve details for a specific group.
 */
async function getGroup(req, res) {
  try {
    const { groupId } = req.params;
    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    return res.json({ group });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ message: 'Server error while fetching group' });
  }
}

/**
 * Update group details.
 * Protected by role middleware (e.g., only Leader can update).
 */
async function updateGroup(req, res) {
  try {
    const { groupId } = req.params;
    const { name } = req.body;
    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    group.name = name || group.name;
    await group.save();
    return res.json({ message: 'Group updated successfully', group });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ message: 'Server error while updating group' });
  }
}

/**
 * Delete a group.
 * Protected by role middleware (e.g., only Leader can delete).
 */
async function deleteGroup(req, res) {
  try {
    const { groupId } = req.params;
    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    await group.destroy();
    return res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Server error while deleting group' });
  }
}

/**
 * Join a group.
 * The user is assigned a default "Member" role.
 */
async function joinGroup(req, res) {
  try {
    const { groupId } = req.params;
    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    const memberRole = await Role.findOne({ where: { name: 'Member' } });
    if (!memberRole) {
      return res.status(500).json({ message: 'Default member role not configured' });
    }

    const existing = await UserGroup.findOne({
      where: { UserId: req.user.id, GroupId: groupId }
    });
    if (existing) return res.status(400).json({ message: 'Already a member of this group' });

    await UserGroup.create({
      UserId: req.user.id,
      GroupId: groupId,
      roleId: memberRole.id,
    });
    
    return res.status(200).json({ message: 'Joined group successfully' });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ message: 'Server error while joining group' });
  }
}

module.exports = {
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
};
