const { UserGroup, Role, Permission } = require('../models');

/**
 * Middleware factory to enforce that the authenticated user has the specified permission
 * within the context of a particular group.
 *
 * @param {string} requiredPermission - The permission name required to access the route.
 * @returns {function} Express middleware function.
 */
function permissionMiddleware(requiredPermission) {
  return async (req, res, next) => {
    try {
      // Ensure the user is authenticated (assumed to be set by authenticateToken middleware)
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const userId = req.user.id;
      // Expect the group identifier to be provided as a URL parameter or in the request body.
      const groupId = req.params.groupId || req.body.groupId;
      if (!groupId) {
        return res.status(400).json({ message: 'Group ID is required for permission check' });
      }

      // Retrieve the user's membership record with associated Role and its Permissions.
      const userGroup = await UserGroup.findOne({
        where: { UserId: userId, GroupId: groupId },
        include: {
          model: Role,
          include: {
            model: Permission,
            attributes: ['name'], // Only fetch the permission name
          },
        },
      });

      if (!userGroup || !userGroup.Role) {
        return res.status(403).json({ message: 'Access denied: User is not a member of the group' });
      }

      // Extract the permission names assigned to the user's role.
      const permissions = (userGroup.Role.Permissions || []).map((perm) => perm.name);

      if (!permissions.includes(requiredPermission)) {
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
      }

      // Optionally attach role and permissions info to req for downstream use.
      req.userRole = userGroup.Role.name;
      req.userPermissions = permissions;

      // Permission granted – proceed to the next middleware or route handler.
      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({ message: 'Server error during permission check' });
    }
  };
}

module.exports = permissionMiddleware;
