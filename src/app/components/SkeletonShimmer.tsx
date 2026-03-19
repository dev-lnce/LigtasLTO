import React from 'react';

export function SkeletonShimmer({ className }: { className: string }) {
  return <div className={`skeleton-shimmer ${className}`} />; // IMPROVEMENT 3: Shared shimmer skeleton block for loading states.
}

