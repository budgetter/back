const { UserCategoryMapping, Category } = require('../models');

const list = async (req, res) => {
  try {
    const mappings = await UserCategoryMapping.findAll({
      where: { userId: req.user.id },
      include: [{ model: Category, attributes: ['id', 'name', 'icon'] }],
      order: [['companyPattern', 'ASC']],
    });
    return res.json(mappings);
  } catch (error) {
    console.error('List user category mappings error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const { companyPattern, categoryId } = req.body;

    if (!companyPattern || !categoryId) {
      return res.status(400).json({ message: 'companyPattern and categoryId are required' });
    }

    const category = await Category.findByPk(categoryId);
    if (!category) return res.status(400).json({ message: 'Category not found' });

    const existing = await UserCategoryMapping.findOne({
      where: { userId: req.user.id, companyPattern },
    });
    if (existing) return res.status(409).json({ message: 'Mapping already exists for this pattern' });

    const { v4: uuidv4 } = require('uuid');
    const mapping = await UserCategoryMapping.create({ id: uuidv4(), userId: req.user.id, companyPattern, categoryId });
    return res.status(201).json(mapping);
  } catch (error) {
    console.error('Create user category mapping error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const mapping = await UserCategoryMapping.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!mapping) return res.status(404).json({ message: 'Mapping not found' });

    const { companyPattern, categoryId } = req.body;

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) return res.status(400).json({ message: 'Category not found' });
      mapping.categoryId = categoryId;
    }
    if (companyPattern !== undefined) mapping.companyPattern = companyPattern;

    await mapping.save();
    return res.json(mapping);
  } catch (error) {
    console.error('Update user category mapping error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const mapping = await UserCategoryMapping.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!mapping) return res.status(404).json({ message: 'Mapping not found' });

    await mapping.destroy();
    return res.json({ message: 'Mapping deleted' });
  } catch (error) {
    console.error('Delete user category mapping error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { list, create, update, remove };
