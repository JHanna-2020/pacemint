import { useEffect, useRef } from 'react';

type Props = {
  onToken: (token: string | null) => void;
  resetKey: number;
};

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    // The load event fires after the explicit-render API is available. Calling
    // turnstile.ready() from an async/defer script is rejected by Cloudflare.
    script.onload = () => (window.turnstile ? resolve() : reject(new Error('Bot protection did not initialize.')));
    script.onerror = () => reject(new Error('Bot protection could not load.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function TurnstileWidget({ onToken, resetKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let active = true;
    let widgetId: string | undefined;
    onToken(null);
    void loadTurnstile()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          size: 'flexible',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null)
        });
      })
      .catch(() => onToken(null));
    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken, resetKey]);

  if (!siteKey) return null;
  return <div className="turnstile-container" ref={containerRef} />;
}

export const turnstileConfigured = Boolean(siteKey);
