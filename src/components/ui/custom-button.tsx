
import * as React from 'react';
import { Button as ShadcnButton } from './button';
import { createIconElement } from './icon';

// Custom button component that works with React 18's stricter type checking
interface CustomButtonProps {
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  [key: string]: any;
}

export const Button = React.forwardRef<HTMLButtonElement, CustomButtonProps>(
  ({ children, icon, ...props }, ref) => {
    return React.createElement(
      ShadcnButton,
      { ...props, ref },
      <>
        {icon}
        {children}
      </>
    );
  }
);
Button.displayName = 'Button';
