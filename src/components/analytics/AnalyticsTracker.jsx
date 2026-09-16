import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../../lib/analytics';

function routeEvents(pathname, search) {
  if (pathname === '/') {
    return [{ name: 'feed_view', entityType: 'feed', entityId: 'home' }];
  }

  const templateMatch = pathname.match(/^\/template\/([^/]+)$/);
  if (templateMatch) {
    return [{ name: 'template_view', entityType: 'template', entityId: templateMatch[1] }];
  }

  if (pathname === '/rank') {
    const params = new URLSearchParams(search);
    const templateId = params.get('template');
    const challengeId = params.get('challenge');
    const events = templateId
      ? [{ name: 'ranking_start', entityType: 'template', entityId: templateId }]
      : [];
    if (challengeId) events.push({ name: 'challenge_start', entityType: 'challenge', entityId: challengeId });
    return events;
  }

  return [];
}

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    routeEvents(location.pathname, location.search).forEach((event) => {
      trackEvent(event.name, {
        entityType: event.entityType,
        entityId: event.entityId,
        onceKey: `route:${event.name}:${event.entityType}:${event.entityId}`,
      });
    });
  }, [location.pathname, location.search]);

  return null;
}
