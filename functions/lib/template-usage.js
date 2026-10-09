// Callers supply fixed SQL aliases, never user input. The flag is enabled only
// after migration 0029; legacy installations retain their exact COUNT fallback.
export function templateUsageSql(env, alias = 't') {
  return env.TEMPLATE_USAGE_COUNTERS === 'true'
    ? `COALESCE((SELECT ranking_count FROM template_usage_counts WHERE template_id = ${alias}.id), 0)`
    : `(SELECT COUNT(*) FROM rankings r WHERE r.template_id = ${alias}.id)`;
}
