import { internalErrorResponse } from '../lib/request-guard.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  try {
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '5', 10) || 5, 1), 100);
    
    // Group by category, count how many templates exist in each category
    const query = `
      SELECT category, COUNT(*) as count 
      FROM templates 
      WHERE category IS NOT NULL AND category != '' 
      GROUP BY category 
      ORDER BY count DESC 
      LIMIT ?
    `;
    const { results } = await env.tear_of_god_db.prepare(query).bind(limit).all();

    return new Response(JSON.stringify({ success: true, data: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Category query failed:', { name: error?.name, message: error?.message });
    return internalErrorResponse();
  }
}
