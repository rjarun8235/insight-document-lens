import React from 'react';
import { Card as ShadcnCard, CardContent as ShadcnCardContent, CardFooter as ShadcnCardFooter } from './card';

// Simple wrapper components to fix the TypeScript errors with React 18's stricter type checking

interface CardWrapperProps {
  children?: React.ReactNode;
  className?: string; 
  onClick?: () => void;
  [key: string]: any;
}

// Simple wrapper around the Card component
export const Card: React.FC<CardWrapperProps> = ({ children, ...props }) => {
  return <ShadcnCard {...props}>{children}</ShadcnCard>;
};

// Simple wrapper around the CardContent component
export const CardContent: React.FC<CardWrapperProps> = ({ children, ...props }) => {
  return <ShadcnCardContent {...props}>{children}</ShadcnCardContent>;
};

// Simple wrapper around the CardFooter component
export const CardFooter: React.FC<CardWrapperProps> = ({ children, ...props }) => {
  return <ShadcnCardFooter {...props}>{children}</ShadcnCardFooter>;
};
