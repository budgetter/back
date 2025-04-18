const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const passport = require("passport");
const jwt = require("jsonwebtoken");

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
router.post("/register", register);

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
router.post("/login", login);

/**
 * Initiate Google OAuth login.
 */
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

/**
 * Google OAuth callback endpoint.
 * We disable session support by setting { session: false } because we are using JWT.
 * On success, a JWT token is generated and the user is redirected back to the front end.
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    // Generate a JWT token for the authenticated user.
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "48h" }
    );
    // Redirect back to the front end with the token as a query parameter.
    res.redirect(`${process.env.ORIGIN_URL}/login?token=${token}`);
  }
);

module.exports = router;
