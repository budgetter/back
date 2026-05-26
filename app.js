const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { validateEncryptionKey } = require("./utils/encryption");
const budgetRoutes = require("./routes/budgets");
const authRoutes = require("./routes/auth");
const categoryRoutes = require("./routes/categories");
const transactionRoutes = require("./routes/transactions");
const walletRoutes = require("./routes/wallets");
const debtRoutes = require("./routes/debts");
const dashboardRoutes = require("./routes/dashboard");
const groupRoutes = require("./routes/groups");
const integrationRoutes = require("./routes/integration");
const splitRoutes = require("./routes/splits");
const adminRoutes = require("./routes/admin");
const pushRoutes = require("./routes/push");

// Validate encryption key is set before starting the app
validateEncryptionKey();

const app = express();

// Trust proxy headers (Netlify terminates SSL, so req.protocol needs X-Forwarded-Proto)
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/integration", integrationRoutes);
app.use("/api/splits", splitRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/push", pushRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something broke!" });
});

module.exports = app;
