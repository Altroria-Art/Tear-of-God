import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportsDir = path.resolve(__dirname, '../tests/reports');
const ORDER = ['smoke', 'load', 'stress', 'spike', 'soak'];

const TREND_IDX = { avg: 0, max: 1, med: 2, min: 3, 'p(90)': 4, 'p(95)': 5, 'p(99)': 6 };

function parseReport(file) {
  const raw = readFileSync(path.join(reportsDir, file), 'utf8');
  const m = raw.match(/<script id="data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`${file}: no <script id="data"> found`);

  const buf = Buffer.from(m[1].trim(), 'base64');
  const text = gunzipSync(buf).toString('utf8');

  const declared = [];
  const declaredTypes = {};
  let cumVals = null;
  let startTs = null;
  let stopTs = null;
  let params = null;
  const crossedThresholds = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const ev = JSON.parse(line);
    switch (ev.event) {
      case 'start':
        startTs = ev.data[0][0];
        break;
      case 'stop':
        stopTs = ev.data[0][0];
        break;
      case 'param':
        params = ev.data;
        break;
      case 'metric':
        for (const [name, def] of Object.entries(ev.data)) {
          if (!(name in declaredTypes)) {
            declaredTypes[name] = def.type;
            declared.push(name);
          }
        }
        break;
      case 'cumulative':
        cumVals = ev.data;
        break;
      default:
    }
  }

  const timeIdx = cumVals
    .findIndex((v) => v.length === 1 && typeof v[0] === 'number' && v[0] > 1e11);
  const names = declared.filter((n) => n !== 'time');
  const byName = {};
  cumVals.forEach((vals, idx) => {
    const name = idx < timeIdx ? names[idx] : idx === timeIdx ? 'time' : names[idx - 1];
    byName[name] = { name, vals };
  });

  const durationSec = startTs && stopTs ? (stopTs - startTs) / 1000 : null;

  const overall = (() => {
    const get = (agg) => {
      const mtr = byName[agg.metric];
      if (!mtr) return 0;
      const v = mtr.vals[agg.index];
      return typeof v === 'number' ? v : 0;
    };
    return {
      vusMax: get({ metric: 'vus_max', index: 0 }),
      iterations: get({ metric: 'iterations', index: 0 }),
      iterationDurationAvg: get({ metric: 'iteration_duration', index: 0 }),
      reqs: get({ metric: 'http_reqs', index: 0 }),
      reqRate: get({ metric: 'http_reqs', index: 1 }),
      durationAvg: get({ metric: 'http_req_duration', index: 0 }),
      durationMed: get({ metric: 'http_req_duration', index: 2 }),
      durationP90: get({ metric: 'http_req_duration', index: 4 }),
      durationP95: get({ metric: 'http_req_duration', index: 5 }),
      durationP99: get({ metric: 'http_req_duration', index: 6 }),
      errorRate: byName['http_req_failed'] ? byName['http_req_failed'].vals[0] * 100 : 0,
      checksPass: byName['checks'] ? byName['checks'].vals[0] * 100 : 100,
    };
  })();

  if (params?.thresholds) {
    for (const [metricName, thresholds] of Object.entries(params.thresholds)) {
      for (const t of thresholds) {
        const mm = t.match(/^([a-zA-Z0-9()%.]+)\s*([<>])\s*([\d.]+)$/);
        if (!mm) continue;
        const stat = mm[1];
        const op = mm[2];
        const limit = parseFloat(mm[3]);
        const mtr = byName[metricName];
        if (!mtr) continue;
        const index = TREND_IDX[stat] ?? (mtr.vals.length === 1 ? 0 : stat === 'rate' ? 1 : 0);
        const actual = mtr.vals[index];
        const passed = op === '<' ? actual < limit : actual > limit;
        crossedThresholds.push({ metric: metricName, threshold: t, ok: passed });
      }
    }
  }

  const groups = [];
  for (const mtr of Object.values(byName)) {
    const gm = mtr.name.match(/^(http_req_duration|http_req_failed|http_reqs)\{group:::(.+)\}$/);
    if (!gm) continue;
    const base = gm[1];
    const groupName = gm[2].replace(/^::+/, '').replace(/\|/g, ' / ');
    let entry = groups.find((g) => g.name === groupName);
    if (!entry) {
      entry = { name: groupName };
      groups.push(entry);
    }
    if (base === 'http_req_duration') {
      entry.duration = {
        avg: mtr.vals[0], max: mtr.vals[1], med: mtr.vals[2],
        p90: mtr.vals[4], p95: mtr.vals[5], p99: mtr.vals[6],
      };
    } else if (base === 'http_req_failed') {
      entry.errorRate = mtr.vals[0] * 100;
    } else if (base === 'http_reqs') {
      entry.count = mtr.vals[0];
    }
  }

  groups.sort((a, b) => (b.duration?.p95 ?? -1) - (a.duration?.p95 ?? -1));

  return { overall, durationSec, crossedThresholds, groups };
}

function fmtMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function p95Class(ms) {
  if (ms == null || !Number.isFinite(ms)) return 'neutral';
  if (ms < 800) return 'good';
  if (ms <= 2000) return 'warn';
  return 'bad';
}

