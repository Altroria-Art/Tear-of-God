# UX/UI audit — 10 ตุลาคม 2026

ตรวจและแก้บน Local ใน branch `codex/discover-full-boards` โดยรักษางาน Discover ที่มีอยู่ก่อนเริ่มรอบนี้ ไม่ deploy/push/commit รายงานนี้บันทึกเวอร์ชันที่ตรวจ ไม่ใช่ข้อยืนยันว่า Production หรือทุกสถานการณ์ของระบบผ่านแล้ว

## วิธีตรวจ

ใช้ built React app + Cloudflare Pages Functions + D1/R2 Local และ Chromium 154.0.8037.98 จริง แยกฐานข้อมูล QA จาก `.wrangler/state` และเซิร์ฟเวอร์ใช้งานที่ 8788 ตรวจ marker ผ่าน API ก่อนสร้าง fixture หรือสมัครบัญชีทดสอบ ใช้ browser contexts แยกสำหรับ guest/member/admin และตรวจ session ID หลัง login ผ่านฟอร์มจริง

Matrix: 40 route/state cases × 320/390/768/1024/1440px × EN/TH × light/dark = 800 ชุดต่อรอบ พร้อม screenshots วัดความกว้างเทียบ viewport ที่ตั้งไว้ ไม่เทียบ `scrollWidth` กับ `innerWidth` อย่างเดียว เพราะ mobile Chromium อาจขยาย layout viewport ตามเนื้อหาที่ล้นและซ่อนปัญหา

Baseline แรก 740 ชุดพบ overflow ใน 3 route cases, main ไม่ครบ 3 cases, heading ไม่ครบ 9 cases และช่องกรอกไม่มีชื่อใน 6 cases มีการเพิ่ม states และเข้มงวดกับ select labels ระหว่างตรวจ จึงไม่ใช้ baseline เป็นรายการปัญหาทั้งหมด

## ปัญหาที่แก้

| ระดับ | ปัญหา | ผลหลังแก้ |
|---|---|---|
| P1 | Community/Duel ล้นจอ 320px; participants ของสมาชิก redirect ไป Community จึงได้รับผลเดียวกัน | Chart หดได้ ชื่อยาวขึ้นบรรทัดใหม่ กลุ่ม tier ของ Duel wrap ได้ |
| P1 | Modal แอดมินมี implementation แยกและจัดการ focus/background ไม่ครบ | ใช้ shared Modal มีชื่อ, focus trap, Escape, คืน focus, scroll lock และ background inert รองรับจำนวน Modal ที่เปิด |
| P1 | กด Space บนรายการในหน้าหัวข้อกระตุ้น keyboard handler ของบอร์ดและอาจเปิดโพสต์ | Handler ทำงานเมื่อ target เป็นตัวบอร์ดเอง รายการเป็น native button บอร์ดนำทางใช้ role link |
| P2 | โหวตบางส่วนเป็น span ที่คีย์บอร์ดกดไม่ได้ | Native button มีชื่อ/aria-pressed คง mutation guard และ API; footer wrap บนมือถือ |
| P2 | Enter บนลิงก์จัดการรายงานถูก handler ของแบนเนอร์ดัก | แบนเนอร์ไม่เป็นปุ่มซ้อนปุ่ม ใช้ปุ่มดูรายงานและลิงก์จัดการรายงานแยกกัน |
| P2 | บางช่องอาศัย placeholder และ select ไม่มีชื่อ | เพิ่ม label/aria-label ใน Create, Rank, hashtags, participants, ช่วงเวลาอันดับรวมและ admin search; ไม่นับข้อความ option เป็น label |
| P2 | Main/h1 ไม่ครบในบางหน้าและหน้าข้อมูลหาย | ครอบเนื้อหาหลัก มี h1 ที่แสดงจริง 1 รายการ ทางกลับ และ Skip to content |
| P2 | Sort ใช้คีย์บอร์ดไม่ครบ | Arrow Up/Down, Home/End, Enter/Space, Escape, Tab, outside click และ focus restore |
| P2 | Follow/แท็บ/ปุ่มลูกศรบางจุดมีพื้นที่กดเล็ก | ปุ่มอย่างน้อย 44px ลูกศรไม่ถูก flex บีบ และแท็บ Home ไม่ scale ค้าง |
| P2 | สีแจ้งเตือน/ลบ/สถานะรายงาน/muted อ่านยากในบางธีม | แยกสี status ของข้อความกับพื้นทึบ เพิ่ม contrast และใช้ tokens สำหรับสถานะโหวต/ลิงก์ |
| P2 | ตารางแอดมินตัดคอลัมน์ด้านขวาบนมือถือโดยไม่มีคำแนะนำ | TableScroller บอกเมื่อ overflow จริง เป็น region มีชื่อ ใช้ Tab/ลูกศรเลื่อนได้ |
| P2 | ปุ่ม recovery แสดง spinner อย่างเดียวระหว่างรอ | มีข้อความ Loading และ aria-busy คงการกัน submit ซ้ำ/error/retry |
| P3 | Login มือถือมีพื้นที่ฟอร์ม inactive มากเกิน | ไม่ให้ฟอร์ม inactive ใช้พื้นที่ ลดหัว/ท้าย คง desktop book และการล้างค่าฟอร์ม |
| P3 | Preview ด้านข้างของหัวข้อไม่มีอันดับดูว่าง | จัดสถานะไม่มีอันดับให้เห็นในส่วน preview ที่ไม่ถูกครอบ |
| P2 | รูปเสียในรายการ preview ของหน้าหัวข้อแสดง broken-image icon/alt text | ใช้ชื่อรายการแทนรูปเสีย ตรวจ URL, lazy load และขนาดช่องคงที่ |
| P3 | Motion ไม่เป็นชุดเดียวกัน/บาง class ไม่มี CSS | Page/dialog/popover motion จริง พร้อม reduced motion และ hover/focus เบา ๆ |
| P3 | Caption บางจุดเล็ก ลิงก์ footer Rank ไม่มีปลายทาง และการ์ด Profile เป็นปุ่มครอบ pin | ขยายข้อความที่พบ เอาลิงก์ `#` ที่ไม่ทำงานออก ใช้ลิงก์ชื่อโพสต์ใน Profile |

