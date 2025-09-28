// ------- State -------
let MENU = [];
let FILTER = 'all';
let CART = []; // [{id, qty}]
const THB = n => '฿' + n.toString();

// ------- Elements -------
const tabsEl = document.getElementById('tabs');
const gridEl = document.getElementById('grid');
const searchEl = document.getElementById('search');
const cartBtn = document.getElementById('cartBtn');
const panel = document.getElementById('panel');
const panelClose = document.getElementById('panelClose');
const cartList = document.getElementById('cartList');
const totalEl = document.getElementById('total');
const form = document.getElementById('orderForm');
const nameEl = document.getElementById('fName');
const phoneEl = document.getElementById('fPhone');
const deptEl = document.getElementById('fDept');
const pickupEl = document.getElementById('fPickup');
const backHome = document.getElementById('backHome');
const toast = document.getElementById('toast');

const showToast = (msg) => {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 2000);
};

// ------- Fetch menu from API -------
async function loadMenu(){
  const res = await fetch('/api/menu');
  MENU = await res.json();
  renderTabs();
  renderGrid();
}
loadMenu();

// ------- Render Tabs -------
function renderTabs(){
  const cats = ['รายการทั้งหมด', 'กาแฟ', 'น้ำผลไม้', 'ชา/ชาเขียว', 'โซดาและน้ำอัดลม', 'ปั่น'];
  const map = ['all','coffee','juice','tea','soda','smoothie'];
  tabsEl.innerHTML = '';
  cats.forEach((label, i)=>{
    const key = map[i];
    const b = document.createElement('button');
    b.textContent = label;
    b.className = 'tab';
    if (FILTER === key) b.classList.add('active');
    b.onclick = () => { FILTER = key; renderTabs(); renderGrid(); };
    tabsEl.appendChild(b);
  });
}

// ------- Render Grid -------
function renderGrid(){
  const q = searchEl.value?.trim().toLowerCase();
  let items = MENU.slice();
  if (FILTER !== 'all') items = items.filter(x => x.type === FILTER);
  if (q) items = items.filter(x => x.name.toLowerCase().includes(q));

  gridEl.innerHTML = '';
  items.forEach(it=>{
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="img" style="background-image:url('${it.img || ''}')"></div>
      <div class="body">
        <div class="name">${it.name} <span class="badge">${it.type}</span></div>
        <div class="price">${THB(it.price)}</div>
        <div class="foot">
          <span></span>
          <button class="add">เพิ่ม</button>
        </div>
      </div>
    `;
    card.querySelector('.add').onclick = () => addToCart(it.id);
    gridEl.appendChild(card);
  });
}
searchEl.addEventListener('input', renderGrid);

// ------- Cart helpers -------
function cartCount(){ return CART.reduce((s,x)=>s+x.qty,0) }
function updateCartBtn(){ cartBtn.textContent = `ตะกร้า (${cartCount()})` }

function addToCart(id){
  const f = CART.find(x=>x.id===id);
  if (f) f.qty += 1; else CART.push({id, qty:1});
  updateCartBtn();
  showToast('เพิ่มลงตะกร้าแล้ว');
}

function renderCart(){
  cartList.innerHTML = '';
  let total = 0;
  CART.forEach(row=>{
    const it = MENU.find(m=>m.id===row.id);
    const amt = it.price * row.qty; total += amt;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="row"><strong>${it.name}</strong><strong>${THB(amt)}</strong></div>
      <div class="row">
        <small class="muted">Type: ${it.type}</small>
        <div class="qty">
          <button aria-label="dec">-</button>
          <span>${row.qty}</span>
          <button aria-label="inc">+</button>
          <button aria-label="remove" class="icon-btn">✕</button>
        </div>
      </div>
    `;
    const [dec, , inc, remove] = div.querySelectorAll('button');
    dec.onclick = ()=>{ row.qty=Math.max(1,row.qty-1); renderCart() };
    inc.onclick = ()=>{ row.qty+=1; renderCart() };
    remove.onclick = ()=>{ CART = CART.filter(x=>x!==row); renderCart(); updateCartBtn(); };
    cartList.appendChild(div);
  });
  totalEl.textContent = THB(total);
}

// ------- Panel open/close -------
cartBtn.onclick = ()=>{
  renderCart();
  panel.classList.remove('hidden');
}
panelClose.onclick = ()=> panel.classList.add('hidden');
backHome.onclick = ()=> panel.classList.add('hidden');

// ------- Place Order -------
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!CART.length) { showToast('ตะกร้าว่างเปล่า'); return; }

  // สร้าง payload
  const items = CART.map(x=>({ id:x.id, qty:x.qty }));
  const table = (deptEl.value || nameEl.value || 'T1'); // เก็บเผื่อใช้ใน KDS
  const payload = { table, items, meta:{
    name:nameEl.value||'',
    phone:phoneEl.value||'',
    dept:deptEl.value||'',
    pickup:pickupEl.value||''
  }};

  try{
    const res = await fetch('/api/orders', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok || !data.ok) throw new Error(data?.error||'order failed');

    CART = []; updateCartBtn(); renderCart(); panel.classList.add('hidden');
    showToast(`สั่งสำเร็จ! รหัสออเดอร์: ${data.code} ยอดรวม: ${THB(data.total)}`);
  }catch(err){
    console.error(err);
    showToast('สั่งซื้อไม่สำเร็จ กรุณาลองใหม่');
  }
});
