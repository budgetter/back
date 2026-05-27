const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const serverless = require("serverless-http");

const sequelize = require("./config/database");
require("./models");
const defaultCategoriesSeeder = require("./models/seeders/20250401-defaultCategories");
const systemCategoriesSeeder = require("./models/seeders/20260527-system-categories-hierarchy");

const passport = require("./config/passport");
const app = express();

// Trust proxy headers (Netlify terminates SSL, so req.protocol needs X-Forwarded-Proto)
app.set('trust proxy', true);

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
const adminRoutes = require("./routes/admin");
const pushRoutes = require("./routes/push");
const userCategoryRoutes = require("./routes/userCategories");

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
app.use("/api/admin", adminRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/user-categories", userCategoryRoutes);

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

    // Only run migrations and seeders in development (production runs migrations during build)
    if (process.env.NODE_ENV === "development") {
      const { exec } = require("child_process");
      await new Promise((resolve, reject) => {
        exec("npx sequelize-cli db:migrate", (error, stdout, stderr) => {
          if (error) {
            console.error(`Migration error: ${error.message}`);
            reject(error);
            return;
          }
          if (stderr) {
            console.error(`Migration stderr: ${stderr}`);
          }
          console.log(`Migration stdout: ${stdout}`);
          resolve();
        });
      });
      const { Sequelize } = require('sequelize');
      await defaultCategoriesSeeder.up(sequelize.getQueryInterface(), Sequelize);
      console.log("Default categories seeded successfully.");
      await systemCategoriesSeeder.up(sequelize.getQueryInterface(), Sequelize);
      console.log("System categories hierarchy seeded successfully.");
    }
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

// Immediately initialize database connection on startup
initializeDatabase();

const { startScheduledSync } = require('./services/scheduledSyncService');
startScheduledSync();

// Export the Express app directly
module.exports = app;
