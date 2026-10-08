# ตรวจการใช้งานไฟล์ทุกไฟล์ — 9 ตุลาคม 2026

## ผลจัดการหลัง audit

ส่วนนี้เป็นสถานะล่าสุด ส่วนตาราง 428 ไฟล์ด้านล่างเก็บผลก่อนแก้ไว้เพื่อเทียบย้อนหลัง.

- แก้ชุดตรวจ Discover ให้ execute หน้าและ effects ปัจจุบัน: Popular/New เมื่อ Pulse เงียบ, loading/error/empty/retry, response จาก tab เก่า และลำดับ Active. ไม่ใช้การค้นหา useEffect รุ่นเก่าเป็นเกณฑ์อีกแล้ว.
- แก้ชุดตรวจ Profile ให้ตรวจ header/education/join date/grid ปัจจุบันและการ append หน้า 2 จริงสำหรับ 100 รายการ พร้อมเคส 0/3/20/50. ชุด profile-pagination-regression เดิมที่ตรวจ pending lock, dedup, failure/retry และการเปลี่ยนผู้ใช้ยังเก็บและรันผ่าน.
- Comments ลด **9 → 7 SQL statements** ใน fixture verified-session เดิม: รวม count/activity เป็น UPDATE เดียว และ JOIN count ใน SELECT comment กลับมา. เกณฑ์ยังเป็น **8**; เพิ่มตรวจจำนวนจริงจาก DB, response shape และ reply ที่ผ่านเกณฑ์เดิม. ไม่มี migration หรือการลดการตรวจสิทธิ์.
- อัปเดต AGENTS, README, SDS, Discover Pulse และเอกสาร polling. แผนเก่าที่อ้าง seed tools ใส่หมายเหตุว่าเป็นประวัติ; เอาคำสั่ง test geometry ที่เลิกใช้จากรายการตรวจปัจจุบัน.
- ถอนเฉพาะ **7 ไฟล์ในตาราง ARCHIVE** ออกจาก checkout หลังตรวจ dependency. scripts สร้าง demo ถอนทั้งคู่พร้อม generator เก่า; output k6 ทั้งหมดถูก ignore และยังเก็บ generator/โฟลเดอร์ output. ไม่ลบข้อมูล D1/R2 และไม่แตะ migrations.
- **เก็บ activity.js และ spotlights.js**: ไม่มี UI caller ปัจจุบัน แต่ยังเป็น API ที่ตอบ request ได้และมี regression coverage. ไม่ได้ตรวจ traffic/client ภายนอก จึงยังไม่มีหลักฐานพอให้ปิด API. README ระบุสถานะนี้; cache invalidation/middleware ที่อ้าง Spotlight ยังเก็บครบ.
- ผลรันหลังแก้และถอนไฟล์: **91/91 standalone checks ผ่าน** (ลดจาก 92 เพราะถอน copied-constant geometry check หนึ่งไฟล์). Build/Lint ผ่าน; Lint มี Fast Refresh warnings เดิม 4 จุด. `git diff --check` ผ่าน.
- **Browser QA เสร็จตามสามส่วนที่ขอ: 32/32 scenarios ผ่าน** ด้วย Chrome/CDP โดยตรง หลัง CUA/node_repl runtime ล่ม. ใช้ production build + Pages Functions + D1/R2 Local แยก และสองบัญชีคนละ browser context. รายละเอียดและข้อจำกัดอยู่ใน [browser-qa-2026-10-09.md](browser-qa-2026-10-09.md); วิธีรันใน [local-browser-qa.md](local-browser-qa.md). ยังไม่ commit/deploy รอบนี้.
- Browser QA พบว่า Discover list ใช้ item ID เป็นชื่อแสดงผล. แก้ query เดิมให้ JOIN ชื่อ/รูปจาก items และรักษา legacy name fallback โดยไม่เพิ่ม SQL statements. เพิ่ม regression และรัน standalone checks ซ้ำ **91/91 ผ่าน**, Build/Lint/diff check ผ่าน.

### Coverage ของ Browser QA และส่วนที่ยังไม่ได้รัน

- Discover: tabs, loading, error/retry ทั้งสาม tab, empty, activity windows, สลับ tab/เปลี่ยนหน้าระหว่าง request, DOM/geometry ที่ 320–1440px ผ่าน.
- Profile: เคส 0/1/3/20/49/50/51/100 rankings, หน้า 2, dedup, pin นอกหน้าแรก, Pinned tab, grid และเปลี่ยนเจ้าของระหว่างโหลดหน้า 2 ผ่าน. screenshots มี education labels/join date; duels ไม่ได้ตรวจใน Browser QA นี้.
- Comments: สองบัญชีสร้าง/ตอบ/ลบ, UI/server counter, notifications และข้อมูลหลัง refresh, draft ค้าง, สิทธิ์ลบ ผ่าน. hidden/offline resume ยังไม่ได้ตรวจบน browser.
- browser harnesses อื่น, real-flow test และ Wrangler migration rehearsal ที่ต้องมี setup เฉพาะยังไม่ได้รัน. Browser QA ใหม่นี้เป็น integration จริงกับ Pages Functions + isolated Local D1; ไม่ใช่ production end-to-end.

## ผล audit ก่อนแก้

ตรวจ **428 ไฟล์ที่ Git ติดตาม** ณ commit `2c45c61` ก่อนสร้างรายงานนี้: อ่าน source/เอกสาร, ตาม import และ lazy import, ตรวจ route/config ที่ระบบโหลดตาม convention, อ่านคำสั่ง CLI และผู้ใช้ fixtures แล้วรันชุดตรวจที่ใช้ source/ฐานข้อมูลจำลองได้ โดยไม่มีการลบไฟล์หรือแก้โค้ดแอปในรอบนี้.

ขอบเขตไม่รวมการตรวจทีละไฟล์ใน `node_modules`, `dist`, `.wrangler`, `backups` และ snapshot ฐานข้อมูลที่ gitignore เพราะเป็น dependencies/output/state/ข้อมูลส่วนตัว ไม่ใช่ source ที่จะส่งขึ้น GitHub. ไม่เปิดอ่านข้อมูลผู้ใช้ใน snapshot และไม่เรียกคำสั่ง migration/seed/cleanup กับ production.

**ผลหลัก:** ไม่พบไฟล์ `src` ทั้งไฟล์ที่ขาดเส้นทาง import จากแอป; พบเครื่องมือ/ชุดตรวจ/ผลรันเก่า 7 ไฟล์ที่พิจารณาถอนออกจาก checkout ได้ตามเงื่อนไขด้านล่าง. นอกจากนี้พบ API 2 ตัวที่ไม่มี UI เรียกในปัจจุบัน แต่ยังมี route และชุดตรวจ จึงต้องตัดสินใจเลิกฟีเจอร์ก่อนลบเป็นชุด. เอกสารและ migrations ไม่ควรถูกลบด้วยเกณฑ์ว่าไม่มี JS import.

