import React from 'react';
import { Card as ShadcnCard } from './card';

// Define a simple interface for the Card props
interface CardProps {
  children: React.ReactNode;
  className?: string;
  [key: string]: any; // Allow any other props to be passed through
}

// This is a wrapper around the shadcn Card component that accepts React nodes as children
export function Card(props: CardProps) {
  return (
    <ShadcnCard {...props}>
      {props.children}
    </ShadcnCard>
  );
}
