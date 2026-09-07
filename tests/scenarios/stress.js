import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, setup, getSeedIds, checkOk } from '../config.js';

// Stress test: ramp beyond expected capacity to find the breaking point
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // normal load
        { duration: '2m', target: 100 },  // above normal
        { duration: '2m', target: 150 },  // stress
        { duration: '2m', target: 200 },  // peak stress
        { duration: '1m', target: 200 },  // sustain peak
        { duration: '1m', target: 0 },    // recover
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.2'],
    http_reqs: ['rate>3'],
  },
};

export default function (data) {
  const { rankingId, userId: seedUserId } = getSeedIds(data);
  const roll = Math.random();
  const userId = `${__VU}${__ITER}`;

  if (roll < 0.40) {
    group('feed: GET /api/rankings', () => {
      const res = http.get(`${BASE_URL}/api/rankings?sort=newest&limit=10`);
      checkOk(res, 'feed');
    });
  } else if (roll < 0.55) {
    group('templates: GET /api/templates', () => {
      const res = http.get(`${BASE_URL}/api/templates?sort=popular&limit=20`);
      checkOk(res, 'templates');
    });
  } else if (roll < 0.70) {
    if (rankingId) {
      group('detail: GET /api/rankings?id', () => {
        const res = http.get(`${BASE_URL}/api/rankings?id=${rankingId}`);
        checkOk(res, 'detail');
      });
    }
  } else if (roll < 0.85) {
    if (rankingId) {
      group('vote: POST /api/votes', () => {
        const payload = JSON.stringify({
          ranking_id: rankingId,
          user_id: userId,
          voteType: 'like',
        });
        const res = http.post(`${BASE_URL}/api/votes`, payload, {
          headers: { 'Content-Type': 'application/json' },
        });
        checkOk(res, 'vote');
      });
    }
  } else {
    group('misc: GET /api/hashtags + categories', () => {
      const res1 = http.get(`${BASE_URL}/api/hashtags?limit=10`);
      const res2 = http.get(`${BASE_URL}/api/categories`);
      checkOk(res1, 'hashtags');
      checkOk(res2, 'categories');
    });
  }
}
