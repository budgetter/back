const { ParserConfig } = require('../models');

/**
 * Validates that regex patterns in the config are compilable.
 */
function validateRegexPatterns(patterns) {
  const requiredFields = ['amount', 'description'];
  for (const field of requiredFields) {
    if (!patterns[field] || !patterns[field].pattern) {
      return `Missing required regex pattern for "${field}"`;
    }
    try {
      new RegExp(patterns[field].pattern, 'i');
    } catch (e) {
      return `Invalid regex for "${field}": ${e.message}`;
    }
  }
  // Optional date pattern
  if (patterns.date && patterns.date.pattern) {
    try {
      new RegExp(patterns.date.pattern, 'i');
    } catch (e) {
      return `Invalid regex for "date": ${e.message}`;
    }
  }
  return null;
}

const list = async (req, res) => {
  try {
    const where = {};
    if (req.query.country) where.country = req.query.country;

    const parsers = await ParserConfig.findAll({ where, order: [['country', 'ASC'], ['bankName', 'ASC']] });
    return res.json(parsers);
  } catch (error) {
    console.error('List parsers error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const { country, bankName, senderEmail, regexPatterns, isActive } = req.body;

    if (!country || !bankName || !senderEmail || !regexPatterns) {
      return res.status(400).json({ message: 'country, bankName, senderEmail, and regexPatterns are required' });
    }

    const validationError = validateRegexPatterns(regexPatterns);
    if (validationError) return res.status(400).json({ message: validationError });

    const parser = await ParserConfig.create({ country, bankName, senderEmail, regexPatterns, isActive: isActive !== false });
    return res.status(201).json(parser);
  } catch (error) {
    console.error('Create parser error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const parser = await ParserConfig.findByPk(req.params.id);
    if (!parser) return res.status(404).json({ message: 'Parser not found' });

    const { country, bankName, senderEmail, regexPatterns, isActive } = req.body;

    if (regexPatterns) {
      const validationError = validateRegexPatterns(regexPatterns);
      if (validationError) return res.status(400).json({ message: validationError });
    }

    if (country !== undefined) parser.country = country;
    if (bankName !== undefined) parser.bankName = bankName;
    if (senderEmail !== undefined) parser.senderEmail = senderEmail;
    if (regexPatterns !== undefined) parser.regexPatterns = regexPatterns;
    if (isActive !== undefined) parser.isActive = isActive;

    await parser.save();
    return res.json(parser);
  } catch (error) {
    console.error('Update parser error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const parser = await ParserConfig.findByPk(req.params.id);
    if (!parser) return res.status(404).json({ message: 'Parser not found' });

    await parser.destroy();
    return res.json({ message: 'Parser deleted' });
  } catch (error) {
    console.error('Delete parser error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { list, create, update, remove };
