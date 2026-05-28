const { UserCategoryMapping, Category, UserCategory } = require('../models');

const list = async (req, res) => {
  try {
    const mappings = await UserCategoryMapping.findAll({
      where: { userId: req.user.id },
      order: [['companyPattern', 'ASC']],
    });

    // Enrich with user category info for display
    const enriched = await Promise.all(mappings.map(async (m) => {
      const data = m.toJSON();
      // Find the user_category that links to this system categoryId
      const uc = await UserCategory.findOne({
        where: { id: m.categoryId },
        include: [{ model: Category, attributes: ['name', 'icon'], required: false }],
      });
      data.userCategory = uc ? {
        id: uc.id,
        name: uc.customName || uc.Category?.name || 'Unknown',
        icon: uc.customIcon || uc.Category?.icon || '📂',
        color1: uc.color1,
      } : null;
      return data;
    }));

    return res.json(enriched);
  } catch (error) {
    console.error('List user category mappings error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const { companyPattern, categoryId, userCategoryId } = req.body;

    if (!companyPattern) {
      return res.status(400).json({ message: 'companyPattern is required' });
    }

    if (!userCategoryId && !categoryId) {
      return res.status(400).json({ message: 'A category selection is required' });
    }

    // Store the userCategoryId directly
    const resolvedCategoryId = userCategoryId || categoryId;

    const existing = await UserCategoryMapping.findOne({
      where: { userId: req.user.id, companyPattern },
    });
    if (existing) {
      return res.status(409).json({ message: 'Mapping already exists for this pattern', existingId: existing.id });
    }

    const { v4: uuidv4 } = require('uuid');
    const mapping = await UserCategoryMapping.create({
      id: uuidv4(),
      userId: req.user.id,
      companyPattern,
      categoryId: resolvedCategoryId,
    });
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

    const { companyPattern, userCategoryId } = req.body;

    if (userCategoryId) {
      mapping.categoryId = userCategoryId;
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
