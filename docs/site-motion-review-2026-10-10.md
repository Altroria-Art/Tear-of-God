# Motion review — 10 ตุลาคม 2026

ตรวจเพื่อเสนอจุดเพิ่ม/ปรับแอนิเมชันตามคำขอผู้ใช้ รอบนี้ยังไม่เพิ่มแอนิเมชันใน production source และไม่ deploy รักษางาน UX/Discover บน branch `codex/discover-full-boards`

## หลักฐานและวิธีดู

- ไล่ routes ใน `src/App.jsx`, ทุก page component และ components ของ navigation, feed, editor, comments, share, auth และ admin ร่วมกับ CSS ที่ใช้อยู่
- ตรวจภาพ Local จาก QA รอบล่าสุดของ Home, Discover, Create, Profile, Duel, Post และ Dashboard; อ่านผล route coverage เดิมประกอบ แต่ไม่ถือภาพนิ่งเป็นหลักฐานการเคลื่อนไหว
- เปิด Pages Functions/D1 Local ที่พอร์ต 8797 ด้วย QA state เดิมที่แยกจากเว็บใช้งาน 8788 ใช้บัญชีสังเคราะห์ใน QA และ browser contexts แยก guest/member/admin
- Browser motion inspection ดู 40 route/state cases × 390/1440px × normal/reduced motion ตรวจ computed styles และทดลอง Home demo, Discover next และ shared Modal จริง มี physical mouse drag probe ของช่อง tier สูงสุดเพิ่มเติม ผลและขอบเขตบันทึกท้ายเอกสาร
- ไม่วัด FPS/พลังงานบนมือถือจริงในรอบนี้ ข้อเสนอด้าน performance เป็นแนวทางจาก implementation ไม่ใช่ benchmark

## ทิศทางที่เหมาะกับเว็บ

ให้การ **จัดอันดับ** เป็นแอนิเมชันที่จำได้: รายการลงช่องอย่างมีน้ำหนัก, สถานะตอบสนองทันที, ผลเทียบอันดับเปิดเผยเป็นลำดับ ส่วนข้อความและบอร์ดที่กำลังอ่านให้นิ่ง แอนิเมชันเด่นใช้เมื่อผู้ใช้ทำอะไรสำเร็จหรือเปิดผลครั้งแรก

ส่วนที่อ่านเยอะ เช่น 500 รายการ คอมเมนต์ และตารางแอดมิน ใช้เอฟเฟกต์กับรายการที่เปลี่ยนเท่านั้น ไม่เริ่มแอนิเมชันทั้งชุดทุกครั้งที่ poll, pagination หรือ virtualization remount

## ตรวจแต่ละพื้นที่

