const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const budgetController = require("../controllers/budgetController");

/**
 * @swagger
 * /budgets/current/remaining:
 *   get:
 *     summary: Retrieve remaining budget for the current month
 *     description: Fetches the remaining budget for the current month for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         description: The month in YYYY-MM format for which to retrieve the budget.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response with the remaining budget data.
 *       400:
 *         description: Invalid month format.
 *       404:
 *         description: No budget found for the selected month.
 *       500:
 *         description: Server error retrieving remaining budget.
 */
router.get(
  "/current/remaining",
  authenticateToken,
  budgetController.getRemainingBudget
);

/**
 * @swagger
 * /budgets/current:
 *   get:
 *     summary: Retrieve the current budget
 *     description: Fetches the current budget for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response with the current budget data.
 *       404:
 *         description: No current budget found.
 *       500:
 *         description: Server error retrieving current budget.
 */
router.get("/current", authenticateToken, budgetController.getCurrentBudget);

/**
 * @swagger
 * /budgets/list:
 *   get:
 *     summary: Retrieve a list of budgets
 *     description: Fetches a list of budgets for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response with the list of budgets.
 *       500:
 *         description: Server error retrieving budget list.
 */
router.get("/list", authenticateToken, budgetController.getBudgetList);

/**
 * @swagger
 * /budgets/month:
 *   get:
 *     summary: Retrieve budget for a specific month
 *     description: Fetches the budget for the specified month for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         description: The month in YYYY-MM format for which to retrieve the budget.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response with the budget data.
 *       400:
 *         description: Invalid month format.
 *       404:
 *         description: No budget found for the selected month.
 *       500:
 *         description: Server error retrieving budget for month.
 */
router.get("/month", authenticateToken, budgetController.getBudgetForMonth);

/**
 * @swagger
 * /budgets:
 *   post:
 *     summary: Create a new budget
 *     description: Create a new budget for the authenticated user.
 *     security:
 *       - bearerAuth: []
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
router.post("/", authenticateToken, budgetController.createBudget);

/**
 * @swagger
 * /budgets/{budgetId}:
 *   get:
 *     summary: Get budget details
 *     description: Retrieve details of a specific budget.
 *     security:
 *       - bearerAuth: []
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
router.get("/:budgetId", authenticateToken, budgetController.getBudget);

/**
 * @swagger
 * /budgets/{budgetId}:
 *   put:
 *     summary: Update a budget
 *     description: Update an existing budget.
 *     security:
 *       - bearerAuth: []
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
router.put("/:budgetId", authenticateToken, budgetController.updateBudget);

/**
 * @swagger
 * /budgets/{budgetId}:
 *   delete:
 *     summary: Delete a budget
 *     description: Delete a specific budget.
 *     security:
 *       - bearerAuth: []
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
router.delete("/:budgetId", authenticateToken, budgetController.deleteBudget);

module.exports = router;
