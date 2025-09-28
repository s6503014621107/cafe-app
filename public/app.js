// -------- state --------
let MENU = [];
let FILTER = 'all';
let CART = [];

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function baht(n){ return `฿${Number(n||0).toLocaleString('th-TH')}`; }
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

function cartCount(){
  return CART.reduce((s,it)=>s+it.qty,0);
}
function cartTotal(){
  return CART.reduce((s,it)=>s + it.price*it.qty,0);
}
function syncCartBadge(){
  $('#cartBtn').textContent = `ตะกร้า (${cartCount()})`;
  $('#totalText').textContent = baht(cartTotal());
}

// ---------- UI render ----------
function renderTabs(){
  const types = ['รายการทั้งหมด','กาแฟ','น้ำผลไม้','ปั่น','โซดา/น้ำอัดลม','ชา/ชาสมุนไพร'];
  const map = ['all','coffee','juice','smoothie','soda','tea'];
  $('#tabs').innerHTML = types.map((t,i)=>(
    `<button data-type="${map[i]}" class="${map[i]===FILTER?'active':''}">${t}</button>`
  )).join('');
  $$('#tabs button').forEach(btn=>{
    btn.onclick = () => { FILTER = btn.dataset.type; renderGrid(); renderTabs(); }
  });
}

function renderGrid(){
  const q = $('#search').value.trim().toLowerCase();
  let list = MENU;
  if (FILTER!=='all') list = list.filter(m => m.type===FILTER);
  if (q) list = list.filter(m => m.name.toLowerCase().includes(q));

  $('#grid').innerHTML = list.map(m => `
    <div class="card">
      <div class="card__body">
        <div class="card__name">${m.name}</div>
        <div class="card__price">${baht(m.price)}</div>
      </div>
      <div class="card__footer">
        <span></span>
        <button class="add" data-id="${m.id}">เพิ่ม</button>
      </div>
    </div>
  `).join('');

  $$('#grid .add').forEach(btn=>{
    btn.onclick = () => {
      const id = btn.dataset.id;
      const found = MENU.find(x=>x.id===id);
      const ex = CART.find(x=>x.id===id);
      if (ex) ex.qty += 1; else CART.push({ id, name:found.name, price:found.price, qty:1 });
      syncCartBadge();
      toast(`เพิ่ม ${found.name} ลงตะกร้าแล้ว`);
    };
  });
}

function renderCart(){
  const el = $('#cartList');
  if (CART.length===0){
    el.innerHTML = `<div style="color:#888">ยังไม่มีสินค้าในตะกร้า</div>`;
    syncCartBadge();
    return;
  }
  el.innerHTML = CART.map(it => `
    <div class="cart-item">
      <div>
        <div style="font-weight:600">${it.name}</div>
        <div style="color:#8a8a8a; font-size:12px">${baht(it.price)}</div>
      </div>
      <div class="qty">
        <button data-act="minus" data-id="${it.id}">-</button>
        <div>${it.qty}</div>
        <button data-act="plus" data-id="${it.id}">+</button>
        <button data-act="rm" data-id="${it.id}" title="ลบ" style="margin-left:6px">✕</button>
      </div>
    </div>
  `).join('');

  // bind qty buttons
  $('#cartList').onclick = (e)=>{
    const id = e.target.dataset.id;
    const act = e.target.dataset.act;
    if (!id || !act) return;
    const row = CART.find(x=>x.id===id);
    if (!row) return;
    if (act==='plus') row.qty += 1;
    if (act==='minus') row.qty = Math.max(1, row.qty-1);
    if (act==='rm') CART = CART.filter(x=>x.id!==id);
    renderCart(); syncCartBadge();
  };

  syncCartBadge();
}

// ---------- drawer controls ----------
function openDrawer(){
  $('#backdrop').classList.add('show');
  $('#drawer').classList.add('open');
  renderCart();
}
function closeDrawer(){
  $('#backdrop').classList.remove('show');
  $('#drawer').classList.remove('open');
}

// ---------- place order ----------
async function placeOrder(){
  if (CART.length===0){ toast('ตะกร้าว่าง'); return; }
  const name = $('#custName').value.trim();
  const phone = $('#custPhone').value.trim();
  const dept = $('#custDept').value.trim();
  const pick = $('#pickupTime').value.trim();

  if (!name || !phone){
    toast('กรอกชื่อและเบอร์โทรก่อนนะ');
    return;
  }
  // แพ็กข้อมูล items => [{id, qty}]
  const items = CART.map(it => ({ id: it.id, qty: it.qty }));
  // ส่งค่า table เก็บ meta (อ่านได้ใน KDS/Influx)
  const table = `${dept||'N/A'} | ${name} | ${phone} | ${pick||'N/A'}`;

  try{
    const res = await fetch('/api/orders', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ table, items })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'order failed');

    toast(`สั่งสำเร็จ! ออร์เดอร์: ${data.code} ยอดรวม ${baht(data.total)}`);
    CART = [];
    syncCartBadge();
    // ล้างฟอร์ม
    $('#custName').value = '';
    $('#custPhone').value = '';
    $('#custDept').value = '';
    $('#pickupTime').value = '';
    renderCart();
    // ปิด drawer
    closeDrawer();
  }catch(err){
    console.error(err);
    toast('สั่งไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
}

// ---------- boot ----------
async function boot(){
  try{
    const r = await fetch('/api/menu');  // server.js ให้เมนู
    MENU = await r.json();
  }catch{
    // fallback (กรณีไม่มี /api/menu)
    MENU = [
      { id:'m01', name:'มัทฉะ (เย็น)', type:'tea', price:69 },
      { id:'m02', name:'ชาดอกเก๊กฮวย (เย็น)', type:'tea', price:49 },
      { id:'m03', name:'น้ำส้ม (เย็น)', type:'juice', price:45 },
      { id:'m04', name:'อเมริกาโน่ (เย็น)', type:'coffee', price:55 },
      { id:'m05', name:'ลาเต้ (เย็น)', type:'coffee', price:65 },
      { id:'m06', name:'โค้กโค้กซ่า (เย็น)', type:'soda', price:55 },
      { id:'m07', name:'เลมอนโซดา (เย็น)', type:'soda', price:49 },
      { id:'m08', name:'สตรอว์เบอร์รีปั่น', type:'smoothie', price:59 },
    ];
  }

  renderTabs();
  renderGrid();
  syncCartBadge();

  // events
  $('#search').addEventListener('input', renderGrid);
  $('#cartBtn').onclick = openDrawer;
  $('#backdrop').onclick = closeDrawer;
  $('#closeDrawer').onclick = closeDrawer;
  $('#backToMenu').onclick = closeDrawer;
  $('#placeOrder').onclick = placeOrder;
}

boot();
