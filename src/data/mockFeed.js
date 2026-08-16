export const CATEGORIES = ['For You', 'Trending', 'General', 'Movies', 'Food', 'Sports']

// Not post categories — these two reorder the whole feed rather than filter it.
export const FOR_YOU = 'For You'
export const TRENDING = 'Trending'

// Placeholder until the schema lands — shape mirrors a future `rankings` row
// joined with its profile, category, and ranking_items. `stats` counts are raw
// numbers; formatting happens at render time via `formatCount`.
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
    stats: { likes: 1240, dislikes: 63, comments: 342 },
  },
  {
    id: 'post-2',
    author: { name: 'Sarah Chen', avatarUrl: null },
    postedAt: '5 hours ago',
    category: 'Movies',
    title: 'Best Sci-Fi Movies of the 2010s',
    templateName: 'Sci-Fi Movies',
    tiers: [
      { tier: 'S', items: ['Inception', 'Arrival'] },
      { tier: 'A', items: ['Blade Runner 2049'] },
    ],
    stats: { likes: 3410, dislikes: 128, comments: 512 },
  },
  {
    id: 'post-3',
    author: { name: 'Marcus Webb', avatarUrl: null },
    postedAt: '8 hours ago',
    category: 'General',
    title: 'Everyday Things That Are Secretly Perfect',
    templateName: 'Everyday Things',
    tiers: [
      { tier: 'S', items: ['Hot shower after work', 'A cold pillow'] },
      { tier: 'A', items: ['Fresh bedsheets', 'Empty inbox'] },
      { tier: 'C', items: ['Group projects'] },
    ],
    stats: { likes: 486, dislikes: 21, comments: 97 },
  },
  {
    id: 'post-4',
    author: { name: 'Priya Nair', avatarUrl: null },
    postedAt: '11 hours ago',
    category: 'Food',
    title: 'Street Food Worth Flying For',
    templateName: 'Street Food',
    tiers: [
      { tier: 'S', items: ['Pad Kaphrao', 'Takoyaki'] },
      { tier: 'A', items: ['Banh Mi', 'Elote'] },
      { tier: 'B', items: ['Currywurst'] },
    ],
    stats: { likes: 2075, dislikes: 44, comments: 388 },
  },
  {
    id: 'post-5',
    author: { name: 'Diego Fuentes', avatarUrl: null },
    postedAt: '1 day ago',
    category: 'Sports',
    title: 'Greatest World Cup Finals Ranked',
    templateName: 'World Cup Finals',
    tiers: [
      { tier: 'S', items: ['2022 Argentina v France'] },
      { tier: 'A', items: ['1986 Argentina v West Germany', '1998 France v Brazil'] },
      { tier: 'D', items: ['1990 West Germany v Argentina'] },
    ],
    stats: { likes: 912, dislikes: 205, comments: 631 },
  },
  {
    id: 'post-6',
    author: { name: 'Emma Larsson', avatarUrl: null },
    postedAt: '1 day ago',
    category: 'Movies',
    title: 'Every Studio Ghibli Film, Ranked',
    templateName: 'Studio Ghibli Films',
    tiers: [
      { tier: 'S', items: ['Spirited Away', 'Princess Mononoke'] },
      { tier: 'A', items: ['My Neighbor Totoro', "Howl's Moving Castle"] },
      { tier: 'B', items: ['Ponyo'] },
    ],
    stats: { likes: 5620, dislikes: 97, comments: 1204 },
  },
  {
    id: 'post-7',
    author: { name: 'Tobi Adeyemi', avatarUrl: null },
    postedAt: '2 days ago',
    category: 'Food',
    title: 'Instant Noodles Tier List',
    templateName: 'Instant Noodles',
    tiers: [
      { tier: 'S', items: ['Shin Ramyun Black'] },
      { tier: 'B', items: ['Indomie Mi Goreng', 'Buldak Carbonara'] },
      { tier: 'C', items: ['Plain cup noodles'] },
    ],
    stats: { likes: 148, dislikes: 312, comments: 76 },
  },
  {
    id: 'post-8',
    author: { name: 'Hana Suzuki', avatarUrl: null },
    postedAt: '3 days ago',
    category: 'General',
    title: 'Ranking Every Season of the Year',
    templateName: 'Seasons',
    tiers: [
      { tier: 'S', items: ['Autumn'] },
      { tier: 'A', items: ['Spring'] },
      { tier: 'C', items: ['Winter'] },
      { tier: 'D', items: ['Summer'] },
    ],
    stats: { likes: 734, dislikes: 189, comments: 205 },
  },
]
