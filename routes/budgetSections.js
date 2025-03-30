const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middlewares/authMiddleware');
const { createSection, deleteSection } = require('../controllers/budgetSectionController');

router.post('/:budgetId/sections', authenticateToken, createSection);
router.delete('/sections/:sectionId', authenticateToken, deleteSection);

module.exports = router;
