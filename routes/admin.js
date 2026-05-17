const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/requireAdmin');
const adminParserController = require('../controllers/adminParserController');
const adminCategoryMappingController = require('../controllers/adminCategoryMappingController');

// All admin routes require authentication + admin role
router.use(authenticateToken, requireAdmin);

// Parser configs
router.get('/parsers', adminParserController.list);
router.post('/parsers', adminParserController.create);
router.put('/parsers/:id', adminParserController.update);
router.delete('/parsers/:id', adminParserController.remove);

// Global category mappings
router.get('/category-mappings', adminCategoryMappingController.list);
router.post('/category-mappings', adminCategoryMappingController.create);
router.put('/category-mappings/:id', adminCategoryMappingController.update);
router.delete('/category-mappings/:id', adminCategoryMappingController.remove);

module.exports = router;
