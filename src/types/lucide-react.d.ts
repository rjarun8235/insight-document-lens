declare module 'lucide-react' {
  import { FC, ReactNode } from 'react';

  export interface IconProps {
    color?: string;
    size?: string | number;
    strokeWidth?: string | number;
    className?: string;
    onClick?: () => void;
    [key: string]: any;
  }

  // Define the return type of the icon components
  export interface LucideIcon extends ReactNode {
    type: any;
    props: IconProps;
  }

  export type Icon = FC<IconProps> & (() => LucideIcon);

  export const Loader2: Icon;
  export const Search: Icon;
  export const Send: Icon;
  export const File: Icon;
  export const FileText: Icon;
  export const Image: Icon;
  export const FileSpreadsheet: Icon;
  export const FileCode: Icon;
  export const AlertCircle: Icon;
  export const CheckCircle: Icon;
  export const X: Icon;
  export const XCircle: Icon;
  export const RefreshCw: Icon;
  export const Download: Icon;
  export const Copy: Icon;
  export const Printer: Icon;
  export const Save: Icon;
  export const ChevronDown: Icon;
  export const ChevronUp: Icon;
  export const ChevronRight: Icon;
  export const ChevronLeft: Icon;
  export const Plus: Icon;
  export const Minus: Icon;
  export const Upload: Icon;
  export const Trash: Icon;
  export const Edit: Icon;
  export const Info: Icon;
  export const HelpCircle: Icon;
  export const Settings: Icon;
  export const User: Icon;
  export const Users: Icon;
  export const Mail: Icon;
  export const Calendar: Icon;
  export const Clock: Icon;
  export const Home: Icon;
  export const Menu: Icon;
  export const MoreHorizontal: Icon;
  export const MoreVertical: Icon;
  export const ArrowRight: Icon;
  export const ArrowLeft: Icon;
  export const ArrowUp: Icon;
  export const ArrowDown: Icon;
  export const ExternalLink: Icon;
  export const Link: Icon;
  export const Check: Icon;
  export const Filter: Icon;
  export const Eye: Icon;
  export const EyeOff: Icon;
  export const Lock: Icon;
  export const Unlock: Icon;
  export const Star: Icon;
  export const Heart: Icon;
  export const Bookmark: Icon;
  export const Flag: Icon;
  export const Bell: Icon;
  export const AlertTriangle: Icon;
  export const FileQuestion: Icon;
  export const Share2: Icon;
  export const GripVertical: Icon;
  export const Share: Icon;
}
