// Shared template-deletion statements — ใช้ร่วมกันระหว่าง admin delete
// (functions/api/admin/templates.js) และ creator delete (functions/api/template-delete.js)
// เพื่อไม่ให้มี business logic สองชุด
//
// ครอบทุก table ที่อ้าง template:
// - template_items / template_views / template_reactions / template_comments /
//   template_bookmarks / reports(template_id) / ranking_item_scores(template_id)
// - topic_follows ที่ติดตาม template นี้ (topic_type='template', topic_key=template id)
//   เป็น plain text ไม่มี FK — ถ้าไม่ลบตรงนี้จะเป็น orphan (ดู PHASE 0 audit §2)
// - rankings ของ template นี้พร้อมลูกทั้งหมด (ranking_items/votes/comments)
// - notifications ที่ผูก template/rankings เหล่านั้นลบตาม FK ON DELETE CASCADE เอง
// - items เป็น catalog กลาง (ไม่มี FK ฝั่ง template) จึงไม่แตะต้อง
export function templateDeleteStatements(db, templateId) {
  return [
    db.prepare('DELETE FROM template_items WHERE template_id = ?').bind(templateId),
    db.prepare('DELETE FROM template_views WHERE template_id = ?').bind(templateId),
    db.prepare('DELETE FROM template_reactions WHERE template_id = ?').bind(templateId),
    db.prepare('DELETE FROM template_comments WHERE template_id = ?').bind(templateId),
    db.prepare('DELETE FROM template_bookmarks WHERE template_id = ?').bind(templateId),
    db.prepare('DELETE FROM reports WHERE template_id = ?').bind(templateId),
    db.prepare('DELETE FROM ranking_item_scores WHERE template_id = ?').bind(templateId),
    db.prepare('DELETE FROM topic_follows WHERE topic_type = ? AND topic_key = ?').bind('template', templateId),
    db.prepare('DELETE FROM ranking_items WHERE ranking_id IN (SELECT id FROM rankings WHERE template_id = ?)').bind(templateId),
    db.prepare('DELETE FROM votes WHERE ranking_id IN (SELECT id FROM rankings WHERE template_id = ?)').bind(templateId),
    db.prepare('DELETE FROM comments WHERE ranking_id IN (SELECT id FROM rankings WHERE template_id = ?)').bind(templateId),
    db.prepare('DELETE FROM rankings WHERE template_id = ?').bind(templateId),
    db.prepare('DELETE FROM templates WHERE id = ?').bind(templateId),
  ];
}
