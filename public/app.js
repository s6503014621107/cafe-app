// ====== CONFIG / STATE ======
const API = {
  menu: '/api/menu',
  orders: '/api/orders',
};

const el = {
  grid:   document.getElementById('grid'),
  tabs:   document.getElementById('tabs'),
  search: document.getElementById('search'),
  cartBtn:document.getElementById('cartBtn'),
  toast:  document.getElementById('toast'),
};

const TYPE_LABEL = {
  all: 'รายการทั้งหมด',
  coffee: 'กาแฟ',
  tea: 'ชา/ชาสมุนไพร',
  juice: 'น้ำผลไม้',
  soda: 'โซดา/น้ำอัดลม',
  smoothie: 'ปั่น',
};

let MENU = [];
let FILTER = { type: 'all', q: '' };
const CART = new Map(); // Map<id, qty>

// ====== UTIL ======
const $ = (sel, root = document) => root.querySelector(sel);
const formatBaht = (n) => `฿${Number(n).toLocaleString('th-TH')}`;

function showToast(msg) {
  if (!el.toast) return alert(msg);
  el.toast.textContent = msg;
  el.toast.style.opacity = '1';
  el.toast.style.transform = 'translateY(0)';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.toast.style.opacity = '0';
    el.toast.style.transform = 'translateY(10px)';
  }, 1800);
}

function updateCartBadge() {
  const count = [...CART.values()].reduce((s, x) => s + x, 0);
  if (el.cartBtn) el.cartBtn.textContent = `ตะกร้า (${count})`;
}

// ====== MENU LOAD & RENDER ======
async function loadMenu() {
  try {
    const res = await fetch(API.menu, { cache: 'no-store' });
    if (!res.ok) throw new Error(`menu http ${res.status}`);
    MENU = await res.json();

    renderTabs();
    renderGrid();
    bindSearch();
    updateCartBadge();
  } catch (e) {
    console.error(e);
    showToast('โหลดเมนูไม่สำเร็จ ลองกด Ctrl+F5');
  }
}

function renderTabs() {
  if (!el.tabs) return;
  const types = Array.from(new Set(MENU.map(m => m.type))).sort();
  const entries = [{ key: 'all', label: TYPE_LABEL.all }, ...types.map(t => ({ key: t, label: TYPE_LABEL[t] || t }))];

  el.tabs.innerHTML = entries.map(t =>
    `<button class="tab ${FILTER.type === t.key ? 'active' : ''}" data-type="${t.key}">${t.label}</button>`
  ).join('');

  el.tabs.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-type]');
    if (!btn) return;
    FILTER.type = btn.dataset.type;
    [...el.tabs.children].forEach(b => b.classList.toggle('active', b === btn));
    renderGrid();
  });
}

function renderGrid() {
  if (!el.grid) return;
  const q = (FILTER.q || '').toLowerCase();
  let items = MENU.slice();

  if (FILTER.type !== 'all') items = items.filter(i => i.type === FILTER.type);
  if (q) items = items.filter(i => i.name.toLowerCase().includes(q));

  el.grid.innerHTML = items.map(cardHTML).join('');
  el.grid.querySelectorAll('.add').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.card').dataset.id;
      CART.set(id, (CART.get(id) || 0) + 1);
      updateCartBadge();
      showToast('เพิ่มลงตะกร้าแล้ว');
    });
  });
}

function cardHTML(m) {
  return `
    <div class="card" data-id="${m.id}">
      <div class="card__info">
        <div class="card__name">${m.name}</div>
        <div class="price">${formatBaht(m.price)}</div>
      </div>
      <div class="card__foot">
        <button class="btn add">เพิ่ม</button>
      </div>
    </div>
  `;
}

function bindSearch() {
  if (!el.search) return;
  el.search.addEventListener('input', () => {
    FILTER.q = el.search.value.trim();
    renderGrid();
  });
}

// ====== SUBMIT ORDER ======
async function submitOrder() {
  const items = [...CART.entries()].map(([id, qty]) => ({ id, qty }));
  if (items.length === 0) { showToast('ยังไม่ได้เลือกเมนู'); return; }

  try {
    const payload = { table: 'T1', items };
    const res = await fetch(API.orders, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'order failed');

    showToast(`สั่งสำเร็จ! รหัส: ${data.code} • รวม ${formatBaht(data.total)}`);
    CART.clear();
    updateCartBadge();
  } catch (e) {
    console.error(e);
    showToast('ส่งออเดอร์ไม่สำเร็จ');
  }
}

// ====== INIT ======
window.addEventListener('DOMContentLoaded', () => {
  if (el.cartBtn) el.cartBtn.addEventListener('click', submitOrder);
  loadMenu();
});