| พื้นที่/หน้า | มีอยู่แล้ว | ข้อเสนอ | ลำดับ |
|---|---|---|---|
| Create / Rank | Item enter, drag preview, insertion marker, drop-zone highlight, native progress | รายการสไลด์เข้าช่อง/เข้าตำแหน่งใหม่ 180–240ms; ปุ่มโพสต์ตอบสนองครั้งเดียวเมื่อเปลี่ยนจากจัดไม่ครบเป็นครบ; success mark หลัง API รับโพสต์สำเร็จ | 1 |
| Home | Page fade, demo reveal ครั้งแรก, CTA press/hover, reaction pop | ทำให้การกดสลับรายการใน demo เห็นรายการย้ายจริง; active pill ของแท็บเลื่อน 180–220ms; คง feed ที่เลื่อนอ่านให้นิ่ง | 1 |
| Discover Popular/New/Active/search/saved | Squeeze slide/width 1000ms, bookmark pop, page fade, loading pulse | เกลา slide ให้ไวและสัมพันธ์กับการปัด; active pill ของแท็บเลื่อน; เนื้อหาบอร์ดที่เลือก fade 140–180ms; ปุ่มขยายหมุน chevron เบา ๆ โดยไม่ animate บอร์ด 500 รายการทั้งความสูง | 1 |
| Duel | Header tear reveal, page fade, button feedback | เปิด avatars → คะแนน → สรุป/รายละเอียดเป็นลำดับใน 400–600ms; แถบผล scaleX จาก 0 ถึงค่าจริง; ตัวเลขผลจริงยังอ่านได้และไม่ถูกประกาศทุกเฟรม | 1 |
| Post / Community / Topic comments | Shared Modal, vote state, loading | คอมเมนต์/คำตอบใหม่ fade + เลื่อน 4px 160–200ms และ highlight สั้น; reply context ปรากฏนุ่มขึ้น; ไม่ replay คอมเมนต์เก่าหรือแย่ง scroll ขณะอ่าน | 1 |
| Profile own/other | Page fade, edit Modal, follow press, card hover | เปลี่ยนแท็บด้วย indicator เดียว; pin/unpin ใช้ motion เฉพาะการ์ดที่ย้ายและรักษา focus; บันทึกโปรไฟล์สำเร็จมี check สั้น; badge ที่เพิ่งได้เปิดเผยครั้งเดียว | 2 |
| Community average/chart | Tier rows reveal มี stagger, item Modal | แถบกราฟเปิดครั้งเดียว 300–450ms แล้วอัปเดตค่าที่เปลี่ยนเท่านั้น; คง TierLabel/สีข้อมูลและ custom labels; ไม่ reveal ทุก item ในกราฟ | 2 |
| Topic detail / Post detail | Page fade, shared item Modal, keyboard votes | คงบอร์ดนิ่ง; vote feedback สอดคล้องกับ Home; comment destination highlight ส่วนหัวเมื่อเข้า #comments ไม่กระพริบทุกครั้งที่โหลด | 2 |
| Notifications | Menu popover, loading, count/status | count/icon ตอบสนองสั้นเฉพาะเมื่อมี ID ใหม่; mark read ลดความเด่นของแถว; ลบแถวหลัง API สำเร็จด้วย fade สั้นและรักษา focus | 2 |
| Navbar / Mobile bottom nav | Popover, active background, hover/press | indicator ของหน้าปัจจุบันเลื่อน 160–200ms; icon ตอบสนองเฉพาะครั้งที่กด; ปุ่ม Create หมุนเครื่องหมาย + เบา ๆ เมื่อ hover/focus | 2 |
| Popular templates / Hashtags / Hashtag detail / category alias | Page fade, hover, sort popover/pagination | ผลจาก filter/sort fade 120–160ms ครั้งเดียวต่อชุดข้อมูล; reveal เฉพาะการ์ดแรก 4–6 ใบถ้าจำเป็น; loading skeleton ขนาดตรงกับเนื้อหาจริง | 3 |
| Participants | Page fade, filter/selection states, loading | อัปเดตจำนวนผล/selection นุ่มขึ้น 120–160ms; ไม่เลื่อนตำแหน่ง checkbox/rows เพื่อหลบ pointer; คง export state ชัด | 3 |
| Login / Signup | Desktop book 950ms, form opacity, page fade | คงหนังสือเป็น signature; เกลา timing ของข้อความ/หน้าใบเดียวให้สัมพันธ์กัน ไม่เพิ่มหลายชั้น; มือถือใช้ crossfade สั้นแทน flip 3D | คงไว้ |
| Forgot / Reset / OTP | Slot-to-orbit, checking spin 5.6s ต่อรอบ, success check pop, minimum verification 2s | คงเวลา/การส่งรหัสเดิม; error emphasis สั้นหนึ่งครั้งพร้อมข้อความชัด หากเพิ่ม shake ต้องระยะเล็กและปิดเมื่อ reduced motion | คงไว้ |
| Share / Export / Badge gallery / User lists | Shared Modal, button states, progress/loading | copy-success icon 160–200ms; preview fade เมื่อภาพใหม่พร้อม; ตำแหน่งปุ่ม/preview ไม่ขยับระหว่าง export | 3 |
| Admin Dashboard / Users / Rankings / Templates / Reports | Page/Modal/popover, hover, progress widths บางจุด | เปลี่ยนสถานะแถวให้เห็นก่อนย้ายรายการ; success/error feedback 120–160ms; คงข้อมูล pending/resolved อ่านชัด; ตาราง/ตัวเลขไม่เล่นซ้ำเมื่อ refresh | 3 |
| Empty / missing resource / 404 / ErrorBoundary | Page fade และทางกลับ | ไอคอนหรือมาสคอตเผยตัวครั้งเดียว 220–300ms เฉพาะ empty/404 ถ้าต้องการ; error ทางเทคนิคคงเรียบ เน้น Retry | 3 |

## 5 จุดแรกที่ให้ผลคุ้มที่สุด

