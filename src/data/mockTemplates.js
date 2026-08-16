// Simulated database keyed by template ID (until the schema lands).
export const MOCK_TEMPLATES = {
  'goat-nba': {
    id: 'goat-nba',
    title: 'GOAT NBA Players',
    authorHandle: '@hoop_alex',
    uses: '15.2k',
    views: '84k',
    description:
      'Rank the greatest basketball players to ever step on the court. Drag and drop your picks across the S through D tiers and share your definitive list with the community.',
    rankings: [
      {
        id: 'avg',
        isAverage: true,
        timeAgo: 'Updated recently',
        tiers: {
          S: ['Michael Jordan', 'LeBron James'],
          A: ['Kobe Bryant', 'Magic Johnson'],
          B: ['Shaquille O\'Neal', 'Tim Duncan'],
          C: ['Hakeem Olajuwon', 'Larry Bird'],
          D: ['Stephen Curry', 'Kevin Durant'],
        },
      },
      {
        id: 'creator',
        authorHandle: '@hoop_alex',
        timeAgo: '1 week ago',
        tiers: {
          S: ['Michael Jordan', 'LeBron James'],
          A: ['Kobe Bryant'],
          B: ['Magic Johnson', 'Shaquille O\'Neal'],
          C: ['Tim Duncan'],
          D: ['Stephen Curry'],
        },
      },
      {
        id: 'user1',
        authorHandle: '@random_fan',
        timeAgo: '2 days ago',
        tiers: {
          S: ['LeBron James'],
          A: ['Michael Jordan', 'Kobe Bryant'],
          B: ['Stephen Curry', 'Magic Johnson'],
          C: ['Kevin Durant'],
          D: ['Hakeem Olajuwon'],
        },
      },
    ],
  },
  'greatest-footballers': {
    id: 'greatest-footballers',
    title: 'Greatest Footballers Ever',
    authorHandle: '@futbol_diego',
    uses: '22.7k',
    views: '130k',
    description:
      'Settle the eternal debate. Rank the best footballers in history from the legends of yesterday to today’s superstars.',
    rankings: [
      {
        id: 'avg',
        isAverage: true,
        timeAgo: 'Updated recently',
        tiers: {
          S: ['Messi', 'Maradona'],
          A: ['Ronaldo', 'Zidane'],
          B: ['Ronaldinho', 'Cruyff'],
          C: ['Beckham', 'Henry'],
          D: ['Neymar', 'Suarez'],
        },
      },
      {
        id: 'creator',
        authorHandle: '@futbol_diego',
        timeAgo: '1 week ago',
        tiers: {
          S: ['Messi'],
          A: ['Maradona', 'Ronaldo'],
          B: ['Zidane', 'Cruyff'],
          C: ['Ronaldinho'],
          D: ['Neymar'],
        },
      },
      {
        id: 'user1',
        authorHandle: '@random_fan',
        timeAgo: '2 days ago',
        tiers: {
          S: ['Maradona'],
          A: ['Messi', 'Zidane'],
          B: ['Ronaldo', 'Ronaldinho'],
          C: ['Beckham'],
          D: ['Suarez'],
        },
      },
    ],
  },
  'ultimate-ramen': {
    id: 'ultimate-ramen',
    title: 'Ultimate Ramen Rankings',
    authorHandle: '@Chef_Mike',
    uses: '16.8k',
    views: '95k',
    description:
      'Rank the greatest bowls of ramen. From rich tonkotsu to delicate shio, crown the ultimate noodle experience.',
    rankings: [
      {
        id: 'avg',
        isAverage: true,
        timeAgo: 'Updated recently',
        tiers: {
          S: ['Tonkotsu', 'Shoyu'],
          A: ['Miso'],
          B: ['Shio', 'Tantanmen'],
          C: ['Tsukemen'],
          D: ['Yasai'],
        },
      },
      {
        id: 'creator',
        authorHandle: '@Chef_Mike',
        timeAgo: '1 week ago',
        tiers: {
          S: ['Tonkotsu'],
          A: ['Shoyu', 'Miso'],
          B: ['Shio'],
          C: ['Tantanmen'],
          D: ['Tsukemen'],
        },
      },
      {
        id: 'user1',
        authorHandle: '@random_fan',
        timeAgo: '2 days ago',
        tiers: {
          S: ['Shoyu'],
          A: ['Tonkotsu', 'Miso'],
          B: ['Tsukemen'],
          C: ['Shio'],
          D: ['Yasai'],
        },
      },
    ],
  },
  'best-street-food': {
    id: 'best-street-food',
    title: 'Best Street Food in Bangkok',
    authorHandle: '@streetbites_nok',
    uses: '12.4k',
    views: '71k',
    description:
      'Rank Bangkok’s legendary street eats. From wok-fired pad thai to fiery som tum, pick the street food king.',
    rankings: [
      {
        id: 'avg',
        isAverage: true,
        timeAgo: 'Updated recently',
        tiers: {
          S: ['Pad Thai', 'Som Tum'],
          A: ['Khao Man Gai'],
          B: ['Moo Ping', 'Khao Soi'],
          C: ['Mango Sticky Rice'],
          D: ['Satay'],
        },
      },
      {
        id: 'creator',
        authorHandle: '@streetbites_nok',
        timeAgo: '1 week ago',
        tiers: {
          S: ['Pad Thai'],
          A: ['Som Tum', 'Khao Man Gai'],
          B: ['Moo Ping'],
          C: ['Mango Sticky Rice'],
          D: ['Satay'],
        },
      },
      {
        id: 'user1',
        authorHandle: '@random_fan',
        timeAgo: '2 days ago',
        tiers: {
          S: ['Som Tum'],
          A: ['Pad Thai', 'Khao Soi'],
          B: ['Khao Man Gai'],
          C: ['Satay'],
          D: ['Moo Ping'],
        },
      },
    ],
  },
  'best-sci-fi': {
    id: 'best-sci-fi',
    title: 'Best Sci-Fi Movies',
    authorHandle: '@scifi_sarah',
    uses: '14.8k',
    views: '88k',
    description:
      'Rank the greatest science fiction films of all time. From mind-bending mind-benders to space epics, crown the sci-fi champion.',
    rankings: [
      {
        id: 'avg',
        isAverage: true,
        timeAgo: 'Updated recently',
        tiers: {
          S: ['Inception', 'Arrival'],
          A: ['Blade Runner 2049', 'Interstellar'],
          B: ['The Matrix', 'Dune'],
          C: ['Ex Machina'],
          D: ['Looper'],
        },
      },
      {
        id: 'creator',
        authorHandle: '@scifi_sarah',
        timeAgo: '1 week ago',
        tiers: {
          S: ['Inception'],
          A: ['Arrival', 'Blade Runner 2049'],
          B: ['Interstellar', 'The Matrix'],
          C: ['Dune'],
          D: ['Looper'],
        },
      },
      {
        id: 'user1',
        authorHandle: '@random_fan',
        timeAgo: '2 days ago',
        tiers: {
          S: ['Interstellar'],
          A: ['Inception', 'Dune'],
          B: ['Arrival', 'Ex Machina'],
          C: ['Blade Runner 2049'],
          D: ['Looper'],
        },
      },
    ],
  },
  'greatest-superhero': {
    id: 'greatest-superhero',
    title: 'Greatest Superhero Films',
    authorHandle: '@nerdynate',
    uses: '19.3k',
    views: '112k',
    description:
      'Rank the mightiest superhero movies ever made. From caped crusaders to web-slingers, decide who reigns supreme.',
    rankings: [
      {
        id: 'avg',
        isAverage: true,
        timeAgo: 'Updated recently',
        tiers: {
          S: ['The Dark Knight', 'Avengers: Endgame'],
          A: ['Spider-Verse', 'Logan'],
          B: ['Infinity War', 'Black Panther'],
          C: ['The Batman'],
          D: ['Wonder Woman'],
        },
      },
      {
        id: 'creator',
        authorHandle: '@nerdynate',
        timeAgo: '1 week ago',
        tiers: {
          S: ['The Dark Knight'],
          A: ['Spider-Verse', 'Logan'],
          B: ['Avengers: Endgame', 'Infinity War'],
          C: ['Black Panther'],
          D: ['Wonder Woman'],
        },
      },
      {
        id: 'user1',
        authorHandle: '@random_fan',
        timeAgo: '2 days ago',
        tiers: {
          S: ['Avengers: Endgame'],
          A: ['Infinity War', 'Black Panther'],
          B: ['The Dark Knight', 'The Batman'],
          C: ['Spider-Verse'],
          D: ['Logan'],
        },
      },
    ],
  },
  'top-10-games': {
    id: 'top-10-games',
    title: 'Top 10 Games of the Year',
    authorHandle: '@alexplays',
    uses: '21.4k',
    views: '126k',
    description:
      'Rank the best games of the year. From sprawling RPGs to cozy indies, put this year’s standout titles in order.',
    rankings: [
      {
        id: 'avg',
        isAverage: true,
        timeAgo: 'Updated recently',
        tiers: {
          S: ['Elden Ring', 'Baldur’s Gate 3'],
          A: ['Tears of the Kingdom', 'Hades'],
          B: ['Cyberpunk 2077', 'God of War'],
          C: ['Final Fantasy XVI'],
          D: ['Starfield'],
        },
      },
      {
        id: 'creator',
        authorHandle: '@alexplays',
        timeAgo: '1 week ago',
        tiers: {
          S: ['Elden Ring'],
          A: ['Tears of the Kingdom', 'Hades'],
          B: ['Baldur’s Gate 3', 'God of War'],
          C: ['Cyberpunk 2077'],
          D: ['Starfield'],
        },
      },
      {
        id: 'user1',
        authorHandle: '@random_fan',
        timeAgo: '2 days ago',
        tiers: {
          S: ['Baldur’s Gate 3'],
          A: ['Elden Ring', 'Cyberpunk 2077'],
          B: ['Final Fantasy XVI', 'God of War'],
          C: ['Hades'],
          D: ['Starfield'],
        },
      },
    ],
  },
  'best-books': {
    id: 'best-books',
    title: 'Best Books to Read in 2026',
    authorHandle: '@janereads',
    uses: '8.2k',
    views: '43k',
    description:
      'Rank the must-read books of 2026. From page-turning sci-fi to literary masterpieces, build your perfect reading list.',
    rankings: [
      {
        id: 'avg',
        isAverage: true,
        timeAgo: 'Updated recently',
        tiers: {
          S: ['Project Hail Mary', 'The Midnight Library'],
          A: ['Piranesi', 'Klara and the Sun'],
          B: ['The Name of the Wind', 'Circe'],
          C: ['Tomorrow, and Tomorrow, and Tomorrow'],
          D: ['Lessons in Chemistry'],
        },
      },
      {
        id: 'creator',
        authorHandle: '@janereads',
        timeAgo: '1 week ago',
        tiers: {
          S: ['Project Hail Mary'],
          A: ['The Midnight Library', 'Piranesi'],
          B: ['Klara and the Sun', 'Circe'],
          C: ['The Name of the Wind'],
          D: ['Lessons in Chemistry'],
        },
      },
      {
        id: 'user1',
        authorHandle: '@random_fan',
        timeAgo: '2 days ago',
        tiers: {
          S: ['The Midnight Library'],
          A: ['Piranesi', 'The Name of the Wind'],
          B: ['Klara and the Sun', 'Tomorrow, and Tomorrow, and Tomorrow'],
          C: ['Project Hail Mary'],
          D: ['Lessons in Chemistry'],
        },
      },
    ],
  },
}

