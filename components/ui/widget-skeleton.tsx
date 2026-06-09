import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Shimmer placeholder shown via <Suspense> while a heavy dashboard widget
 * streams in. Makes panels appear instantly instead of blocking on data.
 */
export function WidgetSkeleton({ rows = 4, title = true }: { rows?: number; title?: boolean }) {
  return (
    <Card className="glass border-white/10">
      {title && (
        <CardHeader>
          <div className="skeleton h-5 w-40" />
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass border-white/10">
          <CardContent className="p-5 space-y-3">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-8 w-20" />
            <div className="skeleton h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
