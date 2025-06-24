const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron'); // Add this import

// Cloudinary imports
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();

// Use MongoDB Atlas for production, local for development
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/foodOrders';

mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected');
    console.log('📊 Database:', mongoose.connection.name || 'foodOrders');
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('☁️ Cloudinary configured:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '❌',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅' : '❌',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅' : '❌'
});

// PRODUCTION CORS - Fixed for Netlify deployment
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  console.log('🌐 Request from origin:', origin);
  
  // Allow specific origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://obiggrills.netlify.app',
    'https://obiggrills.netlify.app/'
  ];
  
  // More permissive CORS for production
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    // Allow all Netlify domains as fallback
    if (origin && origin.includes('.netlify.app')) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,X-Forwarded-For');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    console.log('🔄 OPTIONS request from:', origin);
    return res.status(204).end();
  }
  
  console.log(`🌐 ${req.method} ${req.path} from ${origin || 'direct'}`);
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'obiggrills-products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 800, height: 600, crop: 'fill' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  nickname: { type: String, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  addresses: [{
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    isDefault: { type: Boolean, default: false }
  }],
  preferences: {
    favoriteItems: { type: [String], default: [] },
    deliveryInstructions: { type: String, default: '' }
  }
}, { timestamps: true });

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  category: String,
  imageUrl: String,
}, { timestamps: true });

// Order Schema
const orderSchema = new mongoose.Schema({
  customer: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
  },
  items: [{
    id: String,
    name: String,
    price: Number,
    quantity: Number,
  }],
  subtotal: { type: Number },
  deliveryFee: { type: Number, default: 0 },
  deliveryLocation: {
    id: String,
    name: String,
    fee: Number
  },
  total: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentReference: { type: String },
  paymentStatus: { type: String, default: 'pending' },
  orderReference: { type: String },
  fulfilled: { type: Boolean, default: false },
}, { timestamps: true });

// Create Models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'OBIGGRILLS API Server',
    status: 'running',
    version: '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured',
    endpoints: [
      'GET /api/test',
      'GET /api/health',
      'POST /api/users/create-basic',
      'GET /api/users/:email',
      'PATCH /api/users/:email',
      'POST /api/users/register',
      'GET /api/users',
      'GET /api/debug/users',
      'POST /api/products',
      'GET /api/products',
      'DELETE /api/products/:id',
      'POST /api/orders',
      'GET /api/orders',
      'PATCH /api/orders/:id'
    ]
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'OBIGGRILLS API working perfectly!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Create user
app.post('/api/users/create-basic', async (req, res) => {
  try {
    const { email, nickname } = req.body;

    if (!email || !nickname) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and nickname required' 
      });
    }

    // Check if exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.json({ 
        success: true,
        message: 'User exists', 
        user: existing 
      });
    }

    // Create new
    const user = new User({
      email: email.toLowerCase().trim(),
      nickname: nickname.trim(),
      name: nickname.trim()
    });

    const saved = await user.save();
    
    res.status(201).json({ 
      success: true,
      message: 'User created successfully', 
      user: saved 
    });

  } catch (error) {
    console.error('❌ Create user error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

// Get user
app.get('/api/users/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }

    res.json(user);
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

// Update user
app.patch('/api/users/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== 'email') {
        user[key] = req.body[key];
      }
    });

    const updated = await user.save();
    
    res.json({ 
      success: true,
      message: 'User updated successfully',
      user: updated 
    });
  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message
    });
  }
});

// Register user (for checkout)
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, email, and phone are required' 
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      user.name = name;
      user.phone = phone;
      if (!user.nickname) {
        user.nickname = name.split(' ')[0];
      }
      await user.save();
      
      return res.json({ 
        success: true,
        message: 'User updated successfully', 
        user 
      });
    }

    // Create new user
    user = new User({
      name,
      nickname: name.split(' ')[0],
      email: email.toLowerCase(),
      phone
    });

    await user.save();
    
    res.status(201).json({ 
      success: true,
      message: 'User registered successfully', 
      user 
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to register user',
      error: error.message 
    });
  }
});

