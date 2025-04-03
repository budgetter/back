"use strict";

const { v4: uuidv4 } = require("uuid");

module.exports = {
  async up(queryInterface) {
    // List of default categories with associated icon names (React Icons).
    const categories = [
      {
        id: uuidv4(),
        name: "Salary",
        type: "income",
        description: "Monthly salary",
        icon: "FiDollarSign",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        name: "Loan",
        type: "expense",
        description: "Credit loan payments",
        icon: "FiCreditCard",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        name: "Rent",
        type: "expense",
        description: "Monthly rent for housing",
        icon: "FiHome",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        name: "Internet",
        type: "expense",
        description: "Monthly internet bills",
        icon: "FiWifi",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        name: "Telephone",
        type: "expense",
        description: "Mobile or landline phone bills",
        icon: "FiPhone",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        name: "Bills",
        type: "expense",
        description: "General utilities or bills",
        icon: "FiFileText",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        name: "Food",
        type: "expense",
        description: "Groceries or dining out",
        icon: "FiShoppingBag",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Add more categories as needed...
    ];

    await queryInterface.bulkInsert("categories", categories, {});
  },

  async down(queryInterface) {
    // Remove these seeded categories if rolling back
    await queryInterface.bulkDelete("categories", null, {});
  },
};
