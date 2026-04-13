const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const transactionController = require('../controllers/transactionController');


router.post('/', authenticateToken, transactionController.createTransaction);


router.get('/:groupId', authenticateToken, transactionController.getTransactions);

router.put('/:transactionId', authenticateToken, transactionController.updateTransaction);


router.delete('/:transactionId', authenticateToken, transactionController.deleteTransaction);

module.exports = router;
