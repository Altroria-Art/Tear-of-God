// Skeleton loading primitives — mirror the real cards' structure so the
// loading state doesn't push layout around when real data arrives.
function Block({ className = '' }) {
  return <div className={`animate-pulse bg-tag ${className}`} />;
}

export function SkeletonRow({ className = '' }) {
  return <Block className={`h-3 rounded-full ${className}`} />;
}

export function SkeletonCircle({ className = '' }) {
  return <Block className={`rounded-full ${className}`} />;
}

export function FeedCardSkeleton() {
  return (
    <article className="bg-surface border border-line-soft rounded-[20px] p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <SkeletonCircle className="w-10 h-10" />
          <div className="space-y-2">
            <SkeletonRow className="w-32" />
            <SkeletonRow className="w-20 h-2.5" />
          </div>
        </div>
        <SkeletonRow className="w-28 h-8 rounded-full" />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <SkeletonRow className="w-16 h-5 rounded-md" />
        <SkeletonRow className="w-20 h-5 rounded-md" />
        <SkeletonRow className="w-14 h-5 rounded-md" />
      </div>

      <SkeletonRow className="w-3/4 h-6 mb-5" />

      <div className="space-y-2 mb-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex bg-tag rounded-xl border border-line-soft min-h-[50px] items-stretch">
            <Block className="w-14 rounded-l-xl" />
            <div className="p-2.5 flex gap-2 flex-grow flex-wrap items-center bg-tag">
              {[0, 1, 2, 3].map((j) => (
                <SkeletonCircle key={j} className="h-20 w-20 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-line-soft">
        <div className="flex items-center gap-6">
          <SkeletonRow className="w-12" />
          <SkeletonRow className="w-12" />
          <SkeletonRow className="w-12" />
        </div>
        <div className="flex items-center gap-6">
          <SkeletonRow className="w-10" />
          <SkeletonRow className="w-10" />
        </div>
      </div>
    </article>
  );
}

export function TemplateCardSkeleton() {
  return (
    <div className="glass rounded-xl overflow-hidden flex flex-col">
      <div className="bg-surface-glass h-40 relative p-3">
        <div className="absolute top-2 right-2 flex gap-2">
          <SkeletonRow className="w-12 h-5" />
          <SkeletonRow className="w-12 h-5" />
        </div>
        <div className="space-y-1.5 mt-8">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-1.5">
              <Block className="w-8 h-5 rounded" />
              <SkeletonRow className="w-16 h-5" />
              <SkeletonRow className="w-12 h-5" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-surface/50 border-t border-line-soft p-3 flex-1">
        <SkeletonRow className="w-4/5 h-4 mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonCircle className="w-6 h-6" />
            <SkeletonRow className="w-16 h-3" />
          </div>
          <SkeletonRow className="w-14 h-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonFeedList() {
  return (
    <div className="space-y-6">
      <FeedCardSkeleton />
      <FeedCardSkeleton />
    </div>
  );
}

export function SkeletonTemplateGrid() {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <TemplateCardSkeleton key={i} />
      ))}
    </div>
  );
}