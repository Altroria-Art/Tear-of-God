# Mock ranking likes and text verification

Existing demo/mock data only. Removed display markers from ranking titles and replaced ranking/template descriptions. Provenance remains in IDs and prior reports. Likes were submitted via the real authenticated `/api/votes` handler using 12 existing @example.com accounts. Temporary test sessions were expired afterwards. No manual counter updates, account creation or deletions.

Verified 66 card API records against vote rows; one post-detail API also checked. Profiles: 186; rankings: 702; templates: 78. No duplicate votes or non-test voters on seeded rankings.

| Ranking | Likes (rows = card API) |
|---|---:|
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 1](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-001) | 2 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 2](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-002) | 3 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 3](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-003) | 4 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 4](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-004) | 5 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 5](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-005) | 2 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 6](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-006) | 3 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 7](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-007) | 4 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 8](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-008) | 5 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 9](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-009) | 2 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 10](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-010) | 3 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 11](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-011) | 4 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 12](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-012) | 5 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 13](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-013) | 2 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 14](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-014) | 3 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 15](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-015) | 4 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 16](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-016) | 5 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 17](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-017) | 2 |
| [ชีวิตนิสิต ม.พะเยา: กิจกรรมไหนใช่เรา · เวอร์ชัน 18](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-1-018) | 3 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 1](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-001) | 4 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 2](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-002) | 5 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 3](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-003) | 2 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 4](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-004) | 3 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 5](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-005) | 4 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 6](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-006) | 5 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 7](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-007) | 2 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 8](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-008) | 3 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 9](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-009) | 4 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 10](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-010) | 5 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 11](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-011) | 2 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 12](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-012) | 3 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 13](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-013) | 4 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 14](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-014) | 5 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 15](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-015) | 2 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 16](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-016) | 3 |
| [ม.พะเยา: มุมอ่านหนังสือในแบบของคุณ · เวอร์ชัน 17](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-2-017) | 4 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 1](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-001) | 5 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 2](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-002) | 2 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 3](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-003) | 3 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 4](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-004) | 4 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 5](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-005) | 5 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 6](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-006) | 2 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 7](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-007) | 3 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 8](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-008) | 4 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 9](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-009) | 5 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 10](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-010) | 2 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 11](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-011) | 3 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 12](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-012) | 4 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 13](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-013) | 5 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 14](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-014) | 2 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 15](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-015) | 3 |
| [ม.พะเยา: เมนูเติมพลังก่อนเข้าเรียน · เวอร์ชัน 16](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-3-016) | 4 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 1](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-001) | 5 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 2](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-002) | 2 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 3](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-003) | 3 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 4](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-004) | 4 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 5](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-005) | 5 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 6](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-006) | 2 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 7](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-007) | 3 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 8](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-008) | 4 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 9](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-009) | 5 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 10](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-010) | 2 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 11](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-011) | 3 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 12](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-012) | 4 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 13](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-013) | 5 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 14](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-014) | 2 |
| [เฟรชชี่ ม.พะเยา: ของจำเป็นติดกระเป๋า · เวอร์ชัน 15](https://tear-of-god.pages.dev/post/demo-up-rank-20260920-4-015) | 3 |
