# ตรวจการใช้ Cloudflare และลดงานที่กินโควต้า — 10 ตุลาคม 2026

การใช้งานที่อ่านได้ยังต่ำเมื่อเทียบกับเพดาน Free แต่จำนวนคนที่รองรับขึ้นกับเวลาที่เปิดเล่น จำนวนหน้าที่เปิด และจำนวนแถวที่แต่ละ SQL อ่าน ไม่ใช่จำนวนบัญชีที่สมัคร การตรวจครั้งนี้อ่าน analytics ของบัญชีจริงและแก้โค้ดในสาขา `codex/free-quota-optimization` ยังไม่ได้ deploy หรือเปลี่ยนแพ็กเกจ Cloudflare

## ตัวเลขจริง ณ เวลาตรวจ

ข้อมูล D1/Workers อ่านเมื่อ 00:28 น. และ Pages/R2 เมื่อ 00:36 น. วันที่ 10 ต.ค. ตามเวลาไทย เป็นวันโควต้า UTC วันที่ **9 ต.ค. 2026** ไม่ใช่ยอดเต็มวัน และ analytics อาจมีความล่าช้าหรือ sampling ข้อมูลดิบกับ D1 Query Insights อยู่ใน `.wrangler/quota-audit-20261010/` ซึ่งถูก Git ignore

| รายการ | การใช้ที่ Cloudflare รายงาน | เทียบเพดาน Free |
| --- | ---: | ---: |
| D1 อ่าน ทั้งบัญชีรวมฐาน Preview ที่ใช้ระหว่าง QA | 83,561 แถว | 1.67% ของ 5,000,000 แถว/วัน |
| D1 เขียน ทั้งบัญชี | 4,173 แถว | 4.17% ของ 100,000 แถว/วัน |
| D1 Production อย่างเดียว | อ่าน 58,267 / เขียน 267 แถว | 1.17% / 0.27% |
| Pages Functions Production / Preview | 380 / 243 invocations | ประมาณ 0.62% ของ 100,000 requests/วัน |
| Worker ลบแจ้งเตือนหมดอายุ | 1,045 invocations รวม 2 exceptions | ประมาณ 1.05% ของ budget requests/วัน |
| R2 พื้นที่ล่าสุด Production | 2,763,243 bytes, 7 objects | ประมาณ 2.8 MB; Free Standard รวม 10 GB-month |
| R2 operations 1–9 ต.ค. ทั้งบัญชี | Class A 6 / Class B 119 / DeleteObject 1 | Free Standard รวม 1 ล้าน / 10 ล้าน operations ต่อเดือน; DeleteObject ฟรี |

เมื่อรวม Pages และ Worker ต่างช่วงเวลาข้างต้น ได้ประมาณ 1,668 invocations (1.67% ของเพดาน requests Free) การนับนี้ต้องรวม Preview ด้วย ไม่ใช้ Workers dataset อย่างเดียว เพราะ Pages Functions อยู่ในอีก dataset

D1 metadata ที่อ่านในภายหลังรายงาน Production 1,646,592 bytes และอีกฐาน 20,480 bytes รวมประมาณ 1.67 MB ข้อมูล R2 เป็นขนาด ณ จุดเวลา ยังไม่ใช่ค่า GB-month ที่เฉลี่ยยอดสูงสุดแต่ละวัน ปัจจุบันรายการ D1 ไม่คืนฐาน Preview ที่อ้างใน `wrangler.toml`; ต้องตรวจ binding ก่อน deploy Preview ครั้งต่อไป การตรวจนี้ไม่ได้สร้างหรือลบฐาน Cloudflare

การอ่าน Account Subscriptions ถูก API ปฏิเสธด้วย authentication error จึง **ยังยืนยันแพ็กเกจ billing ที่ใช้งานจริงไม่ได้** ตารางนี้เปรียบเทียบกับเพดาน Free ที่ผู้ใช้ต้องการ ไม่ใช่ใบแจ้งหนี้หรือการยืนยันว่าจะไม่มีค่าใช้จ่าย

## จุดที่แก้แล้วในโค้ด

