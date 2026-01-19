async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error inesperado');
  }
  return data;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value);
}

async function loadProducts() {
  const { products } = await fetchJson('/api/products');
  const container = document.querySelector('[data-products]');
  if (!container) return;
  container.innerHTML = '';
  if (!products.length) {
    container.innerHTML = '<p class="notice">Aún no hay productos registrados.</p>';
    return;
  }
  products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'card';
    const image = product.photoUrl
      ? `<img src="${product.photoUrl}" alt="${product.name}">`
      : '<img src="/placeholder.svg" alt="Foto del producto">';
    card.innerHTML = `
      ${image}
      <h3>${product.name}</h3>
      <p>${formatCurrency(product.price)}</p>
      <span class="badge">${product.available ? 'Disponible' : 'No disponible'}</span>
    `;
    container.appendChild(card);
  });
}

async function setupProductForm() {
  const form = document.querySelector('[data-product-form]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name'),
      price: Number(formData.get('price')),
      photoUrl: formData.get('photoUrl'),
      available: formData.get('available') === 'on'
    };
    try {
      await fetchJson('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      form.reset();
      await loadProducts();
    } catch (error) {
      alert(error.message);
    }
  });
}

async function loadOrderProducts() {
  const list = document.querySelector('[data-order-products]');
  if (!list) return;
  const { products } = await fetchJson('/api/products/available');
  if (!products.length) {
    list.innerHTML = '<p class="notice">No hay productos disponibles.</p>';
    return;
  }
  list.innerHTML = '';
  products.forEach((product) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'card';
    wrapper.innerHTML = `
      <label>
        <input type="checkbox" name="product" value="${product.id}">
        <strong>${product.name}</strong> (${formatCurrency(product.price)})
      </label>
      <label>
        Cantidad
        <input type="number" name="quantity-${product.id}" min="1" value="1" />
      </label>
    `;
    list.appendChild(wrapper);
  });
}

async function setupOrderForm() {
  const form = document.querySelector('[data-order-form]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const customer = formData.get('customer');
    const notes = formData.get('notes');
    const selected = Array.from(form.querySelectorAll('input[name="product"]'))
      .filter((input) => input.checked)
      .map((input) => {
        const productId = Number(input.value);
        const quantity = Number(form.querySelector(`[name="quantity-${productId}"]`).value);
        return { productId, quantity };
      });

    try {
      await fetchJson('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, notes, items: selected })
      });
      form.reset();
      await loadOrderProducts();
      alert('Pedido registrado.');
    } catch (error) {
      alert(error.message);
    }
  });
}

async function setupReport() {
  const form = document.querySelector('[data-report-form]');
  const output = document.querySelector('[data-report-output]');
  if (!form || !output) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const date = formData.get('date');
    try {
      const report = await fetchJson(`/api/report?date=${date}`);
      output.innerHTML = `
        <div class="notice">
          <p><strong>Pedidos:</strong> ${report.totals.orders || 0}</p>
          <p><strong>Total vendido:</strong> ${formatCurrency(report.totals.total || 0)}</p>
        </div>
        <h3>Top productos</h3>
        ${report.topProducts.length ? '' : '<p>No hay ventas para esta fecha.</p>'}
        ${report.topProducts.length ? `
          <table class="table">
            <thead>
              <tr><th>Producto</th><th>Cantidad</th></tr>
            </thead>
            <tbody>
              ${report.topProducts.map((item) => `<tr><td>${item.name}</td><td>${item.quantity}</td></tr>`).join('')}
            </tbody>
          </table>
        ` : ''}
      `;
    } catch (error) {
      alert(error.message);
    }
  });
}

function markActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('nav a').forEach((link) => {
    if (link.getAttribute('href') === path) {
      link.classList.add('active');
    }
  });
}

async function init() {
  markActiveNav();
  await loadProducts();
  await setupProductForm();
  await loadOrderProducts();
  await setupOrderForm();
  await setupReport();
}

init();
