const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// PRODUCTION CORS - Allow Netlify and local development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow specific origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://obiggrills.netlify.app',
    'https://obiggrills.netlify.app/'
  ];
  
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,X-Forwarded-For');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    console.log('🔄 OPTIONS from:', origin);
    return res.status(204).end();
  }
  
  console.log(`🌐 ${req.method} ${req.path} from ${origin || 'direct'}`);
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
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
    endpoints: [
      'GET /api/test',
      'GET /api/health',
      'POST /api/users/create-basic',
      'GET /api/users/:email',
      'PATCH /api/users/:email',
      'POST /api/users/register',
      'POST /api/products',
      'GET /api/products',
      'DELETE /api/products/:id'
    ]
  });
});

app.get('/api/test', (req, res) => {
  console.log('📍 /api/test route hit');
  res.json({ 
    success: true, 
    message: 'OBIGGRILLS API working perfectly!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Create user
app.post('/api/users/create-basic', async (req, res) => {
  try {
    const { email, nickname } = req.body;
    console.log('🔵 Creating user:', { email, nickname });

    if (!email || !nickname) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and nickname required' 
      });
    }

    // Check if exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log('🟡 User already exists:', existing._id);
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
    console.log('✅ User created:', saved._id);
    
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
    console.log('🔵 Getting user:', req.params.email);
    
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ User found:', user.email);
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
    console.log('🔵 Register user:', { name, email, phone });

    if (!name || !email || !phone) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, email, and phone are required' 
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      console.log('🟡 Updating existing user:', user.email);
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
    console.log('✅ User registered:', user.email);
    
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
    console.log(`📊 Retrieved ${users.length} users`);
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
    console.log(`📊 Debug: Found ${users.length} users in database`);
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

// PRODUCT ROUTES - Built into main server (NO separate routes file)

// Create product with image upload
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    console.log('🔵 POST /api/products called');
    console.log('🔵 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔵 Request file:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file uploaded');
    
    // Log all form fields received
    console.log('🔵 All form fields received:');
    Object.keys(req.body).forEach(key => {
      console.log(`  ${key}: "${req.body[key]}" (type: ${typeof req.body[key]})`);
    });
    
    const { name, description, price, category } = req.body;

    // Detailed validation with specific error messages
    if (!name || typeof name !== 'string' || name.trim() === '') {
      console.log('❌ Missing or invalid name field:', { name, type: typeof name });
      return res.status(400).json({ 
        success: false,
        message: 'Product name is required and must be a non-empty string',
        received: { name, type: typeof name }
      });
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      console.log('❌ Missing or invalid description field:', { description, type: typeof description });
      return res.status(400).json({ 
        success: false,
        message: 'Product description is required and must be a non-empty string',
        received: { description, type: typeof description }
      });
    }

    if (!price || isNaN(parseFloat(price))) {
      console.log('❌ Invalid price field:', { price, type: typeof price, parsed: parseFloat(price) });
      return res.status(400).json({ 
        success: false,
        message: 'Valid product price is required (must be a number)',
        received: { price, type: typeof price, parsed: parseFloat(price) }
      });
    }

    if (!category || typeof category !== 'string' || category.trim() === '') {
      console.log('❌ Missing or invalid category field:', { category, type: typeof category });
      return res.status(400).json({ 
        success: false,
        message: 'Product category is required and must be a non-empty string',
        received: { category, type: typeof category }
      });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';
    console.log('🔵 Image path:', imagePath);

    const productData = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category: category.trim(),
      imageUrl: imagePath
    };

    console.log('🔵 Creating product with data:', JSON.stringify(productData, null, 2));

    const newProduct = new Product(productData);
    const savedProduct = await newProduct.save();
    
    console.log('✅ Product created successfully:', savedProduct._id);
    
    res.status(201).json({ 
      success: true,
      message: 'Product uploaded successfully', 
      product: savedProduct 
    });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Handle different types of errors
    if (error.name === 'ValidationError') {
      console.log('❌ Validation Error Details:', error.message);
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        details: error.message,
        validationErrors: error.errors
      });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      console.log('❌ File too large');
      return res.status(400).json({ 
        success: false,
        message: 'File too large. Maximum size is 5MB.' 
      });
    }
    
    if (error instanceof multer.MulterError) {
      console.log('❌ Multer Error:', error.message);
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
    console.log(`📊 Retrieved ${products.length} products`);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    console.log('🗑️ Deleting product:', req.params.id);
    const deleted = await Product.findByIdAndDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    console.log('✅ Product deleted successfully');
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

// Order routes
app.post('/api/orders', async (req, res) => {
  const order = req.body;
  console.log('🔵 Received order:', JSON.stringify(order, null, 2));

  if (!order || !order.customer || !order.items || order.items.length === 0) {
    return res.status(400).json({ message: 'Invalid order data' });
  }

  if (!order.customer.email) {
    return res.status(400).json({ message: 'Customer email is required' });
  }

  try {
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
    
    console.log('✅ Order saved successfully:', newOrder._id);
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

app.get('/api/orders', async (req, res) => {
  try {
    const email = req.query.email;
    console.log('🔵 Fetching orders for email:', email);
    
    let filter = {};
    if (email) {
      filter = { 'customer.email': email };
    }
    
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    console.log(`📊 Found ${orders.length} orders`);
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
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
      'GET /api/debug/users',
      'POST /api/products',
      'GET /api/products',
      'DELETE /api/products/:id'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  console.error('❌ Server error stack:', err.stack);
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

module.exports = app;