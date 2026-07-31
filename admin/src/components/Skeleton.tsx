export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-[#efe8e0] ${className}`} />
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[#ece5dd] bg-[#fdfbf9] px-4 py-3">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ withStats = false }: { withStats?: boolean }) {
  return (
    <div>
      <Skeleton className="mb-5 h-8 w-56" />
      {withStats && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
      <TableSkeleton />
    </div>
  );
}
