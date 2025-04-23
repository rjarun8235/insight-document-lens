declare module 'tailwind-merge' {
  /**
   * Creates a function that merges Tailwind CSS classes without style conflicts.
   */
  export function twMerge(...classLists: (string | undefined)[]): string;

  /**
   * Creates a function that joins class names and passes the result to twMerge.
   */
  export function twJoin(...classLists: (string | undefined)[]): string;

  /**
   * Configuration options for createTailwindMerge.
   */
  export interface TailwindMergeConfig {
    cacheSize?: number;
    theme?: Record<string, Record<string, string>>;
    classGroups?: Record<string, (string | Record<string, string>)[]>;
    conflictingClassGroups?: Record<string, string[]>;
    conflictingClassGroupModifiers?: Record<string, Record<string, string[]>>;
  }

  /**
   * Creates a custom instance of twMerge with the given configuration.
   */
  export function createTailwindMerge(
    config?: TailwindMergeConfig
  ): (...classLists: (string | undefined)[]) => string;
}
