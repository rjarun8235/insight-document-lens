import * as React from 'react';
import * as LucideIcons from 'lucide-react';

// Type for icon names
export type IconName = keyof typeof LucideIcons;

// Props for the Icon component
interface IconProps {
  name: IconName;
  className?: string;
}

// Simple wrapper component for Lucide icons
export const Icon = ({ name, className }: IconProps) => {
  // Get the icon component from Lucide
  const IconComponent = LucideIcons[name];
  
  if (!IconComponent) {
    return null;
  }
  
  // Use a simple div wrapper to avoid TypeScript issues
  return (
    <div className={className} style={{ display: 'inline-flex' }}>
      <IconComponent />
    </div>
  );
};
