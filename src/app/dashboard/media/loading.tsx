export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="h-8 w-48 bg-muted rounded"></div>
          <div className="h-4 w-64 bg-muted rounded mt-2"></div>
        </div>
        <div className="h-10 w-32 bg-muted rounded"></div>
      </div>
      
      <div className="glass-card rounded-xl border border-border/50 p-6">
        <div className="space-y-4">
          <div className="h-10 max-w-sm bg-muted rounded"></div>
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-8 w-20 bg-muted rounded"></div>
            ))}
          </div>
          
          <div className="mt-6 space-y-4">
            <div className="h-10 w-full bg-muted rounded"></div>
            <div className="h-16 w-full bg-muted rounded"></div>
            <div className="h-16 w-full bg-muted rounded"></div>
            <div className="h-16 w-full bg-muted rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
