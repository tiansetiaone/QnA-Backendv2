const Category = require('../models/Category');

// Tambahkan kategori baru
exports.createCategory = (req, res) => {
  const { category_name } = req.body;

  if (!category_name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  Category.createCategory({ category_name }, (err, result) => {
    if (err) {
      console.error('Error creating category:', err);
      return res.status(500).json({ error: 'Failed to create category' });
    }
    res.status(201).json({ message: 'Category created successfully', categoryId: result.insertId });
  });
};

// Ambil semua kategori
exports.getCategories = (req, res) => {
  console.log("Fetching categories...");
  Category.getCategories((err, results) => {
    if (err) {
      console.error('Error fetching categories:', err);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    console.log("Categories fetched:", results);
    res.status(200).json(results);
  });
};

// Update kategori
exports.updateCategory = (req, res) => {
  const { id } = req.params;
  const { category_name } = req.body;

  if (!category_name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  Category.updateCategory(id, { category_name }, (err, result) => {
    if (err) {
      console.error('Error updating category:', err);
      return res.status(500).json({ error: 'Failed to update category' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json({ message: 'Category updated successfully' });
  });
};

// Hapus kategori
exports.deleteCategory = (req, res) => {
  const { id } = req.params;

  Category.deleteCategory(id, (err, result) => {
    if (err) {
      console.error('Error deleting category:', err);
      return res.status(500).json({ error: 'Failed to delete category' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  });
};
