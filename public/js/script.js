(() => {
  const state = { restaurants: [], items: [], activeRestaurant: '', cart: new Map() };
  const $ = id => document.getElementById(id);
  const money = amount => `₹${Number(amount || 0).toFixed(2)}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const icons = ['🍛', '🍕', '🥗', '🍜', '🍔'];
  const foodIcons = ['🍛', '🍕', '🥪', '🍜', '🥘', '🥗'];

  function message(text, isError = false) {
    const el = $('pageMessage');
    el.className = `notice ${isError ? 'error' : 'success'}`;
    el.textContent = text;
    el.hidden = false;
  }

  function renderRestaurants() {
    $('restaurantCount').textContent = `${state.restaurants.length} available`;
    const grid = $('restaurantGrid');
    if (!state.restaurants.length) {
      grid.innerHTML = '<div class="empty"><div class="empty-icon">🍽️</div><h3>No restaurants yet</h3><p>The admin can log in and add the first restaurant.</p><a class="btn secondary" href="/admin/login">Admin login</a></div>';
      return;
    }
    grid.innerHTML = state.restaurants.map((r, i) => `
      <button class="restaurant-card ${String(r.id) === state.activeRestaurant ? 'selected' : ''}" data-restaurant="${Number(r.id)}">
        <span class="restaurant-icon">${icons[i % icons.length]}</span>
        <span><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.description || 'Fresh food, ready to order')}</small></span><span class="arrow">↗</span>
      </button>`).join('');
    grid.querySelectorAll('[data-restaurant]').forEach(button => button.addEventListener('click', () => selectRestaurant(button.dataset.restaurant)));
  }

  function renderMenu() {
    const term = $('search').value.trim().toLowerCase();
    const visible = state.items.filter(item => String(item.restaurant_id) === state.activeRestaurant &&
      (`${item.name} ${item.category} ${item.description || ''}`).toLowerCase().includes(term));
    const grid = $('menuGrid');
    if (!state.restaurants.length) { grid.innerHTML = ''; return; }
    if (!visible.length) {
      grid.innerHTML = '<div class="empty"><div class="empty-icon">🍽️</div><h3>No food items found</h3><p>Choose another restaurant or ask the admin to add menu items.</p></div>';
      return;
    }
    grid.innerHTML = visible.map((item, i) => `
      <article class="food-card">
        <div class="food-photo">${item.photo ? `<img src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.name)}" loading="lazy">` : `<div class="food-placeholder">${foodIcons[i % foodIcons.length]}</div>`}<span class="category-tag">${escapeHtml(item.category || 'Other')}</span></div>
        <div class="food-info"><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || item.restaurant_name)}</p></div>
        <div class="food-bottom"><strong>${money(item.price)}</strong><button class="add-btn" data-add="${Number(item.id)}">+ Add</button></div></div>
      </article>`).join('');
    grid.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => addToCart(Number(button.dataset.add))));
  }

  function selectRestaurant(id) {
    id = String(id);
    if (state.cart.size && id !== state.activeRestaurant) {
      if (!window.confirm('Changing restaurant will clear your current cart. Continue?')) return;
      state.cart.clear();
    }
    state.activeRestaurant = id;
    renderRestaurants(); renderMenu(); renderCart();
  }

  function addToCart(id) {
    const item = state.items.find(entry => Number(entry.id) === id);
    if (!item) return;
    if (String(item.restaurant_id) !== state.activeRestaurant) selectRestaurant(String(item.restaurant_id));
    const existing = state.cart.get(id);
    state.cart.set(id, { ...item, quantity: existing ? existing.quantity + 1 : 1 });
    renderCart();
  }

  function renderCart() {
    const entries = [...state.cart.values()];
    const count = entries.reduce((sum, item) => sum + item.quantity, 0);
    const total = entries.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    $('cartCount').textContent = count;
    $('cartTotal').textContent = money(total);
    $('orderNow').disabled = entries.length === 0;
    if (!entries.length) {
      $('cartItems').innerHTML = '<div class="cart-empty"><span>🛍️</span><p>Your cart is empty</p><small>Add something delicious!</small></div>';
      return;
    }
    $('cartItems').innerHTML = entries.map(item => `
      <div class="cart-line"><div class="cart-line-copy"><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} each</small></div>
      <div class="qty-control"><button data-qty="${Number(item.id)}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button data-qty="${Number(item.id)}" data-delta="1" aria-label="Increase quantity">+</button></div>
      <strong class="line-price">${money(Number(item.price) * item.quantity)}</strong></div>`).join('');
    $('cartItems').querySelectorAll('[data-qty]').forEach(button => button.addEventListener('click', () => {
      const id = Number(button.dataset.qty), item = state.cart.get(id);
      if (!item) return;
      item.quantity += Number(button.dataset.delta);
      if (item.quantity <= 0) state.cart.delete(id);
      else state.cart.set(id, item);
      renderCart();
    }));
  }

  async function checkout() {
    const entries = [...state.cart.values()];
    if (!entries.length) return;
    const button = $('orderNow');
    button.disabled = true; button.textContent = 'Preparing order…';
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: Number(state.activeRestaurant), items: entries.map(item => ({ id: item.id, quantity: item.quantity })), customerName: $('customerName').value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your order.');
      window.location.assign(result.whatsappUrl);
    } catch (error) {
      message(error.message || 'Something went wrong. Please try again.', true);
      button.disabled = false; button.innerHTML = 'Order now on WhatsApp <span>↗</span>';
    }
  }

  async function init() {
    $('orderNow').addEventListener('click', checkout);
    $('search').addEventListener('input', renderMenu);
    try {
      const response = await fetch('/api/catalog');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load restaurants.');
      state.restaurants = data.restaurants || [];
      state.items = data.items || [];
      state.activeRestaurant = state.restaurants.length ? String(state.restaurants[0].id) : '';
      renderRestaurants(); renderMenu(); renderCart();
    } catch (error) {
      $('restaurantGrid').innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>Could not load the menu</h3><p>${escapeHtml(error.message)} Make sure MySQL is running and the database is configured.</p><a class="btn secondary" href="/admin/login">Admin login</a></div>`;
      $('menuGrid').innerHTML = '';
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
