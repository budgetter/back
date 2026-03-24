const { Category } = require('../models');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

async function getCategories(req, res) {
  try {
    const categories = await Category.findAll();
    return res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ message: 'Server error while fetching categories' });
  }
}

async function createCategory(req, res) {
  try {
    const { name, emoji, type = 'expense' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    if (!['expense', 'income'].includes(type)) {
      return res.status(400).json({ message: 'Type must be "expense" or "income"' });
    }

    // Duplicate check – case-insensitive
    const existing = await Category.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        Op.eq,
        name.trim().toLowerCase()
      ),
    });

    if (existing) {
      return res.status(409).json({ message: `A category named "${existing.name}" already exists` });
    }

    const category = await Category.create({
      name: name.trim(),
      icon: emoji || null,
      type,
    });

    return res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({ message: 'Server error while creating category' });
  }
}

module.exports = { getCategories, createCategory };
