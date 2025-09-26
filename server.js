require('dotenv').config();
const express = require('express');
const path = require('path');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { nanoid } = require('nanoid');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** ====== เมนูตัวอย่าง (แก้ไขเพิ่มได้) ====== **/
const CATS = ['รายการทั้งหมด','น้ำผลไม้','กาแฟ','ชาและโกโก้','ซิกเนเจอร์','โซดาและน้ำอัดลม','ปั่น'];
const MENU = [
  { id:1,  name:'มัทฉะ',         cat:'ซิกเนเจอร์', type:'ice',  price:69, img:'/img/matcha.jpg' },
  { id:2,  name:'ชาดอกเก็กฮวย',  cat:'ชาและโกโก้', type:'ice',  price:49, img:'/img/chrys.jpg' },
  { id:3,  name:'น้ำส้ม',        cat:'น้ำผลไม้',    type:'ice',  price:45, img:'/img/orange.jpg'},
  { id:4,  name:'อเมริกาโน่',     cat:'กาแฟ',       type:'ice',  price:55, img:'/img/americano.jpg'},
  { id:5,  name:'ลาเต้',         cat:'กาแฟ',       type:'ice',  price:65, img:'/img/latte.jpg'},
  { id:6,  name:'โกโก้เข้ม',      cat:'ชาและโกโก้', type:'ice',  price:55, img:'/img/cocoa.jpg'},
  { id:7,  name:'เลมอนโซดา',     cat:'โซดาและน้ำอัดลม', type:'ice', price:49, img:'/img/lemon-soda.jpg'},
  { id:8,  name:'สตรอว์เบอร์รี่ปั่น', cat:'ปั่น', type:'blend', price:59, img:'/img/straw-blend.jpg'},
];

/** ====== Influx (optional) ====== **/
let writeApi = null;
try {
  const influx = new InfluxDB({ url: process.env.INFLUX_URL, token: process.env.INFLUX_TOKEN });
  writeApi = influx.getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET);
  console.log('[InfluxDB] ready');
} catch (e) {
  console.log('[InfluxDB] skip (config not ready)');
}

/** ====== API ====== **/
// หมวดหมู่
app.get('/api/categories', (_,res)=> res.json(CATS));

// เมนู + ตัวกรอง
app.get('/api/menu', (req,res)=>{
  const q = (req.query.q || '').toLowerCase().trim();
  const cat = req.query.cat || 'รายการทั้งหมด';
  let data = MENU.slice();
  if (cat && cat !== 'รายการทั้งหมด') data = data.filter(m => m.cat === cat);
  if (q) data = data.filter(m => m.name.toLowerCase().includes(q));
  res.json(data);
});

// สร้างออเดอร์
app.post('/api/orders', async (req, res) => {
  const { table = 'NA', items = [] } = req.body || {};
  if (!items.length) return res.status(400).json({ error: 'ต้องมีสินค้าในตะกร้า' });

  // คิดเงินจากไอเท็มที่ client ส่งมา (ปกติควรคำนวณฝั่งเซิร์ฟเวอร์จาก MENU)
  let total = 0;
  const points = [];
  const code = nanoid(6).toUpperCase();

  for (const it of items) {
    const found = MENU.find(m => m.id === it.id);
    if (!found) return res.status(400).json({ error: 'พบสินค้าไม่ถูกต้อง' });
    const qty = it.qty || 1;
    total += found.price * qty;

    if (writeApi) {
      const p = new Point('orders')
        .tag('orderCode', code)
        .tag('table', table)
        .tag('status', 'received')
        .tag('item', found.name)
        .tag('type', found.type)
        .intField('qty', qty)
        .floatField('price', found.price)
        .floatField('amount', found.price * qty);
      points.push(p);
    }
  }

  if (writeApi && points.length) {
    try { writeApi.writePoints(points); await writeApi.flush(); } catch(e){ console.error('[Influx write]', e.message); }
  }
  res.json({ ok:true, code, total });
});

app.listen(process.env.PORT || 8080, () =>
  console.log(`Server running: http://localhost:${process.env.PORT || 8080}`)
);
