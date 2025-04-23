declare module 'vite' {
  export function defineConfig(config: any): any;
}

declare module '@vitejs/plugin-react-swc' {
  const plugin: any;
  export default plugin;
}

declare module 'lovable-tagger' {
  export function componentTagger(): any;
}

// Add Node.js process global
declare const process: {
  cwd(): string;
  env: Record<string, string>;
};
