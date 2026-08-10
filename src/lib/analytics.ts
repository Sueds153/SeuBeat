import ReactGA from 'react-ga4';
import { CURRENCY } from '../constants/currency';
import { safeUUID } from './uuid';

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const IS_ENABLED = Boolean(MEASUREMENT_ID);
let initialized = false;

function getUtm(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem('seubeat_utm_params');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function initGA(): void {
  if (!IS_ENABLED || initialized) return;
  initialized = true;
  try {
    ReactGA.initialize(MEASUREMENT_ID!);
  } catch {
    // GA4 falhou silenciosamente — não afecta o site
  }
}

export function gaPageView(path?: string): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.send({ hitType: 'pageview', page: path || window.location.pathname, ...getUtm() });
  } catch {}
}

export function gaViewContent(contentName?: string, value?: number, currency = CURRENCY): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.event('view_item', {
      content_type: 'product',
      items: [{ item_name: contentName || 'unknown', price: value }],
      value,
      currency,
      ...getUtm(),
    });
  } catch {}
}

export function gaInitiateCheckout(plan?: string, value?: number, currency = CURRENCY): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.event('begin_checkout', {
      currency,
      value,
      items: [{ item_name: plan || 'unknown', price: value }],
      ...getUtm(),
    });
  } catch {}
}

export function gaAddPaymentInfo(plan?: string, value?: number, currency = CURRENCY): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.event('add_payment_info', {
      currency,
      value,
      items: [{ item_name: plan || 'unknown', price: value }],
      ...getUtm(),
    });
  } catch {}
}

export function gaLead(contentName?: string): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.event('generate_lead', {
      value: contentName || '',
      ...getUtm(),
    });
  } catch {}
}

export function gaCompleteRegistration(): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.event('sign_up', {
      method: 'wizard',
      ...getUtm(),
    });
  } catch {}
}

export function gaSubmitApplication(plan?: string, value?: number, currency = CURRENCY): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.event('add_to_cart', {
      currency,
      value,
      items: [{ item_name: plan || 'unknown', price: value }],
      ...getUtm(),
    });
  } catch {}
}

export function gaPurchase(plan?: string, value?: number, currency = CURRENCY): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.event('purchase', {
      transaction_id: safeUUID(),
      currency,
      value,
      items: [{ item_name: plan || 'unknown', price: value }],
      ...getUtm(),
    });
  } catch {}
}

export function gaWizardStep(step: number, totalSteps = 9): void {
  if (!IS_ENABLED || !initialized) return;
  try {
    ReactGA.event('wizard_step', {
      step,
      total_steps: totalSteps,
      progress_pct: Math.round((step / totalSteps) * 100),
      ...getUtm(),
    });
  } catch {}
}
