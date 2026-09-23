import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * VirtualFeedContainer
 * Sliding-window DOM virtualization for infinite feeds (TikTok style).
 * 
 * - Only renders ~20–30 cards in the DOM around the current scroll position.
 * - Upper cards are unmounted when scrolling down; their heights are converted to a top spacer.
 * - Previously unmounted cards are restored when scrolling back up.
 * - Items in memory are NEVER deleted from session history.
 * - Prevents DOM bloat and eliminates scroll jumps.
 */
export default function VirtualFeedContainer({
  items = [],
  renderItem,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  windowSize = 24,
  bufferBefore = 8,
  estimatedItemHeight = 440,
  className = '',
}) {
  const containerRef = useRef(null);
  const heightsMapRef = useRef(new Map());
  const [range, setRange] = useState({ start: 0, end: Math.min(items.length - 1, windowSize - 1) });
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const inFlightTriggerRef = useRef(false);

  useEffect(() => {
    if (!isLoadingMore) {
      inFlightTriggerRef.current = false;
    }
  }, [isLoadingMore]);

  const triggerLoadMore = useCallback(() => {
    if (inFlightTriggerRef.current || isLoadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    inFlightTriggerRef.current = true;
    onLoadMoreRef.current?.();
  }, []);

  // Track item count changes
  useEffect(() => {
    const total = items.length;
    if (total === 0) {
      setRange({ start: 0, end: -1 });
      return;
    }
    const currentStart = rangeRef.current.start;
    const nextEnd = Math.min(total - 1, currentStart + windowSize - 1);
    const nextStart = Math.max(0, Math.min(currentStart, nextEnd));
    setRange({ start: nextStart, end: nextEnd });
  }, [items.length, windowSize]);

  // Compute cumulative offsets
  const getOffsets = useCallback(() => {
    const total = items.length;
    const offsets = new Float64Array(total + 1);
    let accum = 0;
    offsets[0] = 0;
    for (let i = 0; i < total; i++) {
      const id = items[i]?.id ?? String(i);
      const h = heightsMapRef.current.get(id) || estimatedItemHeight;
      accum += h;
      offsets[i + 1] = accum;
    }
    return offsets;
  }, [items, estimatedItemHeight]);

  // Handle scroll and adjust sliding window
  const updateWindow = useCallback(() => {
    const total = items.length;
    if (total <= windowSize || !containerRef.current) {
      if (rangeRef.current.start !== 0 || rangeRef.current.end !== total - 1) {
        setRange({ start: 0, end: Math.max(-1, total - 1) });
      }
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const containerTop = rect.top + window.scrollY;
    const scrollY = window.scrollY;
    const currentY = Math.max(0, scrollY - containerTop);

    const offsets = getOffsets();

    // Binary search for anchorIndex
    let low = 0;
    let high = total - 1;
    let anchorIndex = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (offsets[mid] <= currentY) {
        anchorIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let desiredStart = Math.max(0, anchorIndex - bufferBefore);
    let desiredEnd = Math.min(total - 1, desiredStart + windowSize - 1);

    if (desiredEnd === total - 1) {
      desiredStart = Math.max(0, desiredEnd - windowSize + 1);
    }

    // Hysteresis threshold: only re-render if shifted by >= 3 items
    const curStart = rangeRef.current.start;
    const curEnd = rangeRef.current.end;
    const diff = Math.abs(desiredStart - curStart);

    if (diff >= 3 || (desiredStart === 0 && curStart !== 0) || (desiredEnd === total - 1 && curEnd !== total - 1)) {
      setRange({ start: desiredStart, end: desiredEnd });
    }

    // Trigger loadMore if close to the end
    if (desiredEnd >= total - 4) {
      triggerLoadMore();
    }
  }, [items.length, windowSize, bufferBefore, getOffsets, triggerLoadMore]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateWindow();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [updateWindow]);

  // Sentinel for infinite scroll trigger when near the bottom
  const sentinelRef = useCallback((node) => {
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        triggerLoadMore();
      }
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [triggerLoadMore]);

  if (items.length === 0) return null;

  const offsets = getOffsets();
  const validStart = Math.max(0, Math.min(range.start, items.length - 1));
  const validEnd = Math.max(validStart, Math.min(range.end, items.length - 1));

  const topSpacerHeight = offsets[validStart] || 0;
  const bottomSpacerHeight = Math.max(0, (offsets[items.length] || 0) - (offsets[validEnd + 1] || 0));

  const visibleItems = items.slice(validStart, validEnd + 1);

  return (
    <div ref={containerRef} className={className}>
      {/* Top spacer replaces unmounted cards above viewport without scroll jump */}
      {topSpacerHeight > 0 && (
        <div
          style={{ height: `${topSpacerHeight}px`, width: '100%', pointerEvents: 'none' }}
          aria-hidden="true"
        />
      )}

      {/* Render active window cards */}
      {visibleItems.map((item, idx) => {
        const absIndex = validStart + idx;
        const key = item?.virtualKey || item?.id || String(absIndex);
        const itemKey = item?.id ?? key;
        return (
          <div
            key={key}
            data-virtual-index={absIndex}
            className="pb-6"
            ref={(el) => {
              if (el) {
                const h = el.offsetHeight;
                if (h > 0 && heightsMapRef.current.get(itemKey) !== h) {
                  heightsMapRef.current.set(itemKey, h);
                }
              }
            }}
          >
            {renderItem(item, absIndex)}
          </div>
        );
      })}

      {/* Bottom spacer replaces unmounted cards below viewport */}
      {bottomSpacerHeight > 0 && (
        <div
          style={{ height: `${bottomSpacerHeight}px`, width: '100%', pointerEvents: 'none' }}
          aria-hidden="true"
        />
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-1" />}
    </div>
  );
}
