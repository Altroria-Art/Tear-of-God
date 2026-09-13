export function onRequest() {
  return Response.json(
    { success: false, error: 'API endpoint not found', code: 'NOT_FOUND' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  );
}
