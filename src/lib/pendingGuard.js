// In-flight guard: 1 user action ที่ pending มีได้ไม่เกิน 1 request.
//
// ใช้แบบ per-component-instance (เก็บใน useRef) จึงเป็น per-resource โดยธรรมชาติ —
// ranking A pending ไม่ล็อก ranking B; key เสริมสำหรับกรณี instance เดียวคุมหลาย resource.
// Guard ก่อนเริ่ม async request เสมอ และ release ใน finally เพื่อให้ retry/กดครั้งใหม่ได้
// หลัง resolve/reject — ไม่ debounce, ไม่ delay click, ไม่เปลี่ยน optimistic UI.
export function createPendingGuard() {
  const pending = new Set();
  return {
    // คืน true = ได้สิทธิ์ยิง request; false = มี request ของ key นี้ค้างอยู่ ให้ข้าม
    acquire(key = 'default') {
      if (pending.has(key)) return false;
      pending.add(key);
      return true;
    },
    release(key = 'default') {
      pending.delete(key);
    },
  };
}
