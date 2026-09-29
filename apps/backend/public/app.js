const grid = document.querySelector('#productGrid');
const template = document.querySelector('#productTemplate');
const cart = [];
let currentProducts = [];

const money = amount => `₦${Number(amount).toLocaleString('en-NG')}`;
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));

async function loadProducts(params = {}) {
  const query = new URLSearchParams(params);
  const response = await fetch(`/api/products?${query}`);
  currentProducts = await response.json();
  grid.innerHTML = '';
  document.querySelector('#emptyState').hidden = Boolean(currentProducts.length);
  currentProducts.forEach(product => {
    const card = template.content.cloneNode(true);
    card.querySelector('img').src = product.image;
    card.querySelector('img').alt = product.name;
    card.querySelector('.product-badge').textContent = product.badge;
    card.querySelector('.product-category').textContent = product.category;
    card.querySelector('h3').textContent = product.name;
    card.querySelector('.rating').innerHTML = `★★★★★ <span>${product.rating || 'New'} ${product.reviews ? `(${product.reviews})` : ''}</span>`;
    card.querySelector('.price').textContent = money(product.price);
    card.querySelector('.old-price').textContent = product.oldPrice ? money(product.oldPrice) : '';
    card.querySelector('.add').addEventListener('click', () => addToCart(product));
    card.querySelector('.heart').addEventListener('click', event => { event.currentTarget.textContent = event.currentTarget.textContent === '♡' ? '♥' : '♡'; });
    grid.append(card);
  });
}

function addToCart(product) {
  cart.push(product); renderCart(); document.querySelector('#cartPanel').classList.add('open'); document.querySelector('#overlay').classList.add('show');
}
function renderCart() {
  const items = document.querySelector('#cartItems');
  document.querySelector('#cartCount').textContent = cart.length;
  document.querySelector('#cartLabel').textContent = `(${cart.length})`;
  document.querySelector('#cartTotal').textContent = money(cart.reduce((sum, item) => sum + item.price, 0));
  if (!cart.length) { items.innerHTML = '<p class="empty-cart">Your basket is waiting for something lovely.</p>'; return; }
  items.innerHTML = cart.map((item, index) => `<div class="cart-item"><img src="${item.image}" alt=""><div><h4>${escapeHtml(item.name)}</h4><p>${money(item.price)}</p></div><button class="remove" data-index="${index}" aria-label="Remove item">×</button></div>`).join('');
  items.querySelectorAll('.remove').forEach(button => button.addEventListener('click', () => { cart.splice(Number(button.dataset.index), 1); renderCart(); }));
}
function closePanels() { document.querySelector('#cartPanel').classList.remove('open'); document.querySelector('#overlay').classList.remove('show'); }

document.querySelector('#cartButton').addEventListener('click', () => { document.querySelector('#cartPanel').classList.add('open'); document.querySelector('#overlay').classList.add('show'); });
document.querySelector('#overlay').addEventListener('click', closePanels);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { const target = document.querySelector(`#${button.dataset.close}`); if (target.tagName === 'DIALOG') target.close(); else closePanels(); }));
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.product-filters button').forEach(item => item.classList.remove('active')); loadProducts({ category: button.dataset.category }); document.querySelector('#shop').scrollIntoView({ behavior: 'smooth' }); }));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-filter]').forEach(item => item.classList.remove('active')); button.classList.add('active'); loadProducts(button.dataset.filter ? { category: button.dataset.filter } : {}); }));
document.querySelector('#searchButton').addEventListener('click', () => loadProducts({ search: document.querySelector('#searchInput').value }));
document.querySelector('#searchInput').addEventListener('keydown', event => { if (event.key === 'Enter') document.querySelector('#searchButton').click(); });
document.querySelector('#sellerModalButton').addEventListener('click', () => document.querySelector('#sellerDialog').showModal());
document.querySelector('#openUpload').addEventListener('click', () => { document.querySelector('#sellerDialog').close(); document.querySelector('#uploadDialog').showModal(); });
document.querySelector('#sellerForm').addEventListener('submit', async event => { event.preventDefault(); const response = await fetch('/api/sellers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); const data = await response.json(); document.querySelector('#sellerMessage').textContent = data.message; if (response.ok) event.target.reset(); });
document.querySelector('#productForm').addEventListener('submit', async event => { event.preventDefault(); const response = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); const data = await response.json(); document.querySelector('#productMessage').textContent = response.ok ? 'Published! Your product is now visible in the store.' : data.message; if (response.ok) { event.target.reset(); loadProducts(); } });
document.querySelector('.checkout').addEventListener('click', () => { if (cart.length) alert('Checkout is ready for payment integration.'); });
loadProducts();
