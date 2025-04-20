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

// Error handling middleware to catch all errors and log them
app.use((err, req, res, next) => {
  console.error("Error caught in middleware:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error" });
  }
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

app.use("/.netlify/functions/api/auth", authRoutes);
app.use("/.netlify/functions/api/users", userRoutes);
app.use("/.netlify/functions/api/groups", groupRoutes);
app.use("/.netlify/functions/api/budgets", budgetRoutes);
app.use("/.netlify/functions/api/transactions", transactionRoutes);
app.use("/.netlify/functions/api/recurrent-payments", recurrentPaymentRoutes);
app.use("/.netlify/functions/api/debts", debtRoutes);
app.use("/.netlify/functions/api/budgets", budgetSectionsRoutes);
app.use("/.netlify/functions/api/budgets", budgetCategoryPlansRoutes);
app.use("/.netlify/functions/api/categories", categoriesRoutes);

app.get("/.netlify/functions/api/", (req, res) => {
  res.status(200).send("API is running");
});

app.get("/.netlify/functions/api/test", (req, res) => {
  console.log("Test endpoint hit");
  return res.status(200).json({ message: "Test endpoint working" });
});

// Initialize database connection with timeout handling
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");

    // Only run migrations and seeders in development
    if (process.env.NODE_ENV === "development") {
      await sequelize.sync({ alter: true });
      await defaultCategoriesSeeder.up(sequelize.getQueryInterface());
      console.log("Default categories seeded successfully.");
    }
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

// Create the serverless handler
const serverlessHandler = serverless(app, {
  binary: ["image/*", "application/json"],
  response: {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  },
});

// Wrap the handler with database connection management
const handler = async (event, context) => {
  // Initialize database connection for this invocation
  await initializeDatabase();

  // Execute the request
  const result = await serverlessHandler(event, context);

  // Ensure the response is properly formatted
  if (!result) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "No response from handler" }),
    };
  }

  return result;
};

// Export the handler
module.exports.handler = handler;
