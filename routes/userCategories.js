const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getUserCategories,
  createUserCategory,
  updateUserCategory,
  hideUserCategory,
  restoreUserCategory,
  reorderUserCategories,
  getFrequentCategories,
  setupDefaults,
  resetToDefaults,
} = require('../controllers/userCategoryController');

router.use(authenticateToken);

router.get('/', getUserCategories);
router.get('/frequent', getFrequentCategories);
router.post('/', createUserCategory);
router.post('/setup-defaults', setupDefaults);
router.post('/reset', resetToDefaults);
router.put('/reorder', reorderUserCategories);
router.put('/:id', updateUserCategory);
router.put('/:id/hide', hideUserCategory);
router.put('/:id/restore', restoreUserCategory);

module.exports = router;