1. **รายการลง tier และการเรียงใหม่**: เป็นกิจกรรมหลักของเว็บ มีเอฟเฟกต์เดิมแล้วแต่ยังขาดการย้ายจากตำแหน่งเก่าไปตำแหน่งใหม่ที่มองตามได้ ใช้ FLIP เฉพาะรายการที่มองเห็น ไม่อ่าน layout ของ 500 รายการทุกเฟรม ไม่ transform ทั้งบอร์ดระหว่างลาก
2. **แท็บ Home / Discover / Profile**: pill หรือเส้นใต้เดินไปหาแท็บที่เลือก ใช้ pattern เดียวกัน ขนาดแท็บยังเท่าเดิมและกดได้ทันที; ไม่ remount ทั้งหน้าเพื่อให้เกิดเอฟเฟกต์
3. **Duel result**: ทำเป็นช่วงเปิดผลที่มีบุคลิกชัด แต่ไม่บังคับรอให้ animation จบก่อนกดปุ่ม อ่านผลจริงได้ทันที และไม่ใช้แอนิเมชันกับทุกแถวใน breakdown
4. **คอมเมนต์ใหม่/ตอบกลับ/แจ้งเตือนใหม่**: feedback ช่วยให้เห็นว่าข้อมูลเข้ามาแล้ว ไม่เพิ่ม polling ไม่ทำให้รายการเก่าเต้นตาม และไม่ scroll ไปคอมเมนต์ใหม่ถ้าผู้ใช้กำลังอ่านข้อความอื่น
5. **โพสต์อันดับสำเร็จ**: check และเศษสติกเกอร์เล็ก ๆ ครั้งเดียว 500–700ms หลังเซิร์ฟเวอร์ยืนยันสำเร็จ จำกัดจำนวนตกแต่ง เช่น 8–12 ชิ้น CSS ไม่ยิง confetti เต็มจอ ไม่เล่นตอนแค่กดส่ง/คำขอล้มเหลว

## จุดที่ควรเกลาก่อนเพิ่ม

### CSS ทับซ้อน

- `src/index.css` มี `@keyframes item-enter` สองชุด (ประมาณบรรทัด 399 และ 610) ชุดท้ายเป็นตัวกำหนด keyframes จริง ให้เหลือชื่อและรูปแบบเดียวเมื่อเริ่ม implementation
- `.dialog-panel` มี animation ใน unlayered CSS และ `@layer components` อยู่คนละชุด; runtime ใช้ `ui-panel-enter` 220ms ควรมี motion source of truth เดียว
- Reaction มีเอฟเฟกต์ที่ปุ่มทั้งอันและ SVG/count ลูกพร้อมกัน ควรเลือกชั้นหลักหนึ่งชั้นเพื่อไม่ให้ scale ซ้อนแรงเกิน; ทดสอบ hover, click, keyboard, rollback และ selected state ที่โหลดมาจาก API ด้วย
- อย่าลบ keyframes/utility เพียงเพราะไม่เห็นใน screenshot ต้องตรวจ usages และ mounted states เช่น OTP checking และ Modal

### Discover

`.squeeze-track` ใช้ transform 1000ms และ `.squeeze-panel` ใช้ width 1000ms จริงใน browser การ animate width มีงาน layout จึงควรวัดในเครื่องช้าหลังปรับ ไม่สรุปว่าใช้ GPU อย่างเดียว

เสนอทดลอง 450–650ms สำหรับกดลูกศร และจังหวะสั้นสำหรับ swipe; เป็นข้อเสนอ ยังไม่ได้เปลี่ยน 1000ms ที่อ้างอิงตัวอย่างเดิม ไม่เปิด autoplay เพราะผู้ใช้กำลังอ่านอันดับและกดรายการ

การขยายบอร์ดจาก 600px ถึงความสูงหลายพันพิกเซลควรเปลี่ยน layout แล้ว fade เฉพาะเนื้อหาที่เปิดและหมุน chevron ไม่ interpolate ความสูงของ 500 รายการทั้งก้อน

### Editor

พบปัญหาจริงใน `DropZone`: หลัง physical mouse drag เข้า tier สูงสุด browser เริ่ม `top-tier-snap` 420ms แต่ `item-enter` ของรายการลูกจบที่ 220ms แล้ว bubble เข้า `onAnimationEnd` ของ zone ทำให้ `is-landed` ถูกล้างก่อนเอฟเฟกต์ zone จบ (`top-tier-snap` ไม่มี animationend ของตัวเองใน probe) ควรกรอง target/animation name ให้ zone จบตามตัวเองก่อนเพิ่ม celebration หลักฐานอยู่ใน `drop-motion-probe.json` ของ QA state ไม่กระทบการจัดอันดับจริง แต่ทำให้ feedback ขาดตอน

Toast มี exit timer 200ms ขณะที่ transition class ใช้ 300ms เป็นอีกจุดควรเกลา timing ให้ตรงกันเมื่อปรับ shared motion; ข้อนี้พบจาก source ยังไม่ได้วัดจังหวะปิด Toast แยกในรอบนี้

