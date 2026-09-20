# Synthetic rankings — 2026-09-20

User explicitly confirmed tear-of-god-db is the mock/demo database for coursework. Insert-only seed used rankings, ranking_items and ranking_item_scores with the same tier-index scoring formula as publishing. No account creation, notifications, counter updates or deletions. All titles/descriptions identify synthetic test data.

Verified using the live Discover request `/api/templates?limit=4`:

| Template | Rankings | Test account IDs |
|---|---:|---|
| ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา | 18 | community_001, community_002, community_003, community_004, community_005, community_006, community_007, community_008, community_009, community_010, community_011, community_012, community_013, community_014, community_015, community_016, community_017, community_018 |
| ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ | 17 | community_006, community_007, community_008, community_009, community_010, community_011, community_012, community_013, community_014, community_015, community_016, community_017, community_018, community_019, community_020, community_021, community_022 |
| ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน | 16 | community_011, community_012, community_013, community_014, community_015, community_016, community_017, community_018, community_019, community_020, community_021, community_022, community_023, community_024, community_025, community_026 |
| เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า | 15 | community_016, community_017, community_018, community_019, community_020, community_021, community_022, community_023, community_024, community_025, community_026, community_027, community_028, community_029, community_030 |

66 new rankings, 528 placements, 528 scores; 30 existing @example.com accounts. Original 636 rankings retained; profiles remain 186 and templates remain 78. Zero foreign-key violations or ineligible accounts. Popular sorting code unchanged. Local SQLite rehearsal verified repeat execution introduces no duplicates.
