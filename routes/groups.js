const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware"); // e.g., require ['Leader']
const groupController = require("../controllers/groupController");

/**
 * @swagger
 * /groups:
 *   post:
 *     summary: Create a new group
 *     description: Create a new group where the authenticated user becomes the group Leader.
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         description: Group details.
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             description:
 *               type: string
 *     responses:
 *       201:
 *         description: Group created successfully.
 *       400:
 *         description: Invalid input.
 */
router.post("/", authenticateToken, groupController.createGroup);

/**
 * @swagger
 * /groups/{groupId}:
 *   get:
 *     summary: Get group details
 *     description: Retrieve details of a specific group.
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         description: ID of the group to retrieve.
 *         type: string
 *     responses:
 *       200:
 *         description: Group details retrieved successfully.
 *       404:
 *         description: Group not found.
 */
router.get("/:groupId", authenticateToken, groupController.getGroup);

/**
 * @swagger
 * /groups/{groupId}:
 *   put:
 *     summary: Update a group
 *     description: Update an existing group. Accessible only by users with the 'Leader' role.
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         description: ID of the group to update.
 *         type: string
 *       - name: body
 *         in: body
 *         required: true
 *         description: Updated group details.
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             description:
 *               type: string
 *     responses:
 *       200:
 *         description: Group updated successfully.
 *       400:
 *         description: Invalid input.
 *       404:
 *         description: Group not found.
 */
router.put(
  "/:groupId",
  authenticateToken,
  roleMiddleware(["Leader"]),
  groupController.updateGroup
);

/**
 * @swagger
 * /groups/{groupId}:
 *   delete:
 *     summary: Delete a group
 *     description: Delete a specific group. Accessible only by users with the 'Leader' role.
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         description: ID of the group to delete.
 *         type: string
 *     responses:
 *       204:
 *         description: Group deleted successfully.
 *       404:
 *         description: Group not found.
 */
router.delete(
  "/:groupId",
  authenticateToken,
  roleMiddleware(["Leader"]),
  groupController.deleteGroup
);

/**
 * @swagger
 * /groups/{groupId}/join:
 *   post:
 *     summary: Join a group
 *     description: Join a specific group and assign the default 'Member' role.
 *     parameters:
 *       - name: groupId
 *         in: path
 *         required: true
 *         description: ID of the group to join.
 *         type: string
 *     responses:
 *       200:
 *         description: Successfully joined the group.
 *       404:
 *         description: Group not found.
 */
router.post("/:groupId/join", authenticateToken, groupController.joinGroup);

module.exports = router;
