const { UserCategory, Category, Transaction, sequelize } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// Initialize user_categories from system defaults for a user
async function initializeUserCategories(userId) {
  const existing = await UserCategory.count({ where: { userId } });
  if (existing > 0) return;

  const systemParents = await Category.findAll({
    where: { isSystem: true, parentId: null },
    order: [['sortOrder', 'ASC']],
  });

  if (systemParents.length === 0) return; // Seeder hasn't run

  for (const parent of systemParents) {
    const userParentId = uuidv4();
    await UserCategory.create({
      id: userParentId,
      userId,
      categoryId: parent.id,
      customName: null,
      customIcon: null,
      color1: parent.color1,
      color2: parent.color2,
      parentId: null,
      sortOrder: parent.sortOrder,
      hidden: false,
    });

    const children = await Category.findAll({
      where: { isSystem: true, parentId: parent.id },
      order: [['sortOrder', 'ASC']],
    });

    for (const child of children) {
      await UserCategory.create({
        id: uuidv4(),
        userId,
        categoryId: child.id,
        customName: null,
        customIcon: null,
        color1: child.color1,
        color2: child.color2,
        parentId: userParentId,
        sortOrder: child.sortOrder,
        hidden: false,
      });
    }
  }
}

// GET /user-categories — tree structure
async function getUserCategories(req, res) {
  try {
    const userId = req.user.id;

    const categories = await UserCategory.findAll({
      where: { userId },
      include: [{ model: Category, attributes: ['name', 'icon', 'translationKey', 'type'] }],
      order: [['sortOrder', 'ASC']],
    });

    // Build tree
    const parents = categories.filter(c => !c.parentId);
    const tree = parents.map(p => {
      const cat = p.Category;
      return {
        id: p.id,
        categoryId: p.categoryId,
        name: p.customName || cat?.name || 'Custom',
        icon: p.customIcon || cat?.icon || '📂',
        translationKey: cat?.translationKey || null,
        color1: p.color1 || cat?.color1,
        color2: p.color2 || cat?.color2,
        type: cat?.type || 'expense',
        sortOrder: p.sortOrder,
        hidden: p.hidden,
        children: categories
          .filter(c => c.parentId === p.id)
          .map(c => {
            const childCat = c.Category;
            return {
              id: c.id,
              categoryId: c.categoryId,
              name: c.customName || childCat?.name || 'Custom',
              icon: c.customIcon || childCat?.icon || '📂',
              translationKey: childCat?.translationKey || null,
              color1: c.color1 || childCat?.color1,
              color2: c.color2 || childCat?.color2,
              type: childCat?.type || p.Category?.type || 'expense',
              sortOrder: c.sortOrder,
              hidden: c.hidden,
              parentId: c.parentId,
            };
          }),
      };
    });

    return res.json(tree);
  } catch (error) {
    console.error('Error fetching user categories:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// POST /user-categories — create custom
async function createUserCategory(req, res) {
  try {
    const userId = req.user.id;
    const { name, icon, color1, color2, parentId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const maxOrder = await UserCategory.max('sortOrder', {
      where: { userId, parentId: parentId || null },
    });

    const userCat = await UserCategory.create({
      userId,
      categoryId: null,
      customName: name.trim(),
      customIcon: icon || '📂',
      color1: color1 || '#6b7280',
      color2: color2 || null,
      parentId: parentId || null,
      sortOrder: (maxOrder || 0) + 1,
      hidden: false,
    });

    return res.status(201).json(userCat);
  } catch (error) {
    console.error('Error creating user category:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PUT /user-categories/:id
async function updateUserCategory(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { customName, customIcon, color1, color2, parentId, sortOrder } = req.body;

    const cat = await UserCategory.findOne({ where: { id, userId } });
    if (!cat) return res.status(404).json({ message: 'Not found' });

    if (customName !== undefined) cat.customName = customName;
    if (customIcon !== undefined) cat.customIcon = customIcon;
    if (color1 !== undefined) cat.color1 = color1;
    if (color2 !== undefined) cat.color2 = color2;
    if (parentId !== undefined) cat.parentId = parentId;
    if (sortOrder !== undefined) cat.sortOrder = sortOrder;

    await cat.save();
    return res.json(cat);
  } catch (error) {
    console.error('Error updating user category:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PUT /user-categories/:id/hide
async function hideUserCategory(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const cat = await UserCategory.findOne({ where: { id, userId } });
    if (!cat) return res.status(404).json({ message: 'Not found' });
    cat.hidden = true;
    await cat.save();
    return res.json(cat);
  } catch (error) {
    console.error('Error hiding category:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PUT /user-categories/:id/restore
async function restoreUserCategory(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const cat = await UserCategory.findOne({ where: { id, userId } });
    if (!cat) return res.status(404).json({ message: 'Not found' });
    cat.hidden = false;
    await cat.save();
    return res.json(cat);
  } catch (error) {
    console.error('Error restoring category:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PUT /user-categories/reorder
async function reorderUserCategories(req, res) {
  try {
    const userId = req.user.id;
    const { items } = req.body; // [{id, sortOrder}]

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'items array required' });
    }

    await Promise.all(
      items.map(({ id, sortOrder }) =>
        UserCategory.update({ sortOrder }, { where: { id, userId } })
      )
    );

    return res.json({ message: 'Reordered' });
  } catch (error) {
    console.error('Error reordering:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /user-categories/frequent — hybrid frequency + recency
async function getFrequentCategories(req, res) {
  try {
    const userId = req.user.id;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Get transaction counts per userCategoryId
    const [results] = await sequelize.query(
      `SELECT userCategoryId, COUNT(*) as txCount FROM transactions 
       WHERE UserId = :userId AND userCategoryId IS NOT NULL AND date >= :since
       GROUP BY userCategoryId ORDER BY txCount DESC LIMIT 8`,
      { replacements: { userId, since: ninetyDaysAgo.toISOString().split('T')[0] } }
    );

    const categoryIds = results.map(r => r.userCategoryId);
    if (categoryIds.length === 0) {
      return res.json([]);
    }

    const categories = await UserCategory.findAll({
      where: { id: categoryIds },
      include: [{ model: Category, attributes: ['name', 'icon', 'translationKey', 'color1', 'color2'] }],
    });

    // Maintain frequency order
    const ordered = categoryIds.map(id => {
      const cat = categories.find(c => c.id === id);
      if (!cat) return null;
      const sysCat = cat.Category;
      return {
        id: cat.id,
        name: cat.customName || sysCat?.name || 'Custom',
        icon: cat.customIcon || sysCat?.icon || '📂',
        translationKey: sysCat?.translationKey || null,
        color1: cat.color1 || sysCat?.color1,
        color2: cat.color2 || sysCat?.color2,
      };
    }).filter(Boolean);

    return res.json(ordered);
  } catch (error) {
    console.error('Error fetching frequent categories:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// POST /user-categories/setup-defaults — user-triggered initialization
async function setupDefaults(req, res) {
  try {
    const userId = req.user.id;
    const existing = await UserCategory.count({ where: { userId } });
    if (existing > 0) {
      return res.status(409).json({ message: 'Categories already exist' });
    }
    await initializeUserCategories(userId);
    const count = await UserCategory.count({ where: { userId } });
    return res.json({ message: 'Defaults created', count });
  } catch (error) {
    console.error('Error setting up defaults:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// POST /user-categories/reset — delete all and re-create from system defaults
async function resetToDefaults(req, res) {
  try {
    const userId = req.user.id;
    await UserCategory.destroy({ where: { userId } });
    await initializeUserCategories(userId);
    const count = await UserCategory.count({ where: { userId } });
    return res.json({ message: 'Reset complete', count });
  } catch (error) {
    console.error('Error resetting categories:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getUserCategories,
  createUserCategory,
  updateUserCategory,
  hideUserCategory,
  restoreUserCategory,
  reorderUserCategories,
  getFrequentCategories,
  setupDefaults,
  resetToDefaults,
  initializeUserCategories,
};
