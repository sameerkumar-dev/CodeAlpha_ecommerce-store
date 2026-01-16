// ============= SESSION AUTH =============
async function checkLogin() {
    try {
        const res = await fetch('/me', { 
            credentials: 'include'
        });

        if (res.ok) {
            const user = await res.json();
            updateNavbar(user.firstName + " " + user.lastName);
            return true;
        } else {
            updateNavbarAsGuest();
            return false;
        }
    } catch (err) {
        console.log('Not logged in or server error:', err);
        updateNavbarAsGuest();
        return false;
    }
}

function updateNavbar(name = null) {
    const guestLinks = document.getElementById('guest-links');
    const userLinks = document.getElementById('user-links');
    const userNameSpan = document.getElementById('user-name');

    if (name && userLinks && guestLinks && userNameSpan) {
        userNameSpan.textContent = name;
        guestLinks.style.display = 'none';
        userLinks.style.display = 'flex';
    } else {
        updateNavbarAsGuest();
    }
}

function updateNavbarAsGuest() {
    const guestLinks = document.getElementById('guest-links');
    const userLinks = document.getElementById('user-links');

    if (guestLinks && userLinks) {
        guestLinks.style.display = 'flex';
        userLinks.style.display = 'none';
    }
}

async function logout() {
    try {
        await fetch('/logout', { 
            method: 'POST',
            credentials: 'include'
        });
        alert('Logged out successfully!');
        await checkLogin();
        window.location.href = '/';
    } catch (err) {
        alert('Error during logout');
    }
}

// ============= PRODUCTS =============
let allProducts = [];

async function loadProducts(isFeatured = false) {
    try {
        const res = await fetch('products');
        if (res.ok) {
            allProducts = await res.json();
        } else {
            console.warn('Products fetch failed:', res.status);
        }
    } catch (err) {
        console.error('Failed to load products:', err);
        allProducts = [];
    }

    let products = allProducts;
    if (isFeatured) products = products.slice(0, 6);

    renderProducts(products, isFeatured ? 'featured-products-grid' : 'products-grid');
}

