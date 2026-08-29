export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  try {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 50);
    
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

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