| โฟลเดอร์ | ไฟล์ |
|---|---:|
| (root) | 16 |
| docs | 61 |
| functions | 54 |
| migrations-active | 27 |
| migrations | 20 |
| public | 4 |
| scripts | 10 |
| src | 114 |
| tests | 120 |
| workers | 2 |

| สถานะ | จำนวน | ความหมาย |
|---|---:|---|
| KEEP | 360 | แอป/เครื่องมือ/ขั้นตอนดูแลระบบหรือชุดตรวจที่ควรเก็บ |
| HISTORY | 51 | หลักฐานหรือแผนตามเวอร์ชัน; เก็บหรือจัดหมวด archive ได้ |
| ARCHIVE | 7 | ผู้สมัครถอนออกจาก checkout; ดูเงื่อนไขก่อนถอน |
| UPDATE | 7 | ไฟล์มีประโยชน์ แต่เนื้อหา/ข้อคาดหวังเก่า ควรแก้ |
| REVIEW | 3 | มีเหตุให้ตรวจ/ตัดสินใจฟีเจอร์ต่อ ยังไม่ควรลบ |

## ไฟล์ที่พิจารณาถอนได้

| ไฟล์ | เหตุผลและเงื่อนไข |
|---|---|
| `docs/benchmarks/home-feed-2026-09-28/test-results.json` | ไม่พบ importer/การอ่านไฟล์นี้ใน source; เป็นผลรันเก่าซึ่ง audit ครั้งนี้มีผลใหม่แล้ว; ลบออกจาก checkout ได้เมื่อไม่ต้องการเก็บหลักฐานเดิม |
| `scripts/demo-template-catalog.mjs` | import โดย prepare-demo-templates.mjs เท่านั้น; หากเลิก generator ให้ถอนทั้งคู่ |
| `scripts/gen-community-seed.mjs` | สร้าง community-rankings-seed.sql โดย hardcode tmpl_### และ user_###; อ้างอิง namespace จาก templates-seed.sql / seed.sql ที่ไม่มีใน checkout ปัจจุบัน; docs/synthetic-data-cleanup.md บันทึกการถอนข้อมูลกลุ่มนี้แล้ว |
| `scripts/prepare-demo-templates.mjs` | ต้องรับ preflight.json และ community_### อย่างน้อย 30 บัญชี; ใช้คู่ demo-template-catalog.mjs สำหรับ namespace demo-up-ui-20260920-* ที่มีประวัติ cleanup แล้ว; ไม่ใช่คำสั่งแอป |
| `tests/local/home-layout-browser.mjs` | ยัง waitFor .home-pulse-strip / .home-pulse-rail และคาดหวัง Pulse ใน Home ซึ่งถูกย้าย/ถอดแล้ว; ควรถอน harness เดิมหรือเขียนใหม่ตามหน้าปัจจุบัน; ไม่รัน Chrome |
| `tests/local/template-card-preview-dimensions.mjs` | รันผ่านแต่ไม่ import/อ่าน TemplateCard หรือ DOM จริง; hardcode h-36, w-14, w-8 ซึ่งไม่ตรง compact card ปัจจุบันที่ใช้ ResizeObserver; ผ่านไม่ได้พิสูจน์ layout จริง |
| `tests/reports/summary.html` | generate-k6-summary.mjs เป็นผู้เขียน; ไม่เป็น input ของแอปหรือ tests; ลบออกจาก checkout ได้ถ้าไม่ต้องการผลรันเดิม แต่การสร้างผลเดียวกันต้องมี HTML ต้นฉบับซึ่งไม่อยู่ใน Git |

การถอน scripts สร้าง demo ควรทำพร้อมกันและแก้ลิงก์/คำแนะนำในเอกสารที่เรียก scripts เหล่านั้นให้เป็นบันทึกประวัติ. การถอน browser/layout test เก่าควรคงชุดตรวจพฤติกรรมที่ยังจำเป็นไว้. ไฟล์รายงานที่ลบจาก checkout จะยังดูประวัติได้ใน Git เมื่อ commit ก่อนหน้านั้นยังถูกเก็บ.

## ไฟล์ที่ควรแก้หรือตรวจต่อ

| ไฟล์ | สิ่งที่พบ |
|---|---|
| `AGENTS.md` | ยังกล่าวว่าไม่มี tests และอ้าง src/data/mockFeed.js / FeedProvider.jsx ที่ไม่มีแล้ว; ควรแก้ข้อความ ไม่ลบไฟล์ |
| `README.md` | ยังอธิบาย categories, Taste Identity และ reset token อายุหนึ่งชั่วโมง; generator k6 อ่าน HTML ไม่ใช่ raw JSON ตามข้อความปัจจุบัน |
| `SDS.md` | สถาปัตยกรรม Cloudflare ถูกอัปเดตแล้ว แต่ยังมี reset token หนึ่งชั่วโมงและคำอธิบาย categories; ควรเทียบ schema.sql และการรีเซ็ตแบบรหัส 6 หลัก |
| `docs/discover-pulse.md` | API และชุดตรวจ discover-pulse.mjs ยังใช้ได้ แต่รายละเอียดหน้าจอ/ตำแหน่งและรายการ section ต้องเทียบ Discover.jsx รุ่นล่าสุด |
| `docs/polling-analytics-quota.md` | คำอธิบาย notification idle/polling เป็นนโยบายเดิม; อ่าน docs/live-social-updates.md สำหรับ scheduler 10 วินาทีและการหยุดเมื่อซ่อนแท็บ |
| `functions/api/activity.js` | src/lib/api.js มี fetchFollowingActivity แต่ไม่พบผู้เรียกฟังก์ชันนี้ใน src; endpoint ยังเปิดอยู่และมีชุดตรวจ API จึงเป็นฟีเจอร์ที่ยังไม่เชื่อม UI ไม่ใช่ไฟล์ที่ลบได้ทันที |
| `functions/api/spotlights.js` | ไม่พบ /api/spotlights ใน src ปัจจุบัน; endpoint ยังเปิดใช้ได้และ tests/local/active-debates.mjs, spotlights-optimization.mjs ตรวจมันอยู่; หากเลิก API นี้ต้องจัดการ middleware และ cache invalidation ด้วย |
| `tests/local/discover-quiet-fallback-regression.mjs` | รันไม่ผ่าน: หา useEffect ที่มี if (!isQuiet) ไม่พบ; Discover ปัจจุบันเปลี่ยนเป็น tabs และ fetchTemplates limit 8; ควรเปลี่ยน scenario ให้ตรงพฤติกรรมปัจจุบัน |
| `tests/local/profile-placement-scalability-regression.mjs` | รันไม่ผ่าน: คาดหวัง profile-taste-summary ก่อนรายการ ranking และ xl:grid-cols-3; หน้าโปรไฟล์ปัจจุบันเปลี่ยน layout; เก็บ coverage pagination โดยเขียน assertions ใหม่ |
| `tests/local/verified-session-mutations.mjs` | รันไม่ผ่านที่ POST /api/comments: 9 statements เกิน budget 8; comments.js เพิ่ม SELECT comments_count เพื่อส่งค่าจริงหลังบันทึก; ควรทบทวน budget/ลด query และรันทดสอบให้ครบ ห้ามลบ coverage สิทธิ์ผู้ใช้เพื่อซ่อน failure |

