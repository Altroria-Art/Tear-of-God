import { useEffect, useRef } from 'react';

// HTML5 drag & drop ไม่ auto-scroll หน้าให้เอง — ขณะลากการ์ด ถ้าเมาส์ลอยเข้าโซนขอบจอ
// บน/ล่าง (edge px) ให้ window.scrollBy เลื่อนตามความใกล้ขอบ (ใกล้ = เร็ว, ไกล = ช้า)
// จะเลื่อนต่อเนื่องจนแถวเป้าหมายโผล่จากขอบจอ → ปล่อยวางได้จริง ใช้ได้ทั้งหน้า Create และ
// RankTierList (ทั้งคู่มี structure: pool ล่างสุด, tiers อยู่บน)
// หมายเหตุ: listener นี้ไม่เรียก preventDefault — drop ยังทำงานตามปกติที่ row/pool handler
export default function useDragAutoScroll({ edge = 90, maxStep = 28 } = {}) {
  const draggingRef = useRef(false);
  const beginDrag = () => { draggingRef.current = true; };
  const endDrag = () => { draggingRef.current = false; };

  useEffect(() => {
    const onDragover = (e) => {
      if (!draggingRef.current) return;
      // โซนตามสัดส่วนจอ (กันจอเล็กที่ edge=90 ใหญ่เกินไป)
      const zone = Math.min(edge, Math.round(window.innerHeight * 0.25));
      if (e.clientY < zone) {
        window.scrollBy(0, -Math.min(maxStep, Math.max(1, (zone - e.clientY) * 0.35)));
      } else if (e.clientY > window.innerHeight - zone) {
        window.scrollBy(0, Math.min(maxStep, Math.max(1, (e.clientY - (window.innerHeight - zone)) * 0.35)));
      }
    };
    window.addEventListener('dragover', onDragover);
    return () => window.removeEventListener('dragover', onDragover);
  }, [edge, maxStep]);

  return { beginDrag, endDrag };
}