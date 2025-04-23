import React from 'react';
import { Button as ShadcnButton } from './button';

// This is a wrapper around the shadcn Button component that accepts React nodes as children
export function Button({
  children,
  ...props
}: React.ComponentProps<typeof ShadcnButton> & { children: React.ReactNode }) {
  return (
    <ShadcnButton {...props}>
      {children}
    </ShadcnButton>
  );
}
