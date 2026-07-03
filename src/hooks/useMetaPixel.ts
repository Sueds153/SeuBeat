import { useEffect } from 'react';
import { initMetaPixel } from '../lib/metaPixel';

export function useMetaPixel(): void {
  useEffect(() => {
    initMetaPixel();
  }, []);
}
