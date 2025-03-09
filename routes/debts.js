const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const debtController = require("../controllers/debtController");

/**
 * @swagger
 * /debts:
 *   post:
 *     summary: Create a new debt
 *     description: Create a new debt for the authenticated user.
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         description: Debt details.
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *             description:
 *               type: string
 *     responses:
 *       201:
 *         description: Debt created successfully.
 *       400:
 *         description: Invalid input.
 */
router.post("/", authenticateToken, debtController.createDebt);

/**
 * @swagger
 * /debts:
 *   get:
 *     summary: Get all debts
 *     description: Retrieve all debts for the authenticated user.
 *     responses:
 *       200:
 *         description: List of debts retrieved successfully.
 *       401:
 *         description: Unauthorized.
 */
router.get("/", authenticateToken, debtController.getDebts);

/**
 * @swagger
 * /debts/{id}:
 *   put:
 *     summary: Update a debt
 *     description: Update an existing debt.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the debt to update.
 *         type: string
 *       - name: body
 *         in: body
 *         required: true
 *         description: Updated debt details.
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *             description:
 *               type: string
 *     responses:
 *       200:
 *         description: Debt updated successfully.
 *       400:
 *         description: Invalid input.
 *       404:
 *         description: Debt not found.
 */
router.put("/:id", authenticateToken, debtController.updateDebt);

/**
 * @swagger
 * /debts/{id}:
 *   delete:
 *     summary: Delete a debt
 *     description: Delete a specific debt.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the debt to delete.
 *         type: string
 *     responses:
 *       204:
 *         description: Debt deleted successfully.
 *       404:
 *         description: Debt not found.
 */
router.delete("/:id", authenticateToken, debtController.deleteDebt);

module.exports = router;
