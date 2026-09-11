import { requireAdmin as requireSessionAdmin } from '../_auth.js';

// Authorization is derived exclusively from a validated bearer session.
// Client-provided IDs are deliberately ignored.
export async function requireAdmin(env, request) {
  try {
    return await requireSessionAdmin(request, env);
  } catch (error) {
    console.error('requireAdmin error:', error);
    return null;
  }
}