function errClass(rate) {
  if (rate == null) return 'neutral';
  if (rate < 1) return 'good';
  if (rate < 10) return 'warn';
  return 'bad';
}

const LABELS = {
  smoke: { full: 'Smoke Test', desc: 'ระบบทำงานปกติ · 1 VU · 30s', color: '#3f9e4d' },
  load: { full: 'Load Test', desc: 'การใช้งานปกติ · ramp 0→50 VUs · ~4นาที', color: '#2f7dcc' },
  stress: { full: 'Stress Test', desc: 'หาจุดพัง · ramp 0→200 VUs · ~10นาที', color: '#d9822b' },
  spike: { full: 'Spike Test', desc: 'traffic กระชาก · 0→300 VUs ทันใด · ~3.5นาที', color: '#d64545' },
  soak: { full: 'Soak Test', desc: 'โหลดต่อเนื่อง · 50 VUs · 10 นาที', color: '#7a5fbf' },
};

const results = {};
for (const name of ORDER) {
  results[name] = parseReport(`${name}.html`);
}

const now = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

let html = '';
html += `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Load Test Summary — Tear of God</title>
<style>
  :root { --bg:#0f1115; --panel:#171a21; --panel2:#1d212b; --border:#2a2f3a; --text:#e6e9ef; --muted:#9aa3b2; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:"Segoe UI",system-ui,-apple-system,sans-serif; line-height:1.5; padding:32px 20px 60px; }
  .wrap { max-width:1080px; margin:0 auto; }
  h1 { font-size:24px; margin:0 0 4px; }
  .sub { color:var(--muted); font-size:13px; margin-bottom:28px; }
  .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:600; color:#fff; }
  .legend { display:flex; gap:16px; flex-wrap:wrap; color:var(--muted); font-size:12px; margin-bottom:22px; }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:5px; vertical-align:middle; }
  table { border-collapse:collapse; width:100%; font-size:13px; margin:0; }
  th, td { padding:7px 10px; text-align:right; white-space:nowrap; }
  th:first-child, td:first-child { text-align:left; }
  thead th { color:var(--muted); font-weight:600; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--panel); }
  td, th { border-bottom:1px solid var(--border); }
  tbody tr:hover { background:var(--panel2); }
  .num { font-variant-numeric:tabular-nums; }
  .good { color:#52c41a; font-weight:600; }
  .warn { color:#e8a33d; font-weight:600; }
  .bad { color:#ff5d5d; font-weight:600; }
  .overview { overflow-x:auto; border:1px solid var(--border); border-radius:10px; background:var(--panel); }
  header { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .test { margin-top:36px; }
  .test h2 { font-size:18px; margin:0 0 2px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .test .desc { color:var(--muted); font-size:12px; margin-bottom:14px; }
  .group-table { overflow-x:auto; border:1px solid var(--border); border-radius:10px; background:var(--panel); }
  .thBadge { padding:2px 8px; border-radius:6px; font-size:11px; font-weight:700; }
  .thBadge.pass { background:rgba(82,196,26,.15); color:#52c41a; }
  .thBadge.fail { background:rgba(255,93,93,.15); color:#ff5d5d; }
  .footer { margin-top:40px; color:var(--muted); font-size:11px; }
  .muted { color:var(--muted); }
  .empty { color:var(--muted); font-style:italic; }
  @media (max-width:760px){ th,td { padding:6px 7px; font-size:12px; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Load Test Summary — Tear of God</h1>
      <div class="sub">ผลสรุปจาก k6 · 5 test types · สร้างเมื่อ ${esc(now)}</div>
    </div>
  </header>

  <div class="legend">
    <span><span class="dot" style="background:#52c41a"></span>p95 &lt; 800ms (ปกติ)</span>
    <span><span class="dot" style="background:#e8a33d"></span>p95 800–2000ms (เริ่มเสื่อม)</span>
    <span><span class="dot" style="background:#ff5d5d"></span>p95 &gt; 2000ms (ช้าหรือพัง)</span>
    <span><span class="dot" style="background:#7a5fbf"></span>error rate การันตีสถานะ</span>
  </div>

  <div class="overview">
    <table>
      <thead>
        <tr>
          <th>Test</th><th>VUs สูงสุด</th><th>ระยะเวลา</th><th>จำนวน Request</th><th>req/s</th>
          <th>Error %</th><th>Avg</th><th>p95</th><th>p99</th><th>Checks ผ่าน</th><th>Thresholds</th>
        </tr>
      </thead>
      <tbody>`;

