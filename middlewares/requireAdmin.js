const User = require('../models/User');

/**
 * Middleware that requires the authenticated user to be an admin.
 * Must be used AFTER authenticateToken middleware.
 * Loads user from DB to get current isAdmin status (JWT may be stale).
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'isAdmin'] });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('requireAdmin error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { requireAdmin };
