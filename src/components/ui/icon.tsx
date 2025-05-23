
import * as React from 'react';
import * as LucideIcons from 'lucide-react';

// Type for icon names
export type IconName = keyof typeof LucideIcons;

// Props for the Icon component
interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
  color?: string;
}

// Simple wrapper component for Lucide icons that works with React 18's stricter type checking
export const Icon = ({ name, className, size = 24, color }: IconProps) => {
  // Get the icon component from Lucide
  const IconComponent = LucideIcons[name];
  
  if (!IconComponent) {
    return null;
  }
  
  // Return the icon with proper props
  return React.createElement(IconComponent, {
    className,
    size,
    color
  });
};

// Helper function to safely create icon elements
export const createIconElement = (IconComponent: any, props: any = {}) => {
  if (!IconComponent) return null;
  return React.createElement(IconComponent, props);
};
