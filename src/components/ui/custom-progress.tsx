import React from 'react';
import { cn } from "@/lib/utils";

interface CustomProgressProps {
  value?: number;
  className?: string;
}

// Direct implementation of a progress bar to avoid TypeScript errors with React 18
export const Progress: React.FC<CustomProgressProps> = ({ value = 0, className }) => {
  return (
    <div className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div 
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </div>
  );
};
