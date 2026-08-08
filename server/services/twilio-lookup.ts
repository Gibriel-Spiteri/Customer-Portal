/**
 * Twilio Lookup service — validates phone numbers and detects line type
 * (mobile vs landline) via the Twilio Lookup v2 API.
 *
 * Credentials come from the Replit Twilio connector. They are fetched fresh
 * per call (never cached) because connector tokens/settings can rotate.
 */
import { buildHeaders, resolveBaseUrl } from '@replit/connectors-sdk/identity.js';

interface TwilioSettings {
  account_sid: string;
  api_key: string;
  api_key_secret: string;
}

async function getTwilioSettings(): Promise<TwilioSettings> {
  const baseUrl = resolveBaseUrl();
  const headers = await buildHeaders();
  const url = `${baseUrl}/api/v2/connection?connector_names=twilio&expand=connector&include_secrets=true`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Twilio connector lookup failed (${response.status})`);
  }
  const data: any = await response.json();
  const settings = data?.items?.[0]?.settings;
  if (!settings?.api_key || !settings?.api_key_secret) {
    throw new Error('Twilio connection is not configured');
  }
  return settings as TwilioSettings;
}

/** Normalize a US phone number to E.164. Returns null if it can't be. */
export function toE164(input: string): string | null {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export interface PhoneLookupResult {
  valid: boolean;
  e164: string | null;
  /** 'mobile' | 'landline' | 'fixedVoip' | 'nonFixedVoip' | 'voip' | ... */
  lineType: string | null;
  /** Pretty national format, e.g. (631) 555-0123 */
  nationalFormat: string | null;
}

export async function lookupPhone(input: string): Promise<PhoneLookupResult> {
  const e164 = toE164(input);
  if (!e164) {
    return { valid: false, e164: null, lineType: null, nationalFormat: null };
  }

  const settings = await getTwilioSettings();
  const auth = Buffer.from(`${settings.api_key}:${settings.api_key_secret}`).toString('base64');
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`;

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (response.status === 404) {
    return { valid: false, e164, lineType: null, nationalFormat: null };
  }
  if (!response.ok) {
    const text = await response.text();
    console.error('Twilio Lookup failed:', response.status, text.slice(0, 300));
    throw new Error('Phone validation service is unavailable right now');
  }

  const data: any = await response.json();
  return {
    valid: data?.valid !== false,
    e164,
    lineType: data?.line_type_intelligence?.type ?? null,
    nationalFormat: data?.national_format ?? null,
  };
}
