const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config;
const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./swagger");

const sequelize = require("./config/database");
require("./models");
const defaultCategoriesSeeder = require("./models/seeders/20250401-defaultCategories");

const passport = require("./config/passport");
const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(
  cors({
    origin: process.env.VITE_API_URL,
    credentials: true,
  })
);

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
const budgetSectionsRoutes = require("./routes/budgetSections");
const budgetCategoryPlansRoutes = require("./routes/budgetCategoryPlans");
const categoriesRoutes = require("./routes/categories");

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

app.get("/", (req, res) => {
  res.send("API is running");
});

sequelize
  .sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    // Run the default categories seeder
    return defaultCategoriesSeeder
      .up(sequelize.getQueryInterface())
      .then(() => {
        console.log("Default categories seeded successfully.");
      })
      .catch((error) => {
        console.error("Error seeding default categories: ", error);
      });
  })
  .catch((err) => console.error("Error syncing with the database: ", err));
