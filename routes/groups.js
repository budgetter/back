const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.post('/create', authenticateToken, groupController.createGroupBudget);
router.post('/join', authenticateToken, groupController.joinGroup);
router.get('/:groupId/members', authenticateToken, groupController.getGroupMembers);
router.put('/transfer-admin', authenticateToken, groupController.transferAdmin);

module.exports = router;
