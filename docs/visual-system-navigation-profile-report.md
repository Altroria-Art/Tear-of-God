# Visual system, Navigation และ Profile

เริ่มจาก `origin/main` ที่ `9b71f22` หลัง merge PR #144 บน branch `codex/visual-system-navigation-profile` งานนี้ปรับ presentation และ navigation ของเว็บเดิม ไม่มี feature ใหม่

## 1. Visual inconsistencies ที่พบ

ตรวจ browser ก่อนแก้ครบ Home, Discover, All Topics, Topic Detail, Rank, Create, Post, Community, Profile และ Login ทั้ง Light/Dark แล้วพบการ์ดขอบดำกับเงาเยื้องหลายชุด, Quick Add พื้น cyan, ปุ่ม signup สี pink, หัวเรื่องขนาดต่างกัน และ Profile มี generic hero ตามด้วย passport, education และส่วนโปรโมต ก่อนโพสต์จริง

## 2. Design rules

ให้เนื้อหาและ action เป็นตัวนำ ลดการหมุน, เงาเยื้อง, glow และพื้นที่ตกแต่ง ใช้ surface/border/control token เดิมร่วมกัน คง mascot, wordmark, accent สีม่วงขนาดเล็ก และสี tier จากข้อมูลจริง

## 3. Palette roles

| บทบาท | หลังแก้ |
| --- | --- |
| พื้นหลัก | Charcoal ใน Dark / cream ใน Light |
| Primary action และ selected navigation | Acid lime `#D8FF45` |
| Personality | Violet ใน eyebrow, brand mark และ detail ขนาดเล็ก |
| Secondary actions | พื้น neutral, ขอบบาง, ข้อความอ่านชัด |
| Tier labels | ใช้ `resolveTierColor()` และ `<TierLabel>` ตาม `color` ของ tier |

เอา cyan ออกจาก Quick Add และ pink ออกจากปุ่ม signup/เงาแผง Login ไม่เปลี่ยนสีข้อมูล tier, vote หรือ status

## 4. Card / button / type system

- Shared cards ใช้ radius 16px, ขอบ 1px และ `--shadow-panel`; ลด hover ที่ยกทั้งการ์ด
- Primary buttons ใช้ lime + dark ink, สูงอย่างน้อย 44px, radius 12px, ไม่มีเงาเยื้อง; hover เปลี่ยนสีเบา ๆ
- Secondary buttons ใช้ neutral surface และ radius เดียวกัน
- ลดขนาดหัวเรื่อง Create/Post/Login และใช้ฟอนต์ sans ของโปรเจ็กต์เดิม ไม่เพิ่ม font dependency
- ลด uppercase ในหัวเรื่องหลักและเอา sticker treatment ออกจาก generic page eyebrow
- TierLabel ไม่มี outer glow; เอา inset shadow หนาออกจาก Create ด้วย ยังคง custom labels/สีจากข้อมูล
- Export และ Duel ในแถบ action ที่เกี่ยวข้องมีข้อความกำกับ
- Avatar ที่โหลดรูปไม่ได้กลับไปแสดง initials/glyph แทน broken image
- ลบ CSS ของ passport, hero, promotional ticket และ lead tile ที่ Profile ไม่ใช้อีกแล้ว รวมกฎ shared card/primary button ที่ซ้ำ

## 5. Desktop navbar

ก่อนแก้เป็น Home → Rank/Create → Discover หลังแก้เป็น Home → Discover → Create คง search, account menu และ routes เดิม ใช้ `aria-current` และ selected lime underline รวมถึงให้ Create เป็น current บน `/rank`

## 6. Tablet navigation

เดิม desktop nav เริ่ม 1024 แต่ bottom nav หายตั้งแต่ 768 หลังแก้ bottom nav อยู่ถึง 1023 และ desktop nav เริ่ม 1024 ตรวจ 768, 820 และ 1024 จริงแล้ว ไม่มี primary nav สองชุดพร้อมกัน

Create/Rank คง editor toolbar แทน bottom nav และมี Discover ในเมนูรองสำหรับกลับไปเลือกหัวข้อ ส่วนโลโก้ยังกลับ Home ได้

## 7. Mobile bottom nav และ hamburger

Logged in: Home / Discover / Create / Profile

Guest: Home / Discover / Create / Log in

Hamburger มี mobile search, Saved, language และ theme; ไม่สำเนา Home/Create/Profile ซ้ำกับ bottom nav มี `aria-expanded`/`aria-controls`, เปิดแล้ว focus search, Escape ปิดและคืน focus, click ด้านนอกปิดได้ Ctrl+K เปิด search ตาม breakpoint ทดสอบ utility ด้วยบัญชีที่ login แล้วเพื่อป้องกัน outside-click handler ปิดเมนูก่อนปุ่มทำงาน

## 8. Profile hierarchy

ก่อน: generic hero → passport/education/taste/sidebar → intro/create ticket/pinned cards → posts

หลัง: avatar → username/badge → bio → Follow/Edit → followers/following → metadata บรรทัดเล็ก → Rankings → Taste summary/badges → education disclosure

