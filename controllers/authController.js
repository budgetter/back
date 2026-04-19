
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const BudgetService = require("../functions/budgetService");
const splitResolutionService = require("../services/splitResolutionService");
require("dotenv").config();

// Register a new user
const register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    //Create the user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // Create a default personal budget for the new user.
    await BudgetService.createDefaultBudget(newUser.id);

    // Resolve any pending split invitations for this email (non-blocking for registration)
    try {
      await splitResolutionService.resolveInvitations(email, newUser.id);
    } catch (invitationError) {
      console.error("Failed to resolve split invitations during registration:", invitationError);
    }

    return res
      .status(201)
      .json({ message: "User registered successfully", userId: newUser.id });
  } catch (error) {
    console.error("Registration error:", error);
    return res
      .status(500)
      .json({ message: "Server error during registration" });
  }
};

// Login an existing user
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Find the user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    // Compare provided password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    // Resolve any pending split invitations for this email (non-blocking for login)
    try {
      await splitResolutionService.resolveInvitations(email, user.id);
    } catch (invitationError) {
      console.error("Failed to resolve split invitations during login:", invitationError);
    }

    // Sign a JWT token with a 30-day expiration
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    return res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// Refresh token — issues a new token if the current one is still valid
const refreshToken = async (req, res) => {
  try {
    // req.user is set by authenticateToken middleware
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    return res.json({ token });
  } catch (error) {
    console.error("Token refresh error:", error);
    return res.status(500).json({ message: "Server error refreshing token" });
  }
};

module.exports = { register, login, refreshToken };
