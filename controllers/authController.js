const User = require("../models/User");
const Budget = require("../models/Budget");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

async function createDefaultBudget(userId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const startDate = new Date(year, month, 1, 0).toISOString().split("T")[0];
  const endDate = new Date(year, month, 1, 0).toISOString().split("T")[0];

  return Budget.create({
    ownerType: "User",
    ownerId: userId,
    name: "Personal Budget",
    totalBudget: 0,
    startDate,
    endDate,
  });
}

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
    await createDefaultBudget(newUser.id);

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
    // Sign a JWT token with a 1-hour expiration
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    return res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

module.exports = { register, login };
