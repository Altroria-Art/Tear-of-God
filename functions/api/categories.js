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

    // M2: response มีแค่ {category, count} ไม่มีข้อมูลเฉพาะผู้ชม — cache ที่ edge/browser
    // ได้ปลอดภัย (limit อยู่ใน URL จึงแยก cache key กันอยู่แล้ว; request ที่มี session
    // จะถูก _middleware overwrite เป็น private,no-store ตามเดิม ไม่รั่วข้ามผู้ใช้)
    return new Response(JSON.stringify({ success: true, data: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    });
  } catch (error) {
    console.error('Category query failed:', { name: error?.name, message: error?.message });
    return internalErrorResponse();
  }
}
