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

  // Logo size classes
  const logoSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  // Product name and company details
  const productName = "DocLens";
  const companyName = "TSV Global Solutions Pvt Limited";
  const tagline = "Intelligent Document Analysis & Comparison";

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {/* Logo */}
      <div className={cn(
        "flex items-center justify-center rounded-md overflow-hidden",
        logoSizeClasses[size]
      )}>
        <img src="/logo.png" alt="DocLens Logo" className="w-full h-full object-contain" />
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
 * Favicon component - uses the favicon.png from the public directory
 */
export function FaviconPlaceholder() {
  // This is a helper component to remind developers to update the favicon
  // The actual favicon should be set in the index.html file
  
  React.useEffect(() => {
    // Check if favicon is already set
    const existingFavicon = document.querySelector('link[rel="icon"]');
    
    // If no favicon is set, set it programmatically
    if (!existingFavicon) {
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = '/favicon.png';
      favicon.type = 'image/png';
      document.head.appendChild(favicon);
      
      console.log('Favicon set programmatically');
    }
  }, []);
  
  return null; // This component doesn't render anything
}