for (const name of ORDER) {
  const r = results[name];
  const L = LABELS[name];
  const o = r.overall;
  const failedTh = r.crossedThresholds.filter((t) => !t.ok).length;
  const dur = r.durationSec ? `${(r.durationSec / 60).toFixed(1)} นาที` : '—';
  html += `
        <tr>
          <td><span class="badge" style="background:${L.color}"></span> ${esc(L.full)}</td>
          <td class="num">${o.vusMax}</td>
          <td class="num">${dur}</td>
          <td class="num">${o.reqs.toLocaleString()}</td>
          <td class="num">${o.reqRate.toFixed(1)}</td>
          <td class="num ${errClass(o.errorRate)}">${o.errorRate.toFixed(2)}%</td>
          <td class="num">${fmtMs(o.durationAvg)}</td>
          <td class="num ${p95Class(o.durationP95)}">${fmtMs(o.durationP95)}</td>
          <td class="num ${p95Class(o.durationP99)}">${fmtMs(o.durationP99)}</td>
          <td class="num">${o.checksPass.toFixed(1)}%</td>
          <td>${failedTh === 0 ? '<span class="thBadge pass">ผ่านทั้งหมด</span>' : `<span class="thBadge fail">ล้ม ${failedTh} รายการ</span>`}</td>
        </tr>`;
}

html += `
      </tbody>
    </table>
  </div>`;

for (const name of ORDER) {
  const r = results[name];
  const L = LABELS[name];
  const o = r.overall;
  html += `
  <section class="test">
    <h2><span class="badge" style="background:${L.color}">${esc(L.full)}</span> <span class="muted" style="font-weight:400;font-size:13px">${esc(L.desc)}</span></h2>
    <div class="desc">รวม ${o.reqs.toLocaleString()} requests · ${o.reqRate.toFixed(1)} req/s · error ${o.errorRate.toFixed(2)}% · p95 ${fmtMs(o.durationP95)} · p99 ${fmtMs(o.durationP99)} · iteration เฉลี่ย ${fmtMs(o.iterationDurationAvg)}</div>`;

  const bad = r.crossedThresholds.filter((t) => !t.ok);
  if (bad.length > 0) {
    html += `<div class="desc" style="color:#ff5d5d">⚑ Threshold เกินเป้า: ${bad.map((t) => `${esc(t.metric)} ${esc(t.threshold)}`).join(' · ')}</div>`;
  }

  if (r.groups.length === 0) {
    html += `<div class="empty">ไม่มีข้อมูลจำแนกตาม endpoint group</div>`;
  } else {
    html += `
    <div class="group-table">
      <table>
        <thead>
          <tr><th>Endpoint (group)</th><th>Requests</th><th>Error %</th><th>Avg</th><th>p50</th><th>p90</th><th>p95</th><th>p99</th><th>Max</th></tr>
        </thead>
        <tbody>`;
    for (const g of r.groups) {
      const main = g.duration;
      html += `
          <tr>
            <td>${esc(g.name)}</td>
            <td class="num">${(g.count ?? 0).toLocaleString()}</td>
            <td class="num ${errClass(g.errorRate)}">${(g.errorRate ?? 0).toFixed(2)}%</td>
            <td class="num">${main ? fmtMs(main.avg) : '—'}</td>
            <td class="num">${main ? fmtMs(main.med) : '—'}</td>
            <td class="num ${main ? p95Class(main.p90) : 'neutral'}">${main ? fmtMs(main.p90) : '—'}</td>
            <td class="num ${main ? p95Class(main.p95) : 'neutral'}">${main ? fmtMs(main.p95) : '—'}</td>
            <td class="num ${main ? p95Class(main.p99) : 'neutral'}">${main ? fmtMs(main.p99) : '—'}</td>
            <td class="num">${main ? fmtMs(main.max) : '—'}</td>
          </tr>`;
    }
    html += `
        </tbody>
      </table>
    </div>`;
  }
  html += `</section>`;
}

html += `
  <div class="footer">
    สร้างจาก Script: scripts/generate-k6-summary.mjs · แหล่งข้อมูล: tests/reports/{smoke,load,stress,spike,soak}.html
    (k6 web dashboard export) · ทดสอบผ่าน local wrangler pages dev (http://localhost:8788) — ตัวเลข production บน Cloudflare edge อาจดีกว่า
  </div>
</div>
</body>
</html>`;

writeFileSync(path.join(reportsDir, 'summary.html'), html, 'utf8');
console.log(`summary.html written (${(html.length / 1024).toFixed(1)} KB) to ${path.join(reportsDir, 'summary.html')}`);

for (const name of ORDER) {
  const r = results[name];
  const o = r.overall;
  console.log(`\n[${LABELS[name].full}] VUs=${o.vusMax} reqs=${o.reqs} rate=${o.reqRate.toFixed(1)}/s err=${o.errorRate.toFixed(2)}% avg=${fmtMs(o.durationAvg)} p95=${fmtMs(o.durationP95)} p99=${fmtMs(o.durationP99)} checks=${o.checksPass.toFixed(1)}% thrFail=${r.crossedThresholds.filter(t=>!t.ok).length}`);
  for (const g of r.groups) {
    const m = g.duration;
    console.log(`   ${g.name}  reqs=${g.count} err=${(g.errorRate ?? 0).toFixed(2)}% p50=${m ? fmtMs(m.med) : '-'} p90=${m ? fmtMs(m.p90) : '-'} p95=${m ? fmtMs(m.p95) : '-'} p99=${m ? fmtMs(m.p99) : '-'}`);
  }
}