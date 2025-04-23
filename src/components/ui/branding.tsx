import React from 'react';
import { cn } from '@/lib/utils';

interface BrandingProps {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Branding component for TSV Global Solutions Pvt Limited
 * Displays the company logo, product name, and optional tagline
 */
export function Branding({
  className,
  showTagline = false,
  size = 'md'
}: BrandingProps) {
  // Size classes for responsive design
  const sizeClasses = {
    sm: 'text-lg md:text-xl',
    md: 'text-xl md:text-2xl',
    lg: 'text-2xl md:text-3xl'
  };

  // Product name and company details
  const productName = "DocLens";
  const companyName = "TSV Global Solutions Pvt Limited";
  const tagline = "Intelligent Document Analysis & Comparison";

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {/* Logo Placeholder - Replace with actual logo */}
      <div className={cn(
        "flex items-center justify-center bg-primary text-primary-foreground rounded-md font-bold",
        size === 'sm' ? 'w-8 h-8 text-sm' : size === 'md' ? 'w-10 h-10 text-base' : 'w-12 h-12 text-lg'
      )}>
        DL
      </div>
      
      <div className="flex flex-col">
        <div className={cn("font-bold tracking-tight", sizeClasses[size])}>
          {productName}
        </div>
        
        {showTagline && (
          <div className="flex flex-col text-muted-foreground">
            <span className="text-xs">{tagline}</span>
            <span className="text-xs">{companyName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Favicon component - can be used to generate a favicon dynamically
 * or as a placeholder until a proper favicon is created
 */
export function FaviconPlaceholder() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="4" fill="#0F172A" />
      <path
        d="M8 10H24M8 16H24M8 22H16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="22" r="4" fill="#2563EB" />
    </svg>
  );
}
