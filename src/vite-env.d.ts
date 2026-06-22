/// <reference types="vite/client" />

interface Window {
  turnstile?: {
    ready: (callback: () => void) => void;
    render: (container: HTMLElement, options: Record<string, unknown>) => string;
    remove: (widgetId: string) => void;
  };
}
