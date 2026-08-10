export const CATEGORIES = ['For You', 'Trending', 'Movies', 'Anime', 'Food', 'Sports']

// Placeholder until the schema lands — shape mirrors a future `rankings` row
// joined with its profile, category, and ranking_items.
export const MOCK_POSTS = [
  {
    id: 'post-1',
    author: { name: 'Alex Mercer', avatarUrl: null },
    postedAt: '2 hours ago',
    category: 'Sports',
    title: 'GOAT NBA Players of All Time',
    templateName: 'GOAT NBA Players',
    tiers: [
      { tier: 'S', items: ['Michael Jordan', 'LeBron James'] },
      { tier: 'A', items: ['Kobe Bryant', 'Magic Johnson'] },
    ],
    stats: { likes: '1.2k', comments: 342 },
  },
  {
    id: 'post-2',
    author: { name: 'Sarah Chen', avatarUrl: null },
    postedAt: '5 hours ago',
    category: 'Movie',
    title: 'Best Sci-Fi Movies of the 2010s',
    templateName: 'Sci-Fi Movies',
    tiers: [
      { tier: 'S', items: ['Inception', 'Arrival'] },
      { tier: 'A', items: ['Blade Runner 2049'] },
    ],
    stats: { likes: '3.4k', comments: 512 },
  },
]
