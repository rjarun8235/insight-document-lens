import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  showProgress?: boolean;
  progress?: number;
  variant?: 'default' | 'primary' | 'secondary';
}

/**
 * A versatile loading indicator component with optional text and progress bar
 */
export function LoadingIndicator({
  size = 'md',
  text,
  className,
  showProgress = false,
  progress = 0,
  variant = 'primary'
}: LoadingIndicatorProps) {
  // Size mappings
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4'
  };

  // Variant mappings
  const variantClasses = {
    default: 'border-muted-foreground/20 border-t-muted-foreground/60',
    primary: 'border-muted-foreground/20 border-t-primary',
    secondary: 'border-muted-foreground/20 border-t-secondary'
  };

  // Calculate progress percentage
  const progressPercentage = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-2', className)}>
      <div
        className={cn(
          'rounded-full animate-spin',
          sizeClasses[size],
          variantClasses[variant]
        )}
      />
      
      {text && (
        <p className={cn(
          'text-center text-muted-foreground',
          size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
        )}>
          {text}
        </p>
      )}
      
      {showProgress && (
        <div className="w-full max-w-xs">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300 ease-in-out",
                variant === 'primary' ? 'bg-primary' : 
                variant === 'secondary' ? 'bg-secondary' : 'bg-muted-foreground'
              )}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {progressPercentage.toFixed(0)}%
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * A full-page loading overlay with a centered loading indicator
 */
export function LoadingOverlay({
  text = 'Loading...',
  message,
  variant = 'primary',
  showProgress = false,
  progress = 0
}: {
  text?: string;
  message?: string;
  variant?: 'default' | 'primary' | 'secondary';
  showProgress?: boolean;
  progress?: number;
}) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <LoadingIndicator 
        size="lg" 
        text={message || text} 
        variant={variant} 
        showProgress={showProgress || !!progress}
        progress={progress}
      />
    </div>
  );
}

/**
 * A skeleton loader for content that's still loading
 */
export function Skeleton({
  className,
  ...props
}: {
  className?: string;
  [key: string]: any;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
