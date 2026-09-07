import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, setup, getSeedIds, checkOk } from '../config.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function (data) {
  const { rankingId, templateId, userId } = getSeedIds(data);

  group('GET /api/rankings (list)', () => {
    const res = http.get(`${BASE_URL}/api/rankings?sort=newest&limit=5`);
    checkOk(res, 'rankings-list');
  });

  group('GET /api/templates (list)', () => {
    const res = http.get(`${BASE_URL}/api/templates?sort=popular&limit=5`);
    checkOk(res, 'templates-list');
  });

  group('GET /api/hashtags', () => {
    const res = http.get(`${BASE_URL}/api/hashtags?limit=10`);
    checkOk(res, 'hashtags');
  });

  group('GET /api/categories', () => {
    const res = http.get(`${BASE_URL}/api/categories?limit=10`);
    checkOk(res, 'categories');
  });

  if (rankingId) {
    group('GET /api/rankings?id (detail)', () => {
      const res = http.get(`${BASE_URL}/api/rankings?id=${rankingId}`);
      checkOk(res, 'ranking-detail');
    });

    group('GET /api/comments (list)', () => {
      const res = http.get(`${BASE_URL}/api/comments?ranking_id=${rankingId}`);
      checkOk(res, 'comments-list');
    });
  }

  if (templateId) {
    group('GET /api/templates?id (detail)', () => {
      const res = http.get(`${BASE_URL}/api/templates?id=${templateId}`);
      checkOk(res, 'template-detail');
    });
  }

  if (userId) {
    group('GET /api/users', () => {
      const res = http.get(`${BASE_URL}/api/users?id=${userId}`);
      checkOk(res, 'user-profile');
    });
  }
}
