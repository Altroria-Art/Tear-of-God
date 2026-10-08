# Production vs Experimental — UX/UI comparative audit

วันที่ตรวจ: 8 ตุลาคม 2026 · Audit เท่านั้น

## 1. Executive verdict

**Final product ควรใช้ HYBRID: ใช้โครงสร้างและภาษาของ NEW เป็นฐาน คืนบุคลิกของ OLD เฉพาะจุดที่ช่วยให้จำแบรนด์และเข้าใจสิ่งที่กดได้ และออกแบบ Profile ใหม่อีกหนึ่งรอบ**

ไม่แนะนำ revert ทั้งเว็บ และไม่แนะนำรับ NEW ทั้งชุดโดยไม่ปรับ จุดที่ NEW ชนะชัดคือความหมายของ Topic/Ranking, เส้นทาง “Rank mine → See community”, ลำดับใน editor และ navigation ที่ 820px จุดที่ OLD ชนะคือ Home hero ที่มีตัวตน, ความเป็นของเล่นที่จับต้องได้ของ primary CTA และแนวคิดให้ identity/taste อยู่ข้างผลงานบน desktop

NEW ลดเสียงรบกวนได้จริง แต่บางส่วนกลายเป็นกล่อง cream มุมมนที่มีน้ำหนักใกล้กันเกินไป โดยเฉพาะ Home, Discover และ Quick Add อย่างไรก็ตาม NEW ไม่ได้สูญเสีย personality ทุกหน้า: Login/Register ยังมี mascot และ charcoal panel ชัดเจน และ tier colors ยังทำให้ตัวเนื้อหามีชีวิต จึงไม่ควรคืนกรอบหนาให้ทุก component

ประเด็นที่ควรจัดการก่อน final design:

1. **P1 — Auth mode state:** Login password carry ไป Register และกลับ Login; confirm password ค้างข้าม mode ต้อง clear เมื่อเปลี่ยน mode ส่วน email เก็บไว้ได้ และ username ปัจจุบันไม่ได้ถูกสร้างจาก Login
2. **P1 — Profile discovery:** Taste/Education อยู่หลังรายการทั้งหมดที่โหลด; NEW เริ่มโหลดทีละ **50** rankings ไม่ใช่ 20 จึงมีความเสี่ยงมากกว่าที่เห็นจากบัญชี 3 โพสต์
3. **P1 — Discover quiet state:** ทั้งสองแบบบอกว่าเงียบแล้วให้ไปหน้ารวม แต่ยังไม่โชว์หัวข้อจริงให้เลือกทันที
4. **P1 — Profile mobile preview:** NEW เห็นโพสต์เร็วขึ้น แต่ preview สองคอลัมน์ที่ 390px บีบชื่อ item มาก จึงยังไม่ใช่ layout สุดท้าย
5. **P2 — Brand refinement:** คืน charcoal hero, violet accent และ dark outline/offset เล็กน้อยให้ CTA สำคัญ โดยรักษาความอ่านง่ายของ NEW

### วิธีตรวจและขอบเขตหลักฐาน

