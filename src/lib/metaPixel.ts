const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const IS_ENABLED = Boolean(PIXEL_ID);
let initialized = false;

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

function parsePrice(priceStr: string): number {
  return parseFloat(priceStr.replace(/\./g, '').replace(/[^0-9]/g, ''));
}

function getEventSourceUrl(): string | undefined {
  try {
    return window.location.href;
  } catch {
    return undefined;
  }
}

export function initMetaPixel(): void {
  if (!IS_ENABLED || initialized) return;
  initialized = true;

  if (window.fbq) return;

  window.fbq = function (...args: any[]) {
    (window.fbq as any).callMethod
      ? (window.fbq as any).callMethod.apply(window.fbq, args)
      : (window.fbq as any).queue.push(args);
  };

  if (!window._fbq) window._fbq = window.fbq;
  (window.fbq as any).push = window.fbq;
  (window.fbq as any).loaded = true;
  (window.fbq as any).version = '2.0';
  (window.fbq as any).queue = [];

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');

  const img = document.createElement('img');
  img.height = 1;
  img.width = 1;
  img.style.display = 'none';
  img.src = `https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`;
  img.alt = '';
  document.body.appendChild(img);
}

export function fbPageView(): void {
  if (!IS_ENABLED || !window.fbq) return;
  window.fbq('track', 'PageView');
}

export function fbInitiateCheckout(plan?: string, value?: number, currency: string = 'AOA', eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  window.fbq('track', 'InitiateCheckout', { content_name: plan, value, currency, event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbAddPaymentInfo(plan?: string, value?: number, currency: string = 'AOA', eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  window.fbq('track', 'AddPaymentInfo', { content_name: plan, value, currency, event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbLead(contentName?: string, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  window.fbq('track', 'Lead', { content_name: contentName, event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbPurchase(plan?: string, value?: number, currency: string = 'AOA', eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  window.fbq('track', 'Purchase', { content_name: plan, value, currency, content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbSubmitApplication(plan?: string, value?: number, currency: string = 'AOA', eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  window.fbq('track', 'SubmitApplication', { content_name: plan, value, currency, content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbSetUserData(email: string, phone?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  const userData: Record<string, string> = {};
  if (email) userData.em = email;
  if (phone) userData.ph = phone;
  if (Object.keys(userData).length > 0) {
    window.fbq('set', 'userData', userData);
  }
}

export function fbViewContent(plan?: string, value?: number, currency: string = 'AOA', eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  window.fbq('track', 'ViewContent', { content_name: plan, value, currency, content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbCompleteRegistration(eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  window.fbq('track', 'CompleteRegistration', { content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export { parsePrice };
