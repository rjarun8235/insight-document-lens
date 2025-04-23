import * as React from "react"
import useEmblaCarousel from "embla-carousel-react"

import { cn } from "@/lib/utils"

// Simple carousel implementation that avoids React 18 TypeScript issues
// This is a simplified version that focuses on basic functionality

// Basic carousel component
export function Carousel({ 
  children, 
  className, 
  ...props 
}: { 
  children: React.ReactNode; 
  className?: string; 
  [key: string]: any;
}) {
  const [emblaRef] = useEmblaCarousel()

  return (
    <div 
      ref={emblaRef} 
      className={cn("overflow-hidden", className)} 
      {...props}
    >
      <div className="flex">{children}</div>
    </div>
  )
}

// Carousel item component
export function CarouselItem({ 
  children, 
  className, 
  ...props 
}: { 
  children: React.ReactNode; 
  className?: string; 
  [key: string]: any;
}) {
  return (
    <div 
      className={cn("min-w-0 flex-shrink-0 flex-grow-0", className)} 
      {...props}
    >
      {children}
    </div>
  )
}

// Export simplified components
export {
  Carousel as CarouselContent, // Alias for compatibility
}