- A / OLD: [Production](https://tear-of-god.pages.dev/) จากเว็บจริงขณะ audit ไม่ใช้ภาพ before ของ PR มาแทน Production
- B / NEW: [Experimental](http://127.0.0.1:8788/); ใช้ `localhost:8788` สำหรับ session Google เดิมใน Own Profile และการเปรียบเทียบที่ต้อง signed-in ทั้งสอง host เสิร์ฟ local build เดียวกัน
- Checkout ขณะตรวจ: `codex/visual-system-navigation-profile`, HEAD `9970bf75246b9dec83498e685c60ef41a50ce0a6` ไม่อ้างว่าเป็น commit ของ Production
- Browser จริง: ตรวจ 12 หน้าทั้ง A/B ที่ **1280 × 900**; Home, Own Profile และเมนูเปิด/ปิดที่ **390 × 844** และ **820 × 1180**; ตรวจ `innerWidth` จริงหลัง resize
- เปรียบเทียบ Light theme และ English UI เป็นหลัก เนื้อหาไทยจริงยังคงเดิม ภาพ Home แรกของ B เคยเป็นภาษาไทยแล้วเปลี่ยนเป็น English เพื่อเทียบอย่างเป็นธรรม ไม่ใช่ audit dark-mode ครบชุด
- Own Profile เป็น Google session ของผู้ใช้จริง เห็น avatar/ชื่อ/สัญลักษณ์แอดมินและ **3 rankings** ทั้ง A/B; Other Profile ใช้คนเดียวกัน **7 rankings** ทั้ง A/B
- Topic/Rank/Community ใช้หัวข้อกาแฟเดียวกัน 8 items, 21 rankings; Post ใช้โพสต์กาแฟเดียวกัน Feed บน Home เปลี่ยนลำดับได้ จึงไม่ใช้ความต่างของคน/โพสต์แรกเป็นคะแนน redesign
- Production มี session แอดมิน แต่ B บางหน้าสาธารณะใช้ guest บน `127.0.0.1`; Delete vs Report และ Following vs Follow จึงเป็น **ความต่างของ session ไม่ใช่ redesign**
- ไม่กด Follow/Unfollow, Publish, Like/Dislike, Delete, Pin, Save, ส่ง Edit Profile หรือส่ง auth form ไม่สร้างบัญชี ไม่ logout ไม่เปลี่ยน source/ฐานข้อมูลด้วยเครื่องมือ การเปิดหน้าอาจมี telemetry ภายในเว็บตามปกติ ซึ่งไม่ได้ใช้เป็นหลักฐานว่าไม่มี write ใดเลย
- 20/100 rankings เป็น **แบบจำลองจาก geometry ที่วัดจริง + pagination ใน source** ไม่ได้สร้างข้อมูลหรือแสดง 100 records จริง
- คะแนนเป็น expert heuristic สำหรับกลุ่มวัยรุ่น/นักศึกษา ไม่ใช่ผล usability study หรือหลักฐานว่า Gen Z ทุกคนชอบแบบใด ความต่าง 1 คะแนนเป็นข้อเสนอเชิงประเมิน ไม่ใช่ค่าทางสถิติ
- ตรวจ source เฉพาะเสริมข้อสังเกตจาก browser: `Profile.jsx` (limit 50/load more), `Login.jsx` (shared state), `Discover.jsx`, `api.js`, `functions/api/templates.js` (fallback ที่รองรับจริง)

## 2. OLD strengths

- **Hero สื่อโลกของ tier list ด้วยภาพทันที:** charcoal/cream contrast, lime emphasis, violet edge และ demo board ให้ความรู้สึกเป็นพื้นที่แสดงรสนิยม ไม่ใช่หน้าระบบจัดการ
- **Primary CTA มีน้ำหนักและความเป็นวัตถุ:** dark outline + offset ทำให้ lime ดูเป็นปุ่มที่กดได้ ไม่ใช่แค่สีพื้นหลัง
- **Profile desktop แยก identity ออกจากรายการ:** ข้อมูลคนไม่ถูกผลักลงตามจำนวน rankings แม้ลำดับภายใน sidebar เดิมยังยาวเกินไป
- **Create บอกจุดเริ่มชัด:** cyan Quick Add เห็นได้ทันทีว่าเริ่มป้อน item ตรงไหน
- **Auth visual panel มี character:** mascot, board illustration และ copy เชิงชุมชนยังใช้ได้ ไม่จำเป็นต้องแทนด้วยภาพ stock หรือ dashboard illustration
- **เนื้อหาท้องถิ่นทำให้ social จริง:** ร้านกาแฟ มพ, เมนูในตึก และความเห็นเฉพาะบุคคลมีพลังมากกว่า decoration เป็นส่วนที่ต้องรักษาทั้งสองแบบ

## 3. NEW strengths

- **ภาษาตรงกับงานของผู้ใช้:** Topic, Rank mine, See community แยกชุด item / ความเห็นของคน / ผลรวมได้ดีกว่า Use Template
- **Home ชี้ทางเริ่มที่เหมาะกว่า:** “Pick something to rank” ไปเลือกหัวข้อที่มี item พร้อม แทน TRY RANKING ที่พาไปเริ่มจากกระดานว่าง
- **Post อ่านง่ายขึ้น:** ลด headline และกรอบรอบ board; เพิ่มชื่อเจ้าของความเห็นและทางต่อไปจัดของตัวเอง
- **Rank Editor ใช้พื้นที่ทำงานดีขึ้น:** หัวข้อกระชับ, pool ขึ้นมาอยู่เหนือ shuffle/sort, board ปรากฏสูงขึ้น และอธิบาย guest draft/login ตอน publish
- **Community มีความซื่อสัตย์ต่อความหมายข้อมูล:** ไม่กล่าวว่าเป็นความเห็นเป็นเอกฉันท์; มี period และอธิบายความต่างของอันดับส่วนตัวเป็นประโยค
- **Navigation สม่ำเสมอถึง tablet:** Home/Discover/Create/Profile ใน bottom nav ที่ 820px; เมนูรองรวม Search/Saved/preferences โดยไม่ทำรายการหน้าหลักซ้ำ
- **Own Profile เปิดด้วยชื่อคนจริง:** ลด “A TASTE OF YOU” และแบนเนอร์ชวนสร้างที่แย่งพื้นที่; Education เป็น disclosure ได้เหมาะกว่าแสดงยาวตลอด
- **Neutral secondary controls ลดการแข่งขัน:** Share/Save/Duel ไม่ควรเด่นเท่างานหลักตลอดเวลา

## 4. OLD weaknesses

- Editorial heading ขนาดใหญ่ถูกใช้ในหน้าที่คนมา “ทำงาน” ด้วย เช่น Rank และ Community จึงกินพื้นที่ก่อนถึงข้อมูล
- “RANK” ใน navbar และ “TRY RANKING” บน Home ไป Create เหมือนกัน ทำให้การเริ่มจากหัวข้อที่มีอยู่ไม่ชัด
- Card shadow, tier glow, sticker และเส้นตกแต่งเกิดพร้อมกันหลายบริเวณ จึงไม่มี hierarchy ของความพิเศษ
- Topic card แสดง tier preview เหมือนมีคำตอบของ topic อยู่แล้ว ทั้งที่ topic ควรเป็นชุด item ให้แต่ละคนจัดเอง
- Profile sidebar เดิมไม่ใช่คำตอบสำเร็จ: education ยาว, Taste อยู่ต่ำ, header ซ้ำชื่อ และโพสต์แรกใหญ่กว่าที่เหลือโดยไม่จำเป็นต้องสำคัญกว่า
- Mobile Profile ซ่อน Taste section ที่เห็นบน desktop; ไม่มี Taste entry ที่มองเห็นในการตรวจ 390/820 ขณะที่ education กินพื้นที่ก่อน rankings
- Discover บอก “WHAT’S EVERYONE TALKING ABOUT?” แต่ใต้หัวข้อเป็น quiet state ใหญ่ ความดังของ headline ยิ่งทำให้สัญญากับเนื้อหาขัดกัน
- 820px มี hamburger แต่ไม่มี bottom nav แบบมือถือ จึงต้องค้นหาการเดินทางหลักในเมนู

## 5. NEW weaknesses

- Home hero เสียทั้ง charcoal contrast และตัวอย่าง tier list เหลือ copy ในกล่อง cream; ชัดขึ้นทางภาษา แต่คนใหม่ยังต้องนึกภาพผลิตภัณฑ์เอง
- Primary CTA หลายปุ่มเหลือ lime + rounded rectangle; สีจำได้ แต่ silhouette/สัมผัสลดลง และเส้นทาง “+ Create” ดูใกล้ neutral action อื่นมาก
- Discover ว่างอย่างมีระเบียบแต่ยังว่าง ไม่มี topic card ให้สนใจเลยใน quiet window ที่ตรวจ
- Profile identity panel กว้างเต็มหน้าแต่ใช้ข้อมูลฝั่งซ้ายเป็นหลัก; พร้อมกันนั้น Taste ถูกย้ายไปหลัง rankings ทั้งชุด
- 390px สองคอลัมน์ใน Profile ช่วยให้ scan จำนวนผลงาน แต่ miniature items และชื่อไทยเล็ก/ตัดจนอ่านรสนิยมจาก preview ยาก
- Quick Add ยังมี heading และ lime Add items แต่พื้นแทบเหมือนรายละเอียดชื่อ/hashtags; ความเป็น “ขั้นแรก” ลดลง
- Community signed-in แสดงความต่าง 5 items ก่อน board จนกินเกือบทั้ง viewport 900px; social relevance ดีขึ้น แต่ต้องย่อ summary ก่อนให้ขยาย
- Rank pool ยังแคบและเป็นหนึ่งคอลัมน์ในกรณีที่ตรวจ; ต้อง scroll ภายในเพื่อเห็น 8 items ไม่ควรถือว่าปัญหา editor หมดแล้ว
- Login ยังบอก “Log in to start ranking…” ทั้งที่ NEW ยอมให้เริ่ม guest draft; และ state ข้าม Login/Register ยังผิดจาก target
- ความสะอาดยังไม่สม่ำเสมอทุก component: Create ยังมี “MAKE IT OFFICIAL.”/เลขหมวดตกแต่ง แต่ส่วนที่ต้องเด่นอย่าง Quick Add ถูกทำเรียบมาก

## 6. Score tables และข้อเสนอรายหน้า

คะแนน 1–10: 1 = ขัดขวางงาน/ไม่สื่อเจตนา, 5 = ใช้ได้แต่มีจุดติดขัดชัด, 8 = ดีมีข้อจำกัดเล็กน้อย, 10 = เด่นมากและไม่มีข้อเสียสำคัญในขอบเขตที่ตรวจ ไม่ให้ 10 เพียงเพราะดูสวย

คำย่อในทุกตาราง: **Clarity** = First-time clarity; **Hierarchy** = Visual hierarchy; **Ease** = Ease of use; **Brand** = Brand personality; **Gen Z** = Gen Z appeal; **Social** = Social/community feeling; **Readability** = Readability; **Scale** = Content scalability; **CTA** = CTA clarity; **Consistency** = Visual consistency

### 6.1 Home

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 7 — Demo board explains tiers; “vibe” is vague | 9 — Topic/opinion copy and ready-topic entry explain the loop |
| Hierarchy | 7 — Hero has strong focus but occupies more of the screen | 8 — Smaller introduction gives content room |
| Ease | 6 — Try Ranking opens an empty Create flow | 8 — Pick a topic lowers the first-task effort |
| Brand | 9 — Charcoal, lime, violet and board form a recognizable scene | 5 — Cream card and standard rounded buttons lose that scene |
| Gen Z | 8 — Playful artifact fits sharing tastes without requiring gaming cues | 7 — Relatable opinion copy works; visual energy is weaker |
| Social | 8 — People and ranking cards support the playground promise | 9 — Explicit ownership and Rank mine encourage participation |
| Readability | 7 — Strong contrast, but decoration competes with content | 9 — Smaller heading and quiet cards scan cleanly |
| Scale | 7 — Repeated card effects accumulate in a long feed | 8 — Neutral repeated surfaces cope better with many posts |
| CTA | 7 — Visually strong primary, ambiguous destination | 9 — Pick / see takes / new topic have distinct intent |
| Consistency | 7 — Multiple sticker/card treatments | 8 — Shared surfaces and primary/secondary pattern |

**KEEP FROM OLD:** charcoal hero, one violet edge/accent, small visual tier example.  
**KEEP FROM NEW:** copy “One topic. A thousand opinions.”, choose-existing-topic first, explicit ranking ownership.  
**REMOVE FROM BOTH:** homepage jargon without a concrete example; competing primary-looking controls around each post.  
**HYBRID PROPOSAL:** compact charcoal editorial hero with NEW copy, lime primary and neutral secondary; small demo on desktop, one short tier strip on mobile. Keep the first real person/post visible soon after the hero rather than enlarging the hero to showcase decoration.

### 6.2 Discover

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 6 — Huge conversation promise leads to an empty window | 8 — Title and All topics route state the purpose |
| Hierarchy | 5 — Headline dominates the search and content area | 8 — Search/window/empty state are ordered clearly |
| Ease | 6 — Requires another navigation before finding a topic | 7 — All topics is easier to find, but still another step |
| Brand | 9 — Lime headline and violet search shadow are distinctive | 4 — Mostly generic cream search and panels |
| Gen Z | 6 — Energetic promise feels hollow when quiet | 5 — Understandable but offers little to explore visually |
| Social | 4 — No people or conversations in the observed window | 4 — Same absence despite clearer copy |
| Readability | 6 — Oversized heading and strong outlines compete | 9 — Calm type and spacing make instructions easy |
| Scale | 6 — Large introduction spends space before results | 8 — Compact introduction leaves room for real content |
| CTA | 7 — Explore templates is visually obvious | 8 — Explore topics is clearer; repeated All topics is redundant |
| Consistency | 6 — Editorial numbering and search treatment differ from other pages | 8 — Shared buttons and surfaces match NEW |

**KEEP FROM OLD:** a restrained violet/lime editorial cue and social tone.  
**KEEP FROM NEW:** smaller heading, clear search, visible All topics, activity windows.  
**REMOVE FROM BOTH:** a large dead-end quiet panel as the page’s main content; duplicated routes that add no choice.  
**HYBRID PROPOSAL:** brief quiet message followed by 4–6 real popular topic cards; keep time-window language honest. Explain backend scope in §10 rather than inventing a personalized recommendation service.

### 6.3 All Topics

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 6 — Ranked S/A previews can be mistaken for the topic’s answer | 9 — “Preview · items to rank” separates items from opinions |
| Hierarchy | 7 — Grid is clear but metrics and shadows add weight | 8 — Item preview, title, author and action scan in order |
| Ease | 7 — Familiar grid and pagination | 8 — Rank mine describes the next action more directly |
| Brand | 8 — Tier previews and offset card edges are distinctive | 6 — Cleaner item cards retain some product identity |
| Gen Z | 7 — Colorful subjects and creator names are relevant | 8 — Easier to browse recognizable subjects and join in |
| Social | 7 — Authors and use counts imply participation | 8 — Ranking counts are labeled and ownership remains visible |
| Readability | 6 — Tiny text in miniature tier rows | 8 — Larger item previews help, though long names still truncate |
| Scale | 8 — Paginated multi-column grid handles catalog growth | 8 — Same grid advantage with less visual accumulation |
| CTA | 6 — Use Template sounds like a technical operation | 9 — Lime Rank mine names the personal outcome |
| Consistency | 7 — Repeated card style works inside the page | 8 — Aligned shared card/action treatment |

**KEEP FROM OLD:** recognizable creators and lively real topics; avoid preserving S/A just as decoration.  
**KEEP FROM NEW:** unranked preview, explicit ranking count, Rank mine.  
**REMOVE FROM BOTH:** unreadably truncated item labels and unexplained Unknown User; do not treat data-quality problems as styling problems.  
**HYBRID PROPOSAL:** NEW cards, a very small violet author/context accent and lightly outlined primary CTA. No offset shadow on every card. Let real item imagery and titles provide variety.

### 6.4 Topic Detail

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 7 — Template definition helps but uses product terminology | 9 — Shared items + own take explain the concept |
| Hierarchy | 7 — One large action row mixes main and supporting work | 8 — Rank mine / See community form a clear first group |
| Ease | 7 — Community is reachable through its preview | 9 — Explicit community link avoids discovering a clickable board |
| Brand | 7 — Tier context and violet Duel add character | 6 — Neutral panels reduce distinctive details |
| Gen Z | 7 — Familiar local topics carry most of the appeal | 8 — Personal take versus community is easy to relate to |
| Social | 8 — Real community rankings and authors are present | 9 — Join/compare is made explicit at the decision point |
| Readability | 8 — Item names and description are readable | 8 — Similar readability with clearer labels |
| Scale | 7 — Long item sets and community cards still lengthen the page | 7 — Extra action row increases height; long sets remain a concern |
| CTA | 6 — Use Template competes with several actions | 9 — Rank mine is visibly primary; supporting actions are quieter |
| Consistency | 7 — Mostly structured, but mixed button emphases | 8 — Primary/secondary grouping matches the new flow |

**KEEP FROM OLD:** item inventory and immediate creator context.  
**KEEP FROM NEW:** topic definition, ranked-count language, Rank mine/See community grouping.  
**REMOVE FROM BOTH:** redundant title text inside and below text-only item tiles; secondary action sprawl.  
**HYBRID PROPOSAL:** NEW hierarchy with tactile Rank mine; collapse lower-priority actions when width is tight. Do not restore a thick outer border to the whole topic panel.

### 6.5 Post Detail

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 7 — Author is present but title/board dominate | 9 — Explicit person’s ranking distinguishes opinion from topic |
| Hierarchy | 6 — Very large title and dark frame both demand attention | 9 — Heading, board and explanation have calmer separation |
| Ease | 7 — Main continuation sits in the sidebar | 8 — Additional Rank mine/See community after the board |
| Brand | 8 — Violet offset and bold title create a recognizable poster | 6 — More neutral, though tier data remains colorful |
| Gen Z | 7 — Shareable opinion artifact, visually heavy | 8 — The opinion is easier to read and respond to |
| Social | 7 — Reactions/comments are present | 9 — Ownership and “Which item would you move — and why?” invite a response |
| Readability | 6 — Frame and large type compete with the ranking | 9 — Reduced framing benefits the actual tier content |
| Scale | 7 — Long titles and boards magnify the heavy treatment | 8 — Smaller heading and lighter surface tolerate longer content |
| CTA | 6 — Use Template requires knowing its meaning | 8 — Rank mine is clear, though sidebar and inline styles differ |
| Consistency | 6 — Post has a louder frame than topic surfaces | 8 — Board/sidebar align with shared panels |

**KEEP FROM OLD:** a small violet authorship/context cue, not the entire framed poster.  
**KEEP FROM NEW:** title scale, person’s-ranking label, readable board, specific comment prompt.  
**REMOVE FROM BOTH:** duplicate generic template descriptions; excessive emphasis on low-priority metadata.  
**HYBRID PROPOSAL:** mostly NEW. Return personality in the primary action and author details; leave board borders quiet so tier colors remain data. Here the readability gain is worth losing most OLD decoration.

### 6.6 Rank Editor

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 7 — Drag/tap instruction helps; S-tier slogan assumes familiarity | 9 — Direct question plus guest-draft explanation |
| Hierarchy | 5 — Hero/title block and shuffle controls precede useful items | 8 — Board and pool appear higher; sorting is secondary |
| Ease | 6 — Lower pool and limited visible items require more scanning | 8 — Pool starts higher, but remains narrow and internally scrollable |
| Brand | 8 — Editorial title and physical Publish feel playful | 6 — Tier board carries identity; surrounding UI is generic |
| Gen Z | 7 — Expressive tool, but larger decoration delays doing | 8 — Immediate manipulation is more valuable than a loud slogan |
| Social | 6 — Publishing implies sharing but little comparison context | 7 — “Your take” and accessible guest start lower participation friction |
| Readability | 6 — Above-board area spends too much height | 8 — More of the board and item labels are available |
| Scale | 5 — Narrow pool becomes costly with many items | 6 — Same width limitation despite better order |
| CTA | 8 — Sticky progress/Publish is obvious | 8 — Still obvious; pressed personality is weaker |
| Consistency | 7 — Strong action system but decorative workspace | 8 — Functional controls share NEW treatment |

**KEEP FROM OLD:** sticky progress/Publish, tactile emphasis only on Publish.  
**KEEP FROM NEW:** compact instructions, pool above shuffle/sort, visible board, draft/guest explanation.  
**REMOVE FROM BOTH:** a one-column pool when available width could support legible alternatives; oversized metadata block; misleading all-ranked messaging during loading.  
**HYBRID PROPOSAL:** NEW workspace with clearer pool boundary/count and responsive item density. Use a small violet context label if needed, not a hero. Keep tier colors data-driven. Audit did not move items or publish; drag/drop correctness and pressed Publish execution are outside this read-only pass.

### 6.7 Create

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 7 — Quick Add is unmistakable, heading less literal | 8 — Create a ranking and four steps describe the task |
| Hierarchy | 7 — Cyan identifies start but competes strongly with board | 6 — Quick Add blends into the metadata panels |
| Ease | 7 — Strong start point and comma-separated hint | 8 — Same input approach with guest reassurance |
| Brand | 9 — Mascot, cyan and lime are memorable together | 6 — Mascot remains; panel character is mostly removed |
| Gen Z | 7 — Fun creation space but somewhat noisy | 7 — Approachable, though less invitation to play |
| Social | 6 — Publish and tags imply sharing | 7 — Start without signing up encourages first participation |
| Readability | 6 — Saturated panel and large editorial labels compete | 8 — Better contrast balance and calmer controls |
| Scale | 6 — Details grow down the side; board remains usable | 7 — Cleaner surfaces tolerate longer input, same structural limits |
| CTA | 8 — Add items is clearly the starting action | 7 — Lime button is visible, but its parent section lacks priority |
| Consistency | 6 — Cyan/black frame differs strongly from other form blocks | 7 — Shared surfaces improve consistency; leftover editorial labels remain |

**KEEP FROM OLD:** Quick Add’s prominence and mascot, not full-strength cyan coverage.  
**KEEP FROM NEW:** literal heading, guest reassurance, simpler board and secondary actions.  
**REMOVE FROM BOTH:** board-first visual dominance before any item exists; redundant editorial numbering that does not guide a step.  
**HYBRID PROPOSAL:** lightly tinted cyan or violet Quick Add with “1 · Add items” label and one strong lime action. Keep metadata neutral. On an empty board, a short directional hint should connect Quick Add to the board without adding another permanent panel.

### 6.8 Community

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 5 — “The people have spoken” overstates aggregate agreement | 9 — Combined eligible placements and period are explicit |
| Hierarchy | 5 — Huge generic heading precedes topic and board | 7 — Topic-first is better; five comparison rows delay the board |
| Ease | 6 — Comparison lives below ranking/statistics | 8 — Personal comparison is easy to find when signed in |
| Brand | 8 — Verdict treatment has identity but the wrong implication | 6 — Violet context survives in a much quieter layout |
| Gen Z | 6 — Verdict feels authoritative rather than open to opinions | 8 — Personal disagreement is treated as a reason to participate |
| Social | 7 — Community comments and comparison exist | 9 — Difference language and specific discussion prompt support conversation |
| Readability | 6 — Large heading and tables compete | 9 — Plain-language differences and disclosed statistics help |
| Scale | 6 — Full statistics extend the page before conversation | 8 — Disclosure reduces the default information load |
| CTA | 6 — View template gives limited participation direction | 7 — View my ranking/period are clear; join action could be stronger |
| Consistency | 6 — Another special hero/frame system | 8 — Shared topic, panel and tier-label language |

**KEEP FROM OLD:** recognizable community context and access to detailed statistics.  
**KEEP FROM NEW:** aggregate caveat, period controls, personal comparison, discussion before detailed statistics.  
**REMOVE FROM BOTH:** language implying unanimous truth; long comparison/statistical material before the main result.  
**HYBRID PROPOSAL:** NEW topic-first page, show the largest 1–2 personal gaps with “See all differences”, then board and conversation. Violet identifies community context; lime is reserved for the action to add/update one’s take.

### 6.9 Own Profile

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 6 — Taste Passport/A Taste of You duplicate identity | 9 — Real name, bio and Edit Profile appear directly |
| Hierarchy | 5 — Hero, education and create banner delay work | 7 — Rankings arrive earlier; identity panel is unnecessarily wide |
| Ease | 6 — Own actions visible but scattered | 8 — Edit, Saved topics and Create are understandable |
| Brand | 8 — Passport concept and framed identity feel personal | 5 — Full-width account-style panel is generic |
| Gen Z | 7 — Personal passport has potential, but education dominates | 6 — Clear profile yet weak taste identity above the fold |
| Social | 7 — Followers/taste connect person to opinions | 6 — Followers remain; taste is below every loaded post |
| Readability | 6 — Dense sidebar and large first card | 8 — Cleaner identity and regular desktop grid |
| Scale | 7 — Desktop taste placement is independent of post count | 4 — Taste/Education move down with up to 50 initially loaded posts |
| CTA | 7 — Edit is obvious; create banner competes with it | 8 — Quieter Edit with clear rankings tools |
| Consistency | 6 — First post, passport and banners have different weights | 8 — Consistent panels and uniform cards |

**KEEP FROM OLD:** identity beside rankings on desktop and a compact taste identity.  
**KEEP FROM NEW:** name-first header, regular cards, explicit Saved, Education disclosure, no generic hero.  
**REMOVE FROM BOTH:** space-heavy identity, taste hidden by content growth, oversized first post without editorial reason.  
**HYBRID PROPOSAL:** compact desktop sidebar with identity → actions/counts → taste summary → education disclosure; rankings right. Mobile uses compact identity then a visible taste-summary entry before rankings. Do not copy OLD’s education-first sidebar verbatim.

### 6.10 Other Profile

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 6 — Repeated generic and person-specific headers | 9 — Person’s name and bio lead immediately |
| Hierarchy | 5 — Sidebar and rankings introduction consume the top | 8 — Uniform grid becomes visible sooner |
| Ease | 7 — Follow state and rankings are accessible | 8 — Simpler scanning and interaction locations |
| Brand | 8 — Passport and hashtag strip create identity | 5 — Neutral account panel gives little distinctive taste |
| Gen Z | 7 — Personal flavor fits discovering people | 6 — More efficient, less expressive as a profile |
| Social | 8 — Taste context sits alongside a person’s work | 6 — Seven posts already push Taste to about y=1341 |
| Readability | 6 — Multiple competing titles and decorations | 8 — Bio and card titles read more easily on desktop |
| Scale | 7 — Sidebar discovery does not worsen with each row | 4 — All loaded rows precede taste and education |
| CTA | 7 — Follow/Following is recognizable | 8 — Follow is separated from content actions |
| Consistency | 6 — Profile-specific banners and first-card emphasis | 8 — Shared card and identity styles |

**KEEP FROM OLD:** browsing a person through their tastes, not only a wall of posts.  
**KEEP FROM NEW:** direct identity, quieter Follow, regular grid, optional education.  
**REMOVE FROM BOTH:** duplicated name/introduction; expecting tiny tier previews alone to explain the person.  
**HYBRID PROPOSAL:** same compact sidebar as own mode, swap Edit for Follow without changing layout; show top tags/favorite items and a taste-details entry before the long grid. Do not expose owner-only tools as part of visual consistency.

### 6.11 Login

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 8 — Email/password and Google are familiar | 8 — Same form clarity; guest-start copy is now contradictory |
| Hierarchy | 7 — Login and pink create-account panel compete | 9 — Login primary and mode-switch secondary are clearer |
| Ease | 7 — Familiar controls, mode switching needs care | 6 — Shared password state makes changing intent surprising |
| Brand | 9 — Ticket border, lime button and mascot form a strong system | 7 — Mascot/charcoal remain, physical button identity is reduced |
| Gen Z | 8 — Friendly club presentation without a business-login tone | 8 — Welcoming visual survives with less noise |
| Social | 7 — Club and share-your-takes copy fit the product | 7 — Same social promise, not a generic enterprise sign-in |
| Readability | 8 — Strong form/background contrast | 9 — Reduced heading and framing improve scanning |
| Scale | 7 — Fixed two-panel composition has limited spare space | 8 — Quieter typography tolerates translation better |
| CTA | 8 — Strong Log In, but create account is also loud | 9 — Main submit and secondary mode change separate clearly |
| Consistency | 8 — Matches OLD tactile primary treatment | 8 — Matches NEW primary/secondary surfaces |

**KEEP FROM OLD:** mascot, charcoal visual panel, subtle tactile submit.  
**KEEP FROM NEW:** smaller heading and neutral Create account mode switch.  
**REMOVE FROM BOTH:** unnecessary competition between submit and mode switch; unclear statement that login is required to start when guest ranking is available. OLD state transitions were not behavior-tested, so no claim that OLD fixes the state bug.  
**HYBRID PROPOSAL:** NEW layout with a lightly outlined lime Log In. Copy should explain saving/publishing or returning to one’s account. Clear password/show-password state on mode changes.

### 6.12 Register

| Dimension | OLD — score / reason | NEW — score / reason |
|---|---|---|
| Clarity | 8 — Four familiar fields identify account creation | 8 — Same labels and familiar structure |
| Hierarchy | 7 — Strong back-to-login action competes with Sign Up | 9 — Neutral back action leaves Sign Up primary |
| Ease | 7 — Standard form; OLD carryover was not tested | 5 — Password arrives from Login and confirm can remain stale |
| Brand | 9 — Ticket, mascot and outlined lime create a recognizable pass | 7 — Still recognizable through mascot but flatter controls |
| Gen Z | 8 — Club/pass metaphor feels approachable | 8 — Keeps welcoming tone without shouting |
| Social | 7 — Returning to lists connects account to participation | 7 — Same community context remains |
| Readability | 8 — Clear labels and contrast | 9 — Less typographic and framing weight |
| Scale | 7 — Four fields and two panels are already dense | 8 — Smaller type gives modest room, not unlimited extensibility |
| CTA | 8 — Sign Up is strong; secondary lime competes | 9 — Sign Up and Back to login have distinct emphasis |
| Consistency | 8 — Coherent with OLD Login | 8 — Coherent with NEW Login visually, state needs correction |

**KEEP FROM OLD:** friendly pass metaphor and distinct submit affordance.  
**KEEP FROM NEW:** label hierarchy, quieter mode switch, mascot panel.  
**REMOVE FROM BOTH:** credential assumptions across modes; unverified “less than a minute” promise should not substitute for showing requirements.  
**HYBRID PROPOSAL:** NEW visual structure with shared brand primary; email may persist, both password fields clear on every mode transition, username remains independently entered. Do not infer a display name from email.

## 7. Profile scalability analysis

### สิ่งที่วัดจริง

| View | OLD | NEW |
|---|---|---|
| Own, 3 rankings, 1280×900 | Taste heading ≈ y915; education อยู่ใน identity sidebar ก่อน Taste | Taste ≈ y851; Education ≈ y1110; card row สูงประมาณ 291px + gap16px |
| Other, 7 rankings, 1280×900 | Taste อยู่ฝั่ง sidebar ไม่ต่อท้ายทุก row | Taste ≈ y1341; Education ≈ y1599; card row interval ประมาณ 281px |
| Own, 3 rankings, 390×844 | Taste desktop block ไม่แสดง; identity/education ยาวก่อนโพสต์ | Taste ≈ y1236; Education ≈ y1532; grid 2 columns ชื่อ item เล็กมาก |
| Own, 3 rankings, 820×1180 | Identity/education ยังกินพื้นที่มาก; Taste desktop block ไม่แสดง | Taste ≈ y1116; Education ≈ y1374; bottom nav ทับพื้นที่ท้าย viewport ตามปกติ ต้อง scroll ต่อ |

ตำแหน่ง y เป็น document coordinates โดยประมาณ ฟอนต์/scrollbar/เนื้อหาทำให้ค่าต่างกันเล็กน้อย ไม่ควรใช้เป็น pixel contract

**ข้อค้นพบที่สวนสมมติฐาน:** เมื่อมีเพียง 3 rankings บน desktop NEW ไม่ได้ซ่อน Taste ต่ำกว่า OLD เสมอไป—ในตัวอย่างนี้ NEW เริ่มที่ ~851 และ OLD ~915 ปัญหาจริงของ NEW คือ **การโตตามจำนวนแถว** ส่วน OLD มีปัญหา **sidebar เองยาวและจัดลำดับไม่ดี** จึงต้องแก้ทั้งสองอย่างใน Hybrid

### แบบจำลอง 3 / 20 / 100 rankings

Source B โหลดครั้งแรก `fetchRankings({ authorId, sort: 'recent', limit: 50 })`; ปุ่ม Next ต่อรายการเพิ่มอีก 50 ไม่ใช่เปลี่ยนเป็นหน้าสั้น ๆ โดยอัตโนมัติ ไม่มีข้อมูล 20/100 ถูกสร้างเพื่อการตรวจนี้

ประมาณแบบ desktop 3 columns: `Taste y ≈ gridTop + ceil(loadedCount / 3) × rowInterval + section spacing` โดยใช้ row interval ที่พบจริงประมาณ 281–307px

| จำนวนทั้งหมด | NEW desktop โดยประมาณ | NEW mobile/tablet | OLD desktop |
|---|---|---|---|
| 3 | Taste ~0.85k px ใน own profile ที่วัดจริง; เริ่มปลาย viewport | ที่ 390px ~1.24k, 820px ~1.12k | Taste ~0.92k ในตัวอย่าง; ไม่ได้เห็นทันที แต่ไม่ขึ้นกับจำนวนโพสต์ |
| 20 | 7 rows → Taste ราว 2.5–2.7k px; Education ต่ำลงอีกประมาณหนึ่ง section | 10 rows ใน 2-column grid; ลึกหลายหน้าจอ โดยเฉพาะชื่อ/hashtag หลายบรรทัด | ตำแหน่งเริ่ม taste ไม่ถูก 20 posts ผลักลง แต่ sidebar ต้องย่อ |
| 100, ก่อนกด Next | โหลด 50 → 17 rows → ราว 5.3–5.8k px | 25 rows ก่อนเจอ Taste; discovery แย่แม้ยังโหลดไม่ครบ 100 | ไม่ผูกกับจำนวน rows แต่ sidebar เดิมไม่ได้พิสูจน์ว่า sticky |
| 100, หลังโหลดครบ | 34 rows → ราว 10.1–11.0k px | 50 rows; แทบไม่มีเหตุผลให้คาดว่าคนทั่วไปจะหา Taste ท้าย feed | แยกคอลัมน์ช่วย discovery แต่ไม่แก้ mobile ที่ซ่อน Taste |

Education อยู่หลัง Taste จึงรับปัญหาเดียวกัน แม้ disclosure ลดความสูงของข้อมูลเมื่อปิด แต่ **ไม่ได้ทำให้ตัว entry discoverable**

### Hybrid ที่เลือกหลังตรวจ

- **Desktop ≥1024:** sidebar ประมาณ 280–320px + rankings ทางขวา Identity ใช้ avatar/name/bio แบบกระชับ ตามด้วย Follow/Edit, followers/following, compact Taste (top tags + 1–3 favorites + View taste), Education disclosure; ลด joined/likes เป็น metadata แถวเดียว
- Sticky ได้เมื่อความสูง sidebar แบบพับสั้นกว่าพื้นที่ใต้ navbar จริง ไม่ทำทั้ง sidebar สูงเกิน viewport แล้วล็อกให้ scroll ยาก และไม่สร้าง nested scroll โดยไม่จำเป็น
- **820px:** ใช้ compact header + taste summary/disclosure entry ก่อน grid; ยังไม่บังคับ sidebar ที่ทำให้ cards แคบ
- **390px:** avatar/name/bio/actions กระชับ, แถว “Taste / About” หรือ summary ที่เห็นก่อน rankings; education อยู่ใน About disclosure ไม่ให้ข้อมูลมหาวิทยาลัยกินหน้าจอแรกทั้งหมด
- ทดลอง card density สองแบบบนมือถือ: 1-column สำหรับอ่าน tier preview หรือ 2-column ที่ลด preview เหลือ top item/tag ที่อ่านได้จริง ไม่ใช่ย่อกระดานทั้งอันจน text เหลือเศษคำ
- Detailed Taste เปิดตามความตั้งใจของผู้ใช้ได้ แต่ **ทางเข้า summary ต้องอยู่ก่อน long feed** ไม่ขึ้นกับ 3/20/100 records
- เกณฑ์รับงานรอบ implementation: ที่ 3/20/100 ต้องเห็นทางเข้า Taste และ Education โดยไม่ต้องผ่าน rankings ทั้งหมด; sticky ไม่บังเมนู/เนื้อหา; ชื่อไทยยาวและ badge ไม่ดัน primary action หลุดจอ

## 8. Login / Register state finding

ทดสอบ B บน `127.0.0.1:8788/login` ด้วย email `ux-audit@example.invalid` และ password จำลอง ไม่ใช้ credential ของผู้ใช้ ไม่ submit

| Step / field | Observed | Target | Result |
|---|---|---|---|
| Login → Register: email | มีค่าที่กรอกต่อมา | เก็บได้ | Pass |
| Login → Register: password | มีค่าต่อมา เห็น masked characters ใน Register | Clear | **Fail** |
| Login → Register: username | ว่าง | ไม่สร้างจาก Login | Pass |
| Register ครั้งแรก: confirm | ว่าง | ว่าง | Pass |
| กรอก dummy confirm แล้วกลับ Login: Login password | ยังคงมีค่า | Clear | **Fail** |
| Mode round-trip: confirm state | ยังมีค่าใน form state ขณะกลับ Login และก่อนกลับไปแก้ Register | Clear ทุกครั้งที่เปลี่ยน mode | **Fail** |

หลักฐานเสริม: `Login.jsx` ใช้ `email`/`password` ร่วมกันสอง form, `confirmPassword` แยก state แต่ mode controls เปลี่ยน `isRegister` โดยไม่มี reset ทั้งหมด จึงสอดคล้องกับ browser finding

ข้อเสนอ: handler เปลี่ยน mode เดียวสำหรับทุกปุ่ม; preserve email ตามความสะดวก, clear password/confirm, reset password-visibility toggles และ validation error ที่ไม่ตรงกับ mode ใหม่ Username ต้องเป็น independent input ไม่สร้างจาก login email ส่วนจะเก็บ username ที่ผู้ใช้พิมพ์เองขณะสลับกลับมาหรือไม่เป็น product choice อีกข้อ ไม่ใช่บั๊กที่ยืนยันในรอบนี้

Severity **P1**, ไม่ใช่หลักฐานว่ามี credential leak หรือ account compromise ไม่ควรขยายข้อค้นพบเกินการค้างของ state ก่อน submit หลังทดสอบตรวจซ้ำว่า input ทั้งหมดว่าง ไม่มี account ถูกสร้าง

ภาพ Register ที่ password carry มา (local capture removed) · ผลตรวจ state แบบไม่เก็บ password (local capture removed)

## 9. Button system comparison

**คำตอบตรง ๆ: NEW generic เกินไปใน primary CTA บางจุด แต่ secondary แบบ NEW เป็นทิศทางที่ถูกแล้ว** การคืน dark border และ offset เบา ๆ ช่วยได้เมื่อมันทำให้ action สำคัญดู “กดได้” ไม่ใช่ใช้เพื่อแต่งทุกกล่อง

| Action | OLD | NEW | Hybrid decision |
|---|---|---|---|
| + RANK / + Create | Lime + dark outline/offset เด่น แต่ชื่อ RANK พาไป Create | Neutral Create ชื่อชัดกว่า แต่ลายเซ็นภาพลดลง | ใช้ชื่อ + Create; global nav ไม่จำเป็นต้องเด่นกว่าปุ่มงานหลักทุกหน้า ใช้ outline ที่ชัดและ accent ตาม context |
| Publish | Sticky lime มีกรอบและ offset | Sticky lime มุมมนเรียบ | คืน outline 1–2px + offset ประมาณ 2px; progress ยังอ่านชัด ไม่เพิ่ม hero |
| Rank mine / Use Template | มักเป็น neutral/dark และศัพท์เชิงระบบ | Lime และ outcome ชัด | เก็บ Rank mine; เพิ่ม dark outline/subtle offset เฉพาะ primary ที่ใช้งานจริง |
| Search | Lime framed search action + violet search shadow | Lime action ใน field/container กลมสะอาด | ใช้ขอบชัดกับปุ่ม ไม่ต้อง shadow ทั้ง search panel; ผลลัพธ์สำคัญกว่า decoration |
| Try Ranking / Pick something to rank | เด่นมาก แต่ส่งไปสร้างจากศูนย์ | ชัดว่าเลือกหัวข้อก่อน | เก็บ NEW destination/copy คืน tactile style บน charcoal hero |
| Log In | Lime dark outline/offset | Flat lime | Hybrid primary ใช้ได้ดี; Google คง neutral |
| Sign Up | Lime dark outline/offset | Flat lime | เช่นเดียวกับ Log In แต่แก้ state ก่อน polishing |
| Create account / Back to login | Pink หรือ lime ใหญ่บน visual panel แข่งกับ submit | Neutral cream | เก็บ NEW secondary; pink ใช้เป็น illustration accent ได้ ไม่ต้องคืนให้ปุ่มทุก mode |

Press interaction: เสนอให้ offset ยุบและเลื่อนลง 1px พร้อม focus-visible ที่ชัด รองรับ reduced motion ไม่ใช้เด้ง/หมุนทุกครั้ง รอบนี้ **ไม่ได้กด submit/Publish เพื่อพิสูจน์ active state** จึงแยก recommendation นี้ออกจากสิ่งที่ทดสอบจริง

ข้อจำกัด: repeated lime CTA ในกริดหลายใบยังดูมากได้ จึงต้องทำ card ให้เงียบ ไม่เพิ่ม offset ให้ทั้ง card และ button พร้อมกัน Active nav/filter ใช้ tint/underline ได้ แต่ไม่ใช้เงาแบบเดียวกับ submit จนทุกอย่างดูเป็น primary

## 10. Final Hybrid Design Direction

### Brand และ hierarchy

- Primary **Acid Lime #D8FF45** สำหรับงานหลัก ใช้ dark text/outline ที่อ่านชัด
- Base **charcoal / cream**: charcoal ให้พื้นที่แบรนด์ใน Home/Auth; cream ให้พื้นที่อ่าน feed/form อย่าทำทุกหน้ากลายเป็น hero ดำ
- **Violet** เป็นลายเซ็นรอง เช่น context line, small sticker, focus ring หรือขอบ heroหนึ่งจุด ไม่เป็นเงาทุก card
- **Pink/Cyan** ใช้เลือกจุด: pink ในภาพประกอบ/คำชวน, cyan tint ใน Quick Add ไม่แข่งกับ lime submit
- **Tier colors เป็นข้อมูล:** custom labels และสีของแต่ละ tier ต้องคงความหมายเดิม ไม่ใช้ tier colors เป็นหมวดตกแต่งของ nav และไม่คืน glow รอบทุก tier
- ตัวตนมาจากภาษา ความเห็นจริงของคน และ visual cue ที่จำได้ ไม่ใช่จำนวนเส้นขอบหรือสีจัดบนหน้า

### Home hero

เก็บ NEW copy/hierarchy แต่เปลี่ยน surface หลักกลับเป็น charcoal มี lime emphasis จำกัดและ violet signature เล็ก ๆ เพิ่ม tier example ขนาดพออธิบาย “จัดอะไร” ไม่ต้องคืนความใหญ่/มุมเอียงทุกส่วนของ OLD Primary ไป All Topics, secondary ไป feed, New topic เป็น tertiary

### Discover fallback — แยกสิ่งที่ทำได้จริง

**ใช้ capability ปัจจุบันได้:** `/api/templates` รองรับ popular/recent และ pagination; browser แสดง 30 topics พร้อมกริดอยู่แล้ว จึงนำ 4–6 real popular topics มาแสดงใต้ quiet message ได้โดยเพิ่ม UI composition/fetch ที่เหมาะสม ไม่ต้องสร้าง recommendation backend ใหม่ ใช้หัวข้อ “Popular topics to try” ไม่เรียก “Recommended for you” ถ้าไม่ได้ personalized

**Evergreen:** เลือกจากหัวข้อจริงและใช้ label ว่า “Topics to try” ได้ หากต้องมี editorial evergreen collection ถาวร ต้องกำหนด curated IDs/config หรือสร้างระบบดูแลแยก ไม่อ้างว่าปัจจุบันมี evergreen flag อยู่แล้ว

**Recent conversations:** Pulse มี time windows แต่ quiet Now ไม่ได้แปลว่าทั้งระบบไม่มีเนื้อหา ให้เสนอการเปลี่ยน window อย่างชัดเจนหรือโชว์วันที่จริง ห้ามนำ all-time topic มาแสดงเสมือนกำลังมีคนคุยตอนนี้ การทำ global recent-comment feed/จัดอันดับ conversations/personalized recommendations ต้องตรวจและอาจเพิ่ม backend ต่างหาก; audit นี้ไม่อ้างว่ามี endpoint นั้นพร้อมใช้

### Editor / Create / Post

- Rank: board และ pool มาก่อน branding; metadata พับได้, pool count และขอบแยกชัด, sorting รองลงมา; ทดสอบ density ด้วย item ไทยยาวและภาพจริงในงาน implementation
- Create: Quick Add ต้องเห็นเป็น step แรก ใช้ selective tint และ lime Add items; form metadata เป็น neutral
- Post: ใช้ NEW เกือบทั้งหมด บอร์ดอ่านง่ายมีคุณค่ามากกว่า framed poster หนัก ๆ; เพิ่ม personality ใน author context และ action แทน
- Community: คงคำอธิบาย aggregate ที่ถูกต้อง ย่อ personal-difference summary ก่อน board; ไม่คืน “THE PEOPLE HAVE SPOKEN” เป็นข้อสรุปหลัก

### Navigation 390 / 820 / desktop

| Width | Finding | Final direction |
|---|---|---|
| 390 | OLD bottom item Saved label ถูกย่อ; NEW Profile ชัดกว่า; NEW menu โฟกัส Search อัตโนมัติ | เก็บ NEW Home/Discover/Create/Profile, Saved ในเมนูรอง; รักษา active state ที่ต่างจาก submit |
| 820 | OLD ต้องเปิด hamburger หา main destinations; NEW มี bottom nav ต่อเนื่อง | เก็บ NEW breakpoint strategy; อย่าทำ tablet เป็นช่องว่างระหว่าง desktop/mobile |
| 1280 | ทั้งคู่มี direct desktop nav; OLD +RANK เด่นแต่หมายถึง Create | เก็บ Home/Discover/Create vocabulary; primary page action เด่นกว่า navigation โดยทั่วไป |
| Expanded menu | OLD ทำ main links ซ้ำ; NEW Search/Saved/preferences สั้นกว่า | เก็บ NEW grouping; Escape ที่ทดสอบปิดเมนูและคืน focus ไป Open navigation ได้ |

ไม่พบ horizontal page overflow ใน Home/Profile ที่ 390/820 ที่ตรวจ แต่ไม่ได้เท่ากับทุก route/ทุก locale ผ่าน responsive QA ทั้งหมด

## 11. Component-by-component Keep / Change / Revert

| Component | Decision | Concrete direction |
|---|---|---|
| Home hero surface | Partial revert | คืน charcoal + violet cue; คง NEW copy/CTA destination |
| Global headings | Keep NEW | ใช้ขนาดตามหน้าที่ ไม่คืน slogan ใหญ่บน editor/community/profile |
| Primary button | Change | NEW hierarchy + OLD dark outline/subtle offset; tactile pressed/focus specification |
| Secondary button | Keep NEW | Neutral; ไม่คืน pink/cyan/offset ให้ทุก action |
| Feed card | Keep NEW + small accent | Ownership/Rank mine คงไว้; optional violet identity cue ไม่ shadow ทั้งชุด |
| Topic card preview | Keep NEW | Unranked items และ ranking count; ไม่คืน S/A preview ที่สื่อว่า topic มีคำตอบเดียว |
| Topic action group | Keep NEW | Rank mine/See community ก่อน Save/Follow/Share |
| Post board container | Keep NEW | Quiet frame; no blanket heavy-border revert |
| TierLabel | Keep NEW treatment | คงสีจากข้อมูลและ shared rendering; ไม่คืน glow |
| Rank pool/controls | Keep NEW + improve | Pool ก่อน sorting; พัฒนา density/label readability |
| Quick Add | Change | Selective tint + clear step; ไม่ cyan เต็มแรงหรือ cream เท่าทุก panel |
| Profile desktop composition | Change substantially | Compact identity/taste sidebar + rankings; conditional sticky |
| Profile mobile composition | Change | Compact identity + visible Taste/About entry before rankings |
| Profile ranking cards | Keep regular grid; revise mobile | ไม่ขยาย card แรกอัตโนมัติ; preview ต้องอ่านได้ |
| Education | Keep disclosure, move entry | อยู่ใน identity/about ไม่ท้าย 50 posts |
| Taste summary | Change placement | Discovery independent of ranking count |
| Community differences | Keep content, compact default | 1–2 gaps + expand; board ไม่ถูก 5 rows ดันพ้นจอแรก |
| Detailed statistics | Keep NEW disclosure | ความลึกมีได้แต่ไม่แย่ง conversation |
| Auth illustration | Keep both shared strengths | Mascot/charcoal ยังเป็น brand anchor ที่ดี |
| Auth state | Change | Clear both password fields and visibility state per mode transition |
| Mobile/tablet nav | Keep NEW | Profile as destination, Saved secondary, consistent <1024 behavior |

## 12. P0 / P1 / P2

### P0

**ไม่มี P0 ที่ยืนยันจาก audit นี้** ไม่พบหลักฐาน data loss/account compromise ในขอบเขต read-only และไม่ได้ทดสอบระบบ submit/backend security จึงไม่รับรองส่วนที่ไม่ได้ตรวจ

### P1 — ก่อนถือว่า redesign พร้อมเป็น final product

| Priority item | Why | Acceptance evidence needed later |
|---|---|---|
| Auth mode reset | Password/confirm ค้างเมื่อเจตนา Login/Register เปลี่ยน | Browser test สองทิศทาง: email retained, password/confirm empty, username independent, no stale errors |
| Profile Taste/About discovery | 50 initial posts สามารถฝัง social identity ไว้หลายพัน px | 3/20/100 scenario แสดง entry ก่อน grid; desktop/mobile ทั้งคู่ |
| Mobile profile card legibility | 2-column miniature board อ่านชื่อ item ยาก | 390px Thai long-name cases; อ่าน title และอย่างน้อย meaningful taste cue ได้ |
| Discover useful quiet state | หน้าค้นพบไม่มีสิ่งให้ค้นพบใน window ที่เงียบ | Real popular-topic fallback, truthful labels/dates, no fabricated activity |
| Guest/auth copy alignment | Login บอกต้อง login เพื่อเริ่ม ทั้งที่ editor เปิด guest | Copy ของ Home/Rank/Login ใช้ mental model เดียวกัน |

### P2 — Brand และ usability refinement

- Compact charcoal Home hero + NEW copy/example; ตรวจว่า feed ไม่ถูกดันลงมากเกินไปที่ 390
- Primary outline/2px offset/pressed/focus system; secondary คง neutral
- Quick Add selective tint และ step cue
- Rank pool density และพื้นที่ title/details; loading state ไม่บอก all-ranked ก่อนโหลดเสร็จ
- Compact community difference summary ก่อน board
- ลด duplicate All topics/metadata, อธิบายหรือแก้ Unknown User ที่ชั้นข้อมูล
- ทดสอบรอบต่อไปทั้ง Thai/English, dark/light, reduced motion และ keyboard flows; รอบนี้ไม่ให้คะแนนจากการคาดเดาว่าส่วนเหล่านั้นผ่าน

## 13. Screenshots side-by-side

ภาพ browser จริงจากรอบนี้ เก็บที่ `artifacts/production-vs-experimental-audit/` ภาพในตารางเป็น viewport capture ไม่ใช่ mockup; คลิกเปิดภาพต้นฉบับเพื่ออ่านข้อความเล็ก ภาพ Home อาจมี feed คนละโพสต์ตามลำดับจริงของระบบ จึงเปรียบเทียบโครงหน้า ไม่เทียบความน่าสนใจของโพสต์แรก

### Desktop 1280 × 900

| Page | OLD | NEW |
|---|---|---|
| Home | OLD Home | NEW Home |
| Discover | OLD Discover | NEW Discover |
| All Topics | OLD Topics | NEW Topics |
| Topic Detail | OLD Topic | NEW Topic |
| Post Detail | OLD Post | NEW Post |
| Rank Editor | OLD Rank | NEW Rank |
| Create | OLD Create | NEW Create |
| Community (signed-in both) | OLD Community | NEW Community |
| Own Profile | OLD Own Profile | NEW Own Profile |
| Other Profile | OLD Other Profile | NEW Other Profile |
| Login | OLD Login | NEW Login |
| Register | OLD Register | NEW Register |

### Mobile 390 × 844

| View | OLD | NEW |
|---|---|---|
| Home | OLD Home 390 | NEW Home 390 |
| Navigation open | OLD Nav 390 | NEW Nav 390 |
| Own Profile | OLD Profile 390 | NEW Profile 390 |

### Tablet 820 × 1180

| View | OLD | NEW |
|---|---|---|
| Home | OLD Home 820 | NEW Home 820 |
| Navigation open | OLD Nav 820 | NEW Nav 820 |
| Own Profile | OLD Profile 820 | NEW Profile 820 |

### Taste placement และ auth finding

| OLD sidebar after scroll | NEW Taste/Education after rankings |
|---|---|
| OLD Taste | NEW Taste Education |

NEW Register retains dummy Login password; confirm initially blank

**Final decision: HYBRID.** รักษาความหมายและเส้นทางทำงานที่ดีขึ้นของ NEW คืน brand signature ของ OLD เฉพาะ hero/primary action/identity และแก้ Profile discovery กับ auth state ก่อนประกาศว่าจบ redesign ความเป็น social opinion community ต้องเกิดจากการเห็นคน เห็นรสนิยม และเข้าร่วมได้ง่าย พร้อมบุคลิกที่จำได้—not จากความเรียบหรือความดังเพียงอย่างเดียว


> Screenshot captures and local visual-audit artifacts were removed before publishing this repository. The implementation findings above are retained.
