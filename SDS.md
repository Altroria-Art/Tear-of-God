# Software Design Specification: Tear of God

**Social Platform for Creating and Ranking Tier Lists**
(แพลตฟอร์มโซเชียลสำหรับการสร้างและจัดอันดับเทียร์ลิสต์)

| | |
|---|---|
| **Advisor** | ดร. ณัฐพล หาญสมุทร |
| **Team** | 67025044 รินรพัชร แสนคำ · 67022928 สมพล หยดย้อย · 67023019 อภิทรัพย์ ภาระหันต์ |
| **Version** | 1.0 |
| **Date** | 16 July 2026 |
| **Status** | Draft — ต้องให้ทีมรีวิว [Section 9](#9-design-decisions--open-assumptions) ก่อน finalize |

> เอกสารฉบับนี้จัดทำต่อยอดจาก Project Proposal ของทีม โดยมี Claude (Anthropic) ช่วยร่างตามคำสั่งงานที่ให้ใช้ AI ช่วยเขียน SDS

---

## 1. Introduction

### 1.1 Purpose
เอกสารนี้อธิบาย **การออกแบบ** ของระบบ Tear of God ในระดับที่ทำให้ผู้อ่าน (ผู้สอน, เพื่อนร่วมทีม, หรือ dev ที่เข้ามาใหม่) เข้าใจสถาปัตยกรรม โครงสร้างข้อมูล และ flow การทำงานหลัก โดยไม่ต้องไล่อ่านโค้ด ต่างจาก Project Proposal ที่เน้นตอบคำถามว่า "ทำไมถึงทำ" และ "ระบบทำอะไรได้บ้าง" เอกสารนี้เน้นตอบคำถามว่า **"ระบบถูกออกแบบมาให้ทำงานแบบนั้นได้อย่างไร"**

### 1.2 Scope
ระบบเป็นเว็บแอปพลิเคชันโซเชียลขนาดเล็กที่มี core feature คือการสร้าง Tier List (จัดอันดับ S/A/B/C/D หรือ Top 10), การ remix Tier List ของผู้อื่น, การมีปฏิสัมพันธ์ (like/comment/share) และการรวบรวมผลโหวตมาแสดงเป็นสถิติ/เทรนด์ ครอบคลุมทั้งฝั่ง User ทั่วไปและฝั่ง Admin

### 1.3 Definitions
| คำศัพท์ | ความหมาย |
|---|---|
| **Template** | ชุด item pool + metadata (ชื่อ, หมวดหมู่, คำอธิบาย, mode) ที่ผู้สร้างคนแรกกำหนดไว้ ใช้เป็นต้นแบบให้คนอื่น remix ได้ |
| **Ranking** (Tier List) | การจัดอันดับ item ของ Template หนึ่ง ๆ โดยผู้ใช้คนใดคนหนึ่ง (อาจเป็นผู้สร้าง Template เองหรือคน remix) |
| **Remix** | การที่ผู้ใช้หยิบ Template ของคนอื่นมาสร้าง Ranking ในแบบของตัวเอง |
| **Tier Label** | ชื่อระดับการจัดอันดับ (S, A, B, C, D) ตายตัว 5 ระดับ แก้ไขไม่ได้หลังสร้าง Template |
| **Top 10 Mode** | โหมดจัดอันดับแบบตำแหน่ง 1–10 แทนที่จะเป็น tier label |

### 1.4 References
- Project Proposal — `proposal.pdf` (เอกสารต้นฉบับที่แนบมา)
- UI/UX Mockup — Google Stitch: `https://stitch.withgoogle.com/projects/2992567517623773020` (ต้องล็อกอินเพื่อดู ไม่สามารถดึงเนื้อหามาอ้างอิงในเอกสารนี้ได้โดยตรง — อ้างอิง wireframe จาก proposal.pdf หน้า 8–16 แทน)

---

## 2. System Overview

### 2.1 Product Perspective
Tear of God เป็นระบบแบบ **feed-based social app** (คล้าย pattern ของ short-form content feed ทั่วไป) แต่หน่วยเนื้อหาคือ "Tier List" แทนที่จะเป็นวิดีโอ/รูปภาพ จุดต่างจากเว็บจัดอันดับทั่วไปคือมี layer สถิติ/เทรนด์ที่รวบรวมจากพฤติกรรมโหวตของผู้ใช้ทั้งหมด

### 2.2 User Classes
| Actor | คำอธิบาย |
|---|---|
| **Guest** | ผู้ใช้ที่ยังไม่ล็อกอิน ดูฟีดหลักและเทรนด์ได้ แต่สร้าง/โหวต/คอมเมนต์ไม่ได้ |
| **User** | สมาชิกที่ล็อกอินแล้ว ทำได้ทุกอย่างใน scope 4.1 |
| **Admin** | ผู้ดูแลระบบ เข้าถึงหน้าหลังบ้านเพื่อจัดการเนื้อหาและผู้ใช้ |

### 2.3 Operating Environment
Responsive web application รันบน browser สมัยใหม่ (Chrome/Edge/Safari ล่าสุด) ไม่มีการระบุแอปมือถือแยกใน proposal — ถือว่า responsive design ครอบคลุม mobile web ตาม wireframe ที่ออกแบบใน Google Stitch

---

## 3. Functional Requirements

| ID | Requirement | รายละเอียด | Actor | Proposal Ref |
|---|---|---|---|---|
| FR-1 | Register | สมัครบัญชีด้วยอีเมล/รหัสผ่าน | Guest | 4.1.1 |
| FR-2 | Login / Forgot Password | ล็อกอิน และรีเซ็ตรหัสผ่านผ่านอีเมลกรณีลืม | Guest, User | 4.1.1 |
| FR-3 | Edit Profile | เปลี่ยนชื่อผู้ใช้และรูปโปรไฟล์ | User | 4.1.2 |
| FR-4 | View My Templates & Rankings | ดูรายการ Template ที่สร้าง และ Ranking ที่เคยเข้าร่วม | User | 4.1.2 |
| FR-5 | Browse Home Feed | เลื่อนดูฟีดแบบ Infinite Scroll พร้อม Trending Topics | Guest, User | 4.1.3 |
| FR-6 | Create Tier List (Normal Mode) | ตั้งชื่อ/หมวดหมู่/คำอธิบาย, เพิ่ม item ผ่าน Quick Add (text-to-item) แล้วจัดลง 5 tier (S/A/B/C/D) | User | 4.1.4 |
| FR-7 | Create Tier List (Top 10 Mode) | สุ่มนำเสนอ item ทีละตัวให้จัดลงตำแหน่ง 1–10 ห้ามซ้ำตำแหน่ง | User | 4.1.4 |
| FR-8 | Remix Template | นำ Template ผู้อื่นมาจัด Ranking ใหม่, เพิ่ม item ใหม่ได้, **แก้ tier label ไม่ได้** | User | 4.1.5 |
| FR-9 | View Statistics | ดูสถิติภาพรวมของ Template และของ Ranking ย่อย พร้อมจำนวนผู้ใช้ที่ใช้ Template นั้น | User | 4.1.6 |
| FR-10 | Like / Comment / Share | กดถูกใจ, คอมเมนต์, และคัดลอกลิงก์แชร์ Ranking | User | 4.1.7 |
| FR-11 | Admin Login | ล็อกอินเข้าระบบหลังบ้านแยกจากผู้ใช้ทั่วไป | Admin | 4.2.1 |
| FR-12 | Content Moderation | ตรวจสอบข้อมูลภาพรวม, ลบ/แก้ไข Ranking และลบคอมเมนต์ที่ผิดกฎ | Admin | 4.2.2 |
| FR-13 | Ban User | ระงับบัญชีผู้ใช้งาน | Admin | 4.2.2 |
| FR-14 | Personalized Feed | ปรับลำดับเนื้อหาในฟีดตามหมวดหมู่ที่ผู้ใช้กดถูกใจบ่อย | User | 4.3.1 |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Home Feed ใช้ cursor-based pagination (ไม่ใช้ large `OFFSET`) เพื่อรองรับ Infinite Scroll โดยไม่หน่วง |
| NFR-2 | Security | ใช้ Supabase Row Level Security (RLS): user แก้ไข/ลบได้เฉพาะ ranking/comment ของตัวเอง, เฉพาะ `role = admin` เท่านั้นที่ลบเนื้อหาคนอื่นหรือ ban user ได้ |
| NFR-3 | Data Integrity | Tier label ต้องถูกจำกัดที่ 5 ค่าคงที่ผ่าน `CHECK` constraint หรือ Postgres `enum` ระดับฐานข้อมูล ไม่ใช่แค่ validate ฝั่ง frontend |
| NFR-4 | Usability | Responsive layout ให้ตรงกับ wireframe ที่ออกแบบใน Google Stitch ทั้ง desktop และ mobile web |
| NFR-5 | Scalability | Query สำหรับ trending/personalized feed ออกแบบให้ปรับเป็น materialized view ได้ภายหลังหากจำนวนผู้ใช้เพิ่มขึ้นมาก |
| NFR-6 | Reliability | Session/token handling อ้างอิง Supabase Auth default (client ต้อง handle refresh token) |

---

## 5. System Architecture

### 5.1 Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        UI["React SPA<br/>Tailwind CSS"]
    end

    subgraph Supabase["Supabase (BaaS)"]
        Auth["Auth"]
        DB[("PostgreSQL")]
        Storage["Storage"]
        Realtime["Realtime"]
    end

    UI -->|"supabase-js: signUp / signIn"| Auth
    UI -->|"supabase-js: CRUD ผ่าน RLS policy"| DB
    UI -->|"supabase-js: upload avatar"| Storage
    UI -.->|"subscribe: like/comment count"| Realtime
    Realtime -.-> DB
```

ระบบไม่มี custom backend server แยก — proposal ระบุ Backend = Supabase ตรง ๆ จึงออกแบบเป็น **BaaS architecture**: React เรียก Supabase ผ่าน `@supabase/supabase-js` โดยตรง ความปลอดภัยของข้อมูลอยู่ที่ชั้น RLS policy ในฐานข้อมูลแทนที่จะมี API layer คั่นกลาง

### 5.2 Component Breakdown

| Module | หน้าที่ | Screens ที่เกี่ยวข้อง |
|---|---|---|
| `auth/` | สมัคร/ล็อกอิน/ลืมรหัสผ่าน | Login |
| `feed/` | Home Feed, category tabs, infinite scroll, personalization | Home (For You/Trending/Anime/Movie/Food/Sport) |
| `create/` | ฟอร์มสร้าง Template + Ranking Canvas (Normal/Top 10) | Create Tier List |
| `discover/` | เรียกดู Template ตามหมวดหมู่, popular templates | Discover |
| `ranking-detail/` | หน้ารายละเอียด Ranking, Community Rankings, Rank this Template | Template/Ranking detail |
| `profile/` | ดู/แก้ไขโปรไฟล์, Templates Created, Participated Tier Lists | Profile, Edit Profile modal |
| `admin/` | Protected route จัดการเนื้อหา/ผู้ใช้ | (ไม่มี wireframe แนบ — ดู Section 9) |

### 5.3 Technology Stack

| Layer | เทคโนโลยี |
|---|---|
| Frontend | React |
| UI Framework | Tailwind CSS |
| Backend | Supabase (Auth, Database, Storage, Realtime) |
| Database | PostgreSQL |
| UX/UI Design | Google Stitch |

---

## 6. Data Design

### 6.1 Entity-Relationship Diagram

```mermaid
erDiagram
    PROFILES ||--o{ TEMPLATES : creates
    PROFILES ||--o{ RANKINGS : creates
    PROFILES ||--o{ LIKES : gives
    PROFILES ||--o{ COMMENTS : writes
    CATEGORIES ||--o{ TEMPLATES : classifies
    TEMPLATES ||--o{ TEMPLATE_ITEMS : contains
    TEMPLATES ||--o{ RANKINGS : "ranked as"
    RANKINGS ||--o{ RANKING_ITEMS : contains
    TEMPLATE_ITEMS ||--o{ RANKING_ITEMS : "placed in"
    RANKINGS ||--o{ LIKES : receives
    RANKINGS ||--o{ COMMENTS : receives

    PROFILES {
        uuid id PK
        string username
        string avatar_url
        string bio
        string role
        timestamp created_at
    }
    CATEGORIES {
        int id PK
        string name
    }
    TEMPLATES {
        uuid id PK
        uuid creator_id FK
        int category_id FK
        string title
        string description
        string mode
        int use_count
        timestamp created_at
    }
    TEMPLATE_ITEMS {
        uuid id PK
        uuid template_id FK
        string label
        string image_url
    }
    RANKINGS {
        uuid id PK
        uuid template_id FK
        uuid user_id FK
        string note
        timestamp created_at
    }
    RANKING_ITEMS {
        uuid id PK
        uuid ranking_id FK
        uuid item_id FK
        string tier_label
        int position
    }
    LIKES {
        uuid id PK
        uuid ranking_id FK
        uuid user_id FK
        timestamp created_at
    }
    COMMENTS {
        uuid id PK
        uuid ranking_id FK
        uuid user_id FK
        string content
        timestamp created_at
    }
```

### 6.2 Table Descriptions
- **profiles** — ต่อยอดจาก `auth.users` ของ Supabase (1-1), เก็บ `role` (`user` / `admin`) สำหรับ FR-11–13
- **templates** — item pool ต้นแบบ, `mode` เป็น `normal` หรือ `top10`, `use_count` นับจำนวน ranking ที่ผูกกับ template นี้ (สำหรับ FR-9)
- **template_items** — item ที่อยู่ใน pool ของ template หนึ่ง ๆ, `image_url` รองรับกรณี auto-generate จาก Quick Add (text-to-image block ตาม 4.1.4)
- **rankings** — การจัดอันดับหนึ่งครั้งของ user หนึ่งคนต่อ template หนึ่งอัน (ทั้งของผู้สร้างเองและคน remix)
- **ranking_items** — mapping ว่า item แต่ละตัวถูกจัดไว้ที่ tier ไหน (`tier_label` = S/A/B/C/D) หรือตำแหน่งไหน (`position` = 1–10 สำหรับ Top 10 Mode)
- **likes / comments** — ผูกกับ `rankings` (ไม่ใช่ `templates`) เพราะ engagement เกิดที่ post ในฟีดซึ่งคือ ranking หนึ่ง ๆ ตาม wireframe

### 6.3 Business Rule Constraints
- **Fixed tier labels**: `ranking_items.tier_label` ต้องอยู่ในชุดค่าคงที่ (`S`,`A`,`B`,`C`,`D`) — บังคับด้วย `CHECK` constraint ที่ DB, ไม่ปล่อยให้ frontend เป็นเกราะป้องกันเดียว (NFR-3)
- **Top 10 uniqueness**: เมื่อ `templates.mode = 'top10'`, `ranking_items.position` ต้อง unique ภายใน `ranking_id` เดียวกัน (1–10 ห้ามซ้ำ) — แนะนำใช้ unique constraint บนคู่ `(ranking_id, position)`
- **Remix ห้ามแก้ tier label**: enforce ที่ frontend (UI ไม่ให้แก้ชื่อ tier) และควร enforce ซ้ำที่ DB layer (RLS policy หรือ trigger) เพราะ tier label เป็นคีย์สำคัญสำหรับการรวมสถิติข้าม ranking

---

## 7. Interface Design

### 7.1 Screen Inventory
อ้างอิงจาก wireframe ใน `proposal.pdf` (หน้า 8–16):

| Screen | Purpose | Key Elements |
|---|---|---|
| Login | เข้าสู่ระบบ/สมัครสมาชิก | Email/Password field, "Continue with Google", link ไปหน้าสมัคร |
| Home Feed | ฟีดหลัก แยกตาม tab (For You / Trending / Movies / Anime / Food / Sports) | Card ต่อ 1 ranking: avatar, username, category tag, tier rows (สี S=แดง, A=ส้ม, B=เหลือง, C=เขียว, D=ฟ้า), like/comment count, ปุ่ม "Use Template" |
| Create Tier List — Normal Mode | สร้าง Template + Ranking แบบ 5 tier | ฟอร์ม (Template Name, Category, Description), Quick Add Items (textarea + Generate Cards), Ranking Canvas 5 แถวสี, Unranked Items Pool |
| Create Tier List — Top 10 Mode | สร้าง Ranking แบบตำแหน่ง 1–10 | สลับโหมดด้วย toggle, ต้องมี item ครบ 10 ชิ้นพอดี, ช่องตำแหน่ง 1–10 |
| Ranking Detail | ดู/แก้ไข ranking หนึ่งรายการ | ชื่อ ranking (แก้ได้), Save Ranking, Share, ปุ่ม Shuffle Items / Sort A-Z |
| Discover | ค้นหา Template ตามหมวดหมู่ | Category grid (Anime/Movie/Food/Sport), Popular Templates cards พร้อมจำนวนผู้ใช้ |
| Community Rankings (จาก Discover) | ดูภาพรวมผลโหวตของชุมชนต่อ Template | Sort dropdown (เช่น Most Liked), toggle "Community Average" |
| Profile | ดูผลงานของตัวเอง | Tab "Templates Created" / "Participated Tier Lists", ปุ่ม Edit Profile |
| Edit Profile (modal) | แก้ไขข้อมูลส่วนตัว | Username, Bio, Save Changes |

### 7.2 Key UI Components
- **Ranking Canvas** — reusable component ใช้ทั้งตอนสร้างและตอน remix, รับ prop เป็น tier labels (fixed 5 แบบ หรือ 1–10) และ item list
- **Tier Color Convention** — S = แดง, A = ส้ม, B = เหลือง, C = เขียว, D = ฟ้า (ใช้สม่ำเสมอทุกหน้าที่แสดง tier)
- **Quick Add Items** — text parser ที่รับ comma-separated string แล้ว generate เป็น item card อัตโนมัติ (ตรงกับ FR-6)

---

## 8. Use Cases & Key Flows

### 8.1 Actor / Use Case Summary
ดู Use Case Diagram ต้นฉบับใน `proposal.pdf` หน้า 6–7 ประกอบ

| Actor | Use Cases |
|---|---|
| Guest | View Home Feed & Trends, Register |
| User | ทุกอย่างที่ Guest ทำได้ + Login, Manage Profile, Create Tier List (Normal/Top 10), Remix, Like/Comment/Share, View Statistics |
| Admin | Login to Backend, Review Overview Data, Edit/Delete Inappropriate Ranking, Delete Rule-breaking Comments, Ban User |

### 8.2 Sequence Diagram: Create Tier List (Normal Mode)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as React Frontend
    participant SB as Supabase (Auth + DB)

    U->>FE: เปิดหน้า "Create Tier List"
    FE->>U: แสดงฟอร์ม (name, category, description, mode)
    U->>FE: กรอก Quick Add Items (comma-separated)
    FE->>FE: parse text เป็น item cards
    U->>FE: ลาก item ลง tier S/A/B/C/D
    U->>FE: กด "Publish List"
    FE->>SB: INSERT templates (title, category_id, mode, creator_id)
    SB-->>FE: template_id
    FE->>SB: INSERT template_items (bulk)
    SB-->>FE: item_ids
    FE->>SB: INSERT rankings (template_id, user_id)
    SB-->>FE: ranking_id
    FE->>SB: INSERT ranking_items (ranking_id, item_id, tier_label)
    SB-->>FE: success
    FE->>U: redirect ไป Home feed, แสดง post ใหม่
```

### 8.3 Sequence Diagram: Remix Template

```mermaid
sequenceDiagram
    actor U as User
    participant FE as React Frontend
    participant SB as Supabase (Auth + DB)

    U->>FE: กด "Use Template" จาก Home/Discover
    FE->>SB: SELECT template + template_items WHERE template_id
    SB-->>FE: template data + items
    FE->>U: แสดง Ranking Canvas (tier label fix, ห้ามแก้ชื่อ)
    U->>FE: จัด item ลง tier (เพิ่ม item ใหม่ได้)
    alt มี item ใหม่
        FE->>SB: INSERT template_items ใหม่ (ผูกกับ template_id เดิม)
        SB-->>FE: item_id ใหม่
    end
    U->>FE: กด "Save Ranking"
    FE->>SB: INSERT rankings (template_id, user_id)
    SB-->>FE: ranking_id
    FE->>SB: INSERT ranking_items (bulk)
    SB-->>FE: success
    FE->>SB: UPDATE templates SET use_count = use_count + 1
    FE->>U: แสดง ranking ที่เพิ่ง publish
```

---

## 9. Design Decisions & Open Assumptions

Proposal ไม่ได้ลงรายละเอียดระดับ implementation ไว้ทั้งหมด ส่วนนี้สรุปจุดที่เอกสารนี้ "ตัดสินใจแทน" และควรให้ทีมยืนยันก่อนเริ่ม implement จริง:

1. **BaaS ไม่มี custom backend** — ตีความจาก proposal ที่ระบุ Backend = Supabase ตรง ๆ ถ้าในทางปฏิบัติต้องการ logic ที่ซับซ้อนเกินกว่า RLS จะรองรับ (เช่น batch job คำนวณ trending หนัก ๆ) แนะนำเพิ่ม Supabase Edge Functions แทนการตั้ง server แยก เพื่อไม่ต้องดูแล infra เพิ่ม
2. **Remix เพิ่ม item เข้า shared pool** — กำหนดให้ item ใหม่ที่เพิ่มระหว่าง remix ถูก insert เข้า `template_items` ของ template เดิม (ไม่ใช่แยกเฉพาะ ranking ของคนนั้น) เพื่อให้คน remix คนถัดไปเห็น item ครบและสถิติสะสมถูกต้อง — proposal ไม่ได้ระบุจุดนี้ชัดเจน ต้อง confirm กับทีม
3. **Personalized feed แบบ query-time** — เริ่มจาก aggregate query (`COUNT` likes group by category ของ user ใน N วันล่าสุด) แทนการสร้างตารางสะสมคะแนนแยก เพื่อความง่ายในสโคปนักศึกษา ค่อย migrate เป็น materialized view ถ้าข้อมูลโตขึ้นจริง (NFR-5)
4. **Admin เป็น protected route ใน SPA เดียวกัน** ไม่ใช่แอปแยก — ลด overhead การดูแลสองโปรเจกต์ ใช้ role-based guard ผ่าน `profiles.role`
5. **Top 10 randomization** — ตีความ "สุ่มคำตอบมาทีละอัน" (4.3.2) เป็นกลไก client-side สุ่มลำดับ item จาก unranked pool มาให้ทีละตัว บังคับผู้ใช้เลือกตำแหน่งก่อนเห็นตัวถัดไป — ควร confirm กับทีมว่าตรงกับที่ตั้งใจไว้ เพราะ wireframe หน้า 12 แสดงแค่ layout ตำแหน่ง 1–10 ไม่ได้แสดงกลไกการสุ่มโดยตรง

---

## Appendix A: Project Timeline

| Month | Week | Milestone |
|---|---|---|
| June | 1 | ปรึกษาอาจารย์ที่ปรึกษาเรื่องหัวข้อ |
| June | 2–3 | ศึกษาหาข้อมูล |
| June | 4 | คุยกับอาจารย์เรื่องฟีเจอร์ที่จะทำ |
| July | 1 | ออกแบบ UX/UI และฐานข้อมูล |
| July | 2–3 | เริ่มพัฒนา Frontend |
| July | 4 | ปรับปรุง UI และทดสอบเบื้องต้น |
| August | 1 | เริ่มพัฒนา Backend |
| August | 2 | พัฒนาระบบจัดการข้อมูล |
| August | 3 | Backend สมบูรณ์ |
| August | 4 | เริ่มทำรูปเล่มโครงการ |
| September | 1–2 | ปรับปรุงตามข้อเสนอแนะ |
| September | 3 | ทดสอบระบบโดยรวม |
| September | 4 | จัดทำรายงานฉบับสมบูรณ์ |

## Appendix B: References
- Project Proposal: `proposal.pdf`
- UI/UX Mockup (Google Stitch): `https://stitch.withgoogle.com/projects/2992567517623773020`
