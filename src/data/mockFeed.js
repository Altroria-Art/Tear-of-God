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
    description:
      'Settling the debate once and for all — ranking the players who defined the sport across every era.',
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
    description: 'A decade of ambitious, mind-bending sci-fi — ranked from must-watch to skippable.',
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
    description: 'The small, ordinary moments that quietly make life better than it has any right to be.',
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
    description: 'Ranking the street eats worth booking a flight for, from unmissable to skip-it.',
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
    description: 'The most iconic World Cup finals ever played, ranked by drama, stakes, and legacy.',
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
    description: 'Every feature from the Ghibli catalog, ranked from an all-time classic to a rewatch some day.',
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
    description: 'The pantry staples ranked, from the ones worth stockpiling to the ones you settle for.',
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
    description: 'An unapologetically biased ranking of the four seasons, from the best to the most tolerated.',
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

// A sample of top comments per post — `stats.comments` above reflects the
// full count on a real feed; these are the ones actually rendered.
export const MOCK_COMMENTS = {
  'post-1': [
    {
      id: 'post-1-c1',
      author: { name: 'Jordan Vale', avatarUrl: null },
      postedAt: '1 hour ago',
      body: 'Leaving Kareem off the S tier is a crime honestly.',
    },
    {
      id: 'post-1-c2',
      author: { name: 'Riley Tan', avatarUrl: null },
      postedAt: '40 minutes ago',
      body: 'Solid list, though I’d swap Kobe and Magic.',
    },
  ],
  'post-2': [
    {
      id: 'post-2-c1',
      author: { name: 'Noah Patel', avatarUrl: null },
      postedAt: '3 hours ago',
      body: 'Arrival deserves every bit of that S tier placement.',
    },
    {
      id: 'post-2-c2',
      author: { name: 'Mei Lin', avatarUrl: null },
      postedAt: '2 hours ago',
      body: 'Where is Interstellar though?',
    },
  ],
  'post-3': [
    {
      id: 'post-3-c1',
      author: { name: 'Casey Odom', avatarUrl: null },
      postedAt: '6 hours ago',
      body: 'Group projects in C tier feels generous.',
    },
  ],
  'post-4': [
    {
      id: 'post-4-c1',
      author: { name: 'Ben Okafor', avatarUrl: null },
      postedAt: '9 hours ago',
      body: 'Takoyaki in S tier, no notes.',
    },
    {
      id: 'post-4-c2',
      author: { name: 'Lucia Marin', avatarUrl: null },
      postedAt: '7 hours ago',
      body: 'Currywurst is criminally underrated, glad to see it here.',
    },
  ],
  'post-5': [
    {
      id: 'post-5-c1',
      author: { name: 'Youssef Aziz', avatarUrl: null },
      postedAt: '20 hours ago',
      body: '2022 final was an instant classic, agreed.',
    },
  ],
  'post-6': [
    {
      id: 'post-6-c1',
      author: { name: 'Anya Kowalski', avatarUrl: null },
      postedAt: '22 hours ago',
      body: 'Spirited Away at S is non-negotiable.',
    },
    {
      id: 'post-6-c2',
      author: { name: 'Theo Bergman', avatarUrl: null },
      postedAt: '18 hours ago',
      body: 'Ponyo deserved a bit higher imo.',
    },
  ],
  'post-7': [
    {
      id: 'post-7-c1',
      author: { name: 'Grace Kim', avatarUrl: null },
      postedAt: '1 day ago',
      body: 'Shin Ramyun Black is elite, correct call.',
    },
  ],
  'post-8': [
    {
      id: 'post-8-c1',
      author: { name: 'Owen Blake', avatarUrl: null },
      postedAt: '2 days ago',
      body: 'Summer in D tier is criminal but I respect the honesty.',
    },
    {
      id: 'post-8-c2',
      author: { name: 'Ines Rocha', avatarUrl: null },
      postedAt: '1 day ago',
      body: 'Autumn supremacy, well argued.',
    },
  ],
}
