const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config;

const sequelize = require("./config/database");
require("./models");

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("API is running");
});

sequelize
  .sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("Error syncing with the database: ", err));
