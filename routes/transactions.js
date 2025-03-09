const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const transactionController = require('../controllers/transactionController');

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Create a new transaction
 *     description: Create a new transaction for the authenticated user.
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         description: Transaction details.
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *             description:
 *               type: string
 *     responses:
 *       201:
 *         description: Transaction created successfully.
 *       400:
 *         description: Invalid input.
 */
router.post('/', authenticateToken, transactionController.createTransaction);

/**
 * @swagger
 * /transactions/{groupId}:
 *   get:
 *     summary: Get transactions for a group
 *     description: Retrieve transactions for a specific group with pagination.
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         description: ID of the group to retrieve transactions for.
 *         type: string
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully.
 *       404:
 *         description: Group not found.
 */
router.get('/:groupId', authenticateToken, transactionController.getTransactions);

/**
 * @swagger
 * /transactions/{transactionId}:
 *   put:
 *     summary: Update a transaction
 *     description: Update an existing transaction.
 *     parameters:
 *       - name: transactionId
 *         in: path
 *         required: true
 *         description: ID of the transaction to update.
 *         type: string
 *       - name: body
 *         in: body
 *         required: true
 *         description: Updated transaction details.
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *             description:
 *               type: string
 *     responses:
 *       200:
 *         description: Transaction updated successfully.
 *       400:
 *         description: Invalid input.
 *       404:
 *         description: Transaction not found.
 */
router.put('/:transactionId', authenticateToken, transactionController.updateTransaction);

/**
 * @swagger
 * /transactions/{transactionId}:
 *   delete:
 *     summary: Delete a transaction
 *     description: Delete a specific transaction.
 *     parameters:
 *       - name: transactionId
 *         in: path
 *         required: true
 *         description: ID of the transaction to delete.
 *         type: string
 *     responses:
 *       204:
 *         description: Transaction deleted successfully.
 *       404:
 *         description: Transaction not found.
 */
router.delete('/:transactionId', authenticateToken, transactionController.deleteTransaction);

module.exports = router;
