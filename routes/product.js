const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    const product = new Product({ name, description, price, category });
    await product.save();
    res.status(201).json({ message: 'Product saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save product' });
  }
});

module.exports = router;
