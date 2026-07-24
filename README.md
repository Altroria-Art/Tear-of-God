# Tear of God

Setup:

```
npm install
cp .env.example .env   # fill in your Supabase project's URL + anon key (Settings > API)
npm run dev
```

Stack: React + Vite, Tailwind CSS 4, Supabase client (`src/lib/supabaseClient.js`).
Nothing else is built yet — routing, auth, pages, and schema are next.
See `SDS.md` for the design.