## ผลตรวจครั้งแรกก่อนแก้

- `npm run build`: ผ่าน; ช่วยยืนยัน import และ asset ที่ Vite ต้องใช้.
- `npm run lint`: ผ่าน มี Fast Refresh warnings เดิม 4 จุด.
- standalone checks ที่รันด้วย `node`: **92 ไฟล์ — ผ่าน 89, ไม่ผ่าน 3**. สองไฟล์คาดหวัง UI รุ่นเดิม และอีกไฟล์ติด SQL budget ของ comments ตามรายละเอียดข้างบน. ไม่ได้แก้ชุดตรวจให้ผ่านระหว่าง audit.
- harness/helper ระดับบนที่ตรวจ source โดยไม่ execute: **12 ไฟล์**. เหตุผลแยกตามรายไฟล์ด้านล่าง; browser QA, load test, Wrangler rehearsal และ flow ที่ต้องมี server ไม่ได้ทดสอบการใช้งานจริงในครั้งนี้.
- ตัวช่วย/stubs, SQL fixtures และ k6 scenarios ถูกอ่านและตรวจผู้ใช้แยกจากจำนวน standalone checks; ไม่ใช่ test ที่ควรเรียก `node` ทุกไฟล์ตรง ๆ.
- import ที่ scanner สงสัย 4 จุดเป็น source string ของ esbuild stdin ที่มี `resolveDir: process.cwd()` ไม่ใช่ relative import ที่เสีย. `categories.js` เป็น re-export route. ไม่พบ import ที่เสียจริงในรายการนี้.

ข้อจำกัด: import graph พิสูจน์ว่ามีเส้นทางเรียกไฟล์ ไม่ได้พิสูจน์ว่าผู้ใช้กดทุกฟีเจอร์แล้ว; API อาจมี client ภายนอกซึ่ง source ใน repo มองไม่เห็น. ชุดตรวจ static ที่รันผ่านบางไฟล์ใช้ literal/stub จึงไม่แทน browser QA. ไม่มีการลบ/rollback ข้อมูลหรือ deploy ในรอบนี้.

## รายไฟล์ครบทั้ง 428 ไฟล์ ณ ก่อนแก้

ค่า `pass/fail/not_run` ในตารางนี้คือผลครั้งแรกก่อนแก้; ผลหลังแก้อยู่บนสุด. `—` หมายถึงไม่ใช่ standalone test ระดับบน ไม่ได้หมายความว่าไฟล์ไม่มีการใช้งาน. ไฟล์สถานะ ARCHIVE ถูกถอนแล้วตามผลจัดการข้างบน. คอลัมน์หลักฐานใช้ import/config/source ที่ตรวจ ไม่ใช้จำนวน reference ที่ค้นด้วยชื่อไฟล์เป็นข้อพิสูจน์เดี่ยว.

### (root)

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `.env.example` | KEEP | เอกสาร runtime bindings | เป็น comments ไม่มี runtime secret และ AGENTS.md อ้างอิง; ไม่ใช้ dotenv แต่ไฟล์ยังเป็นคำแนะนำการตั้งค่า | — |
| `.gitignore` | KEEP | กฎไม่ส่ง dependencies/build/ข้อมูลจริงเข้า Git | Git อ่านไฟล์นี้อัตโนมัติ; ไม่จำเป็นต้องมี code import | — |
| `.oxlintrc.json` | KEEP | ตั้งค่า oxlint | npm run lint -> oxlint อ่าน config โดย convention | — |
| `AGENTS.md` | UPDATE | คำแนะนำการพัฒนา | ยังกล่าวว่าไม่มี tests และอ้าง src/data/mockFeed.js / FeedProvider.jsx ที่ไม่มีแล้ว; ควรแก้ข้อความ ไม่ลบไฟล์ | — |
| `README.md` | UPDATE | เอกสารเริ่มใช้งานและคำสั่ง | ยังอธิบาย categories, Taste Identity และ reset token อายุหนึ่งชั่วโมง; generator k6 อ่าน HTML ไม่ใช่ raw JSON ตามข้อความปัจจุบัน | — |
| `SDS.md` | UPDATE | ข้อกำหนดและแบบระบบ | สถาปัตยกรรม Cloudflare ถูกอัปเดตแล้ว แต่ยังมี reset token หนึ่งชั่วโมงและคำอธิบาย categories; ควรเทียบ schema.sql และการรีเซ็ตแบบรหัส 6 หลัก | — |
| `index.html` | KEEP | entry HTML ของ Vite | เรียก src/main.jsx และ favicon / OG asset; Vite ใช้โดย convention | — |
| `package-lock.json` | KEEP | ล็อก dependency tree | ใช้ npm ci / install ให้ได้รุ่นที่ล็อกไว้; ไม่ควรลบเพียงเพราะไม่มี import | — |
| `package.json` | KEEP | dependencies และคำสั่งโครงการ | npm อ่านไฟล์นี้อัตโนมัติ; ไม่มี unified test script แต่ standalone tests ยังใช้ node เรียกได้ | — |
| `schema.sql` | KEEP | schema สำหรับฐานข้อมูลใหม่/local | package.json db:schema และ standalone Miniflare tests ใช้ไฟล์นี้; ต้องเก็บแม้ฐานข้อมูล deployed มีตารางแล้ว | — |
| `vite.config.js` | KEEP | ตั้งค่า build และ Tailwind/React plugins | npm run dev/build ใช้ Vite ซึ่งอ่าน config นี้โดย convention | — |
| `wrangler.phase3d-baseline.toml` | KEEP | config ซ้อม baseline local | tests/local/migration-baseline-rehearsal.mjs ใช้; แยก migration pattern สำหรับ baseline | — |
| `wrangler.phase3d.toml` | KEEP | config ซ้อม migration local | tests/local/migration-baseline-rehearsal.mjs ใช้; ไม่ใช่ production config | — |
| `wrangler.quota-0012-0015.toml` | KEEP | config rollout migration 0012–0015 เฉพาะชุด | docs/deploy-quota-0012-0015.md อ้างอิง; ไม่ควรแทนด้วย blanket migration apply | — |
| `wrangler.quota.toml` | KEEP | config rollout migration 0011 เฉพาะชุด | docs/quota-deployment.md / remaining-d1-and-migration-review.md อ้างอิง; เก็บเป็น operational recipe แม้ไม่ใช่ config deploy app | — |
| `wrangler.toml` | KEEP | Cloudflare Pages และ D1/R2 bindings | dev:full / deploy ใช้ config หลัก; ไม่ใช่ไฟล์ทดลอง | — |

