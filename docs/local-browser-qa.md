# Local Browser QA — Discover, Profile, Comments

การตรวจ UX/UI ทุกหน้ารอบ 10 ตุลาคม 2026 และวิธีรัน matrix, keyboard/Modal/table/OTP และ contrast: [site-ux-audit-2026-10-10.md](site-ux-audit-2026-10-10.md). ชุดใหม่คือ `site-ux-audit-browser.mjs`, `site-ux-interactions-browser.mjs`, `site-ux-contrast-browser.mjs` และใช้ isolated fixture จาก `helpers/site-audit-fixture.mjs`.

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
| Discover | Popular/New/In conversation; loading; late response เมื่อสลับ tab; error + retry ทั้งสาม tab; empty list; สี่ activity windows; เปลี่ยนหน้าเมื่อ request ค้าง; ชื่อ item ที่อ้างด้วย ID; carousel เต็มความกว้างที่ 320/390/768px และกางข้างแผงย่อที่ 1024/1440px; discover-full-boards-browser ตรวจความสูง 600px ปุ่มขยายเฉพาะบอร์ดยาว แสดงครบถึง 500 รายการ ย่อกลับโดยไม่เรียก API และสไลด์ดูทั้งหมด รวมลูกศร/คีย์บอร์ด/ปัดมือถือ/กดเร็ว/ค้นหา/บันทึก/แชร์/คอมเมนต์และไทย–อังกฤษสองธีม |
| Profile | 0/1/3/20/49/50/51/100 โพสต์; หน้า 2 และจำนวนไม่ซ้ำ; ปักหมุดโพสต์เก่าที่อยู่นอก 50 แรก; Pinned tab; เปลี่ยนผู้ใช้ระหว่างโหลดหน้า 2; grid 1/2/3/4 columns ที่ 320/390/768/1024/1440px |
| Comments | สองบัญชีสร้าง/ตอบ/ลบ; live update ในอีกบัญชี; UI + server counters 0→1→2→1→0; draft ค้างไม่หาย; notification badge ตอนเมนูปิด; ผู้รับแจ้งเตือนถูกต้อง; ลบ notification แล้ว refresh; ผู้ใช้ทั่วไปลบของคนอื่นไม่ได้; ลบ parent แล้วรักษา reply ของอีกคน; ข้อมูลและ notification หลัง refresh |

ตรวจ `Runtime.exceptionThrown`, viewport overflow และขนาด grid จาก DOM/layout ของ Chrome จริง พร้อม capture screenshots เพื่อดูซ้ำ. ไม่เรียก source inspection หรือ component harness ว่า Browser QA.

## ผลและขอบเขต

ผลล่าสุดอยู่ใน `.wrangler/browser-qa-2026-10-09/result.json` และ screenshots ในโฟลเดอร์เดียวกัน (ทั้งหมด gitignored). เมื่อ fail จะเขียน `failure.json`, `failure-dom.txt`, `failure.png`. ผล pass ไม่ได้หมายความว่า Safari/Firefox, มือถือจริง, migrations จากฐานข้อมูลเก่า หรือทุกหน้าของแอปผ่าน; รอบนี้ใช้ Chrome headless และ fresh local schema.

ดู [รายงานผลวันที่ 9 ตุลาคม 2026](browser-qa-2026-10-09.md).

## Trending refresh

`tests/local/trending-refresh-browser.mjs` ตรวจ UI จริงกับ Local D1 แยก: การ์ดสูงเกินสองเท่าของ viewport, ลบการ์ดที่อ่านแล้วเมื่อ refresh, กดรัว 20 ครั้งแล้วมี request ทีละหนึ่งพร้อมคิวต่อหนึ่งครั้ง, F5 ยังจำโพสต์ที่อ่าน, error แล้ว retry ทันที, สลับแท็บระหว่างโหลด และอ่านครบแล้วไม่วนโพสต์เก่ากลับมา ตรวจ runtime errors และจำนวน request ที่ทำงานพร้อมกันด้วย

สร้าง **state ใหม่ที่ยังไม่มี rankings** สำหรับแต่ละรอบ เพราะ harness เพิ่ม 60 โพสต์ synthetic แล้วตรวจกรณีอ่านครบทั้งหมด ใช้ขั้นตอน build/schema/server ด้านบนโดยเปลี่ยน persist path เป็น `.wrangler/browser-qa-trending-2026-10-09-r3/state` และ port เป็น `8802` แล้วรัน:

```powershell
$env:BROWSER_QA_URL = 'http://127.0.0.1:8802'
$env:BROWSER_QA_STATE = '.wrangler/browser-qa-trending-2026-10-09-r3/state'
node tests/local/trending-refresh-browser.mjs
```

ผลและภาพอยู่ใน parent ของ state ซึ่ง gitignored. การแก้นี้เอา cooldown ของปุ่ม 1.5 วินาทีออกและรวมคลิกระหว่างโหลดเป็นหนึ่งคิว; ประวัติโพสต์ที่อ่านยังใช้ cooldown เดิม 6 ชั่วโมง. การตรวจ Local ไม่ใช่การยืนยันว่า Cloudflare Production มีโค้ดนี้แล้ว

ผลรอบวันที่ 9 ตุลาคม 2026: 7/7 scenarios ผ่านใน Chromium โดยมี Trending request พร้อมกันสูงสุด 1 และไม่มี runtime error. พบและแก้ `lastRefreshToastRef` ที่ถูกใช้โดยไม่ได้ประกาศด้วย. Build และ lint ผ่าน (4 warnings เดิม); regression ของ visibility/refresh, all-seen, seen persistence และ cursor/cache ผ่าน

## Create: ชื่อคล้ายกันและรายการซ้ำ

`node tests/local/create-item-names.mjs` ตรวจชื่อไทยที่มีคำขึ้นต้น/เสียงคล้ายกัน การซ้ำตรงตัวภายในและระหว่าง batch การซ่อมร่างเดิมโดยเก็บ tier/order ของใบแรก และ 500 ชื่อที่ต่างกัน

`node tests/local/create-item-names-browser.mjs` ใช้ build + Pages server + isolated D1 ตามขั้นตอนด้านบน และ `helpers/site-audit-fixture.mjs` (CDP port 9390 ต้องว่าง) ตรวจไทย/อังกฤษที่ 390px โหมดมืดและ 1440px โหมดสว่าง โพสต์จริง 8 ครั้ง ตรวจชื่อครบหลัง refresh และ draft restore ตรวจปุ่มซ่อมร่าง ชื่อระดับที่คล้ายกันและชื่อซ้ำตรงตัว ข้อความแจ้งชื่อที่ซ้ำต้องเกิดก่อนยิง POST; ไม่ intercept API และไม่แก้ข้อมูลผู้ใช้จริง ผล JSON และ PNG อยู่ใน parent ของ QA state ซึ่ง gitignored

กฎหน้า Create เทียบชื่อแบบตรงตัวหลัง trim ให้ตรงกับ backend ไม่ใช้ prefix/คำคล้ายกัน ชื่อซ้ำใหม่ถูกข้ามพร้อมแจ้งชื่อ ส่วนร่างเดิมจะไม่ถูกลบทิ้งเองเมื่อเปิดหน้า ผู้ใช้เลือกปุ่มซ่อมได้ รายการอื่นและระดับของใบแรกคงเดิม
