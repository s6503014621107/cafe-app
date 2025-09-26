// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

// ===== InfluxDB (ทางเลือก) =====
let writeApi = null;
try {
  const haveInflux =
    process.env.INFLUX_URL &&
    process.env.INFLUX_TOKEN &&
    process.env.INFLUX_ORG &&
    process.env.INFLUX_BUCKET;

  if (haveInflux) {
    const { InfluxDB, Point } = require('@influxdata/influxdb-client');
    const influx = new InfluxDB({
      url: process.env.INFLUX_URL,
      token: process.env.INFLUX_TOKEN,
    });
    writeApi = influx.getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET, 'ns');
    global.InfluxPoint = Point;
    console.log('[InfluxDB] ready:', process.env.INFLUX_URL);
  } else {
    console.log('[InfluxDB] skip (config not ready)');
  }
} catch (e) {
  console.warn('[InfluxDB] disabled:', e.message);
}

// ===== เมนูตัวอย่าง =====
const MENU = [
  { id: 'm01', name: 'มัทฉะ (เย็น)', type: 'tea',     price: 69 },
  { id: 'm02', name: 'ชาดอกเก๊กฮวย (เย็น)', type: 'tea', price: 49 },
  { id: 'm03', name: 'น้ำส้ม (เย็น)',       type: 'juice', price: 45 },
  { id: 'm04', name: 'อเมริกาโน่ (เย็น)',  type: 'coffee', price: 55 },
  { id: 'm05', name: 'ลาเต้ (เย็น)',        type: 'coffee', price: 65 },
  { id: 'm06', name: 'โค้กโค้กซ่า (เย็น)', type: 'soda',   price: 55 },
  { id: 'm07', name: 'เลมอนโซดา (เย็น)',   type: 'soda',   price: 49 },
  { id: 'm08', name: 'สตรอว์เบอร์รีปั่น',  type: 'smoothie', price: 59 },
];

// ===== แอปหลัก =====
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== ที่เก็บออเดอร์ในหน่วยความจำ =====
let ORDERS = [];
let NEXT_ID = 1;

// ===== Helper: normalize items =====
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    if (typeof it === 'string') return { id: it, qty: 1 };
    return { id: it.id, qty: Number(it.qty || 1) };
  });
}

// ===== API: เมนู (ลูกค้าจะเรียกใช้งานตรงนี้) =====
app.get('/api/menu', (req, res) => {
  res.json(MENU);
});

// ===== API: ลูกค้าส่งออเดอร์ =====
app.post('/api/orders', async (req, res) => {
  try {
    const table = String(req.body.table || 'NA');
    const rawItems = normalizeItems(req.body.items || []);
    if (rawItems.length === 0) {
      return res.status(400).json({ ok: false, error: 'No items' });
    }

    // คิดเงิน + ตรวจเมนู
    let total = 0;
    const detail = [];
    for (const it of rawItems) {
      const found = MENU.find((m) => m.id === it.id);
      if (!found) return res.status(400).json({ ok: false, error: `Invalid item: ${it.id}` });
      const qty = it.qty > 0 ? it.qty : 1;
      total += found.price * qty;
      detail.push({ id: found.id, name: found.name, type: found.type, price: found.price, qty });
    }

    // สร้างรหัสออเดอร์
    const code = nanoid().toUpperCase();

    // บันทึกลงหน่วยความจำเพื่อให้ KDS เห็น
    const order = {
      id: NEXT_ID++,
      code,
      table,
      items: detail.map((d) => `${d.name} x${d.qty}`),
      status: 'NEW',
      total,
      createdAt: new Date().toISOString(),
    };
    ORDERS.unshift(order);

    // เขียน InfluxDB (ถ้าตั้งค่าไว้)
    if (writeApi && global.InfluxPoint) {
      const points = [];
      for (const d of detail) {
        const p = new global.InfluxPoint('orders')
          .tag('orderCode', code)
          .tag('table', table)
          .tag('status', 'received')
          .tag('item', d.name)
          .tag('type', d.type)
          .intField('qty', d.qty)
          .floatField('price', d.price)
          .floatField('amount', d.price * d.qty);
        points.push(p);
      }
      if (points.length) {
        try {
          writeApi.writePoints(points);
          await writeApi.flush();
        } catch (e) {
          console.error('[Influx write]', e.message);
        }
      }
    }

    res.json({ ok: true, code, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// ===== API: KDS ดึงรายการออเดอร์ =====
app.get('/api/orders', (req, res) => {
  res.json(ORDERS);
});

// ===== API: KDS เปลี่ยนสถานะ =====
app.patch('/api/orders/:id/status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = String(req.body.status || '').toUpperCase();
  const allow = new Set(['NEW', 'BREWING', 'READY', 'SERVED']);
  if (!allow.has(status)) return res.status(400).json({ ok: false, error: 'Invalid status' });
  const o = ORDERS.find((x) => x.id === id);
  if (!o) return res.status(404).json({ ok: false, error: 'Order not found' });
  o.status = status;
  res.json({ ok: true, order: o });
});

// ===== Health check =====
app.get('/health', (_req, res) => res.json({ ok: true }));

// ===== Start =====
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
