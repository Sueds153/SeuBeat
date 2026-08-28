import { useEffect, useState } from 'react';

export interface SocialProofData {
  createdToday: number;
  paidToday: number;
  paidTotal: number;
  deliveredTotal: number;
  lastPayment: { firstName: string | null; minutesAgo: number; style: string | null } | null;
  lastActivity: { firstName: string | null; minutesAgo: number; style: string | null } | null;
}

export const EMPTY_SOCIAL_PROOF: SocialProofData = {
  createdToday: 0,
  paidToday: 0,
  paidTotal: 0,
  deliveredTotal: 0,
  lastPayment: null,
  lastActivity: null,
};

let cache: { data: SocialProofData; at: number } | null = null;
const TTL_MS = 30_000;

export async function getSocialProof(): Promise<SocialProofData> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('/api/social-proof', { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return EMPTY_SOCIAL_PROOF;
    const data: SocialProofData = await res.json();
    cache = { data, at: Date.now() };
    return data;
  } catch {
    return EMPTY_SOCIAL_PROOF;
  }
}

export function useSocialProof(intervalMs = 60_000): SocialProofData {
  const [data, setData] = useState<SocialProofData>(EMPTY_SOCIAL_PROOF);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      getSocialProof().then(d => {
        if (mounted) setData(d);
      });
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return data;
}

export function formatMinutesAgo(minutes: number): string {
  if (minutes <= 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dia${Math.floor(hours / 24) > 1 ? 's' : ''}`;
}
