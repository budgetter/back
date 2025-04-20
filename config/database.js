const { Sequelize } = require("sequelize");
require("dotenv").config();

let sequelize;

if (!global.sequelize) {
  global.sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      dialect: "mysql",
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      logging: false,
    }
  );

  // Test Connection
  global.sequelize
    .authenticate()
    .then(() => console.log("Database connection established."))
    .catch((err) => console.error("Error connecting to database:", err));
}

sequelize = global.sequelize;

module.exports = sequelize;
