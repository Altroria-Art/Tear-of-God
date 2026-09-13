import http from 'k6/http';
import { group } from 'k6';
import { BASE_URL, MUTATIONS_ENABLED, getSeedIds, checkOk, getMutationSession } from '../config.js';

export { setup } from '../config.js';

// Spike test: sudden burst of traffic then back to normal
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },   // baseline
        { duration: '10s', target: 300 },  // SPIKE!
        { duration: '1m', target: 300 },   // sustain spike
        { duration: '10s', target: 10 },   // drop back
        { duration: '1m', target: 10 },    // recover
        { duration: '30s', target: 0 },    // cooldown
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<8000'],
    http_req_failed: ['rate<0.3'],
    http_reqs: ['rate>3'],
  },
};

export default function (data) {
  const { rankingId } = getSeedIds(data);
  const roll = Math.random();

  if (roll < 0.50) {
    group('feed: GET /api/rankings', () => {
      const res = http.get(`${BASE_URL}/api/rankings?sort=newest&limit=10`);
      checkOk(res, 'feed');
    });
  } else if (roll < 0.70) {
    group('templates: GET /api/templates', () => {
      const res = http.get(`${BASE_URL}/api/templates?sort=popular&limit=20`);
      checkOk(res, 'templates');
    });
  } else if (roll < 0.85 && MUTATIONS_ENABLED) {
    if (rankingId) {
      group('vote: POST /api/votes', () => {
        const payload = JSON.stringify({
          ranking_id: rankingId,
          voteType: 'like',
        });
        const session = getMutationSession(data);
        const res = http.post(`${BASE_URL}/api/votes`, payload, {
          headers: { 'Content-Type': 'application/json' },
          cookies: session.cookies,
        });
        checkOk(res, 'vote');
      });
    }
  } else {
    if (rankingId) {
      group('comments: GET /api/comments', () => {
        const res = http.get(`${BASE_URL}/api/comments?ranking_id=${rankingId}`);
        checkOk(res, 'comments');
      });
    }
  }
}
