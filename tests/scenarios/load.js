import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, setup, getSeedIds, checkOk, vuUserIdStable } from '../config.js';

// Weighted traffic mix — simulates real user browsing behavior
// ~70% reads, 20% votes, 10% comments
const scenarios = {
  ramp_up: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },   // warm up
      { duration: '1m', target: 30 },   // normal traffic
      { duration: '1m', target: 50 },   // peak hours
      { duration: '30s', target: 50 },  // sustain peak
      { duration: '30s', target: 0 },   // cool down
    ],
    gracefulRampDown: '10s',
  },
};

export const options = {
  scenarios,
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.1'],
    http_reqs: ['rate>5'],
  },
};

function pickRankingId(data) {
  const { rankingId } = getSeedIds(data);
  return rankingId || null;
}

export default function (data) {
  const roll = Math.random();
  const userId = vuUserIdStable();
  const rid = pickRankingId(data);

  if (roll < 0.35) {
    // 35% — Browse feed
    group('feed: GET /api/rankings (list)', () => {
      const page = Math.floor(Math.random() * 3) + 1;
      const res = http.get(`${BASE_URL}/api/rankings?sort=newest&page=${page}&limit=10`);
      checkOk(res, 'feed');
    });
  } else if (roll < 0.50) {
    // 15% — Browse templates
    group('discover: GET /api/templates (list)', () => {
      const res = http.get(`${BASE_URL}/api/templates?sort=popular&limit=20`);
      checkOk(res, 'templates');
    });
  } else if (roll < 0.65) {
    // 15% — View post detail
    if (rid) {
      group('post: GET /api/rankings?id (detail)', () => {
        const res = http.get(`${BASE_URL}/api/rankings?id=${rid}`);
        checkOk(res, 'post-detail');
      });
    }
  } else if (roll < 0.80) {
    // 15% — Vote on a post
    if (rid) {
      group('action: POST /api/votes (like)', () => {
        const payload = JSON.stringify({
          ranking_id: rid,
          user_id: userId,
          voteType: Math.random() > 0.3 ? 'like' : 'dislike',
        });
        const res = http.post(`${BASE_URL}/api/votes`, payload, {
          headers: { 'Content-Type': 'application/json' },
        });
        checkOk(res, 'vote');
      });
    }
  } else if (roll < 0.90) {
    // 10% — Read hashtags/categories
    group('explore: GET /api/hashtags', () => {
      const res = http.get(`${BASE_URL}/api/hashtags?limit=20`);
      checkOk(res, 'hashtags');
    });
  } else {
    // 10% — View user profile
    const uid = getSeedIds(data).userId;
    if (uid) {
      group('profile: GET /api/users', () => {
        const res = http.get(`${BASE_URL}/api/users?id=${uid}`);
        checkOk(res, 'profile');
      });
    }
  }
}
