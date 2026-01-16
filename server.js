const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
const port = 3000;

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/ecommerce_p1')
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.json());
app.use(express.static('docs'));
app.use(session({
  secret: 'lumina-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: false, // true kar dena production mein HTTPS ke saath
    httpOnly: true
  }
}));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true }
}));

const Product = mongoose.model('Product', new mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  image: String
}));

const Cart = mongoose.model('Cart', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  products: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number
  }]
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  products: Array,
  total: Number,
  orderNumber: String,
  date: { type: Date, default: Date.now }
}));

// Middleware to check login
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please login first' });
  }
  next();
}

// Seed Products
app.get('/seed', async (req, res) => {
  try {
    await Product.deleteMany({});
    await Product.insertMany([
      { name: 'Eleva Pendant Light', price: 129.00, category: 'Lighting', image: 'imageproduct1.jpg' },
      { name: 'Aeon Lounge Chair', price: 890.00, category: 'Furniture', image: 'imageproduct2.png' },
      { name: 'Ceramic Void Vase', price: 45.00, category: 'Decor', image: 'imageproduct3.jpg' },
      { name: 'Nordic Wool Throw', price: 84.00, category: 'Textiles', image: 'imageproduct4.jpg' },
      { name: 'Geometric Table Lamp', price: 115.00, category: 'Lighting', image: 'imageproduct5.jpg' },
      { name: 'Minimalist Desk Organizer', price: 75.00, category: 'Office', image: 'imageproduct6.jpg' }
    ]);
    res.send('Products seeded successfully! Visit http://localhost:3000');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error seeding products: ' + err.message);
  }
});

// Get all products
app.get('products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Register
app.post('register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    await user.save();

    res.json({ 
      success: true,
      message: 'Account created! Please login to continue.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user._id;

    res.json({ 
      success: true,
      user: { firstName: user.firstName, lastName: user.lastName, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Get current user
app.get('/me', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .select('firstName lastName email');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// Cart helper function
async function getUserCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, products: [] });
    await cart.save();
  }
  return cart;
}

// Add to cart - NEW ENDPOINT: /cart/add
app.post('/cart/add', requireLogin, async (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'Product ID required' });

  try {
    const cart = await getUserCart(req.session.userId);
    const itemIndex = cart.products.findIndex(p => p.productId.toString() === productId);

    if (itemIndex > -1) {
      cart.products[itemIndex].quantity += 1;
    } else {
      cart.products.push({ productId, quantity: 1 });
    }

    await cart.save();
    res.json({ success: true, message: 'Added to cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Add to cart failed' });
  }
});

// Get cart
app.get('/cart', requireLogin, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.session.userId });
    if (!cart) {
      return res.json([]); // empty cart
    }

    // Sahi populate (deep populate)
    await cart.populate({
      path: 'products.productId',
      select: 'name price image category' // sirf jo chahiye woh fields
    });

    // Response mein populated products bhejo
    res.json(cart.products);
  } catch (err) {
    console.error('Cart load error:', err);
    res.status(500).json({ error: 'Failed to load cart' });
  }
});

// Update quantity - NEW ENDPOINT: /cart/update
app.post('/cart/update', requireLogin, async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity || quantity < 1) {
    return res.status(400).json({ error: 'Invalid product ID or quantity' });
  }

  try {
    const cart = await getUserCart(req.session.userId);
    const item = cart.products.find(p => p.productId.toString() === productId);
    
    if (item) {
      item.quantity = quantity;
      await cart.save();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Item not found in cart' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Remove from cart - NEW ENDPOINT: /cart/remove
app.post('/cart/remove', requireLogin, async (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'Product ID required' });

  try {
    const cart = await getUserCart(req.session.userId);
    cart.products = cart.products.filter(p => p.productId.toString() !== productId);
    await cart.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Remove failed' });
  }
});

// Checkout
app.post('/checkout', requireLogin, async (req, res) => {
  try {
    const cart = await getUserCart(req.session.userId);
    if (cart.products.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    await cart.populate('products.productId');
    let total = 0;
    const orderProducts = cart.products.map(item => {
      total += item.productId.price * item.quantity;
      return {
        name: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity,
        image: item.productId.image
      };
    });

    const orderNumber = 'ELEVA-' + Math.floor(1000 + Math.random() * 9000);

    const order = new Order({
      userId: req.session.userId,
      products: orderProducts,
      total,
      orderNumber
    });
    
    await order.save();

    // Clear cart
    cart.products = [];
    await cart.save();

    res.json({ success: true, orderNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Seed products (if needed): http://localhost:${port}/seed`);
});