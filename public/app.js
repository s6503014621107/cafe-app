// ===== state =====
let MENU = [];
let FILTER = { type: 'all', q: '' };
let CART = []; // array of menu.id

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ===== helpers =====
function money(n){ return '฿' + Number(n).toFixed(0); }
function showToast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), 2300);
}
function updateCartBtn(){
  $('#cartBtn').textContent = `ตะกร้า (${CART.length})`;
}

// ===== render =====
function renderTabs(){
  const kinds = [
    {key:'all', label:'รายการทั้งหมด'},
    {key:'coffee', label:'กาแฟ'},
    {key:'juice', label:'น้ำผลไม้'},
    {key:'tea', label:'ชา/ชาเขียว'},
    {key:'soda', label:'โซดาและน้ำอัดลม'},
    {key:'smoothie', label:'ปั่น'},
  ];
  const tabs = kinds.map(k=>{
    const div = document.createElement('div');
    div.className = 'tab' + (FILTER.type===k.key ? ' active':'');
    div.textContent = k.label;
    div.onclick = ()=>{ FILTER.type = k.key; renderGrid(); renderTabs(); };
    return div;
  });
  const wrap = $('#tabs');
  wrap.innerHTML = '';
  tabs.forEach(t=> wrap.appendChild(t));
}

function renderGrid(){
  const wrap = $('#grid');
  let list = MENU.slice();

  if (FILTER.type!=='all'){
    list = list.filter(m=> m.type===FILTER.type);
  }
  if (FILTER.q){
    const q = FILTER.q.toLowerCase();
    list = list.filter(m=> (m.name||'').toLowerCase().includes(q));
  }

  wrap.innerHTML = '';
  list.forEach(m=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="info">
        <div class="name">${m.name}</div>
        <div class="foot">
          <div class="price">${money(m.price)}</div>
          <button class="btn">เพิ่ม</button>
        </div>
      </div>`;
    card.querySelector('.btn').onclick = ()=>{
      CART.push(m.id);
      updateCartBtn();
      showToast(`เพิ่ม "${m.name}" ลงตะกร้า`);
    };
    wrap.appendChild(card);
  });
}

// ===== events =====
$('#search').addEventListener('input', (e)=>{
  FILTER.q = e.target.value.trim();
  renderGrid();
});

$('#cartBtn').addEventListener('click', async ()=>{
  if (CART.length===0) { showToast('ตะกร้าว่างเปล่า'); return; }

  // ส่งทันที (แบบเดิม)
  const items = CART.map(id => id); // string array
  try{
    const res = await fetch('/api/orders', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ table:'T1', items })
    });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || 'order failed');
    showToast(`สั่งสำเร็จ! รหัสออเดอร์: ${out.code} ยอดรวม: ฿${out.total}`);
    CART = [];
    updateCartBtn();
  }catch(err){
    console.error(err);
    showToast('สั่งไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
});

// ===== bootstrap =====
(async function init(){
  try{
    const res = await fetch('/api/menu');
    MENU = await res.json(); // [{id,name,type,price}, ...]
  }catch(e){
    console.warn('fallback: ใช้เมนูจากหน้าเว็บเพราะโหลด API ไม่สำเร็จ');
    MENU = [
      { id:'m01', name:'มัทฉะ (เย็น)',         type:'tea',      price:69 },
      { id:'m02', name:'ชาดอกเก๊กฮวย (เย็น)',  type:'tea',      price:49 },
      { id:'m03', name:'น้ำส้ม (เย็น)',        type:'juice',    price:45 },
      { id:'m04', name:'อเมริกาโน่ (เย็น)',    type:'coffee',   price:55 },
      { id:'m05', name:'ลาเต้ (เย็น)',         type:'coffee',   price:65 },
      { id:'m06', name:'โค้กโค้กซ่า (เย็น)',   type:'soda',     price:55 },
      { id:'m07', name:'เลมอนโซดา (เย็น)',     type:'soda',     price:49 },
      { id:'m08', name:'สตรอว์เบอร์รีปั่น',    type:'smoothie', price:59 },
    ];
  }

  renderTabs();
  renderGrid();
  updateCartBtn();
})();
