const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

/**
 * @swagger
 * /register:
 *   post:
 *     summary: User registration
 *     description: Register a new user.
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         description: User registration details.
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *             password:
 *               type: string
 *     responses:
 *       201:
 *         description: User registered successfully.
 *       400:
 *         description: Invalid input.
 */
router.post('/register', register);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: User login
 *     description: Log in an existing user.
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         description: User login credentials.
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *             password:
 *               type: string
 *     responses:
 *       200:
 *         description: User logged in successfully.
 *       401:
 *         description: Unauthorized.
 */
router.post('/login', login);

module.exports = router;
