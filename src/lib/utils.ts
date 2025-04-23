// Define ClassValue type if clsx is not available
type ClassPrimitive = string | number | boolean | null | undefined;
type ClassObject = { [key: string]: any };
type ClassArray = Array<ClassPrimitive | ClassObject | ClassArray>;
type ClassValue = ClassPrimitive | ClassObject | ClassArray;

// Simple implementation of clsx that just joins classes
function simpleClsx(...inputs: ClassValue[]): string {
  // Helper function to flatten arrays recursively
  function flatten(arr: any[]): any[] {
    return arr.reduce((result, item) => {
      if (Array.isArray(item)) {
        return [...result, ...flatten(item)];
      }
      return [...result, item];
    }, []);
  }

  return flatten(inputs)
    .filter(Boolean)
    .map(input => {
      if (typeof input === 'string') return input;
      if (typeof input === 'number') return String(input);
      if (typeof input === 'object' && input !== null) {
        return Object.entries(input)
          .filter(([_, value]) => Boolean(value))
          .map(([key]) => key)
          .join(' ');
      }
      return '';
    })
    .join(' ');
}

// Use our simple implementation by default
let clsxFn: (...inputs: ClassValue[]) => string = simpleClsx;

// Try to dynamically import clsx
import(/* webpackIgnore: true */ 'clsx')
  .then(module => {
    // If import succeeds, use the real clsx function
    if (module && (module.default || module.clsx)) {
      clsxFn = module.default || module.clsx;
    }
  })
  .catch(() => {
    console.warn("clsx not found, using fallback implementation");
  });

// Simple implementation of twMerge that just removes duplicate classes
// This is used as a fallback if tailwind-merge is not available
function simpleMerge(classString: string): string {
  // Remove duplicate classes
  const classSet = new Set(classString.split(/\s+/).filter(Boolean));
  return Array.from(classSet).join(" ");
}

// Use a simple implementation that doesn't handle Tailwind conflicts
// but at least removes duplicate classes
let twMergeFn: (classString: string) => string = simpleMerge;

// Try to dynamically import tailwind-merge (this will be a no-op if the package doesn't exist)
// This is just to avoid build errors, but the actual implementation will use the fallback
import(/* webpackIgnore: true */ 'tailwind-merge')
  .then(module => {
    // If import succeeds, use the real twMerge function
    if (module && module.twMerge) {
      twMergeFn = module.twMerge;
    }
  })
  .catch(() => {
    console.warn("tailwind-merge not found, using fallback implementation");
  });

/**
 * Merges multiple class values into a single string, handling Tailwind CSS conflicts
 * Uses clsx for conditional classes and twMerge for handling Tailwind conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMergeFn(clsxFn(...inputs));
}
