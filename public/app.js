// ------- State -------
let MENU = [];
let FILTER = 'all';
let CART = []; // [{id, qty}]
const THB = n => '฿' + (Number(n)||0);

// ------- Elements -------
const tabsEl   = document.getElementById('tabs');
const gridEl   = document.getElementById('grid');
const searchEl = document.getElementById('search');
const cartBtn  = document.getElementById('cartBtn');
const panel    = document.getElementById('panel');
const panelClose = document.getElementById('panelClose');
const cartList = document.getElementById('cartList');
const totalEl  = document.getElementById('total');
const form     = document.getElementById('orderForm');
const nameEl   = document.getElementById('fName');
const phoneEl  = document.getElementById('fPhone');
const deptEl   = document.getElementById('fDept');
const pickupEl = document.getElementById('fPickup');
const backHome = document.getElementById('backHome');
const toast    = document.getElementById('toast');

const showToast = (msg) => {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 2000);
};

// ---------- Normalize menu from API ----------
function normalizeMenuItem(raw){
  const id   = raw?.id ?? raw?.menu_id ?? raw?.code ?? raw?._id ?? raw?.ItemID ?? raw?.MenuID;
  const name = raw?.name ?? raw?.menu_name ?? raw?.menuName ?? raw?.title ?? raw?.MenuNameTH ?? raw?.MenuName;
  const type = (raw?.type ?? raw?.category ?? raw?.cat ?? raw?.group ?? 'other') + '';
  const price= Number(raw?.price ?? raw?.unit_price ?? raw?.unitPrice ?? raw?.cost ?? 0);
  const img  = raw?.img ?? raw?.image ?? raw?.photo ?? '';
  return { id: id!=null ? String(id) : '', name: name||'(ไม่มีชื่อ)', type: type.toLowerCase(), price, img };
}

// ------- Fetch menu (รองรับทั้ง {ok,menu} และ array) -------
async function loadMenu(){
  try{
    const res = await fetch('/api/menu',{headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('menu api');
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.menu) ? raw.menu : []);
    MENU = arr.map(normalizeMenuItem).filter(m=>m.id!=='');
    if (!MENU.length) throw new Error('empty menu');
  }catch(_){
    // Fallback ให้ id ตรงกับ server (m01..m08)
    MENU = [
      {id:'m01', name:'มัทฉะ (เย็น)',            type:'tea',      price:69, img:''},
      {id:'m02', name:'ชาดอกเก๊กฮวย (เย็น)',     type:'tea',      price:49, img:''},
      {id:'m03', name:'น้ำส้ม (เย็น)',            type:'juice',    price:45, img:''},
      {id:'m04', name:'อเมริกาโน่ (เย็น)',        type:'coffee',   price:55, img:''},
      {id:'m05', name:'ลาเต้ (เย็น)',             type:'coffee',   price:65, img:''},
      {id:'m06', name:'โค้กโค้กซ่า (เย็น)',       type:'soda',     price:55, img:''},
      {id:'m07', name:'เลมอนโซดา (เย็น)',         type:'soda',     price:49, img:''},
      {id:'m08', name:'สตรอว์เบอร์รีปั่น',        type:'smoothie', price:59, img:''},
    ];
  }
  renderTabs();
  renderGrid();
}
loadMenu();

// ------- Tabs -------
function renderTabs(){
  const labels = [
    ['all','รายการทั้งหมด'],
    ['coffee','กาแฟ'],
    ['juice','น้ำผลไม้'],
    ['tea','ชา/ชาเขียว'],
    ['soda','โซดาและน้ำอัดลม'],
    ['smoothie','ปั่น'],
  ];
  tabsEl.innerHTML = labels.map(([key,label]) =>
    `<button class="tab ${FILTER===key?'active':''}" data-key="${key}">${label}</button>`
  ).join('');
  tabsEl.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click',()=>{ FILTER=btn.dataset.key; renderTabs(); renderGrid(); });
  });
}

