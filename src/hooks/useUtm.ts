import { useEffect } from 'react';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export function useUtm(): void {
  useEffect(() => {
    const stored = sessionStorage.getItem('seubeat_utm_params');
    if (stored) return;

    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    let hasAny = false;

    for (const key of UTM_KEYS) {
      const val = params.get(key);
      if (val) {
        utm[key] = val;
        hasAny = true;
      }
    }

    if (hasAny) {
      sessionStorage.setItem('seubeat_utm_params', JSON.stringify(utm));
    }
  }, []);
}