### docs

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `docs/TestCases.md` | HISTORY | เอกสารกรณีทดสอบ (Test Cases) - Tear of God | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/benchmarks/home-feed-2026-09-28/after.json` | HISTORY | หลักฐาน benchmark ของ Home feed | ไฟล์ JSON เป็นตัวเลขผลวัดสำหรับรายงาน home-feed-quota-2026-09-28.md; ไม่ใช่ input ของเว็บ; เก็บหลักฐานหรือย้ายเข้าหมวด archive ได้ | — |
| `docs/benchmarks/home-feed-2026-09-28/before.json` | HISTORY | หลักฐาน benchmark ของ Home feed | ไฟล์ JSON เป็นตัวเลขผลวัดสำหรับรายงาน home-feed-quota-2026-09-28.md; ไม่ใช่ input ของเว็บ; เก็บหลักฐานหรือย้ายเข้าหมวด archive ได้ | — |
| `docs/benchmarks/home-feed-2026-09-28/compatible-no-index.json` | HISTORY | หลักฐาน benchmark ของ Home feed | ไฟล์ JSON เป็นตัวเลขผลวัดสำหรับรายงาน home-feed-quota-2026-09-28.md; ไม่ใช่ input ของเว็บ; เก็บหลักฐานหรือย้ายเข้าหมวด archive ได้ | — |
| `docs/benchmarks/home-feed-2026-09-28/index-plans.json` | HISTORY | หลักฐาน benchmark ของ Home feed | ไฟล์ JSON เป็นตัวเลขผลวัดสำหรับรายงาน home-feed-quota-2026-09-28.md; ไม่ใช่ input ของเว็บ; เก็บหลักฐานหรือย้ายเข้าหมวด archive ได้ | — |
| `docs/benchmarks/home-feed-2026-09-28/test-results.json` | ARCHIVE | snapshot ผลตรวจเมื่อ 28 ก.ย. | ไม่พบ importer/การอ่านไฟล์นี้ใน source; เป็นผลรันเก่าซึ่ง audit ครั้งนี้มีผลใหม่แล้ว; ลบออกจาก checkout ได้เมื่อไม่ต้องการเก็บหลักฐานเดิม | — |
| `docs/bio-university-dropdown-plan.md` | HISTORY | Bio: University of Phayao Dropdown (Faculty / Major / Admission Year) Plan | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/cloudflare-quota-optimization.md` | HISTORY | Quota optimization — 2026-09-21 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/cold-feed-reads.md` | HISTORY | Cold feed reads: placement range index and For You eligibility | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/community-concurrent-reads.md` | HISTORY | Concurrent community aggregate reads | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/community-social-loop-report.md` | HISTORY | Community / Discover social loop — PR follow-up to #143 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/d1-index-efficiency.md` | HISTORY | D1 index efficiency (0012, not deployed) | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/demo-likes-verification-2026-09-20.md` | HISTORY | Demo Like verification | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/demo-ranking-likes-2026-09-20.md` | HISTORY | Mock ranking likes and text verification | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/demo-rankings-2026-09-20.md` | HISTORY | Synthetic rankings — 2026-09-20 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/demo-templates-2026-09-20.md` | HISTORY | Demo templates — 2026-09-20 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/deploy-quota-0012-0015.md` | HISTORY | 0012–0015 readiness — 2026-09-21 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/deployment-2026-09-20.md` | HISTORY | Deployment checkpoint — 2026-09-20 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/deployment-audit-2026-09-28.md` | HISTORY | Audit fixes deployment — 28 September 2026 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/deployment-quota-2026-09-21.md` | HISTORY | Quota optimization production deployment | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/discover-pulse.md` | UPDATE | การทำงานของ Discover Pulse | API และชุดตรวจ discover-pulse.mjs ยังใช้ได้ แต่รายละเอียดหน้าจอ/ตำแหน่งและรายการ section ต้องเทียบ Discover.jsx รุ่นล่าสุด | — |
| `docs/discover-template-uses-views-fix-plan.md` | HISTORY | Discover Template Uses & Views Fix Plan | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/discover-template-view-refresh-and-tracking-plan.md` | HISTORY | Discover Template View Refresh & Tracking Fix Plan | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/feature-discover-hashtag-count-usage.md` | HISTORY | Feature: Hashtag counts = real usage (templates ∪ rankings) | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/feature-discover-view-all-pages.md` | HISTORY | Feature: Discover View-All Pages | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/feature-hashtag-coverage-expansion.md` | HISTORY | Feature: Hashtag Coverage Expansion (32 → 62 templates) | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/feature-like-dislike-voting.md` | HISTORY | Feature: Like / Dislike Voting | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/feature-post-detail-template-actions.md` | HISTORY | Feature: Post Detail — "Use Template" / "View Community Average" | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/feature-template-detail-page.md` | HISTORY | Feature: Template Detail Page | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/hashtag-catalog-cache-staleness-fix.md` | HISTORY | Hashtag catalog cache freshness — fix report | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/hashtags-only-migration.md` | KEEP | Hashtags-only rollout | เอกสารแนวทาง/กฎหรือขั้นตอนดูแลระบบที่ยังเกี่ยวข้อง; ไม่ต้องอยู่ใน runtime bundle | — |
| `docs/home-feed-deployment-2026-09-28.md` | HISTORY | Home feed production release — 28 September 2026 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/home-feed-quota-2026-09-28.md` | HISTORY | Home Feed D1 quota optimization — 2026-09-28 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/live-social-updates.md` | KEEP | Live social updates | เอกสารแนวทาง/กฎหรือขั้นตอนดูแลระบบที่ยังเกี่ยวข้อง; ไม่ต้องอยู่ใน runtime bundle | — |
| `docs/migration-drafts/0017_schema_reconciliation.sql` | KEEP | migration draft สำหรับ review/rehearsal | เอกสาร/ชุดตรวจ reconciliation อ้างอิง; ไม่อยู่ใน production migration discovery | — |
| `docs/participant-filter-plan.md` | HISTORY | Plan: Participant filter on the Community Average (Participants page) | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/polling-analytics-quota.md` | UPDATE | รายงานลดการ polling รุ่นก่อน | คำอธิบาย notification idle/polling เป็นนโยบายเดิม; อ่าน docs/live-social-updates.md สำหรับ scheduler 10 วินาทีและการหยุดเมื่อซ่อนแท็บ | — |
| `docs/production-d1-migration-runbook.md` | KEEP | Production D1 Migration Runbook | เอกสารแนวทาง/กฎหรือขั้นตอนดูแลระบบที่ยังเกี่ยวข้อง; ไม่ต้องอยู่ใน runtime bundle | — |
| `docs/production-visual-restoration-report.md` | HISTORY | Production visual restoration report | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/production-vs-experimental-design-audit.md` | HISTORY | Production vs Experimental — UX/UI comparative audit | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/project-audit-2026-09-28.md` | HISTORY | Project audit — 28 September 2026 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/quota-deployment.md` | HISTORY | Quota changes: deployment steps | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/rank-your-vibe-acceptance.md` | HISTORY | Rank Your Vibe — local acceptance evidence | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/rank-your-vibe-device-checklist.md` | HISTORY | Rank Your Vibe — physical phone acceptance checklist | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/rank-your-vibe-redesign.md` | HISTORY | Tear of God — Rank Your Vibe | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/recent-activity-trending-plan.md` | HISTORY | Recent-Activity Trending (Home feed, `feed_type=trending`) | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/remaining-d1-and-migration-review.md` | HISTORY | Remaining D1 work — prepared, not activated | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/resource-quota-2026-09-28.md` | HISTORY | Additional D1 reductions, 2026-09-28 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/row-read-optimization-plan.md` | HISTORY | Plan: D1 Row-Read Optimization (Full-System) | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/session-and-ui-improvements.md` | HISTORY | Session และการปรับหน้าใช้งาน — 11 กันยายน 2026 | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/superpowers/plans/2026-09-21-template-vs-original-badge.md` | HISTORY | Template vs. Original Badge Implementation Plan | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/superpowers/specs/2026-09-21-template-vs-original-badge-design.md` | HISTORY | Spec: Template vs. Original Badge (สร้างเอง / ใช้เทมเพลต) | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/synthetic-data-cleanup.md` | KEEP | Synthetic Data Cleanup | เอกสารแนวทาง/กฎหรือขั้นตอนดูแลระบบที่ยังเกี่ยวข้อง; ไม่ต้องอยู่ใน runtime bundle | — |
| `docs/template-hashtag-inheritance-plan.md` | HISTORY | Plan: Template Hashtag Inheritance & Display | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/tier-list-empty-tier-and-publish-validation-plan.md` | HISTORY | Plan: Tier-List Empty-Tier Preservation & Publish Validation | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/tier-list-feed-debug-plan.md` | HISTORY | Feed debug: new posts not visible + tier colors missing in Feed | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/tier-list-feed-timestamp-fix-plan.md` | KEEP | Tier List Feed Timestamp Fix Plan | เอกสารแนวทาง/กฎหรือขั้นตอนดูแลระบบที่ยังเกี่ยวข้อง; ไม่ต้องอยู่ใน runtime bundle | — |
| `docs/tier-list-ui-fix-plan.md` | KEEP | Tier List UI Fix Plan — Thai tier color loss & Discover Detailed row overlap | เอกสารแนวทาง/กฎหรือขั้นตอนดูแลระบบที่ยังเกี่ยวข้อง; ไม่ต้องอยู่ใน runtime bundle | — |
| `docs/ux-foundation-home-rank-flow.md` | HISTORY | UX foundation: Home → opinion → rank → community | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/ux-v2-visual-qa.md` | HISTORY | UX v2 visual QA | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |
| `docs/visual-system-navigation-profile-report.md` | HISTORY | Visual system, Navigation และ Profile | plan / รายงานตรวจ / บันทึกการเปลี่ยนแปลงตามเวอร์ชัน; ไม่ได้โหลดบนเว็บ แต่การไม่มี import ไม่พิสูจน์ว่าลบได้ | — |

### functions

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `functions/api/[[path]].js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/_middleware.js` | KEEP | middleware ของ API | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/activity.js` | REVIEW | API กิจกรรมบัญชีที่ติดตาม | src/lib/api.js มี fetchFollowingActivity แต่ไม่พบผู้เรียกฟังก์ชันนี้ใน src; endpoint ยังเปิดอยู่และมีชุดตรวจ API จึงเป็นฟีเจอร์ที่ยังไม่เชื่อม UI ไม่ใช่ไฟล์ที่ลบได้ทันที | — |
| `functions/api/admin/_check.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/admin/comments.js, functions/api/admin/index.js, functions/api/admin/rankings.js และอีก 5 ไฟล์ | — |
| `functions/api/admin/_request.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/admin/comments.js, functions/api/admin/index.js, functions/api/admin/rankings.js และอีก 3 ไฟล์ | — |
| `functions/api/admin/comments.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/admin/index.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/admin/rankings.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/admin/reports.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/admin/templates.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/admin/users.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/analytics.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/auth.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/bookmarks.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/categories.js` | KEEP | API alias สำหรับ URL เก่า | re-export onRequestGet จาก hashtags.js; Cloudflare ลงทะเบียน route จากชื่อไฟล์ ไม่ต้องมี import ในหน้าเว็บ | — |
| `functions/api/comments.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/discover-pulse.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/duels.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/follows.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/hashtags.js` | KEEP | Cloudflare API route | import โดย functions/api/categories.js | — |
| `functions/api/notifications.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/profile-pins.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/rankings.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/report.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/social-state.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/spotlights.js` | REVIEW | API Spotlight รุ่นเดิม | ไม่พบ /api/spotlights ใน src ปัจจุบัน; endpoint ยังเปิดใช้ได้และ tests/local/active-debates.mjs, spotlights-optimization.mjs ตรวจมันอยู่; หากเลิก API นี้ต้องจัดการ middleware และ cache invalidation ด้วย | — |
| `functions/api/template-comments.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/template-delete.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/template-participants.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/template-votes.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/templates.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/topic-follows.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/upload.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/users.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/api/votes.js` | KEEP | Cloudflare API route | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/lib/badges.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/auth.js, functions/api/users.js | — |
| `functions/lib/comment-delete.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/comments.js, functions/api/template-comments.js | — |
| `functions/lib/community-cache.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/rankings.js | — |
| `functions/lib/cooldown.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/admin/rankings.js, functions/api/admin/users.js, functions/api/duels.js และอีก 2 ไฟล์ | — |
| `functions/lib/feed-refresh.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/rankings.js | — |
| `functions/lib/home-feed.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/rankings.js | — |
| `functions/lib/notifications.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/comments.js, functions/api/votes.js | — |
| `functions/lib/page-meta.js` | KEEP | helper ของ Pages Functions | import โดย functions/post/[id].js, functions/rank.js, functions/template/[id].js และอีก 1 ไฟล์ | — |
| `functions/lib/pool-cache.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/rankings.js, functions/api/spotlights.js, functions/lib/home-feed.js | — |
| `functions/lib/public-response-cache.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/discover-pulse.js, functions/api/templates.js | — |
| `functions/lib/request-guard.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/activity.js, functions/api/admin/_request.js, functions/api/admin/comments.js และอีก 28 ไฟล์ | — |
| `functions/lib/session.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/_middleware.js, functions/api/auth.js, functions/lib/home-feed.js | — |
| `functions/lib/similarity.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/duels.js | — |
| `functions/lib/spotlight-cache.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/admin/comments.js, functions/api/admin/users.js, functions/api/comments.js และอีก 2 ไฟล์ | — |
| `functions/lib/templateDelete.js` | KEEP | helper ของ Pages Functions | import โดย functions/api/admin/templates.js, functions/api/rankings.js, functions/api/template-delete.js | — |
| `functions/post/[id].js` | KEEP | HTML metadata handler สำหรับลิงก์แชร์ | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/rank.js` | KEEP | HTML metadata handler สำหรับลิงก์แชร์ | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/template/[id].js` | KEEP | HTML metadata handler สำหรับลิงก์แชร์ | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `functions/template/[id]/community.js` | KEEP | HTML metadata handler สำหรับลิงก์แชร์ | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |

