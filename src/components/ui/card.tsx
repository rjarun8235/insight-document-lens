import * as React from "react"

import { cn } from "@/lib/utils"

// Create simple interfaces for card components
export interface CardProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any; // Allow any other props to be passed through
}

// Simple functional components instead of using forwardRef
export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardTitleProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
}

export interface CardDescriptionProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  )
}

export interface CardContentProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn("p-6 pt-0", className)} {...props}>
      {children}
    </div>
  )
}

export interface CardFooterProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    >
      {children}
    </div>
  )
}

// Create safe wrapper components that handle React 18's stricter type checking
const SafeCard = (props: CardProps) => <Card {...props} />
const SafeCardContent = (props: CardContentProps) => <CardContent {...props} />
const SafeCardFooter = (props: CardFooterProps) => <CardFooter {...props} />
const SafeCardHeader = (props: CardHeaderProps) => <CardHeader {...props} />
const SafeCardTitle = (props: CardTitleProps) => <CardTitle {...props} />
const SafeCardDescription = (props: CardDescriptionProps) => <CardDescription {...props} />
