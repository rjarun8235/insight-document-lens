/**
 * Spinner Component
 * 
 * A simple loading spinner for async operations
 */

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner = ({ size = 'sm', className = '' }: SpinnerProps): JSX.Element => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };
  
  return (
    <div className={`animate-spin ${sizeClasses[size]} border-2 border-current border-t-transparent rounded-full inline-block mr-2 ${className}`}></div>
  );
};
