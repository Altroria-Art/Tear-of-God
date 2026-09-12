import {
  INPUT_LIMITS,
  assertEnum,
  assertId,
  consumeMemoryRateLimit,
  internalErrorResponse,
  isPlainObject,
  rateLimitResponse,
  readJsonBody,
  requestErrorResponse,
  RequestError,
} from '../../lib/request-guard.js';

const ADMIN_MUTATION_LIMIT = Object.freeze({ limit: 60, windowSeconds: 60 });

export async function readAdminMutation(request, allowedActions) {
  const payload = await readJsonBody(request, INPUT_LIMITS.adminJson);
  if (!isPlainObject(payload)) throw new RequestError('Request body must be an object');
  const action = assertEnum(payload.action, 'action', allowedActions);
  const targetId = assertId(payload.target_id, 'target_id');
  return { payload, action, targetId };
}

export function adminMutationRateLimitResponse(userId) {
  const result = consumeMemoryRateLimit('admin-mutation', userId, ADMIN_MUTATION_LIMIT);
  return result.allowed ? null : rateLimitResponse(result, 'Too many admin mutation requests');
}

export function adminRequestErrorResponse(error, operation) {
  const invalid = requestErrorResponse(error);
  if (invalid) return invalid;
  console.error(`${operation} failed:`, { name: error?.name, message: error?.message });
  return internalErrorResponse();
}
