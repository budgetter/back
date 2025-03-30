const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middlewares/authMiddleware');
const { addCategoryToSection, updateCategoryInSection, deleteCategoryFromSection } = require('../controllers/budgetCategoryPlanController');

router.post('/sections/:sectionId/categories', authenticateToken, addCategoryToSection);
router.put('/sections/:sectionId/categories/:planId', authenticateToken, updateCategoryInSection);
router.delete('/sections/:sectionId/categories/:planId', authenticateToken, deleteCategoryFromSection);

module.exports = router;
