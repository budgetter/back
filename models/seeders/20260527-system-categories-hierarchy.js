"use strict";

const { v4: uuidv4 } = require("uuid");

// Parent categories with their subcategories
const SYSTEM_CATEGORIES = [
  {
    translationKey: "income",
    name: "Income",
    type: "income",
    icon: "💰",
    color1: "#10b981",
    sortOrder: 0,
    children: [
      { translationKey: "salary", name: "Salary", icon: "💵" },
      { translationKey: "freelance", name: "Freelance", icon: "💻" },
      { translationKey: "investments", name: "Investments", icon: "📈" },
      { translationKey: "gifts_income", name: "Gifts", icon: "🎁" },
      { translationKey: "other_income", name: "Other Income", icon: "💸" },
    ],
  },
  {
    translationKey: "housing",
    name: "Housing",
    type: "expense",
    icon: "🏠",
    color1: "#f59e0b",
    sortOrder: 1,
    children: [
      { translationKey: "rent_mortgage", name: "Rent / Mortgage", icon: "🏡" },
      { translationKey: "utilities", name: "Utilities", icon: "⚡" },
      { translationKey: "insurance_home", name: "Insurance", icon: "🛡️" },
      { translationKey: "maintenance", name: "Maintenance", icon: "🔧" },
      { translationKey: "home_supplies", name: "Home Supplies", icon: "🧹" },
    ],
  },
  {
    translationKey: "food_dining",
    name: "Food & Dining",
    type: "expense",
    icon: "🍔",
    color1: "#3b82f6",
    sortOrder: 2,
    children: [
      { translationKey: "groceries", name: "Groceries", icon: "🛒" },
      { translationKey: "restaurants", name: "Restaurants", icon: "🍕" },
      { translationKey: "coffee", name: "Coffee", icon: "☕" },
      { translationKey: "delivery", name: "Delivery", icon: "🛵" },
      { translationKey: "snacks", name: "Snacks", icon: "🍿" },
    ],
  },
  {
    translationKey: "transport",
    name: "Transport",
    type: "expense",
    icon: "🚗",
    color1: "#8b5cf6",
    sortOrder: 3,
    children: [
      { translationKey: "gas", name: "Gas", icon: "⛽" },
      { translationKey: "public_transit", name: "Public Transit", icon: "🚌" },
      { translationKey: "taxi_uber", name: "Taxi / Uber", icon: "🛺" },
      { translationKey: "parking", name: "Parking", icon: "🅿️" },
      { translationKey: "car_maintenance", name: "Car Maintenance", icon: "🔩" },
    ],
  },
  {
    translationKey: "shopping",
    name: "Shopping",
    type: "expense",
    icon: "🛍️",
    color1: "#ec4899",
    sortOrder: 4,
    children: [
      { translationKey: "clothing", name: "Clothing", icon: "👕" },
      { translationKey: "electronics", name: "Electronics", icon: "📱" },
      { translationKey: "home_goods", name: "Home Goods", icon: "🛋️" },
      { translationKey: "gifts_shopping", name: "Gifts", icon: "🎀" },
    ],
  },
  {
    translationKey: "health",
    name: "Health",
    type: "expense",
    icon: "💊",
    color1: "#ef4444",
    sortOrder: 5,
    children: [
      { translationKey: "doctor", name: "Doctor", icon: "🏥" },
      { translationKey: "pharmacy", name: "Pharmacy", icon: "💊" },
      { translationKey: "gym", name: "Gym", icon: "🏋️" },
      { translationKey: "insurance_health", name: "Health Insurance", icon: "❤️" },
      { translationKey: "personal_care", name: "Personal Care", icon: "🛁" },
    ],
  },
  {
    translationKey: "entertainment",
    name: "Entertainment",
    type: "expense",
    icon: "🎬",
    color1: "#f472b6",
    sortOrder: 6,
    children: [
      { translationKey: "streaming", name: "Streaming", icon: "📺" },
      { translationKey: "movies", name: "Movies", icon: "🎬" },
      { translationKey: "games", name: "Games", icon: "🎮" },
      { translationKey: "hobbies", name: "Hobbies", icon: "🎨" },
      { translationKey: "nightlife", name: "Nightlife", icon: "🍻" },
      { translationKey: "vacation", name: "Vacation", icon: "🏖️" },
    ],
  },
  {
    translationKey: "education",
    name: "Education",
    type: "expense",
    icon: "📚",
    color1: "#06b6d4",
    sortOrder: 7,
    children: [
      { translationKey: "courses", name: "Courses", icon: "🎓" },
      { translationKey: "books", name: "Books", icon: "📖" },
      { translationKey: "software_edu", name: "Software", icon: "💻" },
    ],
  },
  {
    translationKey: "financial",
    name: "Financial",
    type: "expense",
    icon: "💳",
    color1: "#6366f1",
    sortOrder: 8,
    children: [
      { translationKey: "loan_payment", name: "Loan Payment", icon: "🏦" },
      { translationKey: "credit_card", name: "Credit Card", icon: "💳" },
      { translationKey: "bank_fees", name: "Bank Fees", icon: "🏧" },
      { translationKey: "savings", name: "Savings", icon: "🐷" },
    ],
  },
  {
    translationKey: "subscriptions",
    name: "Subscriptions",
    type: "expense",
    icon: "📱",
    color1: "#14b8a6",
    sortOrder: 9,
    children: [
      { translationKey: "phone_plan", name: "Phone Plan", icon: "📞" },
      { translationKey: "internet", name: "Internet", icon: "📡" },
      { translationKey: "software_sub", name: "Software", icon: "⚙️" },
      { translationKey: "cloud_storage", name: "Cloud Storage", icon: "☁️" },
    ],
  },
  {
    translationKey: "personal",
    name: "Personal",
    type: "expense",
    icon: "🧑",
    color1: "#a855f7",
    sortOrder: 10,
    children: [
      { translationKey: "pet", name: "Pet", icon: "🐾" },
      { translationKey: "beauty", name: "Beauty", icon: "💅" },
      { translationKey: "laundry", name: "Laundry", icon: "👔" },
      { translationKey: "misc_personal", name: "Miscellaneous", icon: "📦" },
    ],
  },
  {
    translationKey: "other",
    name: "Other",
    type: "expense",
    icon: "❓",
    color1: "#6b7280",
    sortOrder: 11,
    children: [
      { translationKey: "uncategorized", name: "Uncategorized", icon: "❓" },
    ],
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // Check if system categories already exist
    const existing = await queryInterface.sequelize.query(
      "SELECT translationKey FROM categories WHERE isSystem = true AND translationKey IS NOT NULL",
      { type: Sequelize.QueryTypes.SELECT }
    );
    const existingKeys = new Set(existing.map(r => r.translationKey));

    for (const parent of SYSTEM_CATEGORIES) {
      let parentId;

      if (!existingKeys.has(parent.translationKey)) {
        parentId = uuidv4();
        await queryInterface.bulkInsert("categories", [{
          id: parentId,
          name: parent.name,
          type: parent.type,
          icon: parent.icon,
          parentId: null,
          isSystem: true,
          sortOrder: parent.sortOrder,
          translationKey: parent.translationKey,
          color1: parent.color1,
          color2: null,
          description: null,
          createdAt: now,
          updatedAt: now,
        }]);
      } else {
        // Get existing parent ID
        const [rows] = await queryInterface.sequelize.query(
          "SELECT id FROM categories WHERE translationKey = ? AND isSystem = true",
          { replacements: [parent.translationKey] }
        );
        parentId = rows[0].id;
      }

      // Insert children
      for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (!existingKeys.has(child.translationKey)) {
          await queryInterface.bulkInsert("categories", [{
            id: uuidv4(),
            name: child.name,
            type: parent.type,
            icon: child.icon,
            parentId,
            isSystem: true,
            sortOrder: i,
            translationKey: child.translationKey,
            color1: parent.color1,
            color2: null,
            description: null,
            createdAt: now,
            updatedAt: now,
          }]);
        }
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("categories", { isSystem: true });
  },
};
