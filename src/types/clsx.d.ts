declare module 'clsx' {
  export type ClassValue = 
    | string
    | number
    | boolean
    | undefined
    | null
    | { [key: string]: any }
    | ClassValue[];

  /**
   * A utility for constructing className strings conditionally.
   * @param classes - A list of className values to be joined together.
   * @returns A string of joined classNames.
   */
  export default function clsx(...classes: ClassValue[]): string;

  /**
   * A utility for constructing className strings conditionally.
   * @param classes - A list of className values to be joined together.
   * @returns A string of joined classNames.
   */
  export function clsx(...classes: ClassValue[]): string;
}