Identity เป็นแนวนอนบนจอใหญ่และ stack แบบกระชับบนมือถือ ลบ `A TASTE OF YOU.` และส่วน intro ที่ซ้ำ ชื่อบัญชีเป็นหัวเรื่องจริง การ์ดโพสต์มีขนาดสม่ำเสมอ ไม่ทำโพสต์แรกเป็น poster ขนาดสองช่อง

Pinned อยู่ในรายการโพสต์ที่จัดลำดับเดิมพร้อม marker และ tab กรอง แทนการ์ดซ้ำในอีก section ส่วน Duel ยังอยู่ใน tab รอง ทุก handler/fetch/follow/edit/pin/equip/duel เดิมยังอยู่

Taste summary อธิบายว่าเป็นหัวข้อและ favorites จากการจัดอันดับ แสดง hashtags/ชื่อ item ก่อน details; เอา progress bars และ badge S ที่ไม่ได้มาจากข้อมูล tier ออกจาก modal ไม่เปลี่ยนการคำนวณ

## 9. Saved อยู่ที่ไหน

ยังอยู่ใน Discover และ hamburger เพิ่มทางเข้าใน own Profile ทั้งหมดใช้ route เดิม `/discover?view=saved` ไม่แก้ bookmark storage หรือ API Guest เห็นคำแนะนำให้ login ตามเดิม

## 10. Recorded views

เปลี่ยน `common.views` และ `template.views` รวม EN plural forms เป็น “Recorded views” / “การเข้าชมที่บันทึก” Topic Detail ยังแสดง metric นี้ ส่วน TemplateCard ซ่อนยอดชมและคงจำนวน rankings ที่ช่วยตัดสินใจ ไม่เปลี่ยน backend counter หรือ query

## 11. Responsive QA

ทดสอบ local full stack ที่ port 8788 ด้วย browser จริง ใช้ข้อมูลที่มีอยู่และ Google session ที่ผู้ใช้ login ให้เอง ไม่ submit Follow/Edit/Pin/Publish/Like/Delete

ตรวจ 11 หน้า × 11 viewport × Light/Dark = **242 layout cases**: `/`, `/discover`, `/discover/templates`, `/create`, Topic Detail, Rank, Post, Community, own Profile, another Profile และ Login จากนั้นตรวจเฉพาะจุดซ้ำหลังเก็บ selected navigation และ desktop Create current state

| Viewport | Light | Dark | Primary navigation |
| --- | --- | --- | --- |
| 320×568 | ผ่าน | ผ่าน | Bottom nav |
| 360×740 | ผ่าน | ผ่าน | Bottom nav |
| 375×812 | ผ่าน | ผ่าน | Bottom nav |
| 390×844 | ผ่าน | ผ่าน | Bottom nav |
| 412×915 | ผ่าน | ผ่าน | Bottom nav |
| 430×932 | ผ่าน | ผ่าน | Bottom nav |
| 768×1024 | ผ่าน | ผ่าน | Bottom nav |
| 820×1180 | ผ่าน | ผ่าน | Bottom nav |
| 1024×768 | ผ่าน | ผ่าน | Desktop |
| 1280×800 | ผ่าน | ผ่าน | Desktop |
| 1440×900 | ผ่าน | ผ่าน | Desktop |

Create/Rank ใช้ editor navigation ตามข้อ 6 ผลวัดขนาดจริงตรงกับ viewport ที่ร้องขอและไม่พบ positive horizontal overflow ใน matrix ดู [ข้อมูลตรวจจริง](../artifacts/visual-system-navigation-profile/responsive-audit.json)

ตรวจเพิ่มภาษาไทย Home/Profile/own Profile/Community ที่ 320, 390, 820 ทั้งสอง theme, guest nav ที่ 320/390/768/820/1024 และ Dark ที่ 390/820/1024, guest Saved entry, Ctrl+K และ query ภาษาไทย, Discover ทั้ง quiet และ populated Last week, Profile editor, Duel tab, education disclosure, ชื่อยาวที่สุดในข้อมูล local และ empty Profile

ที่ 360/390 จุดเริ่มการ์ดโพสต์อยู่ประมาณ y=542 สำหรับอีกบัญชี และ y=565 สำหรับ own Profile อยู่ในจอแรกก่อน bottom nav ข้อความไทยยาว wrap ได้ ป้าย preview item ยังคง clamp ตามเดิม จอ 320 ใช้การ์ด Profile หนึ่งคอลัมน์ ท้าย education อยู่เหนือ bottom nav เมื่อ scroll ถึงท้ายหน้า

ข้อจำกัดข้อมูล: local มี Profile สูงสุด 7 rankings, ชื่อยาวสุด 22 ตัวอักษร และไม่มี populated `profile_pins` จึงใช้ existing empty/public profiles สำหรับ browser และ regression fixtures สำหรับ off-page pins/deduplication ไม่ seed หรือเปลี่ยนฐานข้อมูลเพื่อสร้างสถานะเหล่านี้

## 12. Accessibility

