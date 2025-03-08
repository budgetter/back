const { UserGroup, Role } = require("../models");

/**
 * Middleware to check if the authenticated user has one of the allowed roles for a given group.
 * @param {Array<string>} allowedRoles - An array of role names allowed for the route.
 */
const roleCheck = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const groupId = req.params.groupId || req.body.groupId;

      if (!groupId) {
        return res.status(400).json({ message: "Group identifier is missing" });
      }

      // Find the user's group membership along with their role
      const userGroup = await UserGroup.findOne({
        where: { UserId: userId, GroupId: groupId },
        include: [Role],
      });

      if (!userGroup) {
        return res
          .status(403)
          .json({ message: "Access denied: Not a member of the group" });
      }

      // Check if the user's role is in the allowed roles list
      if (!allowedRoles.includes(userGroup.Role.name)) {
        return res
          .status(403)
          .json({ message: "Access denied: Insufficient role" });
      }

      // Optionally attach role info to req for downstream use
      req.userRole = userGroup.Role.name;
      next();
    } catch (error) {
      console.error("Role middleware error:", error);
      res.status(500).json({ message: "Server error during role check" });
    }
  };
};

module.exports = roleCheck;
