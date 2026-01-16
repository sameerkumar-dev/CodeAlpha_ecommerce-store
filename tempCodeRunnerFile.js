const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const port = 3000;

// MongoDB connection (local MongoDB ke liye)
mongoose.connect('mongodb://ecommerce_p1:ecommerce_p1@localhost:27017/', { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB error:', err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'secretkey', resave: false, saveUninitialized: true }));
app.use(express.static('public'));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  email: String,
  password: String   // Real app mein bcrypt se hash karna!
}));

const Product = mongoose.model('Product', new mongoose.Schema({
  name: String,
  price: Number,
  description: String
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  products: [{ productId: mongoose.Schema.Types.ObjectId, quantity: Number }],
  total: Number,
  date: { type: Date, default: Date.now }
}));

// Seed products (pehle baar chalane ke liye)
app.get('/seed', async (req, res) => {
  await Product.deleteMany({});
  await Product.insertMany([
    { name: 'Laptop', price: 1000, description: 'High-end gaming laptop' },
    { name: 'Smartphone', price: 600, description: 'Latest Android phone' },
    { name: 'Headphones', price: 150, description: 'Wireless noise-cancelling' },
    { name: 'Smart Watch', price: 300, description: 'Fitness tracker watch' }
  ]);
  res.send('Products added successfully! Now go to http://localhost:3000');
});

// Baaki routes (register, login, cart, etc.) same as before...
// (Maine neeche poora code de diya hai, copy paste kar dena)

// ... [poora server.js code jo maine pehle diya tha, yaha paste karo]

// Server start
app.listen(port, () => {
  console.log(`Server chal raha hai: http://localhost:${port}`);
});