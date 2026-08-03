const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const IS_ENABLED = Boolean(PIXEL_ID);
let initialized = false;

import { CURRENCY } from '../constants/currency';

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

// Tracking nunca deve quebrar o fluxo do utilizador — exceções são engolidas.
function safeFbq(...args: any[]): void {
  try {
    window.fbq(...args);
  } catch {
    // ignora — o tracking não pode bloquear a criação da letra
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

  safeFbq('init', PIXEL_ID);
  safeFbq('track', 'PageView');

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
  safeFbq('track', 'PageView');
}

export function fbInitiateCheckout(plan?: string, value?: number, currency: string = CURRENCY, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('track', 'InitiateCheckout', { content_name: plan, value, currency, event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbAddPaymentInfo(plan?: string, value?: number, currency: string = CURRENCY, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('track', 'AddPaymentInfo', { content_name: plan, value, currency, event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbLead(contentName?: string, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('track', 'Lead', { content_name: contentName, event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbPurchase(plan?: string, value?: number, currency: string = CURRENCY, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('track', 'Purchase', { content_name: plan, value, currency, content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbSubmitApplication(plan?: string, value?: number, currency: string = CURRENCY, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('track', 'SubmitApplication', { content_name: plan, value, currency, content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbSetUserData(email: string, phone?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  const userData: Record<string, string> = {};
  if (email) userData.em = email;
  if (phone) userData.ph = phone;
  if (Object.keys(userData).length > 0) {
    safeFbq('set', 'userData', userData);
  }
}

export function fbViewContent(plan?: string, value?: number, currency: string = CURRENCY, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('track', 'ViewContent', { content_name: plan, value, currency, content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbCompleteRegistration(eventID?: string, fn?: string, ln?: string, gen?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  const ud: Record<string, string> = {};
  if (fn) ud.fn = fn;
  if (ln) ud.ln = ln;
  if (gen) ud.gen = gen;
  safeFbq('track', 'CompleteRegistration', { content_type: 'product', ...(Object.keys(ud).length ? { ud } : {}), event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbStartWizard(eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('trackCustom', 'StartWizard', { event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbWizardStep(stepName: string, stepNumber: number, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('trackCustom', 'WizardStep', { step_name: stepName, step_number: stepNumber, event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbLyricsGenerated(eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('trackCustom', 'LyricsGenerated', { event_source_url: getEventSourceUrl() }, { eventID });
  safeFbq('track', 'CompleteRegistration', { content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export function fbCheckoutView(plan?: string, value?: number, currency: string = CURRENCY, eventID?: string): void {
  if (!IS_ENABLED || !window.fbq) return;
  safeFbq('track', 'ViewContent', { content_name: plan, value, currency, content_type: 'product', event_source_url: getEventSourceUrl() }, { eventID });
}

export { parsePrice };
