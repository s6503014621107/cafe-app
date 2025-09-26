const tabsEl = document.getElementById('tabs');
const gridEl = document.getElementById('grid');
const searchEl = document.getElementById('search');
const cartBtn = document.getElementById('cartBtn');
const toast = document.getElementById('toast');

let categories = [];
let currentCat = 'รายการทั้งหมด';
let menu = [];
let cart = []; // {id, qty}

function showToast(t){
  toast.textContent = t; toast.style.display='block';
  setTimeout(()=>toast.style.display='none', 1400);
}

async function loadCategories(){
  const r = await fetch('/api/categories'); categories = await r.json();
  tabsEl.innerHTML = '';
  categories.forEach(cat=>{
    const b = document.createElement('button');
    b.className = 'tab' + (cat===currentCat?' active':'');
    b.textContent = cat;
    b.onclick = ()=>{ currentCat=cat; renderTabs(); loadMenu(); };
    tabsEl.appendChild(b);
  });
}
function renderTabs(){
  tabsEl.querySelectorAll('.tab').forEach(el=>{
    el.classList.toggle('active', el.textContent===currentCat);
  });
}
async function loadMenu(){
  const q = searchEl.value.trim();
  const r = await fetch('/api/menu?cat='+encodeURIComponent(currentCat)+'&q='+encodeURIComponent(q));
  menu = await r.json();
  renderMenu();
}
function renderMenu(){
  gridEl.innerHTML='';
  menu.forEach(m=>{
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `
      <img src="${m.img}" alt="${m.name}">
      <div class="info">
        <div class="name">${m.name} ${m.type==='ice'?'(เย็น)':''}</div>
        <div class="foot">
          <div class="price">฿${m.price}</div>
          <button class="btn">เพิ่ม</button>
        </div>
      </div>`;
    card.querySelector('.btn').onclick = ()=>{
      const found = cart.find(c=>c.id===m.id);
      if(found) found.qty += 1; else cart.push({id:m.id, qty:1});
      updateCartBtn();
      showToast('เพิ่ม '+m.name+' แล้ว');
    };
    gridEl.appendChild(card);
  });
}
function updateCartBtn(){
  const count = cart.reduce((a,c)=>a+c.qty,0);
  cartBtn.textContent = 'ตะกร้า ('+count+')';
}
cartBtn.onclick = async ()=>{
  if(cart.length===0){ alert('ตะกร้าว่าง'); return; }
  const table = prompt('ใส่หมายเลขโต๊ะ (เช่น T12)') || 'NA';
  // ส่งรายการแบบ id+qty ไปให้เซิร์ฟเวอร์คิดราคา
  const items = cart.map(c=>({ id:c.id, qty:c.qty }));
  const r = await fetch('/api/orders', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ table, items })
  });
  const data = await r.json();
  if(!data.ok){ alert('สั่งไม่สำเร็จ: '+(data.error||'')); return; }
  alert(`สั่งสำเร็จ! รหัสออเดอร์: ${data.code}\nยอดรวม: ฿${data.total}`);
  cart = []; updateCartBtn();
};
searchEl.addEventListener('input', ()=>loadMenu());

// init
loadCategories().then(loadMenu);
