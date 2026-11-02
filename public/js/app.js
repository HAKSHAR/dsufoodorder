(() => {
  const menu = window.DSU_MENU || [];
  const byId = new Map(menu.map(item => [Number(item.id), item]));
  const cart = new Map();
  let activeRestaurant = document.querySelector('[data-restaurant]')?.dataset.restaurant || '';
  const money = n => `₹${Number(n || 0).toFixed(2)}`;
  const cartItems = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartTotal = document.getElementById('cartTotal');
  const orderNow = document.getElementById('orderNow');
  const search = document.getElementById('search');

  function renderCart() {
    if (!cartItems) return;
    const entries = [...cart.values()];
    const count = entries.reduce((sum, x) => sum + x.quantity, 0);
    const total = entries.reduce((sum, x) => sum + x.price * x.quantity, 0);
    cartCount.textContent = count;
    cartTotal.textContent = money(total);
    orderNow.disabled = !entries.length;
    if (!entries.length) {
      cartItems.innerHTML = '<div class="cart-empty"><span>🛍️</span><p>Your cart is empty</p><small>Add something delicious!</small></div>';
      return;
    }
    cartItems.innerHTML = entries.map(item => `<div class="cart-line"><div class="cart-line-copy"><strong>${escapeHtml(item.name)}</strong><small>${money(item.price)} each</small></div><div class="qty-control"><button data-qty="${item.id}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button data-qty="${item.id}" data-delta="1" aria-label="Increase quantity">+</button></div><strong class="line-price">${money(item.price * item.quantity)}</strong></div>`).join('');
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function setRestaurant(id) {
    if (cart.size && String(activeRestaurant) !== String(id)) {
      if (!confirm('Changing restaurant will clear your current cart. Continue?')) return;
      cart.clear(); renderCart();
    }
    activeRestaurant = String(id);
    document.querySelectorAll('.restaurant-card').forEach(el => el.classList.toggle('selected', el.dataset.restaurant === activeRestaurant));
    document.querySelectorAll('.food-card').forEach(el => { el.hidden = el.dataset.restaurant !== activeRestaurant; });
    filterMenu();
  }
  function filterMenu() {
    const term = (search?.value || '').trim().toLowerCase();
    document.querySelectorAll('.food-card').forEach(el => { el.hidden = el.dataset.restaurant !== activeRestaurant || !(el.dataset.name.includes(term) || el.dataset.category.includes(term)); });
  }
  document.querySelectorAll('.restaurant-card').forEach(el => el.addEventListener('click', () => setRestaurant(el.dataset.restaurant)));
  document.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
    const id = Number(btn.dataset.add), restaurantId = String(btn.dataset.restaurant);
    if (activeRestaurant && restaurantId !== String(activeRestaurant)) {
      if (cart.size && !confirm('Your cart has items from another restaurant. Clear it and switch restaurants?')) return;
      cart.clear(); activeRestaurant = restaurantId;
      document.querySelectorAll('.restaurant-card').forEach(el => el.classList.toggle('selected', el.dataset.restaurant === activeRestaurant));
      document.querySelectorAll('.food-card').forEach(el => { el.hidden = el.dataset.restaurant !== activeRestaurant; });
    }
    const item = byId.get(id); if (!item) return;
    const existing = cart.get(id); cart.set(id, {...item, quantity: existing ? existing.quantity + 1 : 1});
    renderCart();
  }));
  cartItems?.addEventListener('click', event => {
    const btn = event.target.closest('[data-qty]'); if (!btn) return;
    const id = Number(btn.dataset.qty), item = cart.get(id); if (!item) return;
    item.quantity += Number(btn.dataset.delta);
    if (item.quantity < 1) cart.delete(id); else cart.set(id, item);
    renderCart();
  });
  search?.addEventListener('input', filterMenu);
  orderNow?.addEventListener('click', async () => {
    const items = [...cart.values()]; if (!items.length) return;
    orderNow.disabled = true; orderNow.innerHTML = 'Preparing order…';
    try {
      const response = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({restaurantId:Number(activeRestaurant), items:items.map(i=>({id:i.id,quantity:i.quantity})), customerName:document.getElementById('customerName').value}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save order.');
      window.location.href = data.whatsappUrl;
    } catch (err) {
      alert(err.message); orderNow.disabled = false; orderNow.innerHTML = 'Order now on WhatsApp <span>↗</span>';
    }
  });
  if (activeRestaurant) setRestaurant(activeRestaurant);
  renderCart();
})();
