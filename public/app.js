// ---------- Globals ----------
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));

const state = {
  menu: [],
  filtered: [],
  tab: 'all',
  cart: [], // {id, name, price, qty}
};

// ---------- UI refs ----------
const tabs = $('#tabs');
const search = $('#search');
const grid = $('#grid');
const cartBtn = $('#cartBtn');
const overlay = $('#overlay');
const drawer = $('#drawer');
const closeDrawer = $('#closeDrawer');
const cartList = $('#cartList');
const cartTotal = $('#cartTotal');
const placeOrder = $('#placeOrder');
const backHome = $('#backHome');
const toast = $('#toast');

const inpName = $('#inpName');
const inpPhone = $('#inpPhone');
const inpDept = $('#inpDept');
const inpPickup = $('#inpPickup');
const inpTable = $('#inpTable');

// ---------- Utils ----------
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 1800);
}

function openDrawer(){
  overlay.classList.remove('hidden');
  drawer.classList.remove('hidden');
  requestAnimationFrame(()=>{
    overlay.classList.add('show');
    drawer.classList.add('show');
  });
  renderCart();
}

function closeDrawerFn(){
  overlay.classList.remove('show');
  drawer.classList.remove('show');
  setTimeout(()=>{
    overlay.classList.add('hidden');
    drawer.classList.add('hidden');
  }, 250);
}

overlay.addEventListener('click', closeDrawerFn);
closeDrawer.addEventListener('click', closeDrawerFn);
backHome.addEventListener('click', closeDrawerFn);

cartBtn.addEventListener('click', openDrawer);

// ---------- Load pickup time slots (every 15 min, next 2 hours) ----------
(function buildPickupSlots(){
  const start = new Date();
  start.setMinutes(start.getMinutes() + 20); // +20 นาที จากตอนนี้
  start.setSeconds(0,0);
  while (start.getMinutes()%15 !== 0) start.setMinutes(start.getMinutes()+1);

  for (let i=0;i<8;i++){
    const hh = String(start.getHours()).padStart(2,'0');
    const mm = String(start.getMinutes()).padStart(2,'0');
    const opt = document.createElement('option');
    opt.value = `${hh}:${mm}`;
    opt.textContent = `${hh}:${mm}`;
    inpPickup.appendChild(opt);
    start.setMinutes(start.getMinutes()+15);
  }
})();

// ---------- Fetch menu ----------
async function loadMenu(){
  const res = await fetch('/api/menu');   // server.js ให้ /api/menu ไว้แล้ว
  const menu = await res.json();
  state.menu = menu;
  state.filtered = menu;
  renderTabs(menu);
  renderGrid();
}

function renderTabs(menu){
  const types = Array.from(new Set(menu.map(m=>m.type)));
  const all = [{key:'all', label:'รายการทั้งหมด'}, ...types.map(t=>({key:t,label:labelOf(t)}))];
  tabs.innerHTML = '';
  all.forEach(({key,label})=>{
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = key===state.tab?'active':'';
    btn.onclick = ()=>{
      state.tab = key;
      filterMenu();
      $$('.tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    };
    tabs.appendChild(btn);
  });
}

function labelOf(type){
  const map = { coffee:'กาแฟ', tea:'ชา', juice:'น้ำผลไม้', smoothie:'ปั่น', soda:'โซดา/น้ำอัดลม' };
  return map[type] || type;
}

function filterMenu(){
  const q = search.value.trim().toLowerCase();
  state.filtered = state.menu.filter(m=>{
    const byTab = state.tab==='all' ? true : m.type===state.tab;
    const byText = !q || m.name.toLowerCase().includes(q);
    return byTab && byText;
  });
  renderGrid();
}

search.addEventListener('input', filterMenu);

function renderGrid(){
  grid.innerHTML = '';
  state.filtered.forEach(m=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="info">
        <div class="name">${m.name}</div>
        <div class="foot">
          <div class="price">฿${m.price}</div>
          <button class="btn" data-id="${m.id}">เพิ่ม</button>
        </div>
      </div>
    `;
    card.querySelector('button').onclick = ()=> addToCart(m.id);
    grid.appendChild(card);
  });
}

function addToCart(id){
  const item = state.menu.find(x=>x.id===id);
  if(!item) return;
  const found = state.cart.find(c=>c.id===id);
  if(found) found.qty += 1;
  else state.cart.push({id:item.id, name:item.name, price:item.price, qty:1});
  updateCartBadge();
  showToast(`เพิ่ม ${item.name} ลงตะกร้าแล้ว`);
}

function updateCartBadge(){
  const n = state.cart.reduce((s,c)=>s+c.qty,0);
  cartBtn.textContent = `ตะกร้า (${n})`;
}

// ---------- Drawer / Cart ----------
function renderCart(){
  cartList.innerHTML = '';
  state.cart.forEach(c=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div>
        <div><strong>${c.name}</strong></div>
        <div class="muted">฿${c.price}</div>
      </div>
      <div class="qtyctl">
        <button aria-label="minus">−</button>
        <span>${c.qty}</span>
        <button aria-label="plus">＋</button>
        <button class="icon-btn" title="remove">🗑️</button>
      </div>
    `;
    const [btnMinus, , btnPlus, btnDel] = row.querySelectorAll('button');
    btnMinus.onclick = ()=>{ c.qty=Math.max(1,c.qty-1); renderCart(); updateCartBadge(); };
    btnPlus.onclick = ()=>{ c.qty+=1; renderCart(); updateCartBadge(); };
    btnDel.onclick  = ()=>{ state.cart = state.cart.filter(x=>x.id!==c.id); renderCart(); updateCartBadge(); };
    cartList.appendChild(row);
  });

  const total = state.cart.reduce((s,c)=>s+c.price*c.qty, 0);
  cartTotal.textContent = '฿'+total;
}

// ---------- Submit order ----------
placeOrder.addEventListener('click', async ()=>{
  if(state.cart.length===0) return showToast('กรุณาเลือกสินค้า');

  const table = (inpTable.value || '').trim() || 'NA';
  const items = state.cart.map(c=>({ id:c.id, qty:c.qty }));

  // ยิงไปยัง /api/orders
  try{
    const res = await fetch('/api/orders', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ table, items })
    });
    const data = await res.json();
    if(!data.ok) throw new Error(data.error||'order failed');

    // แจ้งเตือน + clear cart
    showToast(`สั่งสำเร็จ! ออเดอร์: ${data.code} ยอดรวม ฿${data.total}`);
    state.cart = [];
    updateCartBadge();
    renderCart();
    closeDrawerFn();
  }catch(err){
    console.error(err);
    showToast('สั่งไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
});

// ---------- Start ----------
loadMenu();
