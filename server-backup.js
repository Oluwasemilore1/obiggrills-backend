const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

// Clear any existing mongoose models to prevent caching issues
Object.keys(mongoose.models).forEach(key => {
  delete mongoose.models[key];
});
Object.keys(mongoose.modelSchemas || {}).forEach(key => {
  delete mongoose.modelSchemas[key];
});

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/foodOrders', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('📊 Database:', mongoose.connection.db.databaseName);
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// ENHANCED CORS CONFIGURATION FOR BROWSER COMPATIBILITY
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control'
  ],
  exposedHeaders: ['Content-Length'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200 // For legacy browser support
};

// Apply CORS with enhanced options
app.use(cors(corsOptions));

// EXPLICIT PREFLIGHT HANDLING FOR ALL ROUTES
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

// ADDITIONAL HEADERS FOR BROWSER COMPATIBILITY
app.use((req, res, next) => {
  // Set security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Ensure CORS headers are always present
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests explicitly
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    return res.sendStatus(200);
  }
  
  next();
});

// Body parser with increased limits for compatibility
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// REQUEST LOGGING FOR DEBUGGING BROWSER ISSUES
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'} - User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'unknown'}`);
  next();
});

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  category: String,
  imageUrl: String,
}, { timestamps: true });

// User Schema
const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    default: '' 
  },
  nickname: { 
    type: String, 
    default: '' 
  },
  email: { 
    type: String, 
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: { 
    type: String, 
    default: '' 
  },
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
const Product = mongoose.model('Product', productSchema);
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);

// BROWSER COMPATIBILITY TEST ENDPOINT
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'],
      'accept': req.headers.accept
    },
    browserCompatible: true
  });
});

// HEALTH CHECK ENDPOINT (alternative to test)
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Reset users collection
app.get('/api/reset-users', async (req, res) => {
  try {
    await mongoose.connection.db.dropCollection('users');
    console.log('✅ Users collection completely removed');
    
    const testUser = new User({
      email: 'test@example.com',
      nickname: 'Test',
      name: 'Test User',
      phone: ''
    });
    
    await testUser.save();
    console.log('✅ Test user created with new schema');
    
    await User.deleteOne({ email: 'test@example.com' });
    console.log('✅ Test user removed, schema is now properly initialized');
    
    res.json({ 
      success: true, 
      message: 'Users collection reset and new schema applied successfully!' 
    });
  } catch (error) {
    console.error('Error resetting users collection:', error);
    res.json({ 
      success: true, 
      message: 'Collection reset (might not have existed before)' 
    });
  }
});

// Create basic user (for homepage registration)
app.post('/api/users/create-basic', async (req, res) => {
  console.log('🔵 CREATE BASIC USER CALLED');
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔵 Request headers:', {
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']?.substring(0, 50),
    contentType: req.headers['content-type']
  });
  
  try {
    const { email, nickname } = req.body;

    // Validation
    if (!email || !nickname) {
      console.log('❌ Missing fields:', { email: !!email, nickname: !!nickname });
      return res.status(400).json({ 
        success: false,
        message: 'Email and nickname are required' 
      });
    }

    // Check existing user
    console.log('🔵 Checking for existing user...');
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      console.log('🟡 User already exists:', existingUser.email);
      return res.json({ 
        success: true,
        message: 'User already exists', 
        user: existingUser 
      });
    }

    // Create new user
    console.log('🔵 Creating new user with minimal data...');
    const userData = {
      email: email.toLowerCase().trim(),
      nickname: nickname.trim(),
      name: nickname.trim(),
      phone: ''
    };

    console.log('🔵 User data to save:', userData);
    
    const user = new User(userData);
    console.log('🔵 User model created, saving...');
    
    const savedUser = await user.save();
    console.log('✅ User saved successfully!', {
      id: savedUser._id,
      email: savedUser.email,
      nickname: savedUser.nickname
    });
    
    res.status(201).json({ 
      success: true,
      message: 'User created successfully', 
      user: savedUser 
    });

  } catch (error) {
    console.error('❌ COMPLETE ERROR DETAILS:');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error code:', error.code);
    
    if (error.name === 'ValidationError') {
      console.error('❌ Validation errors:', error.errors);
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to create user',
      error: error.message,
      errorType: error.name
    });
  }
});

// Register user (for checkout updates)
app.post('/api/users/register', async (req, res) => {
  console.log('🔵 REGISTER USER CALLED');
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, email, and phone are required' 
      });
    }

    // Check if user exists
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
    console.log('🔵 Creating new user via register...');
    user = new User({
      name,
      nickname: name.split(' ')[0],
      email: email.toLowerCase(),
      phone
    });

    await user.save();
    console.log('✅ User registered successfully');
    
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

// ENHANCED Get user by email with better error handling
app.get('/api/users/:email', async (req, res) => {
  try {
    console.log('🔵 Fetching user:', req.params.email);
    console.log('🔵 Request from:', req.headers.origin || 'no origin header');
    
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    
    if (!user) {
      console.log('🟡 User not found:', req.params.email);
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        email: req.params.email 
      });
    }

    console.log('✅ User found:', user.email);
    res.json(user);
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch user',
      error: error.message 
    });
  }
});

// PATCH user info (missing from original)
app.patch('/api/users/:email', async (req, res) => {
  try {
    console.log('🔵 PATCH user:', req.params.email);
    console.log('🔵 Update data:', req.body);
    
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update user fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== 'email') {
        user[key] = req.body[key];
      }
    });

    const updatedUser = await user.save();
    
    res.json({ 
      success: true,
      message: 'User updated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update user',
      error: error.message 
    });
  }
});

// Get all users
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

// Get recent users
app.get('/api/users/recent/list', async (req, res) => {
  try {
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email phone nickname createdAt');
    
    res.json({
      success: true,
      count: recentUsers.length,
      users: recentUsers
    });
  } catch (error) {
    console.error('Error fetching recent users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// [Rest of your routes remain the same - products, orders, etc.]
// I've kept the essential user routes enhanced for browser compatibility

// Product routes
app.post('/api/products', upload.single('image'), async (req, res) => {
  const { name, description, price, category } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!name || !description || !price || !category) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newProduct = new Product({ name, description, price, category, imageUrl: imagePath });
    await newProduct.save();
    res.status(201).json({ message: 'Product uploaded successfully', product: newProduct });
  } catch (error) {
    console.error('Error uploading product:', error);
    res.status(500).json({ message: 'Failed to upload product' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
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

// ERROR HANDLING MIDDLEWARE
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 HANDLER - FIXED to avoid path-to-regexp error
app.use((req, res) => {
  console.log('❌ Route not found:', req.method, req.path);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /api/test',
      'GET /api/health',
      'GET /api/users/:email',
      'POST /api/users/create-basic',
      'POST /api/users/register'
    ]
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔄 Reset users: http://localhost:${PORT}/api/reset-users`);
  console.log(`👥 All users: http://localhost:${PORT}/api/users`);
  console.log(`🌐 CORS enabled for multiple origins and browsers`);
});

module.exports = app;