1. **ปิดกระดิ่งอ่านเฉพาะตัวเลขทุก 30 วินาที** ผ่าน `GET /api/notifications?count_only=1` แทนโหลดรายการและลบข้อมูลหมดอายุทุก 10 วินาที เมื่อเปิดกระดิ่งจะโหลดรายการทันทีและยังเช็กทุก 10 วินาที ตัวเลขยังอ่านสดจาก counter ที่ trigger ดูแล ไม่ cache ข้อมูลข้ามบัญชี
2. **รวมคำขอ Community** ผ่าน `GET /api/template-comments?template_id=…&include_reactions=1` คืนคอมเมนต์ จำนวนคอมเมนต์ และยอด like/dislike พร้อม vote ของ session ลดจาก 2 HTTP และ 2 session lookups เหลือ 1 ต่อรอบ SQL aggregate ยังทำงานเดิม โดยแชร์ helper กับ API โหวต
3. **หยุด live polling หลังไม่มี interaction 5 นาที** แม้เปิดแท็บอยู่ด้านหน้า กด เลื่อน หรือพิมพ์แล้วอ่านข้อมูลใหม่ทันที แท็บซ่อน/offline ไม่เริ่มคำขอ polling
4. **ลดการชนของ focus และการ retry ช่วง outage** focus ซ้ำในรอบเดียวไม่ยิงเพิ่ม; เมื่อ request ล้มเหลวจะเพิ่มช่วง retry เป็นสองเท่า สูงสุด 60 วินาที กด retry เองและการ reconcile หลัง mutation ยังทำทันที
5. **ลด SQL ของ preview และ following activity** หา ranking ล่าสุดของแต่ละหัวข้อครั้งเดียวผ่าน MATERIALIZED CTE และเพิ่ม index ที่ตรงกับการเรียงเดิม Activity จำกัด candidate ของแต่ละคนก่อนรวม/เรียง แล้ว join รายละเอียดเฉพาะรายการที่จะส่ง ยังคง `datetime()` เพื่อรองรับข้อมูล ISO เก่า และทดสอบ schema ที่ยังไม่มี index ใหม่ด้วย
6. **แคชคอมเมนต์สาธารณะสั้น ๆ สำหรับผู้ชมพร้อมกัน** periodic reads ใช้ `shared_snapshot=1` เก็บรายการ/ยอดรวม 5 วินาที โดย private vote และ Post counters อ่านสดทุกครั้ง Response ถึง browser ยังเป็น `private, no-store` เปิดหน้าครั้งแรก กด retry และ reconcile หลัง mutation ข้าม cache การเปลี่ยนจากอุปกรณ์อื่นอาจเห็นในประมาณ 10–15 วินาทีบวก network delay; ถ้าอ่านอยู่คนเดียวแต่ละ tick 10 วินาทีจะเป็น cold read ไม่อ้างว่าประหยัดทุกคำขอ
7. **เพิ่ม exact template usage counter แยกจาก mirror เก่า** migration `0029` backfill ตาราง `template_usage_counts` และใช้ triggers ดูแล insert/delete/move ของ ranking รวมถึง cascades และ rollback Home, catalog/detail/suggestions, Spotlights, admin templates/dashboard และ template share metadata ใช้ lookup เมื่อเปิด `TEMPLATE_USAGE_COUNTERS=true` ถ้ายังไม่เปิด flag ใช้ live COUNT เดิม จึง deploy โค้ดกับ schema เก่าได้โดยไม่ต้องเปิด flag ก่อนพร้อม
8. **ย่อรูปโปรไฟล์ก่อนส่ง R2** JPEG/PNG ปกติย่อด้านยาวสูงสุด 512px และ encode WebP quality 0.82 ใช้เฉพาะเมื่อไฟล์เล็กลง รักษา transparency; GIF/APNG/WebP และ codec ที่ไม่พร้อมใช้ไฟล์เดิม Server type/signature/5MB validation ยังทำงานเดิม ไม่ลบรูปเก่าหรือเปลี่ยน URL รูปที่ผู้ใช้มีอยู่
9. **จัดส่วนที่แก้ให้ใช้ helper ร่วม** แยก public comment snapshot, session-only template reactions, exact usage SQL และ avatar preparation ลด SQL/เงื่อนไขซ้ำ ไม่เปลี่ยน API payload เดิมหรือจัด format ทั้ง repository จน diff ตรวจยาก

