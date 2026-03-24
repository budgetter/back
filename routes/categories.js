const express = require('express');
const router = express.Router();
const { getCategories, createCategory } = require('../controllers/categoryController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/', getCategories);
router.post('/', authenticateToken, createCategory);

module.exports = router;