Transition ของจำนวน/สี success ต้องสัมพันธ์กับ state ที่สำเร็จจริง ไม่เปลี่ยนการ validation, pending guards, เวลา OTP หรือ cooldown เพื่อให้เอฟเฟกต์ดูนานขึ้น

### Feed และ background updates

Home ใช้ virtualized feed อย่าใส่ entrance animation ทุกครั้งที่ DOM card กลับเข้าหน้าจอ ใช้ seen IDs ที่มีขอบเขตต่อ view ถ้าจะ reveal ครั้งแรก และไม่ให้ likes/comments counters แอนิเมตเมื่อค่าไม่เปลี่ยน

## กติกาของชุดแอนิเมชัน

- Feedback ปุ่ม/ไอคอน: 120–200ms; เปลี่ยนเนื้อหา/Modal: 180–240ms; ผลสำเร็จ/ผล Duel: 400–700ms
- ใช้ tokens สำหรับ duration/easing แล้วทำเอฟเฟกต์เด่นเฉพาะ editor/Duel/success การอ่านเนื้อหาใช้จังหวะสงบ
- เริ่มด้วย CSS transform/opacity และ observers เฉพาะส่วนที่จำเป็น ไม่มี animation framework/API/schema/polling ใหม่
- Decorative motion ไม่มี keyboard focus/aria announcements/เงื่อนไขทำงาน; screen reader รับผลจริงครั้งเดียว ไม่ประกาศตัวเลข count-up ทุกเฟรม
- รองรับ `prefers-reduced-motion`: ตัดการเลื่อน/หมุน/scale แต่ยังมีข้อความ สี และสถานะสำเร็จ/ล้มเหลวที่เข้าใจได้
- Background/offscreen ต้องไม่วิ่งเอฟเฟกต์ตกแต่งต่อ ไม่ใส่ infinite float/pulse/glow ให้ทุก card
- ชื่อ tier เป็นข้อมูล custom/ไทย: celebration ของ tier สูงสุดผูกกับ index/data ไม่ hardcode ชื่อ `S`
- ไม่ทำให้ปุ่ม/ช่องกรอกเปลี่ยนตำแหน่งใต้ pointer ขณะกด ไม่ทำให้ focus/scroll/hash destination เปลี่ยน และไม่ใช้ animation เป็นเวลารอจำลอง
- หลัง implementation ตรวจ normal/reduced motion, touch/mouse/keyboard, dark/light/EN/TH, สลับแท็บเร็ว, failure/retry, duplicate mutation, virtualized remount และบอร์ด 500 รายการ แล้วทำ Browser QA/Build/Lint ที่เกี่ยวข้อง

## ผล Browser inspection รอบนี้

Chromium 154.0.8037.98 ตรวจครบ **40 route/state cases × 390/1440px × normal/reduced motion = 160 กรณี** ในภาษาไทย/ธีมสว่าง ไม่มี runtime exception ขณะตรวจ mounted content และ reduced-motion duration checks ทั้ง 80 กรณีผ่าน ผลนี้ไม่ได้ตรวจทุก conditional interaction หรือทุก animation ขณะ loading/checking การตรวจภาษา/ธีมอื่นอ้างขอบเขต QA รอบก่อน ไม่ถือว่ารันซ้ำในรอบนี้

- Discover next: track ใช้ `transform` 1s และหลาย panel เปลี่ยน `width` พร้อมกันจริง
- Shared Modal: computed animation เป็น `ui-panel-enter` 0.22s
- Home demo: แอนิเมชัน reveal `demo-snap` ทั้งสามอยู่ในสถานะ finished ก่อนและหลังสลับรายการ (380/510/640ms) ข้อความสลับจริง แต่ไม่มีการย้ายตำแหน่งรายการจาก tier เดิมไป tier ใหม่ มี button transition ขณะกด หลักฐานแยกใน `home-motion-probe.json` เพื่อไม่สับสนกับ completed animations ที่ยังอยู่ใน `getAnimations()` เพราะ fill mode
- Physical drag ของ Rank: ยืนยัน zone feedback ถูก child animationend ตัดที่ 220ms ตามรายละเอียดข้างบน ไม่กด Publish และไม่สร้างอันดับบน backend

ผลอยู่ใน `.wrangler/browser-qa-site-20261010/motion-inspection.json`, `home-motion-probe.json`, `drop-motion-probe.json` ที่ Git ignore แยกจาก 800 ชุดของรอบ UX ก่อนหน้า รอบนี้ตรวจ motion/rendered styles ไม่ใช่การรัน regression ทั้งระบบซ้ำ ไม่มีการแก้ production source/ติดตั้ง dependencies และหยุดเซิร์ฟเวอร์ QA ที่เปิดเองเมื่อปิดการตรวจ