ไม่เปลี่ยนความถี่ Home counters (15 วินาที) หรือคอมเมนต์ Post Detail (10 วินาที) ขณะใช้งานอยู่ ข้อมูลเดิมและ comment draft คงอยู่ระหว่าง polling; read ก่อน mutation ไม่สามารถทับ state หลัง mutation

ทดสอบ Miniflare ด้วยแจ้งเตือน unread 500 รายการพบว่า **counter-only handler ใช้ 1 SQL อ่าน 1 แถว เขียน 0 แถว** ทั้งนี้ middleware ยังต้องตรวจ session ตามปกติ ไม่รวมงานนั้นในตัวเลข 1 แถว หากฐานยังไม่ได้เปิด `NOTIFICATION_UNREAD_COUNTS=true` จะใช้ COUNT แบบเดิมเพื่อความเข้ากันได้ Production มี flag และ migration counter อยู่แล้ว

กติกาแจ้งเตือนอ่านแล้วหมดอายุ 24 ชั่วโมงคงเดิม: full-list GET และ Worker ตามตารางทุกนาทียังลบจริง และ list ไม่แสดงรายการหมดอายุ ไม่มีการลดตาราง cleanup ในการตรวจครั้งนี้

## ผลต่อจำนวน requests

เป็นการคำนวณจากช่วง polling ที่โค้ดกำหนด สำหรับ 1 แท็บของผู้ใช้ที่ล็อกอินและใช้งานต่อเนื่อง โดยปิดกระดิ่ง ไม่มี API เขียน/เปิดหน้าใหม่/analytics/ retry และไม่รวม initial load

| หน้าที่เปิด | ก่อน: requests/ชั่วโมง | หลัง: requests/ชั่วโมง |
| --- | ---: | ---: |
| แจ้งเตือนอย่างเดียว | 360 | 120 (ลด 66.7%) |
| Home + แจ้งเตือน | 600 | 360 (ลด 40%) |
| Post Detail + แจ้งเตือน | 720 | 480 (ลด 33.3%) |
| Community + แจ้งเตือน | 1,080 | 480 (ลด 55.6%) |

ปล่อย foreground ทิ้งไว้หนึ่งชั่วโมงโดยไม่กดหรือเลื่อน: notification badge periodic requests เหลือ 9 แทน 360 และหยุดหลัง 5 นาที (ไม่รวม initial GET) Browser/unit tests จำลองเวลาเพื่อพิสูจน์การหยุดและการกลับมา ไม่ใช่การยิง load test บน Production

ตัวอย่างวาง budget: หากกัน 20,000 จาก 100,000 requests/วันสำหรับ page entry, writes, analytics, admin, cleanup และส่วนเผื่อ จะเหลือ 80,000 สำหรับ live polling หน้า Post/Community ใหม่ใช้อย่างละ 120 requests ต่อการเล่น 15 นาที เท่ากับประมาณ **666 ช่วงเล่น 15 นาทีต่อวันเฉพาะ budget polling** นี่ไม่ใช่จำนวน concurrent players ที่รับรอง หากแต่ละคนเปิดหลายแท็บหรือเล่นหนึ่งชั่วโมง ตัวเลขคนจะลดลง ต้องวัด D1 scans/CPU และ traffic จริงควบคู่ด้วย

## จุดที่ตรวจพบแต่ยังต้องติดตาม

