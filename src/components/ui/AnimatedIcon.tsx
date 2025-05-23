/**
 * AnimatedIcon Component
 * 
 * Provides animated processing indicators with various animations
 * to help users understand background processes are active
 */

import React from 'react';
import { Icon } from './icon';

// Import the IconName type from the icon component
type IconName = "Loader2" | "Search" | "Send" | "File" | "FileText" | "Image" | "FileSpreadsheet" | "FileCode" | "AlertCircle" | "CheckCircle" | "X" | "XCircle" | "RefreshCw" | "Download" | "Copy" | "Share";

export type AnimationType = 
  | 'pulse'
  | 'spin'
  | 'bounce'
  | 'wave'
  | 'dots';

interface AnimatedIconProps {
  name: IconName;
  animation: AnimationType;
  className?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AnimatedIcon = ({
  name,
  animation,
  className = '',
  color = 'text-blue-500',
  size = 'md',
}: AnimatedIconProps): JSX.Element => {
  // Set size class based on prop
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }[size];
  
  // Animation classes
  const animationClass = {
    pulse: 'animate-pulse',
    spin: 'animate-spin',
    bounce: 'animate-bounce',
    wave: 'animate-wave',
    dots: '',
  }[animation];
  
  // If using dots animation, render a special dots indicator
  if (animation === 'dots') {
    return (
      <div className={`flex items-center ${className} ${color}`}>
        <Icon name={name} className={`${sizeClass} mr-2`} />
        <span className="flex space-x-1">
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </span>
      </div>
    );
  }
  
  // For wave animation, create a custom wave effect
  if (animation === 'wave') {
    return (
      <div className={`relative ${className}`}>
        <Icon name={name} className={`${sizeClass} ${color} z-10 relative`} />
        <div className="absolute inset-0 opacity-30 rounded-full bg-current animate-ping"></div>
        <div className="absolute inset-0 opacity-20 rounded-full bg-current animate-ping" style={{ animationDelay: '500ms' }}></div>
      </div>
    );
  }
  
  // For other animations, use standard classes
  return (
    <Icon 
      name={name} 
      className={`${sizeClass} ${color} ${animationClass} ${className}`} 
    />
  );
};
