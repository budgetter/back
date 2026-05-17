const { UserCategoryMapping, GlobalCategoryMapping, Category } = require('../models');
const { Op } = require('sequelize');

/**
 * Resolves a categoryId for a parsed transaction description.
 * Priority:
 *   1. User's custom mapping (case-insensitive contains match)
 *   2. Global mapping by country (case-insensitive contains match → find Category by name)
 *   3. null (caller falls back to IntegrationMap.defaultCategoryId)
 *
 * @param {string} userId - User UUID
 * @param {string} description - Parsed company/description from email
 * @param {string} country - Country code (e.g., 'CO')
 * @returns {Promise<string|null>} categoryId or null
 */
async function resolve(userId, description, country) {
  if (!description) return null;

  const descLower = description.toLowerCase();

  // 1. Check user's custom mappings
  const userMappings = await UserCategoryMapping.findAll({
    where: { userId },
  });

  for (const mapping of userMappings) {
    if (descLower.includes(mapping.companyPattern.toLowerCase())) {
      return mapping.categoryId;
    }
  }

  // 2. Check global mappings for the country
  const globalMappings = await GlobalCategoryMapping.findAll({
    where: { country },
  });

  for (const mapping of globalMappings) {
    if (descLower.includes(mapping.companyPattern.toLowerCase())) {
      // Find category by name (case-insensitive)
      const category = await Category.findOne({
        where: {
          name: { [Op.like]: mapping.categoryName },
        },
      });
      if (category) return category.id;
    }
  }

  // 3. No match
  return null;
}

module.exports = { resolve };
