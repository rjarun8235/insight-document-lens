
import * as React from 'react';
import { 
  Card as ShadcnCard, 
  CardHeader as ShadcnCardHeader,
  CardTitle as ShadcnCardTitle,
  CardDescription as ShadcnCardDescription,
  CardContent as ShadcnCardContent, 
  CardFooter as ShadcnCardFooter 
} from './card';

// Simple wrapper components to fix the TypeScript errors with React 18's stricter type checking

interface CardWrapperProps {
  children?: React.ReactNode;
  className?: string; 
  onClick?: () => void;
  [key: string]: any;
}

// Simple wrapper around the Card component
export const Card = React.forwardRef<HTMLDivElement, CardWrapperProps>(
  ({ children, ...props }, ref) => {
    return React.createElement(ShadcnCard, { ...props, ref }, children);
  }
);
Card.displayName = 'Card';

// Simple wrapper around the CardHeader component
export const CardHeader = React.forwardRef<HTMLDivElement, CardWrapperProps>(
  ({ children, ...props }, ref) => {
    return React.createElement(ShadcnCardHeader, { ...props, ref }, children);
  }
);
CardHeader.displayName = 'CardHeader';

// Simple wrapper around the CardTitle component
export const CardTitle = React.forwardRef<HTMLHeadingElement, CardWrapperProps>(
  ({ children, ...props }, ref) => {
    return React.createElement(ShadcnCardTitle, { ...props, ref }, children);
  }
);
CardTitle.displayName = 'CardTitle';

// Simple wrapper around the CardDescription component
export const CardDescription = React.forwardRef<HTMLParagraphElement, CardWrapperProps>(
  ({ children, ...props }, ref) => {
    return React.createElement(ShadcnCardDescription, { ...props, ref }, children);
  }
);
CardDescription.displayName = 'CardDescription';

// Simple wrapper around the CardContent component
export const CardContent = React.forwardRef<HTMLDivElement, CardWrapperProps>(
  ({ children, ...props }, ref) => {
    return React.createElement(ShadcnCardContent, { ...props, ref }, children);
  }
);
CardContent.displayName = 'CardContent';

// Simple wrapper around the CardFooter component
export const CardFooter = React.forwardRef<HTMLDivElement, CardWrapperProps>(
  ({ children, ...props }, ref) => {
    return React.createElement(ShadcnCardFooter, { ...props, ref }, children);
  }
);
CardFooter.displayName = 'CardFooter';
