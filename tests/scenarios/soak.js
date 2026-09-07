import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, setup, getSeedIds, checkOk } from '../config.js';

// Soak test: sustained load over extended period to detect memory leaks and degradation
// Full spec is 30m; shortened to 10m for interactive runs via DURATION env override:
//   K6_SOAK_DURATION=30m k6 run tests/scenarios/soak.js
const SOAK_DURATION = __ENV.SOAK_DURATION || '10m';
const SOAK_VUS = parseInt(__ENV.SOAK_VUS || '50', 10);

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: SOAK_VUS,
      duration: SOAK_DURATION,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.1'],
    http_reqs: ['rate>5'],
  },
};

export default function (data) {
  const { rankingId, userId: seedUserId } = getSeedIds(data);
  const roll = Math.random();
  const userId = `${__VU}${__ITER}`;

  if (roll < 0.35) {
    group('feed: GET /api/rankings', () => {
      const page = Math.floor(Math.random() * 3) + 1;
      const res = http.get(`${BASE_URL}/api/rankings?sort=newest&page=${page}&limit=10`);
      checkOk(res, 'feed');
    });
  } else if (roll < 0.50) {
    group('templates: GET /api/templates', () => {
      const res = http.get(`${BASE_URL}/api/templates?sort=popular&limit=20`);
      checkOk(res, 'templates');
    });
  } else if (roll < 0.65) {
    if (rankingId) {
      group('detail: GET /api/rankings?id', () => {
        const res = http.get(`${BASE_URL}/api/rankings?id=${rankingId}`);
        checkOk(res, 'detail');
      });
    }
  } else if (roll < 0.80) {
    if (rankingId) {
      group('vote: POST /api/votes', () => {
        const payload = JSON.stringify({
          ranking_id: rankingId,
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
    group('explore: GET /api/hashtags', () => {
      const res = http.get(`${BASE_URL}/api/hashtags?limit=20`);
      checkOk(res, 'hashtags');
    });
  } else {
    if (seedUserId) {
      group('profile: GET /api/users', () => {
        const res = http.get(`${BASE_URL}/api/users?id=${seedUserId}`);
        checkOk(res, 'profile');
      });
    }
  }
}
