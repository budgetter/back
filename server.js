const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const serverless = require("serverless-http");

const sequelize = require("./config/database");
require("./models");
const defaultCategoriesSeeder = require("./models/seeders/20250401-defaultCategories");

const passport = require("./config/passport");
const app = express();

app.use(
  cors({
    origin: process.env.ORIGIN_URL,
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(passport.initialize());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const groupRoutes = require("./routes/groups");
const budgetRoutes = require("./routes/budgets");
const transactionRoutes = require("./routes/transactions");
const recurrentPaymentRoutes = require("./routes/recurrentPayments");
const debtRoutes = require("./routes/debts");
const budgetSectionsRoutes = require("./routes/budgetSections");
const budgetCategoryPlansRoutes = require("./routes/budgetCategoryPlans");
const categoriesRoutes = require("./routes/categories");
const walletRoutes = require("./routes/wallets"); // Added wallets route
const dashboardRoutes = require("./routes/dashboard");
const integrationRoutes = require("./routes/integration");
const splitRoutes = require("./routes/splits");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/recurrent-payments", recurrentPaymentRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/budgets", budgetSectionsRoutes);
app.use("/api/budgets", budgetCategoryPlansRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/wallets", walletRoutes); // Register wallets route
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/integration", integrationRoutes);
app.use("/api/splits", splitRoutes);

app.get("/api/", (req, res) => {
  res.status(200).send("API is running");
});

// Error handling middleware to catch all errors and log them
app.use((err, req, res, next) => {
  console.error("Error caught in middleware:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Initialize database connection once on startup
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");

    // Run migrations on every startup (they are idempotent — safe to re-run)
    const { exec } = require("child_process");
    await new Promise((resolve, reject) => {
      exec("npx sequelize-cli db:migrate", (error, stdout, stderr) => {
        if (error) {
          console.error(`Migration error: ${error.message}`);
          // Don't reject — allow app to start even if migration fails
          resolve();
          return;
        }
        if (stderr) {
          console.error(`Migration stderr: ${stderr}`);
        }
        console.log(`Migration stdout: ${stdout}`);
        resolve();
      });
    });

    // Only run seeders in development
    if (process.env.NODE_ENV === "development") {
      const { Sequelize } = require('sequelize');
      await defaultCategoriesSeeder.up(sequelize.getQueryInterface(), Sequelize);
      console.log("Default categories seeded successfully.");
    }
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

// Immediately initialize database connection on startup
initializeDatabase();

// Export the Express app directly
module.exports = app;
