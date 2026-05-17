const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const transactionController = require('../controllers/transactionController');


router.post('/', authenticateToken, transactionController.createTransaction);


router.get('/:groupId', authenticateToken, transactionController.getTransactions);

router.put('/:transactionId', authenticateToken, transactionController.updateTransaction);


router.delete('/:transactionId', authenticateToken, transactionController.deleteTransaction);

// Duplicate resolution
router.put('/:id/approve-duplicate', authenticateToken, transactionController.approveDuplicate);
router.delete('/:id/dismiss-duplicate', authenticateToken, transactionController.dismissDuplicate);

module.exports = router;
