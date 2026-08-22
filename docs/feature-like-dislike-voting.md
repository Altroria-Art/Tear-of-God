# Feature: Like / Dislike Voting

> Read this file before touching any like/dislike button — on the Home feed (`/`), the Post Detail
> page (`/post/:postId`), or the Community Rankings cards on Template Detail (`/template/:templateId`).
> All three render the same conceptual widget and must stay consistent with each other.

## 1. Scope

A logged-in user can like or dislike any ranking. There is exactly **one vote row per
(ranking, user)** — enforced by `UNIQUE(ranking_id, user_id)` on the `votes` table. The same vote
is shown in three places and every one of them must display **the same number** and **the same
pressed/unpressed state** for the same ranking:

| Where | Component |
|---|---|
| Home feed `/` | `FeedCardActionBar` in `src/pages/HomeFeed.jsx` |
| Post detail `/post/:postId` | `ActionButton` rows in `src/pages/PostDetail.jsx` |
| Template detail `/template/:templateId` | `RankingCard` in `src/pages/TemplateDetailPage.jsx` |

Guests can read counts but cannot vote — they get an `alert()` telling them to log in.

## 2. Functional Requirements

| ID | Requirement | Details | Actor |
|---|---|---|---|
| FR-V1 | Cast a vote | Like or dislike a ranking; persisted to D1 immediately | User (must be logged in) |
| FR-V2 | Toggle a vote off | Pressing the already-active button removes the vote entirely | User |
| FR-V3 | Switch a vote | Like → Dislike (or reverse) replaces the existing row, never adds a second | User |
| FR-V4 | Remember my vote | After reload or navigating between the three pages, my own button stays highlighted | User |
| FR-V5 | Consistent counts | The like/dislike numbers are identical on all three pages and match the DB | Guest, User |

## 3. How the numbers are computed

Both counts are **always live aggregates** — never cached, never stored on the `rankings` row:

```
likes    = COUNT(*) FROM votes WHERE ranking_id = ? AND vote_type = 'like'
dislikes = COUNT(*) FROM votes WHERE ranking_id = ? AND vote_type = 'dislike'
user_vote = (SELECT vote_type FROM votes WHERE ranking_id = ? AND user_id = <viewer>)
```

`user_vote` is `'like'`, `'dislike'`, or `null`. It is **per viewer**, so it is only returned when
the request supplies `user_id`. Without `user_id` it is always `null` (guest view).

## 4. Vote state machine

Client state holds the **raw DB value** — `'like' | 'dislike' | null` — deliberately identical to
what the API sends and accepts. Do **not** invent a parallel vocabulary (`'liked'`/`'disliked'`);
that mapping layer was a source of bugs and is gone.

| Current state | Press Like | Press Dislike |
|---|---|---|
| `null` | `'like'` | `'dislike'` |
| `'like'` | `null` (toggle off) | `'dislike'` |
| `'dislike'` | `'like'` | `null` (toggle off) |

The client sends the **target** state as `voteType`. `voteType: null` means "delete my vote".

## 5. API Contracts

### `POST /api/votes`
```
body: { rankingId, userId, voteType }      // voteType: 'like' | 'dislike' | null
→ { success, userVote, likes, dislikes }   // authoritative state AFTER the write
```
The response carries the recomputed truth so the client never has to guess by adding ±1.

### `GET /api/rankings?user_id=<viewer>` (list) and `GET /api/rankings?id=<id>&user_id=<viewer>` (detail)
```
{ ...ranking,
  stats: { likes, dislikes, comments },
  user_vote: 'like' | 'dislike' | null }   // null when user_id is omitted (guest)
```
`user_id` on the **list** endpoint has a second, unrelated job: when no `sort` is given it also
switches the feed to a personalised `ORDER BY` (used by the Home feed). An explicit `sort` value
(`liked` / `recent`) always wins over that personalised ordering — see §8 for why this matters.

Client wrappers: `src/lib/api.js` — `fetchRankings({ userId, sort, ... })`,
`fetchRanking(postId, userId)`, `voteRanking({ rankingId, userId, voteType })`

## 6. Client integration rules

1. **Initialise from the server.** Vote state must be seeded from `ranking.user_vote`, never from
   `useState(null)` and never from `localStorage`.
2. **Optimistic update, then reconcile.** Apply the state-machine transition locally for instant
   feedback, then overwrite `userVote`/`likes`/`dislikes` with the values the `POST` returns. On
   failure, roll back to the previous values.
3. **Never store counts client-side.** No `localStorage`, no context cache. The DB is the only
   source of truth.

## 7. Related files

| File | Role |
|---|---|
| `functions/api/votes.js` | `POST` — insert / update / delete the vote row, return fresh counts |
| `functions/api/rankings.js` | `GET` list + detail — supply `likes_count`, `dislikes_count`, `user_vote` |
| `src/lib/api.js` | `voteRanking`, `fetchRanking`, `fetchRankings` wrappers |
| `src/pages/HomeFeed.jsx` | `FeedCardActionBar` |
| `src/pages/PostDetail.jsx` | vote row (`ActionButton` like/dislike) |
| `src/pages/TemplateDetailPage.jsx` | `RankingCard` vote footer |
| `src/components/feed/ActionButton.jsx` | shared button (`pressed` / `activeClass` props) |

## 8. Traps — do not repeat

- **`PostDetail.jsx` used to never call the API at all.** Its `handleVote` mutated React state and
  wrote `localStorage` only, so every vote cast on `/post/:id` was silently lost. If you add a new
  vote surface, the first thing to verify is that `voteRanking` is actually imported *and* awaited.
- **Never mirror counts into `localStorage`.** The old code read `tog_likes_<id>` / `tog_dislikes_<id>`
  in preference to `data.stats.likes`. Those keys were per-browser and **not per-user**, so they
  drifted permanently out of sync with D1 — this is exactly why the same post showed different
  numbers on the feed and on its detail page. The keys `tog_likes_*`, `tog_dislikes_*`, and
  `tog_interaction_*` are dead; do not reintroduce them.
- **Never seed vote state with `useState(null)`.** Without `user_vote` from the server, a reload
  leaves the button unpressed even though the vote exists in D1. The user then presses Like again;
  `votes.js` just re-`UPDATE`s the same row (count unchanged) while the client does `likes + 1`
  locally — the displayed number silently inflates above the real one.
- **Do not add ±1 arithmetic as the final word.** Local arithmetic is fine as an optimistic
  placeholder, but the value that sticks must come from the `POST /api/votes` response.
- **Watch the bind order in the list query of `rankings.js`.** The `user_vote` subquery sits in the
  `SELECT` clause, so its parameter must be bound *before* the `WHERE` and `ORDER BY` parameters.
- **`user_id` on the list endpoint used to always force personalised sort**, silently ignoring any
  `sort` value the caller passed. That was fine while only the Home feed (which never sends `sort`)
  used `user_id` — but the moment Template Detail started sending `userId` to get `user_vote`, its
  Most Liked / Recent dropdown would have silently stopped working. `sort` must win over the
  personalised branch whenever it is explicitly provided.
