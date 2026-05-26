const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const pushController = require('../controllers/pushController');

router.post('/subscribe', authenticateToken, pushController.subscribe);
router.delete('/unsubscribe', authenticateToken, pushController.unsubscribe);
router.get('/status', authenticateToken, pushController.getStatus);

module.exports = router;