// Fallback template shown when no mock entry matches the URL's templateId.
export const DEFAULT_TEMPLATE = {
  id: 'sample',
  title: 'Sample Template',
  authorHandle: '@mock_user',
  uses: '1.2k',
  views: '8.4k',
  description:
    'This is a sample tier list template. Use it to rank anything and share your picks with the community.',
  rankings: [
    {
      id: 'avg',
      isAverage: true,
      timeAgo: 'Updated recently',
      tiers: {
        S: ['Item Alpha', 'Item Beta'],
        A: ['Item Gamma'],
        B: ['Item Delta'],
        C: ['Item Epsilon'],
        D: ['Item Zeta'],
      },
    },
    {
      id: 'creator',
      authorHandle: '@mock_user',
      timeAgo: '1 week ago',
      tiers: {
        S: ['Item Alpha'],
        A: ['Item Beta', 'Item Gamma'],
        B: ['Item Delta'],
        C: ['Item Epsilon'],
        D: ['Item Zeta'],
      },
    },
    {
      id: 'user1',
      authorHandle: '@random_fan',
      timeAgo: '2 days ago',
      tiers: {
        S: ['Item Beta'],
        A: ['Item Alpha', 'Item Delta'],
        B: ['Item Gamma'],
        C: ['Item Epsilon'],
        D: ['Item Zeta'],
      },
    },
  ],
}

export function getTemplate(id) {
  return id ? (MOCK_TEMPLATES[id] ?? null) : null
}

// Item count comes from the community-average ranking — the canonical
// contents of the template. `tiers` here is an object keyed S-D.
export function templateItemCount(template) {
  const avg = template.rankings.find((r) => r.isAverage) ?? template.rankings[0]
  return Object.values(avg.tiers).flat().length
}
