const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const recurrentPaymentController = require('../controllers/recurrentPaymentController');

// Create a new recurrent payment
router.post('/', authenticateToken, recurrentPaymentController.createRecurrentPayment);

// Get all recurrent payments
router.get('/', authenticateToken, recurrentPaymentController.getRecurrentPayments);

// Update a recurrent payment
router.put('/:id', authenticateToken, recurrentPaymentController.updateRecurrentPayment);

// Delete a recurrent payment
router.delete('/:id', authenticateToken, recurrentPaymentController.deleteRecurrentPayment);

module.exports = router;
