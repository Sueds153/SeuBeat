import { useEffect } from 'react';
import { captureUtm } from '../lib/utm';

export function useUtm(): void {
  useEffect(() => {
    captureUtm();
  }, []);
}