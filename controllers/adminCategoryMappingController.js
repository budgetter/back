const { GlobalCategoryMapping } = require('../models');

const list = async (req, res) => {
  try {
    const where = {};
    if (req.query.country) where.country = req.query.country;

    const mappings = await GlobalCategoryMapping.findAll({ where, order: [['country', 'ASC'], ['companyPattern', 'ASC']] });
    return res.json(mappings);
  } catch (error) {
    console.error('List global category mappings error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const { country, companyPattern, categoryName } = req.body;

    if (!country || !companyPattern || !categoryName) {
      return res.status(400).json({ message: 'country, companyPattern, and categoryName are required' });
    }

    const existing = await GlobalCategoryMapping.findOne({ where: { country, companyPattern } });
    if (existing) return res.status(409).json({ message: 'Mapping already exists for this country and pattern' });

    const mapping = await GlobalCategoryMapping.create({ country, companyPattern, categoryName });
    return res.status(201).json(mapping);
  } catch (error) {
    console.error('Create global category mapping error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const mapping = await GlobalCategoryMapping.findByPk(req.params.id);
    if (!mapping) return res.status(404).json({ message: 'Mapping not found' });

    const { country, companyPattern, categoryName } = req.body;
    if (country !== undefined) mapping.country = country;
    if (companyPattern !== undefined) mapping.companyPattern = companyPattern;
    if (categoryName !== undefined) mapping.categoryName = categoryName;

    await mapping.save();
    return res.json(mapping);
  } catch (error) {
    console.error('Update global category mapping error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const mapping = await GlobalCategoryMapping.findByPk(req.params.id);
    if (!mapping) return res.status(404).json({ message: 'Mapping not found' });

    await mapping.destroy();
    return res.json({ message: 'Mapping deleted' });
  } catch (error) {
    console.error('Delete global category mapping error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { list, create, update, remove };
