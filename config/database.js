const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
  }
);

// Test Connection
sequelize
  .authenticate()
  .then(() => console.log("Database connection established."))
  .catch((err) => console.error("Error connecting to database:", err));

module.exports = sequelize;