- Query Insights 1 วัน: `PRAGMA foreign_key_check` อ่านรวม 17,882 แถวจาก 8 ครั้ง เป็นงาน audit/QA ไม่ใช่ query ใน normal feed จึงไม่แก้ runtime จากตัวเลขนี้ ส่วน aggregate community placements อ่านเฉลี่ย 708 แถว และ templates list เฉลี่ย 207 แถวต่อครั้ง
- `template_reactions` totals และจำนวน template comments ยังเป็น aggregate ใน cold cache; shared snapshot ลดการอ่านซ้ำของผู้ชมพร้อมกัน แต่ยังไม่ทำให้ cold SQL เป็น O(1) หรือยืด cache ข้อมูลส่วนตัว
- Guest public responses/pools มี cache อยู่แล้ว และรูปใหม่มี `Cache-Control: public, max-age=31536000, immutable` static assets ของ Pages ไม่ต้องผ่าน Functions การ hit cache **ภายใน Function** ช่วย D1 แต่ยังใช้ Function invocation
- รูปยังเก็บผ่าน public `r2.dev` ซึ่ง Cloudflare ไม่แนะนำสำหรับ traffic Production มาก ควรผูก custom domain เพื่อใช้ cache สำหรับรูปเมื่อมีโดเมน การย่อรูปใหม่ช่วยพื้นที่/transfer แต่ไม่ลดขนาดรูปเก่าและไม่เปลี่ยน GIF/APNG/WebP ที่อาจ animated ไม่ตั้ง lifecycle ลบไฟล์ผู้ใช้โดยไม่ตรวจ reference
- Worker cleanup มี 2 exception ในวันดังกล่าว ขณะที่ invocation ส่วนใหญ่สำเร็จ ยังไม่ได้ระบุสาเหตุย้อนหลัง ไม่มีการอ้างว่า exceptions หายแล้ว
- Pages metrics ไม่แยก CPU ตาม endpoint ในชุดที่อ่าน และ HTTP 4xx/5xx ไม่จำเป็นต้องนับเป็น invocation exception การไม่มี exception จึงไม่เท่ากับทุก API สำเร็จ ยังไม่รับรอง CPU/runtime limits ทุกเส้นทาง
- ยังไม่ได้ทำ concurrent load test หรือ Browser QA Safari/Firefox/เครื่องมือถือจริง ไม่ได้แก้ quota ด้วยการเพิ่มเกณฑ์ tests หรือเปิดบริการเสียเงิน

## Validation

ผ่าน `npm run build` และ `npm run lint` (มี Fast Refresh warnings เดิม 4 รายการ) รวม standalone checks: `live-refresh.mjs`, `notification-polling.mjs`, `notification-badge-quota.mjs`, `notification-delete.mjs`, `notification-read-expiry.mjs`, `notification-cleanup-scheduled.mjs`, `social-updates.mjs`, `community-social-loop.mjs`, `verified-session-mutations.mjs`, `analytics-batching-idle.mjs`

`notification-quota-browser.mjs` ใช้ built UI + Pages Functions + D1 แยกใน Local พอร์ต 8791 ทดสอบ Chromium 390/1440 px: closed badge 30s, open list 10s, idle/resume, hidden/resume, mark-all-read จริง, สลับบัญชี และ Community ใช้ combined endpoint เพียงคำขอเดียวต่อ tick เวลาของ polling เร่งด้วย browser clock โดยไม่ได้ mock API responses และไม่ได้เขียนข้อมูล QA ลง Production

## Follow-up: ตรวจ API และหน้าจอเพิ่มเติม

ไล่ caller, timers, SQL, cache และ write paths ของ API ทุกกลุ่ม รวม route metadata และ Worker cleanup ผลการวัดต่อไปนี้มาจาก Local Miniflare/Chromium กับข้อมูล synthetic ไม่ใช่ load test บนเว็บจริง

| ชุดทดสอบ/fixture | ก่อน | หลัง |
| --- | ---: | ---: |
| Catalog 10 หัวข้อ / 2,000 rankings: preview index + MATERIALIZED | 10,148 rows read | 2,172 |
| Activity 2,000 rankings / 2,000 likes ของคนที่ติดตาม | 10,122 rows read | 323 |
| Catalog เปิด exact counters หลังติดตั้ง index แล้ว: 2,000 rankings | 2,173 rows read | 174 |
| Home cold 12 cards บน fixture exact counter เดียวกัน | 2,258 rows read | 261 |
| Post comments 250 รายการ / ส่งสูงสุด 200: cold → shared warm | 402 rows read | 1 |
| Community discussion fixture เดียวกัน: cold → shared warm | 653 rows read | 1 |
| รูป PNG synthetic 1600×900 | 4,941,411 bytes | 88,680 bytes (512×288) |
| รูป JPEG synthetic 1600×900 | 1,467,378 bytes | 79,270 bytes (512×288) |

