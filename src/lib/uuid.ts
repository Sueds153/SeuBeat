let counter = 0;

function fallbackBytes(): number[] {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.from(arr);
    }
  } catch {
    // ignora — usa Math.random
  }
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) bytes.push(Math.floor(Math.random() * 256));
  return bytes;
}

function bytesToUUID(bytes: number[]): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Usa crypto.randomUUID() quando disponível (browsers modernos).
// Fallback seguro (Web Crypto getRandomValues ou Math.random) para webviews
// antigos (ex: Huawei/Android 10) onde crypto.randomUUID não existe — evita
// crash de página em branco (Sentry JAVASCRIPT-REACT-Q).
export function safeUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignora — usa fallback
  }
  counter += 1;
  return bytesToUUID(fallbackBytes());
}