### migrations-active

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `migrations-active/0001_baseline.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0002_schema_reconciliation.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0003_notifications.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0004_analytics.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0005_topic_follows.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0006_notification_types.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0007_like_digest.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0008_profile_taste_identity.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0009_hashtag_transition.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0010_drop_category.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0011_quota_indexes.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0012_d1_index_efficiency.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0013_placement_tier_index.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0014_analytics_primary_storage.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0015_exact_unread_counts.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0016_remove_challenge.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0017_add_notification_read_at.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0018_notification_expiry_index.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0019_add_ranking_last_activity.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0020_duel_system.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0021_cooldown_and_anti_pumping.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0022_equipped_badge.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0023_advanced_badges.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0024_home_feed_indexes.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0025_home_template_use_counts.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0026_discover_pulse_activity_indexes.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |
| `migrations-active/0027_discover_pulse_activity_window_index.sql` | KEEP | SQL migration ที่อยู่ใน migration tree ปัจจุบัน | Wrangler ใช้ migrations_dir / migration pattern และ D1 migration history; ไม่ใช่ JS import; ไม่ apply ระหว่าง audit | — |

### migrations

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `migrations/0001_templates_tiers.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0002_add_counts_to_rankings.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0002_template_views.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0003_profile_bio.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0004_profile_education.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0005_follows.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0006_feed_indexes.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0007_votes_user_index.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0008_admin_role.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0009_reports.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0010_reports_ranking.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0011_profile_education_reset.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0012_auth_sessions.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0012_sessions.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0013_template_bookmarks.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0014_comment_replies_reports.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0015_password_resets.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0016_audit_fixes.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0017_social_retention.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |
| `migrations/0018_report_auto_expire.sql` | KEEP | SQL migration history รุ่นก่อน baseline | เก็บประวัติและประกอบ fixtures/การย้ายระบบ; บางไฟล์มี category แบบเก่าตามช่วง rollout; อย่าตัดสินด้วย schema ใหม่เพียงอย่างเดียว | — |