function renderProducts(products, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = '';
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.category = (product.category || 'all').toLowerCase();
        card.innerHTML = `
            <div class="product-image-wrapper">
                <img src="${product.image}" alt="${product.name}" loading="lazy">
                <button class="add-to-cart-btn" onclick="addToCart('${product._id}')">+</button>
            </div>
            <div class="product-info">
                <p class="product-category">${product.category || 'Category'}</p>
                <h3>${product.name}</h3>
                <p class="product-price">$${product.price.toFixed(2)}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Search & Filter for Product page
function setupProductPageFilters() {
    const searchInput = document.getElementById('Product-search');
    const filterPills = document.querySelectorAll('.filter-pill');

    if (!searchInput || !filterPills.length) return;

    let currentCategory = 'all';

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase().trim();

        const filtered = allProducts.filter(product => {
            const matchesCategory = currentCategory === 'all' || 
                (product.category || '').toLowerCase() === currentCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchTerm);
            return matchesCategory && matchesSearch;
        });

        renderProducts(filtered, 'products-grid');
    }

    searchInput.addEventListener('input', applyFilters);

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.dataset.category;
            applyFilters();
        });
    });
}

// ============= CART =============
async function addToCart(productId) {
    const loggedIn = await checkLogin();
    if (!loggedIn) {
        alert('Please login to add items to cart');
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch('/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
            credentials: 'include'
        });

        const data = await res.json();

        if (res.ok) {
            alert('Added to cart!');
            await renderCart();
            openCart();
        } else {
            alert(data.error || 'Failed to add to cart');
        }
    } catch (err) {
        console.error('Add to cart error:', err);
        alert('Something went wrong while adding to cart');
    }
}

async function updateQty(productId, change) {
    try {
        const resCart = await fetch('/cart', { credentials: 'include' });
        if (!resCart.ok) throw new Error('Failed to fetch cart');
        
        const cart = await resCart.json();
        const currentItem = cart.find(item => item.productId._id === productId);
        
        if (!currentItem) {
            alert('Item not found in cart');
            return;
        }

        let newQuantity = currentItem.quantity + change;
        if (newQuantity < 1) newQuantity = 1;

        const res = await fetch('/cart/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity: newQuantity }),
            credentials: 'include'
        });

        if (res.ok) {
            await renderCart();
        } else {
            const data = await res.json();
            alert(data.error || 'Update failed');
        }
    } catch (err) {
        console.error('Update quantity error:', err);
        alert('Could not update quantity');
    }
}

async function removeFromCart(productId) {
    try {
        const res = await fetch('/cart/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
            credentials: 'include'
        });

        if (res.ok) {
            await renderCart();
        } else {
            const data = await res.json();
            alert(data.error || 'Remove failed');
        }
    } catch (err) {
        console.error('Remove error:', err);
        alert('Could not remove item');
    }
}

// ============= CART UI FUNCTIONS =============
async function renderCart() {
    try {
        const res = await fetch('/cart', { credentials: 'include' });
        if (!res.ok) {
            if (res.status === 401) {
                updateCartCount(0);
                return;
            }
            throw new Error('Failed to load cart');
        }

        const items = await res.json();
        const cartItemsDiv = document.getElementById('cart-items');
        const subtotalSpan = document.getElementById('cart-subtotal');
        if (!cartItemsDiv || !subtotalSpan) return;

        cartItemsDiv.innerHTML = '';
        let subtotal = 0;

        if (items.length === 0) {
            cartItemsDiv.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        } else {
            items.forEach(item => {
                const product = item.productId || {};

                if (!product || !product.price) {
                    console.warn('Invalid/missing product in cart item:', item);
                    return;
                }

                subtotal += product.price * item.quantity;

                const cartItem = document.createElement('div');
                cartItem.className = 'cart-item';
                cartItem.innerHTML = `
                    <div class="cart-item-info">
                        <img src="${product.image || 'image/placeholder.jpg'}" alt="${product.name || 'Product'}" loading="lazy">
                        <div>
                            <h3>${product.name || 'Unknown Product'}</h3>
                            <p>$${product.price.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="qty-controls">
                        <button onclick="updateQty('${product._id}', -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateQty('${product._id}', 1)">+</button>
                    </div>
                    <div class="item-subtotal">$${(product.price * item.quantity).toFixed(2)}</div>
                    <button class="remove-btn" onclick="removeFromCart('${product._id}')">×</button>
                `;
                cartItemsDiv.appendChild(cartItem);
            });
        }

        subtotalSpan.textContent = `$${subtotal.toFixed(2)}`;
        updateCartCount(items.reduce((sum, item) => sum + (item.quantity || 0), 0));
    } catch (err) {
        console.error('Cart render error:', err);
        if (cartItemsDiv) {
            cartItemsDiv.innerHTML = '<p class="empty-cart">Error loading cart. Please refresh.</p>';
        }
    }
}

async function renderCheckout() {
    try {
        const res = await fetch('/cart', { credentials: 'include' });
        if (!res.ok) {
            if (res.status === 401) {
                alert('Please login');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to load cart');
        }

        const items = await res.json();
        if (items.length === 0) {
            alert('Cart is empty! Redirecting...');
            window.location.href = '/';
            return;
        }

        const checkoutItemsDiv = document.getElementById('checkout-items');
        const subtotalSpan = document.getElementById('checkout-subtotal');
        const totalSpan = document.getElementById('checkout-total');
        const payBtn = document.getElementById('pay-btn');

        if (!checkoutItemsDiv || !subtotalSpan || !totalSpan || !payBtn) return;

        checkoutItemsDiv.innerHTML = '';
        let subtotal = 0;

        items.forEach(item => {
            const product = item.productId || {};

            if (!product || !product.price) {
                console.warn('Invalid product in checkout:', item);
                return;
            }

            subtotal += product.price * item.quantity;

            const checkoutItem = document.createElement('div');
            checkoutItem.className = 'checkout-item';
            checkoutItem.innerHTML = `
                <img src="${product.image || 'image/placeholder.jpg'}" alt="${product.name || 'Product'}">
                <div>
                    <h4>${product.name || 'Unknown Product'}</h4>
                    <p>Quantity: ${item.quantity}</p>
                    <p>$${product.price.toFixed(2)}</p>
                </div>
                <span>$${(product.price * item.quantity).toFixed(2)}</span>
            `;
            checkoutItemsDiv.appendChild(checkoutItem);
        });

        subtotalSpan.textContent = `$${subtotal.toFixed(2)}`;
        totalSpan.textContent = `$${subtotal.toFixed(2)}`;
        payBtn.textContent = `Pay $${subtotal.toFixed(2)}`;
    } catch (err) {
        console.error('Checkout render error:', err);
        if (checkoutItemsDiv) {
            checkoutItemsDiv.innerHTML = '<p>Error loading checkout items. Please try again.</p>';
        }
    }
}

function updateCartCount(count) {
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function openCart() {
    document.getElementById('cart-panel')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cart-panel')?.classList.remove('open');
    document.getElementById('cart-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

function showEmptyCartPopup() {
    document.getElementById('empty-cart-modal')?.classList.add('active');
}

function closeEmptyCartPopup() {
    document.getElementById('empty-cart-modal')?.classList.remove('active');
}

// ================== CHECKOUT FORM VALIDATION ==================
function validateCheckoutForm() {
    const requiredFields = [
        document.getElementById('email'),
        document.getElementById('phone'),
        ...document.querySelectorAll('.checkout-form input[required]')
    ];

    let isValid = true;

    requiredFields.forEach(field => {
        if (!field) return;

        if (!field.value.trim()) {
            field.style.borderColor = '#ff4d4f';
            isValid = false;
        } else {
            field.style.borderColor = '#ddd';
        }
    });

    const email = document.getElementById('email');
    if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        email.style.borderColor = '#ff4d4f';
        isValid = false;
    }

    const cardNumber = document.querySelector('input[placeholder="Card Number"]');
    if (cardNumber && cardNumber.value.replace(/\s/g, '').length !== 16) {
        cardNumber.style.borderColor = '#ff4d4f';
        isValid = false;
    }

    const cvc = document.querySelector('input[placeholder="CVC"]');
    if (cvc && cvc.value.length !== 3) {
        cvc.style.borderColor = '#ff4d4f';
        isValid = false;
    }

    return isValid;
}

// ================== DOM LOADED ==================
document.addEventListener('DOMContentLoaded', async () => {
    await checkLogin();
    loadProducts(true);

    if (document.getElementById('products-grid')) {
        loadProducts(false);
        setupProductPageFilters();
    }

    await renderCart();

    if (document.getElementById('checkout-items')) {
        await renderCheckout();
    }

    document.getElementById('logout-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    document.getElementById('cart-toggle')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!(await checkLogin())) {
            alert('Please login to view cart');
            window.location.href = 'login.html';
            return;
        }
        await renderCart();
        openCart();
    });

    document.getElementById('cart-close')?.addEventListener('click', closeCart);
    document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

    // ================== UPDATED: Cart Checkout Button Logic ==================
    document.querySelector('.cart-footer .checkout-btn')?.addEventListener('click', async function(e) {
        e.preventDefault();

        try {
            const res = await fetch('/cart', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to check cart');

            const items = await res.json();

            if (items.length === 0) {
                // Cart empty hai → existing popup show karo
                showEmptyCartPopup();
                return;
            }

            // Cart mein items hain → checkout page pe jao
            window.location.href = '/checkout.html';
        } catch (err) {
            console.error('Checkout check error:', err);
            alert('Something went wrong while checking your cart');
        }
    });

    document.getElementById('close-empty-popup')?.addEventListener('click', closeEmptyCartPopup);

    document.getElementById('pay-btn')?.addEventListener('click', async function(e) {
        e.preventDefault();

        if (!(await checkLogin())) {
            alert('Please login first');
            window.location.href = 'login.html';
            return;
        }

        if (!validateCheckoutForm()) {
            alert('Please fill all required fields correctly!');
            return;
        }

        try {
            const res = await fetch('/checkout', { 
                method: 'POST',
                credentials: 'include'
            });

            if (res.ok) {
                const { orderNumber } = await res.json();
                localStorage.setItem('lastOrderNumber', orderNumber);
                alert('Order placed successfully! Order #' + orderNumber);
                window.location.href = '/order_confirmed.html';
            } else {
                const errorData = await res.json();
                alert(errorData.error || 'Checkout failed');
            }
        } catch (err) {
            console.error(err);
            alert('Something went wrong during checkout');
        }
    });

    document.querySelectorAll('.checkout-form input').forEach(input => {
        input.addEventListener('input', () => {
            if (input.value.trim()) {
                input.style.borderColor = '#ddd';
            }
        });
    });

    if (document.getElementById('order-number')) {
        const num = localStorage.getItem('lastOrderNumber');
        if (num) document.getElementById('order-number').textContent = num;
    }
});

// ============= LOGIN FORM HANDLER =============
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Email aur password daal do');
        return;
    }

    try {
        const res = await fetch('login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        const data = await res.json();

        if (res.ok) {
            alert('Login successful!');
            await checkLogin();
            window.location.href = '/';
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (err) {
        alert('Server connection issue');
    }
});

// ============= REGISTER FORM HANDLER =============
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!firstName || !lastName || !email || !password) {
        alert('Sab fields bhar do');
        return;
    }

    try {
        const res = await fetch('register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password }),
            credentials: 'include'
        });

        const data = await res.json();

        if (res.ok) {
            alert('Registration successful! Please login to continue.');
            window.location.href = 'login.html';
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (err) {
        alert('Server connection issue');
    }
});

// Global functions for onclick
window.addToCart = addToCart;
window.updateQty = updateQty;
window.removeFromCart = removeFromCart;