## หน้าที่ตรวจ

| หน้า | Coverage |
|---|---|
| Home | Hero/demo, feed cards, Trending/For You/Following, ขนาดปุ่มและ main |
| Login/Signup | Desktop book/mobile, form isolation ทั้งสองทิศทาง, labels/headings, reduced motion |
| Recovery | ขอรหัส, 6 ช่อง, loading/error/retry/success และ token หมดอายุ คงเวลาตรวจขั้นต่ำ 2 วินาที |
| Create/Rank | Guest draft, field names, mouse/touch drag, wrapped reorder, cancel/outside, edge scroll, pool 6/7/8/18 รายการ |
| Discover | Popular/New/Active/ช่วงเวลา/search/saved, loading/retry/empty, stale response, carousel/View all/keyboard/swipe/expand |
| Full boards | อันดับรวมทุกคน, 0/12/13/100/500 รายการ, custom/Thai/empty tiers, ชื่อยาว รูปเสีย, bookmark/account isolation |
| Templates/Hashtags | Catalog/filter/sort/pagination, hashtag detail/category alias คง catalog layout |
| Topic/Post/Community | Tier/items, vote controls, comment destinations, keyboard item detail, shared Modal และ missing resources |
| Participants | Admin, filters/empty/missing, member guard และ export regressions |
| Profile | Own/other, ข้อมูลมหาลัยและวันเข้าร่วม, edit modal/native post link, pin และ pagination 0–100 โพสต์, stale user request |
| Comments/Notifications | สร้าง/ตอบ/ลบจากสองบัญชี counters/ownership/notifications และข้อมูลหลัง refresh, mobile menu/Escape |
| Duel | ชื่อยาว tier wrap, mobile comparison, share และ API/similarity regressions |
| Admin | Dashboard/Users/Rankings/Templates/Reports, scrolling, previews/quick reports และ delete/error/retry/pending lock |
| Error/404 | Heading/main/ทางกลับ และ missing post/template/community/profile/duel/participants |

## Motion และโควต้า

Page fade 200ms ไม่มี transform บน page shell จึงไม่เปลี่ยน containing block ของ sticky/fixed controls Dialog 220ms เลื่อน 8px/scale เล็กน้อย backdrop 140ms Popover 160ms หนังสือ Login คง flip 950ms Reduced motion ปิด motion ใหม่และลด animation เดิม

ใช้ CSS และ ResizeObserver เฉพาะส่วนที่ต้องวัด ไม่เพิ่ม animation package, API หรือ polling จากงาน UX รอบนี้ คง TierLabel/สีข้อมูล/UTC parsing, cache, pagination และ mutation guards ไม่เพิ่ม SQL budget เพื่อทำให้ test ผ่าน

## หลักฐาน