ตัวเลข rows ไม่นับ middleware session lookup ผลของ indexes แลกกับ metadata-only ranking insert จาก 7→9 rows written และ exact counter เพิ่มจาก 9→10 อีกหนึ่งแถว ไม่ใช่จำนวน write ของโพสต์จริงที่มี placements/scores/notifications ทั้งชุด ต้องวาง read และ write budgets คู่กัน Backfill counter ใน fixture อ่าน 2,020 / เขียน 15 แถวครั้งเดียว

อ่าน aggregate บน Production เพิ่ม พบ legacy `templates.use_count` คลาดเคลื่อน **2 จาก 30 หัวข้อ** (SQL อ่าน 115 แถว เขียน 0) จึงไม่เปิด shortcut `HOME_PRECOMPUTED_TEMPLATE_COUNTS` หรือเอา mirror เก่ามาใช้กับ catalog ตัวนับใหม่แยกตารางและดูแลใน transaction ของฐานข้อมูล มี test เทียบกับ live COUNT พร้อม insert/move/delete, concurrent delete, profile/template cascades และ failed-batch rollback

| กลุ่มที่ตรวจ | การใช้ quota และการรักษาพฤติกรรม |
| --- | --- |
| rankings / votes / social-state | Home pool 48, preview 12, page 12, counters batch ≤40; รักษา cursor, seen, single-flight, write transactions และ vote privacy |
| templates / discover-pulse / spotlights | public cache ตาม route, bounded Pulse candidates, ranking preview counts ทุก tier, metadata mode ไม่โหลด community histogram; counter ใหม่ลด scans ของ uses |
| hashtags / categories | category เป็น compatibility alias; global tag aggregate ยังขึ้นกับจำนวนข้อมูลเมื่อ cold แต่ cache/autocomplete debounce ลดซ้ำ ไม่ตัดเหลือ sample จนผลค้นหาผิด |
| users / follows / topic-follows / profile-pins / bookmarks | Profile pagination/pins, lazy similar section และ viewer-specific cache อยู่เดิม ไม่แชร์ follow/bookmark state ข้ามบัญชี |
| activity | ไม่มี UI caller ปัจจุบันและไม่ poll; เก็บ API contract ไว้โดยลด scans ไม่ลบ endpoint |
| comments / template-comments / template-votes / notifications | shared public snapshot + fresh viewer state, counter-only badge, idle/hidden/offline gate, 24h retention และ reply preservation |
| template-participants / duels | งาน explicit ไม่ใช่ polling; Participants 500 คนยังอ่านประมาณ 11,498 แถว/278KB เพื่อคง filter/Excel export และ current-contribution semantics; Duel calculation/transaction regression ผ่าน |
| auth / upload | session primary-key lookup; ไม่ลดความแข็งแรง password/OTP เพื่อ quota; avatar compression ใช้ browser ส่วน server ยังตรวจ auth/type/signature/size |
| analytics / report / admin endpoints | analytics batch/idle/duplicate guard; admin badge ใช้ pending-count route อยู่แล้วไม่อ่าน dashboard เต็มทุกนาที; dashboard/tag aggregates เป็นงาน explicit, report archive ยังเก็บหลักฐาน |
| post/template/community metadata / API catch-all / cleanup Worker | metadata uses เปลี่ยนเป็น exact lookup ได้เมื่อเปิด flag; static assets ไม่ต้องเข้า API; catch-all ไม่ query D1; cleanup cron เดิมทุกนาที |

รอบ Browser QA เพิ่มใช้ built UI + real Local Pages Functions/D1 แยกที่พอร์ต **8792** โดยเปิดทั้ง `NOTIFICATION_UNREAD_COUNTS=true` และ `TEMPLATE_USAGE_COUNTERS=true` ตรวจ Discover tabs/loading/error/retry/empty/time windows/สลับหน้าระหว่างโหลด, Profile 0–100 posts/pins/pagination/user switch และ layout 320–1440px รวมคอมเมนต์สองบัญชี create/reply/delete, draft preservation, counts 0→1→2→1→0, notifications/ownership และ persistence หลัง refresh ไม่พบ uncaught runtime errors ใน scenarios นี้ มีภาพ QA ใน `.wrangler/browser-qa-quota-counters-20261010/` (Git ignored) การเปลี่ยนคอมเมนต์ไปอีกบัญชีในรอบนี้ใช้ประมาณ 9.55 วินาที