- วัด header buttons 44×44px, bottom nav links สูง 52.5px และ Follow สูงกว่า 44px เพิ่ม minimum ของ search และ TemplateCard share
- ตรวจ keyboard search, Escape focus return, Profile tabs และ editor modal โดยไม่บันทึกข้อมูล
- `aria-current` แยก own Profile จากการดูคนอื่น, tabs/follow มี `aria-pressed`, pin มี accessible name
- Selected navigation มี underline/weight เพิ่มเติมจากสี และ labels ไม่ truncate ใน bottom nav
- Primary lime/dark ink วัด contrast ได้ 14.5:1; Dark selected Discover ได้ 9.32:1
- คงกฎ `prefers-reduced-motion` เดิมและลด transform ใน shared card/button ตรวจ CSS path; ไม่ได้เปลี่ยน OS preference เพื่อจำลอง reduced motion

## 13. Build / lint / tests

`npm run build` ผ่าน และ `npm run lint` ผ่าน ไม่มี error มี Fast Refresh warnings เดิม 4 รายการใน context/Toast

ผ่านทั้งหมด:

```text
node tests/local/editor-detail-regression.mjs
node tests/local/auth-regression.mjs
node tests/local/community-item-identity.mjs
node tests/local/community-social-loop.mjs
node tests/local/discover-pulse.mjs
node tests/local/template-card-preview-shapes.mjs
node tests/local/template-card-preview-comprehensive.mjs
node tests/local/page-meta-regression.mjs
node tests/local/profile-pagination-regression.mjs
node tests/local/profile-card-hashtags.mjs
node tests/local/profile-links-audit.mjs
node tests/local/primary-navigation-regression.mjs
node tests/local/profile-pinned-presentation.mjs
```

Auth/Discover ใช้ Miniflare D1 ชั่วคราวแยกจากฐานข้อมูล local; ต้องอนุญาต loopback หลัง sandbox ปฏิเสธการเชื่อมต่อรอบแรก ไม่ส่ง email New navigation test ครอบคลุม guest/owner/other profile/Saved/editor/route boundaries; pinned presentation test ครอบคลุม order, off-page pins, duplicate loaded pin และ empty state

## 14. Screenshots ก่อน / หลัง

เก็บก่อนแก้ครบ 10 หน้าที่ 1280 ทั้งสอง theme ภาพหลังมี desktop/mobile, own Profile, tablet, ภาษาไทย, guest และ edge states ใน [evidence directory](../artifacts/visual-system-navigation-profile/)

| หน้า (Light 1280) | ก่อน | หลัง |
| --- | --- | --- |
| Home | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-home-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-home-1280.jpg) |
| Discover | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-discover-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-discover-1280.jpg) |
| All Topics | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-topics-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-topics-1280.jpg) |
| Topic Detail | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-topic-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-topic-1280.jpg) |
| Rank | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-rank-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-rank-1280.jpg) |
| Create | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-create-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-create-1280.jpg) |
| Post | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-post-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-post-1280.jpg) |
| Community | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-community-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-community-1280.jpg) |
| Profile | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-profile-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-profile-1280.jpg) |
| Login | [ก่อน](../artifacts/visual-system-navigation-profile/before-light-login-1280.jpg) | [หลัง](../artifacts/visual-system-navigation-profile/after-light-login-1280.jpg) |

Mobile Profile: [ก่อน](../artifacts/visual-system-navigation-profile/before-light-profile-390.jpg) / [หลัง](../artifacts/visual-system-navigation-profile/after-light-profile-390.jpg); [own ก่อน](../artifacts/visual-system-navigation-profile/before-light-own-profile-390.jpg) / [own หลัง](../artifacts/visual-system-navigation-profile/after-light-own-profile-390.jpg)

เพิ่มเติม: [tablet](../artifacts/visual-system-navigation-profile/after-light-own-profile-820.jpg), [Thai](../artifacts/visual-system-navigation-profile/after-light-th-own-profile-390.jpg), [Dark Profile](../artifacts/visual-system-navigation-profile/after-dark-profile-390.jpg), [empty](../artifacts/visual-system-navigation-profile/after-light-empty-profile-content-320.jpg), [long name](../artifacts/visual-system-navigation-profile/after-dark-long-name-profile-320.jpg), [populated Discover](../artifacts/visual-system-navigation-profile/after-dark-discover-last-week-390.jpg), [guest](../artifacts/visual-system-navigation-profile/after-guest-home-820.jpg)

ก่อน audit ส่วนใหญ่เป็น guest; หลัง audit รวม session ที่ login แล้ว จึงมี account/notification controls และ Community comparison ของบัญชีที่ใช้ตรวจ

## 15. Intentionally ไม่แก้

ไม่มี schema/migration, manual database mutation, auth backend, Community/ranking/recommendation algorithm, notification behavior, Duel logic, Profile API rewrite, Admin redesign, UI framework หรือ font ใหม่ ไม่ deploy production และไม่ merge PR

คง editor workflow/sticky publish controls, item preview clamp, custom tier colors, timestamps, pagination, bookmark และ existing account operations ส่วน decoration เล็ก ๆ ของ mascot/brand ยังอยู่เพื่อรักษา personality ของเว็บ
