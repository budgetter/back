const User = require("../models/User");
const bcrypt = require("bcrypt");

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API for user profile management
 */

/**
 * Retrieve the authenticated user's profile.
 * Excludes the password field from the response.
 *
 * @param {Object} req - Express request object (expects req.user.id to be set from authentication middleware)
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with user profile or error message
 */
async function getProfile(req, res) {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Update the authenticated user's profile.
 * Only allowed fields (e.g., name, email) are updated.
 *
 * @param {Object} req - Express request object (expects req.user.id to be set from authentication middleware)
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with the updated user profile or error message
 */
async function updateProfile(req, res) {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { name, email } = req.body;

    // Update fields if provided
    if (name) {
      user.name = name;
    }
    if (email) {
      // Check if the new email is already in use by another user
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: "Email already in use" });
      }
      user.email = email;
    }
    await user.save();

    // Fetch updated user excluding password
    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });
    return res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Change the password for the authenticated user.
 * Requires the current password for verification.
 *
 * @param {Object} req - Express request object (expects req.user.id to be set from authentication middleware)
 * @param {Object} res - Express response object
 * @returns {Object} JSON response confirming password change or an error message
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Both current and new password are required" });
    }
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    // Hash and update the new password
    const saltRounds = 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    await user.save();
    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};
