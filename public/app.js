/* public/app.js — Twinkle Coffee (safe bindings + qty controls) */

// ---------- Utilities ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const THB = (n) => `฿${Number(n || 0).toLocaleString('th-TH')}`;

// ---------- State ----------
let MENU = [];
let CART = [];

// ---------- DOM ----------
const tabsEl    = $('#tabs');
const gridEl    = $('#grid');
const searchEl  = $('#search');
const panel     = $('#panel');
const cartBtn   = $('#cartBtn');
const panelClose= $('#panelClose');
const cartList  = $('#cartList');
const form      = $('#orderForm');
const nameEl    = $('#fName');
const phoneEl   = $('#fPhone');
const deptEl    = $('#fDept');
const pickupEl  = $('#fPickup');
const totalEl   = $('#total');
const backHome  = $('#backHome');
const toastEl   = $('#toast');

// ---------- Toast ----------
function showToast(msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'),1800);
}

// ---------- Load menu ----------
async function loadMenu(){
  const res = await fetch('/api/menu');
  MENU = await res.json();
  renderTabs();
  renderGrid(MENU);
}

// ---------- Render tabs ----------
function renderTabs(){
  if(!tabsEl) return;
  const types = [
    {key:'all', name:'รายการทั้งหมด'},
    {key:'coffee', name:'กาแฟ'},
    {key:'juice', name:'น้ำผลไม้'},
    {key:'tea', name:'ชา/ชาเขียว'},
    {key:'soda', name:'โซดาและน้ำอัดลม'},
    {key:'smoothie', name:'ปั่น'},
  ];

  tabsEl.innerHTML = '';
  types.forEach(t=>{
    const b = document.createElement('button');
    b.textContent = t.name;
    b.className = 'tab';
    b.onclick = ()=>{
      $$('.tabs button', tabsEl).forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      if(t.key==='all') renderGrid(MENU);
      else renderGrid(MENU.filter(m=>m.type===t.key));
    };
    tabsEl.appendChild(b);
  });

  // default select "all"
  const first = $('button', tabsEl);
  first && first.click();
}

// ---------- Render grid ----------
function renderGrid(list){
  if(!gridEl) return;
  gridEl.innerHTML = '';
  list.forEach(item=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="img"></div>
      <div class="body">
        <div class="name">${item.name}
          <span class="badge">${item.type}</span>
        </div>
        <div class="price">${THB(item.price)}</div>
        <div class="foot">
          <span></span>
          <button class="add">เพิ่ม</button>
        </div>
      </div>
    `;
    $('button.add', card)?.addEventListener('click', ()=> addToCart(item.id));
    gridEl.appendChild(card);
  });
}

// ---------- Cart core ----------
function addToCart(id){
  const found = CART.find(x=>x.id===id);
  if(found) found.qty++;
  else CART.push({ id, qty:1 });
  updateCartBtn();
  showToast('เพิ่มลงตะกร้าแล้ว');
}

function updateCartBtn(){
  if(!cartBtn) return;
  const qty = CART.reduce((s,x)=>s+x.qty,0);
  cartBtn.textContent = `ตะกร้า (${qty})`;
}

function renderCart(){
  if(!cartList || !totalEl) return;

  cartList.innerHTML = '';
  let total = 0;

  CART.forEach(row=>{
    const menu = MENU.find(m=>m.id===row.id);
    if(!menu) return; // กันกรณี id ไม่ตรง

    total += menu.price * row.qty;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="row">
        <div>
          <div><strong>${menu.name}</strong></div>
          <div class="muted">${THB(menu.price)} / แก้ว</div>
        </div>
        <div class="qty">
          <button class="qty-dec" aria-label="decrease">-</button>
          <span class="qty-val">${row.qty}</span>
          <button class="qty-inc" aria-label="increase">+</button>
          <button class="icon-btn remove" aria-label="remove">✕</button>
        </div>
      </div>
    `;

    $('.qty-dec', div)?.addEventListener('click', ()=>{
      row.qty = Math.max(1, (row.qty||1) - 1);
      renderCart(); updateCartBtn();
    });
    $('.qty-inc', div)?.addEventListener('click', ()=>{
      row.qty = (row.qty||1) + 1;
      renderCart(); updateCartBtn();
    });
    $('.remove', div)?.addEventListener('click', ()=>{
      CART = CART.filter(x=>x!==row);
      renderCart(); updateCartBtn();
    });

    cartList.appendChild(div);
  });

  totalEl.textContent = THB(total);
}

// ---------- Search ----------
searchEl?.addEventListener('input', ()=>{
  const q = searchEl.value.trim().toLowerCase();
  const list = MENU.filter(m=>
    m.name.toLowerCase().includes(q) ||
    String(m.id).toLowerCase().includes(q)
  );
  renderGrid(list);
});

// ---------- Panel open/close ----------
cartBtn?.addEventListener('click', ()=>{
  if(!panel) return;
  renderCart();
  panel.classList.remove('hidden');
});
panelClose?.addEventListener('click', ()=> panel?.classList.add('hidden'));
backHome?.addEventListener('click', ()=> panel?.classList.add('hidden'));

// ---------- Submit order ----------
form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!CART.length){ showToast('ตะกร้าว่างเปล่า'); return; }
  if(CART.some(x=>!x.id)){ showToast('พบรายการที่ไม่มีรหัสสินค้า'); return; }

  const items = CART.map(x=>({ id:String(x.id), qty:Number(x.qty||1) }));

  const payload = {
    table: $('#fDept')?.value || 'NA',
    items
  };

  const btn = form.querySelector('button[type="submit"]');
  try{
    btn && (btn.disabled = true);

    const res = await fetch('/api/orders', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data = {};
    try{ data = JSON.parse(text) }catch{}

    if(!res.ok || !data.ok){
      console.error('Order failed:', res.status, text);
      throw new Error(data?.error || `order failed (${res.status})`);
    }

    CART = [];
    updateCartBtn();
    renderCart();
    panel?.classList.add('hidden');

    showToast('สั่งสำเร็จ! ส่งไปที่ KDS แล้ว');
  }catch(err){
    console.error('[submit error]', err);
    showToast('สั่งซื้อไม่สำเร็จ กรุณาลองใหม่');
  }finally{
    btn && (btn.disabled = false);
  }
});

// ---------- Init ----------
window.addEventListener('DOMContentLoaded', loadMenu);
