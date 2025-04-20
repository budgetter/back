const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const passport = require("passport");
const jwt = require("jsonwebtoken");

router.post("/register", register);

router.post("/login", login);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

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
