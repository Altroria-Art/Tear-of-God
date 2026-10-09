import { useEffect } from 'react';

const HOLD_MS = 200;
const MOVE_TOLERANCE = 10;

// Keep normal scrolling and short taps. Only a stationary hold starts a drag.
export default function useTouchItemDrag(elementRef, enabled, setDragging) {
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;
    let gesture = null;
    let holdTimer = 0;
    let frame = 0;
    let preview = null;
    let zone = null;
    let stopped = false;

    const send = (target, phase) => target?.dispatchEvent(new CustomEvent('editor-touch-drag', {
      detail: { phase, itemId: gesture?.itemId, clientX: gesture?.x, clientY: gesture?.y },
    }));
    const update = () => {
      if (!gesture?.active) return;
      preview.style.transform = `translate3d(${gesture.x - gesture.offsetX}px,${gesture.y - gesture.offsetY}px,0) scale(1.04)`;
      const hit = document.elementFromPoint(gesture.x, gesture.y);
      const nextZone = hit?.closest('.drop-zone')
        || hit?.closest('[data-drop-zone-container]')?.querySelector('.drop-zone') || null;
      if (nextZone !== zone) { send(zone, 'leave'); zone = nextZone; }
      send(zone, 'over');
    };
    const scrollStep = (point, start, end, edge = 60) => point < start + edge
      ? -Math.min(14, Math.max(0, (start + edge - point) * .22))
      : point > end - edge ? Math.min(14, Math.max(0, (point - end + edge) * .22)) : 0;
    const tick = () => {
      if (!gesture?.active) return;
      // Scroll the pool under the finger first; scroll the page at screen edges.
      let node = document.elementFromPoint(gesture.x, gesture.y);
      let scrolledX = false;
      let scrolledY = false;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        if (!scrolledY && /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
          node.scrollTop += scrollStep(gesture.y, box.top, box.bottom, Math.min(60, box.height / 4));
          scrolledY = true;
        }
        if (!scrolledX && /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth) {
          node.scrollLeft += scrollStep(gesture.x, box.left, box.right, 36);
          scrolledX = true;
        }
        node = node.parentElement;
      }
      window.scrollBy(0, scrollStep(gesture.y, 70, window.innerHeight - 70));
      update();
      frame = requestAnimationFrame(tick);
    };
    const removeListeners = () => {
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', cancel);
      document.removeEventListener('touchstart', additionalTouch);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
    const finish = () => {
      clearTimeout(holdTimer); cancelAnimationFrame(frame);
      send(zone, 'leave'); zone = null;
      preview?.remove(); preview = null;
      if (gesture?.active) {
        window.dispatchEvent(new Event('editor-touch-drag-end'));
        if (!stopped) setDragging(false);
      }
      gesture = null;
      removeListeners();
    };
    const activate = () => {
      if (!gesture || !element.isConnected) return;
      gesture.active = true;
      const box = element.getBoundingClientRect();
      gesture.offsetX = gesture.x - box.left;
      gesture.offsetY = gesture.y - box.top;
      preview = element.cloneNode(true);
      preview.removeAttribute('data-item-id');
      preview.removeAttribute('id');
      preview.classList.add('touch-drag-preview');
      preview.classList.remove('is-dragging');
      preview.setAttribute('aria-hidden', 'true');
      preview.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      preview.querySelectorAll('button').forEach(button => { button.disabled = true; button.tabIndex = -1; });
      Object.assign(preview.style, { width: `${box.width}px`, height: `${box.height}px` });
      document.body.appendChild(preview);
      setDragging(true);
      update();
      frame = requestAnimationFrame(tick);
    };
    function move(event) {
      if (!gesture) return;
      if (event.touches.length !== 1) { finish(); return; }
      const touch = [...event.touches].find(t => t.identifier === gesture.identifier);
      if (!touch) return;
      gesture.x = touch.clientX; gesture.y = touch.clientY;
      if (!gesture.active) {
        if (Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY) > MOVE_TOLERANCE) finish();
        return;
      }
      event.preventDefault();
      update();
    }
    function end(event) {
      if (!gesture || ![...event.changedTouches].some(t => t.identifier === gesture.identifier)) return;
      if (gesture.active) {
        // Prevent the compatibility click from opening the tier picker on drop.
        event.preventDefault();
        const touch = [...event.changedTouches].find(t => t.identifier === gesture.identifier);
        gesture.x = touch.clientX; gesture.y = touch.clientY;
        update();
        send(zone, 'drop');
      }
      finish();
    }
    function cancel(event) { if (gesture?.active && event?.cancelable) event.preventDefault(); finish(); }
    function additionalTouch(event) { if (event.touches.length > 1) finish(); }
    function scroll() { if (!gesture?.active) finish(); }
    function visibility() { if (document.hidden) finish(); }
    const start = event => {
      if (event.touches.length !== 1 || gesture) return;
      if (!event.target.closest('.editor-item-main')) return;
      const touch = event.touches[0];
      gesture = { identifier: touch.identifier, itemId: element.dataset.itemId,
        startX: touch.clientX, startY: touch.clientY, x: touch.clientX, y: touch.clientY, active: false };
      holdTimer = setTimeout(activate, HOLD_MS);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', end, { passive: false });
      document.addEventListener('touchcancel', cancel, { passive: false });
      document.addEventListener('touchstart', additionalTouch, { passive: true });
      document.addEventListener('scroll', scroll, true);
      window.addEventListener('blur', cancel);
      document.addEventListener('visibilitychange', visibility);
    };
    const contextMenu = event => { if (gesture) event.preventDefault(); };
    const nativeDrag = event => { if (gesture) { event.preventDefault(); event.stopPropagation(); } };
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('contextmenu', contextMenu);
    element.addEventListener('dragstart', nativeDrag, true);
    return () => {
      stopped = true;
      finish();
      element.removeEventListener('touchstart', start);
      element.removeEventListener('contextmenu', contextMenu);
      element.removeEventListener('dragstart', nativeDrag, true);
    };
  }, [elementRef, enabled, setDragging]);
}