// ------- Grid -------
function renderGrid(){
  const q = (searchEl?.value || '').trim().toLowerCase();
  let items = MENU.slice();
  if (FILTER !== 'all') items = items.filter(x => x.type === FILTER);
  if (q) items = items.filter(x => (x.name||'').toLowerCase().includes(q));

  gridEl.innerHTML = items.map(it => `
    <article class="card">
      <div class="img" style="background-image:url('${it.img||''}')"></div>
      <div class="body">
        <div class="name">${it.name} <span class="badge">${it.type}</span></div>
        <div class="price">${THB(it.price)}</div>
        <div class="foot">
          <span></span>
          <button class="add" data-id="${it.id}">เพิ่ม</button>
        </div>
      </div>
    </article>
  `).join('');

  gridEl.querySelectorAll('.add').forEach(b=>{
    b.addEventListener('click',()=> addToCart(String(b.dataset.id)) );
  });
}
searchEl?.addEventListener('input', renderGrid);

// ------- Cart -------
function cartCount(){ return CART.reduce((s,x)=>s+x.qty,0) }
function updateCartBtn(){ cartBtn && (cartBtn.textContent = `ตะกร้า (${cartCount()})`); }

function addToCart(id){
  id = String(id);
  const f = CART.find(x=>x.id===id);
  if (f) f.qty += 1; else CART.push({id, qty:1});
  updateCartBtn();
  showToast('เพิ่มลงตะกร้าแล้ว');
}

function renderCart(){
  cartList.innerHTML = '';
  let total = 0;
  CART.forEach(row=>{
    const it = MENU.find(m=>String(m.id)==String(row.id));
    const price = it && Number(it.price) ? Number(it.price) : 0;
    const amt = price * row.qty; total += amt;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="row"><strong>${it? it.name : '(ไม่พบสินค้า #' + row.id + ')'}</strong><strong>${THB(amt)}</strong></div>
      <div class="row">
        <small class="muted">Type: ${it?.type ?? '-'}</small>
        <div class="qty">
          <button aria-label="dec">-</button>
          <span>${row.qty}</span>
          <button aria-label="inc">+</button>
          <button aria-label="remove" class="icon-btn">✕</button>
        </div>
      </div>
    `;
    const [dec, , inc, remove] = div.querySelectorAll('button');
    dec.addEventListener('click',()=>{ row.qty=Math.max(1,row.qty-1); renderCart(); });
    inc.addEventListener('click',()=>{ row.qty+=1; renderCart(); });
    remove.addEventListener('click',()=>{ CART = CART.filter(x=>x!==row); renderCart(); updateCartBtn(); });
    cartList.appendChild(div);
  });
  totalEl.textContent = THB(total);
}

// ------- Panel open/close -------
cartBtn?.addEventListener('click', () => {
  if (!panel) return;
  renderCart();
  panel.classList.remove('hidden');
});
panelClose?.addEventListener('click', () => panel?.classList.add('hidden'));
backHome?.addEventListener('click', () => panel?.classList.add('hidden'));

// ------- Place Order -------
form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!CART.length) { showToast('ตะกร้าว่างเปล่า'); return; }
  if (CART.some(x=>!x.id)){ showToast('พบรายการที่ไม่มีรหัสสินค้า โปรดลบแล้วเพิ่มใหม่'); return; }

  // ✅ ส่ง id เป็น "สตริง" เสมอ + qty เป็นตัวเลข
  const items = CART.map(x=>({ id: String(x.id), qty: Number(x.qty) }));

  // ฟิลด์เสริมให้ server ใช้ (optional)
  const tableNo = (deptEl?.value || nameEl?.value || 'T1') || '';
  const customerName = (nameEl?.value || '') + (phoneEl?.value ? ` (${phoneEl.value})` : '');
  const payload = {
    items,
    customerName,
    tableNo,
    meta:{
      phone:phoneEl?.value||'',
      dept:deptEl?.value||'',
      pickup:pickupEl?.value||''
    }
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  try{
    submitBtn && (submitBtn.disabled = true);

    const res = await fetch('/api/orders', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let data = {}; try{ data = JSON.parse(text); }catch{}
    if(!res.ok || !data.ok) throw new Error(data?.error || `order failed (${res.status})`);

    CART = []; updateCartBtn(); renderCart(); panel?.classList.add('hidden');

    const total = data?.order?.total ?? items.reduce((s,i)=>{
      const m = MENU.find(mm=>String(mm.id)==String(i.id));
      return s + (m? Number(m.price)*i.qty : 0);
    },0);

    showToast(`สั่งสำเร็จ! ยอดรวม: ${THB(total)}`);
  }catch(err){
    console.error('[submit error]', err);
    showToast('สั่งซื้อไม่สำเร็จ กรุณาลองใหม่');
  }finally{
    submitBtn && (submitBtn.disabled = false);
  }
});