แก้ regression ที่ยังยึด copy เก่าของ Home/Participants/Discover และส่ง SQL splitter เข้า benchmark fixture scope ให้ถูกต้อง ไม่เปลี่ยนเกณฑ์ read/write budget หรือย่อ fixture เพื่อให้ผ่าน `avatar-upload-browser.mjs` ตรวจ Chrome codec จริง, ขนาด/ratio/transparency, animation และ fallback ส่วน backend Admin/Duel ตรวจด้วย regressions ไม่อ้างว่าได้ตรวจ UI ทุกหน้าของสองส่วนนี้

ผลรอบสุดท้าย: standalone regressions **96/96 ผ่าน**, Browser QA จริงของ Discover/Profile/Comments และ notification quota ผ่านทั้งเมื่อปิดและเปิด counter ใหม่, avatar Chromium check ผ่าน, Vite build, Pages Functions build และ lint ผ่าน (Fast Refresh warnings เดิม 4 รายการ) `git diff --check` ผ่าน ไม่มี raw QA files/secrets ถูกเพิ่มใน Git

### ก่อน deploy การแก้ชุดนี้

1. Preview D1 ต้องมี binding แยกจริง ตรวจ migration ledger แล้วติดตั้ง active migrations **0028** (indexes) และ **0029** (exact counters) ด้วย workflow migration ปกติ ไม่รัน legacy migrations ทั้ง directory
2. Verify `template_usage_counts` เทียบ live COUNT และ `PRAGMA foreign_key_check` ก่อนเปิด `TEMPLATE_USAGE_COUNTERS=true` ใน environment นั้น ต้องตรวจทุกครั้งหลัง migration; flag default ปิด ไม่เปลี่ยน Production config ใน audit นี้
3. Deploy Preview และ smoke test ก่อน Production; โค้ด rollback ได้โดยปิด flag ตาราง/triggers additive คงอยู่ได้ ไม่ drop ข้อมูลเพื่อ rollback UI

ในรอบ audit เดิมยังไม่ได้ commit/push/deploy หรือเขียน Production D1 ต่อมาผู้ใช้อนุมัติ deploy และตรวจเว็บจริง: ติดตั้ง migration 0028/0029, เปิดตัวนับใหม่ และผ่าน Preview/Production QA บน Cloudflare แล้ว รวมทั้งแก้ Discover ที่ Pulse cache อ้างหัวข้อถูกลบ รายละเอียดผลจริงและข้อจำกัดล่าสุดอยู่ใน [รายงาน release](deployment-quota-2026-10-10.md)

ยังไม่รับรองจำนวนผู้ใช้สูงสุดหรือว่า Free quota จะไม่มีวันหมด Requests/CPU ต้องวัดตามเวลาที่เล่นจริง, จำนวนแท็บ, cache colo และขนาดข้อมูล ข้อจำกัดที่เหลือคือ concurrent traffic จริง, Safari/Firefox/มือถือจริง, hidden/offline บน browser จริง (logic มี unit coverage), Admin actions/Duel flow ที่ไม่ได้ตรวจครบ และสาเหตุ exceptions ย้อนหลังของ cleanup Worker

## เอกสาร Cloudflare ที่ตรวจเมื่อทำ audit

- [Workers pricing: daily requests/CPU และ D1 quota](https://developers.cloudflare.com/workers/platform/pricing/)
- [Pages Functions pricing: shared Workers quota และ static requests](https://developers.cloudflare.com/pages/functions/pricing/)
- [D1 pricing: rows read/written และ storage](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 pricing: free Standard allowance และ operation classes](https://developers.cloudflare.com/r2/pricing/)
- [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/), [Pages metrics](https://developers.cloudflare.com/pages/functions/metrics/), [R2 metrics](https://developers.cloudflare.com/r2/platform/metrics-analytics/)
- [R2 public access limitations](https://developers.cloudflare.com/r2/platform/limits/)
