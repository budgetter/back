const { UserCategoryMapping, GlobalCategoryMapping, Category, UserCategory } = require('../models');
const { Op } = require('sequelize');

/**
 * Resolves a userCategoryId for a parsed transaction description.
 * Priority:
 *   1. User's custom mapping (companyPattern match → returns the mapping's linked userCategoryId)
 *   2. Global mapping by country (match → find user_category by linked system categoryId)
 *   3. null (caller falls back to IntegrationMap.defaultCategoryId)
 *
 * @param {string} userId - User UUID
 * @param {string} description - Parsed company/description from email
 * @param {string} country - Country code (e.g., 'CO')
 * @returns {Promise<string|null>} userCategoryId or null
 */
async function resolve(userId, description, country) {
  if (!description) return null;

  const descLower = description.toLowerCase();

  // 1. Check user's custom mappings (these already point to categoryId in old system)
  const userMappings = await UserCategoryMapping.findAll({
    where: { userId },
  });

  for (const mapping of userMappings) {
    if (descLower.includes(mapping.companyPattern.toLowerCase())) {
      // mapping.categoryId is a system categories.id — find the user_category that links to it
      const uc = await UserCategory.findOne({
        where: { userId, categoryId: mapping.categoryId },
      });
      if (uc) return uc.id;
      // Fallback: return null, let default handle it
      return null;
    }
  }

  // 2. Check global mappings for the country
  const globalMappings = await GlobalCategoryMapping.findAll({
    where: { country },
  });

  for (const mapping of globalMappings) {
    if (descLower.includes(mapping.companyPattern.toLowerCase())) {
      // Find system category by name
      const category = await Category.findOne({
        where: { name: { [Op.like]: mapping.categoryName } },
      });
      if (category) {
        // Find user's copy of this system category
        const uc = await UserCategory.findOne({
          where: { userId, categoryId: category.id },
        });
        if (uc) return uc.id;
      }
    }
  }

  // 3. No match
  return null;
}

module.exports = { resolve };
