const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const budgetController = require('../controllers/budgetController');

/**
 * @swagger
 * /budgets:
 *   post:
 *     summary: Create a new budget
 *     description: Create a new budget for the authenticated user.
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         description: Budget details.
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             amount:
 *               type: number
 *     responses:
 *       201:
 *         description: Budget created successfully.
 *       400:
 *         description: Invalid input.
 */
router.post('/', authenticateToken, budgetController.createBudget);

/**
 * @swagger
 * /budgets/{budgetId}:
 *   get:
 *     summary: Get budget details
 *     description: Retrieve details of a specific budget.
 *     parameters:
 *       - name: budgetId
 *         in: path
 *         required: true
 *         description: ID of the budget to retrieve.
 *         type: string
 *     responses:
 *       200:
 *         description: Budget details retrieved successfully.
 *       404:
 *         description: Budget not found.
 */
router.get('/:budgetId', authenticateToken, budgetController.getBudget);

/**
 * @swagger
 * /budgets/{budgetId}:
 *   put:
 *     summary: Update a budget
 *     description: Update an existing budget.
 *     parameters:
 *       - name: budgetId
 *         in: path
 *         required: true
 *         description: ID of the budget to update.
 *         type: string
 *       - name: body
 *         in: body
 *         required: true
 *         description: Updated budget details.
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             amount:
 *               type: number
 *     responses:
 *       200:
 *         description: Budget updated successfully.
 *       400:
 *         description: Invalid input.
 *       404:
 *         description: Budget not found.
 */
router.put('/:budgetId', authenticateToken, budgetController.updateBudget);

/**
 * @swagger
 * /budgets/{budgetId}:
 *   delete:
 *     summary: Delete a budget
 *     description: Delete a specific budget.
 *     parameters:
 *       - name: budgetId
 *         in: path
 *         required: true
 *         description: ID of the budget to delete.
 *         type: string
 *     responses:
 *       204:
 *         description: Budget deleted successfully.
 *       404:
 *         description: Budget not found.
 */
router.delete('/:budgetId', authenticateToken, budgetController.deleteBudget);

module.exports = router;