// Get all users (for admin)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Debug route - see all users
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await User.find().select('email nickname name createdAt');
    res.json({
      success: true,
      count: users.length,
      users: users
    });
  } catch (error) {
    console.error('❌ Debug users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PRODUCT ROUTES WITH CLOUDINARY

// Create product with Cloudinary image upload
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    console.log('🔵 POST /api/products called');
    console.log('🔵 Request body:', req.body);
    console.log('🔵 Request file:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    } : 'No file uploaded');
    
    const { name, description, price, category } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Product name is required'
      });
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Product description is required'
      });
    }

    if (!price || isNaN(parseFloat(price))) {
      return res.status(400).json({ 
        success: false,
        message: 'Valid product price is required'
      });
    }

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Product category is required'
      });
    }

    // Cloudinary automatically provides the full URL
    const imageUrl = req.file ? req.file.path : '';
    console.log('☁️ Cloudinary image URL:', imageUrl);

    const productData = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category: category.trim(),
      imageUrl: imageUrl
    };

    const newProduct = new Product(productData);
    const savedProduct = await newProduct.save();
    
    console.log('✅ Product created with Cloudinary image:', savedProduct._id);
    
    res.status(201).json({ 
      success: true,
      message: 'Product uploaded successfully', 
      product: savedProduct 
    });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        details: error.message
      });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        message: 'File too large. Maximum size is 5MB.' 
      });
    }
    
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ 
        success: false,
        message: `File upload error: ${error.message}` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload product',
      error: error.message 
    });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

// ORDER ROUTES

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const order = req.body;

    if (!order || !order.customer || !order.items || order.items.length === 0) {
      return res.status(400).json({ message: 'Invalid order data' });
    }

    if (!order.customer.email) {
      return res.status(400).json({ message: 'Customer email is required' });
    }

    const orderData = {
      customer: {
        name: order.customer.name,
        address: order.customer.address,
        phone: order.customer.phone,
        email: order.customer.email,
      },
      items: order.items,
      subtotal: parseFloat(order.subtotal) || parseFloat(order.total),
      deliveryFee: parseFloat(order.deliveryFee) || 0,
      deliveryLocation: order.deliveryLocation || null,
      total: parseFloat(order.total),
      paymentMethod: order.paymentMethod,
      paymentReference: order.paymentReference || null,
      paymentStatus: order.paymentStatus || 'pending',
      orderReference: order.orderReference || null,
      fulfilled: false,
    };

    const newOrder = new Order(orderData);
    await newOrder.save();
    
    res.status(201).json({ 
      message: 'Order placed successfully', 
      orderId: newOrder._id,
      order: newOrder
    });
  } catch (error) {
    console.error('❌ Error saving order:', error);
    res.status(500).json({ message: 'Failed to save order', error: error.message });
  }
});

// Get orders
app.get('/api/orders', async (req, res) => {
  try {
    const email = req.query.email;
    
    let filter = {};
    if (email) {
      filter = { 'customer.email': email };
    }
    
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Update order status
app.patch('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fulfilled } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid order ID' 
      });
    }

    // Find and update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { fulfilled: fulfilled },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder 
    });
  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update order status',
      error: error.message 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    availableRoutes: [
      'GET /',
      'GET /api/test',
      'GET /api/health',
      'POST /api/users/create-basic',
      'GET /api/users/:email',
      'PATCH /api/users/:email',
      'POST /api/users/register',
      'GET /api/users',
      'GET /api/debug/users',
      'POST /api/products',
      'GET /api/products',
      'DELETE /api/products/:id',
      'POST /api/orders',
      'GET /api/orders',
      'PATCH /api/orders/:id'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OBIGGRILLS API Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured'}`);
  console.log(`🧪 Test route: /api/test`);
  console.log(`💚 Health check: /api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
  }
});

// 🏓 KEEP-ALIVE SYSTEM - Prevents Render free tier from sleeping
// Only run in production to avoid unnecessary pings in development
if (process.env.NODE_ENV === 'production' || process.env.RENDER_EXTERNAL_URL) {
  const selfUrl = process.env.RENDER_EXTERNAL_URL || 'https://obiggrills-api.onrender.com';
  
  // Self-ping every 14 minutes to stay awake
  cron.schedule('*/14 * * * *', async () => {
    try {
      const response = await fetch(`${selfUrl}/api/health`);
      if (response.ok) {
        console.log(`🏓 Self-ping successful: ${response.status} at ${new Date().toISOString()}`);
      } else {
        console.log(`⚠️ Self-ping returned: ${response.status} at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.log(`❌ Self-ping failed: ${error.message} at ${new Date().toISOString()}`);
    }
  });

  console.log('🔄 Keep-alive system activated - server will ping itself every 14 minutes');
  console.log(`🎯 Self-ping URL: ${selfUrl}/api/health`);
} else {
  console.log('💤 Keep-alive system disabled (not in production)');
}

module.exports = app;