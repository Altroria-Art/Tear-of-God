# Feature: Hashtag Coverage Expansion (32 → 62 templates)

> Read this before touching `templates-seed.sql`, `scripts/gen-community-seed.mjs`, or
> `community-rankings-seed.sql`. All three must stay in lockstep — see §3 Traps.

## 1. Scope

Discover (`/discover`, `/discover/hashtags`) showed a lopsided hashtag distribution: 31 of 40
hashtags had exactly one template each, while `#Anime`/`#Gaming`/`#Movie` had 6. This feature adds
30 templates (`tmpl_033`–`tmpl_062`) distributed across existing hashtags — no new hashtags — so the
top tags clear 10 and no tag is left at 1.

## 2. Functional Requirements

| ID | Requirement | Details |
|---|---|---|
| FR-H1 | Reuse existing hashtags only | Every tag on a new template must already appear in the 40-tag set; no new tags introduced |
| FR-H2 | Tags must be genuinely relevant | A template gets a secondary tag only when its content actually fits that tag (no padding for count's sake) |
| FR-H3 | Top tags exceed 10 | `#Anime`, `#Gaming`, `#Movie` each reach 11+ |
| FR-H4 | No tag left at 1 | Every one of the 31 previously-singleton tags reaches at least 2 |
| FR-H5 | D1 write budget respected | The regenerated community seed must stay comfortably under the 100,000 rows-written/day free-plan limit — see §4 |

## 3. Traps

- **`OLD_USE_COUNT` must gain an entry for every new template id.** A missing key makes
  `rankingCountFor` compute `Math.round(undefined / N) → NaN`; the ranking loop then runs zero times
  and the template silently gets no community rankings at all. This has bitten this project before.
- **`tnum` in the generator comes from array index, not from `tmpl.id`.** New templates must be
  appended at the *end* of the `TEMPLATES` array — inserting mid-array shifts every `tnum` downstream
  and desyncs ranking/vote/comment ids from their templates.
- **Item name/order/tier-label parity is manual.** `templates-seed.sql`'s `template_items` block and
  the generator's `TEMPLATES[].items` array must match byte-for-byte per template, or the Community
  Average histogram silently drops or misattributes items. Verify with a script, not by eye.
- **Hashtag CSV formatting**: no spaces around commas, keep the leading `#`, and casing is
  significant (`GROUP BY tag` in `functions/api/hashtags.js` uses BINARY collation). `#anime` and
  `#Anime` would show as two separate tags.
- **`category` must equal the first hashtag, lowercased, minus `#`.** That's what real user content
  produces (`Create.jsx`, `RankTierList.jsx` both derive `category` this way from
  `selectedHashtags[0]`), so seed data that diverges makes category filtering behave differently for
  seed vs. real posts.

## 4. Why votes dominate the D1 write budget

Cloudflare D1's free plan allows **100,000 rows written per day**, resetting 00:00 UTC. Before this
change, the generated community seed (32 templates) was already ~43,000 raw rows, of which **31,391
(73%) were `votes` rows** — because likes/dislikes have no counter column. `functions/api/rankings.js`
always derives displayed counts live:

```sql
SELECT COUNT(*) FROM votes WHERE ranking_id = ? AND vote_type = 'like'
```

So a post showing "202 likes" needs 202 real rows in `votes`, one per (ranking, voter) pair — that is
what makes `UNIQUE(ranking_id, user_id)` enforceable and lets the UI show *your* vote state. There is
no cheaper design available without breaking that guarantee (`docs/feature-like-dislike-voting.md`
§3 is explicit that these counts are always live aggregates, never cached on the row).

**D1 bills DELETE and index maintenance as writes too.** Cloudflare's docs state write operations
include INSERT/UPDATE/DELETE, and that writing to an indexed column costs "two rows written: one to
the table itself, and one to the index." `votes` carries a primary key, the
`UNIQUE(ranking_id, user_id)` autoindex, `idx_votes_ranking_id`, and `idx_votes_user_id` — so one
vote row can plausibly cost more than 1 row written. The docs never state the exact multiplier for N
indexes on one table, so this document treats it as an unconfirmed worst case, not a precise number.

**Given that, this expansion deliberately reduces vote volume** rather than trying to out-earn the
limit: `rankingCountFor` drops from an average of ~21 rankings/template to ~10, and `voteCountFor`
drops from an average of ~46 votes/ranking to ~17 (still skewed — a few posts still read as
"viral" — just not every post landing in the hundreds). `FILLER_VOTER_COUNT` (anonymous profiles that
exist purely to be distinct voters, never shown by name) shrinks accordingly, since it only needs to
exceed the largest single ranking's vote count.

**This round stays local only** (per explicit decision) — nothing here is pushed to remote D1. Before
any future push, re-derive the real number: push the small files first (`templates-seed.sql` is a
few hundred rows), read the actual `rows written` off the Cloudflare D1 dashboard, and use that to
confirm whether the index multiplier is closer to 1x or 5x before pushing the much larger community
seed.

## 5. Related files

| File | Role |
|---|---|
| `templates-seed.sql` | Template + template_items rows, hand-written |
| `scripts/gen-community-seed.mjs` | Generates `community-rankings-seed.sql` deterministically; `TEMPLATES` array must mirror `templates-seed.sql` |
| `community-rankings-seed.sql` | Generated output — never hand-edited, regenerate instead |
| `functions/api/hashtags.js` | Reads hashtags only from the `templates` table, never from `rankings.hashtags` |
| `functions/api/rankings.js` | Where like/dislike/comment counts are computed live from `votes`/`comments` |
