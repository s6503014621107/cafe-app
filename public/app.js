// ====== CONFIG / STATE ======
const API = {
  menu: '/api/menu',
  orders: '/api/orders',
};

const el = {
  grid:    document.getElementById('grid'),
  tabs:    document.getElementById('tabs'),
  search:  document.getElementById('search'),
  cartBtn: document.getElementById('cartBtn'),
  toast:   document.getElementById('toast'),
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
const fmtBaht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');

function showToast(msg) {
  if (!el.toast) { alert(msg); return; }
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

function getUrlTable() {
  const url = new URL(location.href);
  const t = (url.searchParams.get('table') || '').trim();
  return t || null;
}

function validateTable(t) {
  // อนุญาต A-Z0-9 ขีดกลาง ไม่เกิน 10 ตัวอักษร (ปรับได้)
  return /^[A-Za-z0-9-]{1,10}$/.test(t);
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

  el.tabs.onclick = (ev) => {
    const btn = ev.target.closest('button[data-type]');
    if (!btn) return;
    FILTER.type = btn.dataset.type;
    [...el.tabs.children].forEach(b => b.classList.toggle('active', b === btn));
    renderGrid();
  };
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
        <div class="price">${fmtBaht(m.price)}</div>
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

// ====== CHECKOUT (ถามเลขโต๊ะ + ยืนยัน) ======
function buildCartArray() {
  return [...CART.entries()].map(([id, qty]) => ({ id, qty }));
}

function calcTotal(cart) {
  let total = 0;
  for (const { id, qty } of cart) {
    const found = MENU.find(m => m.id === id);
    if (found) total += (found.price || 0) * (qty || 1);
  }
  return total;
}

function cartSummaryText(cart) {
  const lines = cart.map(({ id, qty }) => {
    const f = MENU.find(m => m.id === id);
    const name = f ? f.name : id;
    const price = f ? f.price : 0;
    return `• ${name} x${qty} (${fmtBaht(price * qty)})`;
  });
  return lines.join('\n');
}

async function submitOrder() {
  const cart = buildCartArray();
  if (cart.length === 0) { showToast('ยังไม่ได้เลือกเมนู'); return; }

  // 1) หาเลขโต๊ะ: ?table= > localStorage > prompt
  let table =
    getUrlTable() ||
    localStorage.getItem('twinkle.table') ||
    '';

  if (!validateTable(table)) {
    table = prompt('กรุณากรอกเลขโต๊ะ (เช่น T1):', table || 'T1') || '';
    table = table.trim();
    if (!validateTable(table)) {
      showToast('เลขโต๊ะไม่ถูกต้อง');
      return;
    }
  }

  // 2) สรุปรายการและยืนยัน
  const total = calcTotal(cart);
  const summary = cartSummaryText(cart);
  const ok = confirm(
    `ยืนยันสั่งออเดอร์สำหรับโต๊ะ: ${table}\n\n` +
    `${summary}\n\nรวมทั้งสิ้น: ${fmtBaht(total)}\n\nยืนยันสั่งใช่ไหม?`
  );
  if (!ok) return;

  // บันทึกเลขโต๊ะไว้รอบหน้า
  localStorage.setItem('twinkle.table', table);

  // 3) ยิง API
  try {
    el.cartBtn?.setAttribute('disabled', 'true');

    const res = await fetch(API.orders, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ table, items: cart }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    alert(`สั่งสำเร็จ!\nรหัสคำสั่งซื้อ: ${data.code}\nยอดรวม: ${fmtBaht(data.total)}`);
    CART.clear();
    updateCartBadge();
  } catch (e) {
    console.error(e);
    alert('ส่งออเดอร์ไม่สำเร็จ กรุณาลองใหม่');
  } finally {
    el.cartBtn?.removeAttribute('disabled');
  }
}

// ====== INIT ======
window.addEventListener('DOMContentLoaded', () => {
  el.cartBtn?.addEventListener('click', submitOrder);
  loadMenu();
});