| ชุดตรวจ | ผล |
|---|---|
| Route/language/theme/viewport matrix | 800 ชุดผ่าน; ตรวจ viewport/main/h1, field/button names, duplicate IDs, ปุ่ม 44px และ runtime errors |
| Site keyboard/interaction | 59 กรณี EN/TH 390/1440px: skip/sort/Modal/tables, profile link, topic preview fallback, template item/vote, dashboard link และ OTP |
| Discover full boards | 43 กรณีผ่าน รวม 500 รายการ View all และบัญชี/บันทึกแยกกัน |
| Discover/Profile/Comments backend flow | 33 กรณีผ่าน รวม profile 0/1/3/20/49/50/51/100 โพสต์และคอมเมนต์สองบัญชี |
| Admin delete dialogs | 19 กรณีผ่าน cancel/Escape/backdrop, pending lock, duplicate delete, failure/retry, target/API/row removal |
| Auth form isolation | EN/TH 390/1440px ผ่านทั้งสองทิศทางและสลับซ้ำ |
| Touch tier dragging | Hold/tap/swipe/drop/reorder/cancel/outside/edge scroll ของ Create/Rank และ mouse ผ่าน |
| Rank pool columns | 24 layouts ผ่าน รวม 8→6→8, scrollbar, สองคอลัมน์และ 44px ตรวจมือถือเพิ่ม |
| Topic preview หลังแก้รูปเสีย | 60 ชุดผ่าน: มีโพสต์/ไม่มีรายการ/ยังไม่มีโพสต์ × EN/TH × light/dark × 5 ขนาดจอ รูปปกติยังโหลด รูปเสียใช้ชื่อแทน ตรวจภาพจริงที่ 390/1440px |
| Smoke บน Local ที่ใช้งาน 8788 | 48 ชุดผ่าน: 8 guest routes × EN/TH × 320/390/1440px ไม่สร้างบัญชีหรือแก้ข้อมูลผู้ใช้ |
| Contrast solid backgrounds | 80 screens; 4,303 text samples ผ่าน; gradients/images/transient opacity 36 samples ข้าม ไม่ใช่ WCAG certification |
| Standalone regressions | 34/34 ผ่าน รวม auth/OTP, security/reports, Discover/cache/quota, profile/pagination/pin, community/participants, duel, comments/live refresh/notifications |
| Build / Lint / Pages Functions compile | ผ่าน Lint มี Fast Refresh warnings เดิม 4 รายการ ไม่มี error |

จำนวน test ไม่ใช่จำนวนผู้ใช้ที่รองรับ ใน comments flow ข้อมูลอีกบัญชีแสดงหลังประมาณ 9.5 วินาที และ reply ประมาณ 0.5 วินาทีภายใต้ polling/cache เดิม ไม่ได้เปลี่ยนเป็น realtime transport ในงาน UI นี้

Recovery, auth form isolation, admin delete failures และบาง loading/retry ใช้ CDP interception เพื่อควบคุม error และไม่ส่งอีเมล/ลบข้อมูลจริง Fixture login/matrix/previews/comments สองบัญชี/bookmark/Discover ใช้ backend/D1 Local จริง

ปรับ `profile-pagination-regression.mjs` ที่อ้างรูปแบบเรียก loadResults เดิมให้ตรง generation/catch ปัจจุบัน โดยรักษา lock/deduplication/retry/pagination assertions เกณฑ์ Comments SQL budget ยังเดิม Browser geometry อนุญาตทศนิยม DOMRect 0.01 CSS px (43.99999 จาก control 44px) ไม่ลดขนาด control

## ทำซ้ำ

```powershell
npm run build
npx wrangler d1 execute tear-of-god-db --local --persist-to .wrangler/browser-qa-site-repeat/state --file schema.sql
npx wrangler pages dev dist --local --port 8797 --persist-to .wrangler/browser-qa-site-repeat/state
```

อีก terminal:

```powershell
$env:BROWSER_QA_URL = 'http://127.0.0.1:8797'
$env:BROWSER_QA_STATE = '.wrangler/browser-qa-site-repeat/state'
$env:QA_PHASE = 'after'
node tests/local/site-ux-audit-browser.mjs
node tests/local/site-ux-interactions-browser.mjs
node tests/local/site-ux-contrast-browser.mjs
```

CDP ports 9382/9383/9385 ต้องว่าง ใช้ Node ที่มี global fetch/WebSocket และ Chrome ที่ติดตั้ง (`CHROME_PATH` เปลี่ยนได้) รัน contrast หลัง matrix เพราะอ่าน route cases จากผล matrix ผล JSON/screenshots/SQL/state/fixture credentials อยู่ใต้ `.wrangler/browser-qa-*` ที่ Git ignore ไม่มีบัญชีผู้ใช้จริงใน test ดูขั้นตอนชุดอื่นที่ `docs/local-browser-qa.md` และ `docs/discover-full-boards.md`

## ยังไม่ยืนยันในรอบนี้

- Safari/Firefox และ iOS/Android จริง: ใช้ Chromium viewport/touch emulation
- Screen reader จริง/ทุกเกณฑ์ WCAG: มี semantic/focus/keyboard และ contrast เฉพาะพื้นหลังที่วัดได้
- Google sign-in จริง, OTP email delivery/reset บัญชีจริง: recovery browser rehearsal ไม่ส่งอีเมล
- Cloudflare Preview/Production, D1/R2 remote, URL ภาพ R2 จริง และ load/quota การใช้งานมหาวิทยาลัย
- Hidden/offline lifecycle บน browser จริง และ admin business flows ทุก permission combination: standalone guards ไม่เท่ากับ end-to-end ทุกกรณี
- Export/share ไปแอปภายนอกและทุกชนิดไฟล์บนทุกเครื่อง

ผลนี้ใช้รีวิว Local และเตรียม integration รอบต่อไป ไม่สรุปว่าระบบไม่มีปัญหาในสถานการณ์ที่ยังไม่ได้ตรวจ
