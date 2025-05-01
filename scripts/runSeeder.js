const sequelize = require("../config/database");
const seeder = require("../models/seeders/20250401-defaultCategories");

async function runSeeder() {
  try {
    // Get queryInterface from sequelize instance
    const queryInterface = sequelize.getQueryInterface();

    // Run the seeder's up method
    await seeder.up(queryInterface, sequelize.constructor);

    console.log("Seeder ran successfully.");
  } catch (error) {
    console.error("Error running seeder:", error);
  } finally {
    // Close the database connection
    await sequelize.close();
  }
}

runSeeder();