### public

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `public/_headers` | KEEP | HTTP/security headers ของ Pages | Cloudflare Pages ใช้โดย convention; tests/local/security-headers.mjs ตรวจ | — |
| `public/favicon.svg` | KEEP | ไอคอนเว็บไซต์ | index.html อ้าง /favicon.svg | — |
| `public/item-placeholder.svg` | KEEP | ภาพแทนรายการที่ไม่มีรูป | src/lib/images.js อ้าง /item-placeholder.svg | — |
| `public/og-default.png` | KEEP | ภาพแชร์เว็บไซต์ | index.html และ functions/lib/page-meta.js อ้าง /og-default.png | — |

### scripts

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `scripts/backfill-scores.mjs` | KEEP | เครื่องมือเติมคะแนนย้อนหลัง | มี CLI --preview / --execute / --remote; ไม่อยู่ใน npm script แต่เรียกเองได้; ตรวจ source เท่านั้น ไม่รันกับฐานข้อมูลจริง | — |
| `scripts/cleanup-synthetic-production.mjs` | KEEP | ตรวจนับ synthetic data แบบอ่านอย่างเดียว | docs/synthetic-data-cleanup.md ระบุคำสั่งนี้; ชื่อ cleanup แต่ source เป็น audit ไม่มี apply flag; ตรวจ source ไม่เรียก remote | — |
| `scripts/demo-template-catalog.mjs` | ARCHIVE | ชุดข้อมูลสำหรับ generator demo | import โดย prepare-demo-templates.mjs เท่านั้น; หากเลิก generator ให้ถอนทั้งคู่ | — |
| `scripts/gen-community-seed.mjs` | ARCHIVE | สร้างข้อมูล synthetic รุ่นเก่า | สร้าง community-rankings-seed.sql โดย hardcode tmpl_### และ user_###; อ้างอิง namespace จาก templates-seed.sql / seed.sql ที่ไม่มีใน checkout ปัจจุบัน; docs/synthetic-data-cleanup.md บันทึกการถอนข้อมูลกลุ่มนี้แล้ว | — |
| `scripts/generate-k6-summary.mjs` | KEEP | สร้างสรุปผล k6 | README.md ระบุเครื่องมือนี้; อ่าน tests/reports/{smoke,load,stress,spike,soak}.html ที่เป็นผลรันซึ่ง gitignore; ไม่ได้เรียกจาก npm script | — |
| `scripts/prepare-demo-templates.mjs` | ARCHIVE | สร้าง INSERT SQL สำหรับ demo เก่า | ต้องรับ preflight.json และ community_### อย่างน้อย 30 บัญชี; ใช้คู่ demo-template-catalog.mjs สำหรับ namespace demo-up-ui-20260920-* ที่มีประวัติ cleanup แล้ว; ไม่ใช่คำสั่งแอป | — |
| `scripts/restore-snapshot.mjs` | KEEP | คืน snapshot เข้า D1 local | package.json: db:restore -> node scripts/restore-snapshot.mjs; snapshot เป็นไฟล์ ignored ที่อาจมีข้อมูลจริง จึงไม่ตรวจเนื้อหา snapshot | — |
| `scripts/sql/backfill-ranking-scores.sql` | KEEP | SQL เติมคะแนนย้อนหลังสำหรับ maintenance | เป็นทางเลือก SQL ของ backfill-scores.mjs และมีเอกสารอ้างอิง; ไม่รันโดยอัตโนมัติและไม่ใช้ตัดสินว่าเหลือเพราะไม่มี import | — |
| `scripts/sql/rollback-unread-counters.sql` | KEEP | SQL rollback ตัวนับแจ้งเตือน | เอกสาร quota/deployment มีการอ้างอิง; เก็บสำหรับกู้คืน ไม่ execute ระหว่าง audit | — |
| `scripts/sql/verify-quota-0012-0015.sql` | KEEP | SQL ตรวจ migration quota | tests/local/production-quota-readiness.mjs อ่านไฟล์นี้และเอกสาร deployment อ้างอิง; ตรวจ source เท่านั้น | — |

