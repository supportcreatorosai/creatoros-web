'use client';

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Media error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4 glass-card rounded-xl border border-border/50">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold">Unable to load your content</h1>
      <p className="text-muted-foreground max-w-md">
        We encountered a problem while trying to access the content library. Please try again.
      </p>
      <Button variant="outline" onClick={reset} className="mt-4">
        Try Again
      </Button>
    </div>
  );
}
