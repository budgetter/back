const express = require("express");
const cors = require('cors');
const bodyParser = require("body-parser");
require("dotenv").config;
const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./swagger");

const sequelize = require("./config/database");
require("./models");

const passport = require('./config/passport');
const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(bodyParser.json());
app.use(passport.initialize());

// Serve Swagger docs
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const groupRoutes = require("./routes/groups");
const budgetRoutes = require("./routes/budgets");
const transactionRoutes = require("./routes/transactions");
const recurrentPaymentRoutes = require("./routes/recurrentPayments");
const debtRoutes = require("./routes/debts");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/recurrent-payments", recurrentPaymentRoutes);
app.use("/api/debts", debtRoutes);

app.get("/", (req, res) => {
  res.send("API is running");
});

sequelize
  .sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("Error syncing with the database: ", err));
