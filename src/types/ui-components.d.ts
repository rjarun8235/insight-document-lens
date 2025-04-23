declare module '@/components/ui/button' {
  import { FC, ButtonHTMLAttributes, ReactNode } from 'react';

  export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    asChild?: boolean;
    children?: ReactNode;
    className?: string;
    onClick?: (e: any) => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }

  export const Button: FC<ButtonProps>;
}

declare module '@/components/ui/card' {
  import { FC, HTMLAttributes } from 'react';

  export const Card: FC<HTMLAttributes<HTMLDivElement>>;
  export const CardHeader: FC<HTMLAttributes<HTMLDivElement>>;
  export const CardTitle: FC<HTMLAttributes<HTMLHeadingElement>>;
  export const CardDescription: FC<HTMLAttributes<HTMLParagraphElement>>;
  export const CardContent: FC<HTMLAttributes<HTMLDivElement>>;
  export const CardFooter: FC<HTMLAttributes<HTMLDivElement>>;
}

declare module '@/components/ui/select' {
  import { FC, SelectHTMLAttributes } from 'react';

  export const Select: FC<any>;
  export const SelectContent: FC<any>;
  export const SelectItem: FC<any>;
  export const SelectTrigger: FC<any>;
  export const SelectValue: FC<any>;
}

declare module '@/components/ui/progress' {
  import { FC } from 'react';

  export interface ProgressProps {
    value?: number;
    max?: number;
    className?: string;
  }

  export const Progress: FC<ProgressProps>;
}

declare module '@/components/ui/tabs' {
  import { FC } from 'react';

  export const Tabs: FC<any>;
  export const TabsContent: FC<any>;
  export const TabsList: FC<any>;
  export const TabsTrigger: FC<any>;
}

declare module '@/components/ui/table' {
  import { FC, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

  export const Table: FC<TableHTMLAttributes<HTMLTableElement>>;
  export const TableHeader: FC<any>;
  export const TableBody: FC<any>;
  export const TableFooter: FC<any>;
  export const TableHead: FC<ThHTMLAttributes<HTMLTableCellElement>>;
  export const TableRow: FC<any>;
  export const TableCell: FC<TdHTMLAttributes<HTMLTableCellElement>>;
}

declare module '@/components/ui/input' {
  import { FC, InputHTMLAttributes } from 'react';

  export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

  export const Input: FC<InputProps>;
}
