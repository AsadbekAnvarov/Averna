// Minimal types for the parts of jsdom (already installed for Vitest's jsdom environment)
// used by tests/articles-interactive.test.ts. Avoids adding @types/jsdom.
declare module "jsdom" {
  export type DOMWindow = Window & typeof globalThis;
  export interface ConstructorOptions {
    url?: string;
    runScripts?: "dangerously" | "outside-only";
    beforeParse?: (window: DOMWindow) => void;
  }
  export class JSDOM {
    constructor(html?: string, options?: ConstructorOptions);
    readonly window: DOMWindow;
  }
}