### src

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `src/App.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/admin/AdminLayout.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/admin/HashtagCell.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/analytics/AnalyticsTracker.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/auth/AuthVisualPanel.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/auth/GuestAuthPrompt.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/auth/RequireAuth.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/auth/ResetCodeInput.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/discover/HashtagPill.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/feed/ActionButton.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/feed/CommunityAvgExportPreview.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/feed/HomeCommunityPulse.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/feed/TierRow.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/feed/VirtualFeedContainer.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/layout/ErrorBoundary.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/layout/MobileBottomNav.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/layout/Navbar.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/layout/NotificationMenu.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/layout/ScrollToTop.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/layout/SearchSuggestions.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/post/AboutTemplateCard.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/post/CommentSection.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/template/BookmarkButton.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/template/HashtagList.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/template/SavedTopics.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/template/TemplateCard.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/template/TopicRankActions.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/tier/AssignTierModal.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/tier/DropZone.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/tier/EditorItem.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/tier/EditorToolbar.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/tier/TierLabel.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/topic/TopicFollowButton.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/Avatar.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/BackButton.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/CommunityAvgStatsChart.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/ExportCard.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/HomeShowcase.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/Icons.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/Modal.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/Pagination.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/PlayHeader.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/RipMark.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/ShareExportModal.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/ShareQr.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/SortDropdown.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/TearMascot.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/TierLoader.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/ui/Toast.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/user/BadgeGallery.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/components/user/UserFollowButton.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/context/BookmarkContext.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/context/ThemeContext.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/context/UserContext.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/i18n.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/index.css` | KEEP | styles และ design tokens | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/analytics.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/api.js` | KEEP | ไคลเอนต์ API หลัก | ใช้ทั่วแอป; พบ exports fetchFollowingActivity และ fetchSimilarUsers ที่ไม่มีผู้เรียกใน src ปัจจุบัน สามารถพิจารณาเก็บกวาดเฉพาะส่วน ไม่ลบทั้งไฟล์ | — |
| `src/lib/badges.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/communityComparison.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/communityExcelExport.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/editorBoard.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/exportCardLayout.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/exportImage.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/firebase.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/firebaseConfig.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/format.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/hashtags.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/images.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/lastPublished.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/liveRefresh.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/navigation.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/notificationFeed.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/pendingGuard.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/pollActivity.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/preloadableImport.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/primaryNavigation.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/share.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/similarity.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/statsChartLayout.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/templatePreview.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/templateViewSession.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/tiers.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/trendingSeen.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/university.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/useCooldown.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/useDragAutoScroll.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/lib/useLiveRefresh.js` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/locales/en.json` | KEEP | ข้อความแปลภาษา | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/locales/th.json` | KEEP | ข้อความแปลภาษา | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/main.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/CategoryPage.jsx` | KEEP | รองรับลิงก์หมวดหมู่เก่า | App.jsx ลงทะเบียน /category/:categoryId และหน้า redirect ไป /discover/hashtag/:tag; เป็น compatibility alias ที่ตั้งใจเก็บ | — |
| `src/pages/CommunityAveragePage.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/CommunityParticipants.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/Create.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/Discover.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/DuelResultPage.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/ForgotPassword.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/HashtagDetail.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/HomeFeed.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/Login.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/NotFound.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/PopularHashtags.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/PopularTemplates.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/PostDetail.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/Profile.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/RankTierList.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/ResetPassword.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/TemplateDetailPage.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/admin/Dashboard.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/admin/Rankings.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/admin/Reports.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/admin/Templates.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |
| `src/pages/admin/Users.jsx` | KEEP | โค้ดหน้าเว็บ/โมดูลที่มีผู้เรียก | ตาม import graph จาก src/main.jsx รวม lazy import และ ?url | — |

### tests

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `tests/config.js` | KEEP | ค่าและ helpers สำหรับ k6 | import โดย tests/scenarios ทั้ง 5; ต้องใช้ k6 และ target server; audit ไม่ยิง load test ไป local/production | — |
| `tests/fixtures/preview-seed.sql` | KEEP | SQL fixture สำหรับทดสอบ schema/preview | ข้อมูลจำลองแยกจากฐานข้อมูลจริง; ตรวจ schema/preview ตามชื่อไฟล์ | — |
| `tests/fixtures/production-schema-before-0017.sql` | KEEP | SQL fixture สำหรับทดสอบ schema/preview | อ้างโดย tests/local/duel-migration-verification.mjs, tests/local/migration-baseline-rehearsal.mjs, tests/local/schema-reconciliation.mjs | — |
| `tests/fixtures/schema-before-hashtags.sql` | KEEP | SQL fixture สำหรับทดสอบ schema/preview | อ้างโดย tests/local/hashtags-only.mjs | — |
| `tests/local/active-debates.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/admin-api-security.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/admin-dashboard-queries.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/admin-deletion-counters.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/advanced-badges.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/analytics-batching-idle.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/api-concurrency-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/api-error-sanitization.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/auth-concurrency.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/auth-mode-reset-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/auth-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/backfill-community-average.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/bookmark-state-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/cache-observability.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/catalog-activity-quota.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/client-request-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/cold-feed-reads.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/comment-actions/entry.jsx` | KEEP | helper/stub สำหรับ standalone tests | import โดย  | — |
| `tests/local/comment-actions/format-stub.js` | KEEP | helper/stub สำหรับ standalone tests | import โดย  | — |
| `tests/local/comment-actions/i18next-stub.js` | KEEP | helper/stub สำหรับ standalone tests | import โดย  | — |
| `tests/local/comment-actions/user-context-stub.js` | KEEP | helper/stub สำหรับ standalone tests | import โดย tests/local/comment-actions/entry.jsx | — |
| `tests/local/comment-admin-actions.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/comment-self-delete.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/community-concurrent-reads.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/community-excel-analysis.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/community-item-identity.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/community-polish-browser.mjs` | KEEP | browser/manual acceptance harness | Browser or Wrangler subprocess harness; source inspected only | not_run |
| `tests/local/community-social-loop.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/d1-index-efficiency.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/discover-pulse-browser.mjs` | KEEP | browser/manual acceptance harness | Browser or Wrangler subprocess harness; source inspected only | not_run |
| `tests/local/discover-pulse.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/discover-quiet-fallback-regression.mjs` | UPDATE | ตรวจ quiet fallback ของ Discover รุ่นเดิม | รันไม่ผ่าน: หา useEffect ที่มี if (!isQuiet) ไม่พบ; Discover ปัจจุบันเปลี่ยนเป็น tabs และ fetchTemplates limit 8; ควรเปลี่ยน scenario ให้ตรงพฤติกรรมปัจจุบัน | fail |
| `tests/local/duel-api.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/duel-migration-verification.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/duel-similarity.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/editor-detail-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/equipped-badge.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/export-card-consistency.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/feed-refresh.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/final-hybrid-p1-fixture-server.mjs` | KEEP | fixture helper / local UI server | fixtureProfile และ fixturePosts ยัง import จาก profile-placement-scalability-regression.mjs; browser harness ใช้ประกอบ UI QA; ต้องจัดการคู่กับ coverage ที่แก้ใหม่ ไม่ลบเดี่ยว | not_run |
| `tests/local/full-placement-aggregation.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/hashtag-catalog-staleness.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/hashtags-only.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/helpers/contributions.mjs` | KEEP | helper/stub สำหรับ standalone tests | import โดย tests/local/backfill-community-average.mjs, tests/local/cold-feed-reads.mjs, tests/local/hashtags-only.mjs และอีก 3 ไฟล์ | — |
| `tests/local/home-feed-all-seen.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/home-feed-benchmark.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/home-feed-cursor-cache.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/home-layout-browser.mjs` | ARCHIVE | browser audit สำหรับ Home layout เก่า | ยัง waitFor .home-pulse-strip / .home-pulse-rail และคาดหวัง Pulse ใน Home ซึ่งถูกย้าย/ถอดแล้ว; ควรถอน harness เดิมหรือเขียนใหม่ตามหน้าปัจจุบัน; ไม่รัน Chrome | not_run |
| `tests/local/home-template-counts.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/home-trending-age-limits.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/home-trending-request-storm-guard.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/home-virtual-window.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/k6-auth-safety.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/live-refresh.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/maintenance-read-only.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/migration-baseline-rehearsal.mjs` | KEEP | ซ้อม migration ผ่าน Wrangler local | อ่าน wrangler.phase3d*.toml; สร้างฐานข้อมูลจำลอง/ทดสอบ failure; ไม่ execute เพื่อ audit ไฟล์ | not_run |
| `tests/local/notification-cleanup-scheduled.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/notification-delete.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/notification-polling.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/notification-read-expiry.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/page-meta-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/participants-excel-export.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/participants-filter-reset.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/participants-filter.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/password-reset-code.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/preloadable-import.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/preview-isolation-safety.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/primary-navigation-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/production-quota-readiness.mjs` | KEEP | จำลอง migration กับ production DDL/จำนวนรวม | ต้องมี ignored .wrangler/production-readiness-schema.json และ production-readiness-counts.json; ไม่เป็นชุดตรวจที่รันได้ทันทีจาก clean clone จึงตรวจ source อย่างเดียว | not_run |
| `tests/local/profile-card-hashtags.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/profile-links-audit.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/profile-pagination-regression.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/profile-pinned-presentation.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/profile-placement-scalability-regression.mjs` | UPDATE | ตรวจการวางข้อมูลโปรไฟล์รุ่นเดิม | รันไม่ผ่าน: คาดหวัง profile-taste-summary ก่อนรายการ ranking และ xl:grid-cols-3; หน้าโปรไฟล์ปัจจุบันเปลี่ยน layout; เก็บ coverage pagination โดยเขียน assertions ใหม่ | fail |
| `tests/local/profile-similar-lazy.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/quota-hot-paths.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/quota-item-reactions.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/quota-optimization.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/rank-your-vibe-browser.mjs` | KEEP | browser/manual acceptance harness | Browser or Wrangler subprocess harness; source inspected only | not_run |
| `tests/local/rank-your-vibe-real-browser.mjs` | KEEP | browser/manual acceptance harness | Browser or Wrangler subprocess harness; source inspected only | not_run |
| `tests/local/rank-your-vibe-real-flow.mjs` | KEEP | ทดสอบ flow กับ local Pages + D1/R2 จริง | ต้องใช้ isolated Pages server ที่ port 8799; สร้างบัญชี/จัดอันดับ/บันทึกใน fixture local จึงอ่าน source เท่านั้น | not_run |
| `tests/local/ranking-atomicity.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/ranking-orphan-template-delete.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/remaining-d1.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/report-expiry.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/saved-templates-sync.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/schema-reconciliation.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/security-headers.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/social-updates.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/spotlights-optimization.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/stats-chart-export.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/template-card-preview-comprehensive.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/template-card-preview-dimensions.mjs` | ARCHIVE | การคำนวณ geometry จากค่าที่คัดลอกมา | รันผ่านแต่ไม่ import/อ่าน TemplateCard หรือ DOM จริง; hardcode h-36, w-14, w-8 ซึ่งไม่ตรง compact card ปัจจุบันที่ใช้ ResizeObserver; ผ่านไม่ได้พิสูจน์ layout จริง | pass |
| `tests/local/template-card-preview-shapes.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/template-cooldown-anti-pumping.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/template-discover-preview.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/template-participants-scalability.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/template-view-session.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/test-browser-home.mjs` | KEEP | browser/manual acceptance harness | Browser or Wrangler subprocess harness; source inspected only | not_run |
| `tests/local/trending-pool-cache.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/trending-recent-activity.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/trending-seen-fallback.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/trending-seen.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/trending-virtual-infinite-feed.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/trending-visibility.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/user-session-state.mjs` | KEEP | standalone local regression / benchmark | รันด้วย node ผ่านใน audit นี้; ใช้ source จริง, stub หรือ Miniflare แยกจาก DB ที่บันทึกไว้ | pass |
| `tests/local/ux-clarity-browser.mjs` | KEEP | browser/manual acceptance harness | Browser or Wrangler subprocess harness; source inspected only | not_run |
| `tests/local/verified-session-mutations.mjs` | REVIEW | ตรวจสิทธิ์ mutation และจำนวน SQL | รันไม่ผ่านที่ POST /api/comments: 9 statements เกิน budget 8; comments.js เพิ่ม SELECT comments_count เพื่อส่งค่าจริงหลังบันทึก; ควรทบทวน budget/ลด query และรันทดสอบให้ครบ ห้ามลบ coverage สิทธิ์ผู้ใช้เพื่อซ่อน failure | fail |
| `tests/local/visual-personality-browser.mjs` | KEEP | browser/manual acceptance harness | Browser or Wrangler subprocess harness; source inspected only | not_run |
| `tests/reports/.gitkeep` | KEEP | คงโฟลเดอร์ output สำหรับ k6 | ใช้เป็น placeholder; หากถอด summary.html ยังควรเก็บ directory output หรือให้ generator mkdir ก่อน | — |
| `tests/reports/summary.html` | ARCHIVE | รายงาน k6 ที่สร้างจากผลรัน | generate-k6-summary.mjs เป็นผู้เขียน; ไม่เป็น input ของแอปหรือ tests; ลบออกจาก checkout ได้ถ้าไม่ต้องการผลรันเดิม แต่การสร้างผลเดียวกันต้องมี HTML ต้นฉบับซึ่งไม่อยู่ใน Git | — |
| `tests/scenarios/load.js` | KEEP | k6 load scenario | อ่าน tests/config.js; รันผ่าน k6 แยกจาก node/npm test; ไม่ execute load ใน audit นี้ | — |
| `tests/scenarios/smoke.js` | KEEP | k6 smoke scenario | อ่าน tests/config.js; รันผ่าน k6 แยกจาก node/npm test; ไม่ execute load ใน audit นี้ | — |
| `tests/scenarios/soak.js` | KEEP | k6 soak scenario | อ่าน tests/config.js; รันผ่าน k6 แยกจาก node/npm test; ไม่ execute load ใน audit นี้ | — |
| `tests/scenarios/spike.js` | KEEP | k6 spike scenario | อ่าน tests/config.js; รันผ่าน k6 แยกจาก node/npm test; ไม่ execute load ใน audit นี้ | — |
| `tests/scenarios/stress.js` | KEEP | k6 stress scenario | อ่าน tests/config.js; รันผ่าน k6 แยกจาก node/npm test; ไม่ execute load ใน audit นี้ | — |

### workers

| ไฟล์ | สถานะ | หน้าที่ | หลักฐาน/คำแนะนำ | ผล node |
|---|---|---|---|---|
| `workers/notification-cleanup/index.js` | KEEP | scheduled notification cleanup | Cloudflare/Wrangler ลงทะเบียน entry ตาม path/export; ไม่ต้องมี frontend import | — |
| `workers/notification-cleanup/wrangler.toml` | KEEP | config Worker cron ล้างแจ้งเตือน | main = index.js และ cron ทุกนาที; แยกจาก Pages เพราะใช้ scheduled Worker | — |
