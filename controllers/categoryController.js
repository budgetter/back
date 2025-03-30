const { Category } = require('../models');

async function getCategories(req, res) {
  try {
    const categories = await Category.findAll();
    return res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ message: 'Server error while fetching categories' });
  }
}

module.exports = { getCategories };
