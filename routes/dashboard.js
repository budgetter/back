const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/overview', authenticateToken, dashboardController.getDashboardOverview);
router.get('/expenditures', authenticateToken, dashboardController.getExpendituresData);
router.get('/transactions', authenticateToken, dashboardController.getTransactionsList);

module.exports = router;
