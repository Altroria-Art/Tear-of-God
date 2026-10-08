# Local Browser QA — Discover, Profile, Comments

ใช้ Chromium/CDP โดยตรงกับ production build + Cloudflare Pages Functions + D1 Local. ไม่ต้องใช้ CUA/node_repl และไม่เพิ่ม npm test script หรือ dependency. ตัวช่วยอยู่ใน `tests/local/helpers/chromium.mjs`; scenarios อยู่ใน `tests/local/discover-profile-comments-browser.mjs`.

## วิธีรัน (PowerShell จาก root ของ repo)

สร้าง state ใหม่แยกจาก `.wrangler/state` และใช้ state เดียวกันในทั้งสอง terminal:

```powershell
npm run build
npx wrangler d1 execute tear-of-god-db --local --persist-to .wrangler/browser-qa-2026-10-09/state --file schema.sql
npx wrangler pages dev dist --local --port 8799 --persist-to .wrangler/browser-qa-2026-10-09/state
```

อีก terminal:

```powershell
$env:BROWSER_QA_URL = 'http://127.0.0.1:8799'
$env:BROWSER_QA_STATE = '.wrangler/browser-qa-2026-10-09/state'
node tests/local/discover-profile-comments-browser.mjs
```

ค่าเริ่มต้น Chrome คือ `C:\Program Files\Google\Chrome\Application\chrome.exe`. หากติดตั้งที่อื่นให้ตั้ง `$env:CHROME_PATH`. CDP ใช้ port 9341; ต้องว่างก่อนเริ่ม. ใช้ Node รุ่นที่มี global `fetch` และ `WebSocket` (รอบตรวจนี้ Node 24.19.0).

Harness ยอมรับเฉพาะ loopback และ path `.wrangler/browser-qa-*/state`. เขียน marker ลง isolated D1 แล้วอ่านผ่าน API เพื่อยืนยันว่า Pages server ใช้ state นั้น **ก่อนสมัครบัญชีผ่าน HTTP**. จากนั้นสร้างสองบัญชี synthetic และ profiles/posts ทดสอบ. ไม่มีคำสั่ง `--remote`, reset ฐานข้อมูลเดิม หรือเรียก production.

สองบัญชีอยู่ใน Chrome browser contexts คนละชุด cookie/storage. ทำ login, submit, reply, delete และเปิด notifications ผ่าน UI จริง. ตรวจ persisted API data และสิทธิ์ลบเพิ่มเติม. เฉพาะ scenarios โหลดช้า/error/empty ใช้ CDP Fetch interception แบบครั้งเดียว; request อื่นและทุก mutation วิ่งไป backend จริง.

## สิ่งที่ตรวจ

| ส่วน | Coverage |
|---|---|
| Discover | Popular/New/In conversation; loading; late response เมื่อสลับ tab; error + retry ทั้งสาม tab; empty list; สี่ activity windows; เปลี่ยนหน้าเมื่อ request ค้าง; ชื่อ item ที่อ้างด้วย ID; การ์ด 1:1 และ grid 1/2/4 columns ที่ 320/390/768/1440px |
| Profile | 0/1/3/20/49/50/51/100 โพสต์; หน้า 2 และจำนวนไม่ซ้ำ; ปักหมุดโพสต์เก่าที่อยู่นอก 50 แรก; Pinned tab; เปลี่ยนผู้ใช้ระหว่างโหลดหน้า 2; grid 1/2/3/4 columns ที่ 320/390/768/1024/1440px |
| Comments | สองบัญชีสร้าง/ตอบ/ลบ; live update ในอีกบัญชี; UI + server counters 0→1→2→1→0; draft ค้างไม่หาย; notification badge ตอนเมนูปิด; ผู้รับแจ้งเตือนถูกต้อง; ลบ notification แล้ว refresh; ผู้ใช้ทั่วไปลบของคนอื่นไม่ได้; ลบ parent แล้วรักษา reply ของอีกคน; ข้อมูลและ notification หลัง refresh |

ตรวจ `Runtime.exceptionThrown`, viewport overflow และขนาด grid จาก DOM/layout ของ Chrome จริง พร้อม capture screenshots เพื่อดูซ้ำ. ไม่เรียก source inspection หรือ component harness ว่า Browser QA.

## ผลและขอบเขต

ผลล่าสุดอยู่ใน `.wrangler/browser-qa-2026-10-09/result.json` และ screenshots ในโฟลเดอร์เดียวกัน (ทั้งหมด gitignored). เมื่อ fail จะเขียน `failure.json`, `failure-dom.txt`, `failure.png`. ผล pass ไม่ได้หมายความว่า Safari/Firefox, มือถือจริง, migrations จากฐานข้อมูลเก่า หรือทุกหน้าของแอปผ่าน; รอบนี้ใช้ Chrome headless และ fresh local schema.

ดู [รายงานผลวันที่ 9 ตุลาคม 2026](browser-qa-2026-10-09.md).
