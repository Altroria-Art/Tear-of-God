// api/likes.js
import { queryD1 } from './db.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  // รับเฉพาะ Method POST เท่านั้น
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { rankingId } = req.body;
    
    // 📍 จำลอง User ID ไปก่อน (เดี๋ยวพอทำระบบ Login ค่อยดึง ID คนใช้จริงมาใส่)
    const userId = 'user_123'; 

    if (!rankingId) {
      return res.status(400).json({ success: false, error: 'Missing rankingId' });
    }

    // 1. เช็คก่อนว่า User คนนี้ เคยกดไลก์โพสต์นี้ไปหรือยัง?
    const existingLike = await queryD1(
      'SELECT id FROM likes WHERE ranking_id = ? AND user_id = ?',
      [rankingId, userId]
    );

    // 2. ถ้ามีประวัติการกดไลก์แล้ว = ผู้ใช้ต้องการ "เลิกไลก์ (Unlike)"
    if (existingLike.length > 0) {
      await queryD1('DELETE FROM likes WHERE id = ?', [existingLike[0].id]);
      return res.status(200).json({ success: true, data: null, message: 'Unliked' });
    } 
    
    // 3. ถ้ายังไม่เคยไลก์ = ผู้ใช้ต้องการ "กดไลก์ (Like)"
    else {
      const newLikeId = crypto.randomUUID();
      await queryD1(
        'INSERT INTO likes (id, ranking_id, user_id) VALUES (?, ?, ?)',
        [newLikeId, rankingId, userId]
      );
      return res.status(200).json({ success: true, data: { id: newLikeId }, message: 'Liked' });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}