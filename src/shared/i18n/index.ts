/**
 * i18n Module for Gateway
 */
import {
  type SupportedLocale,
  type TranslationKey,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from './types.js';

import enLocale from './locales/en.json' with { type: 'json' };
import trLocale from './locales/tr.json' with { type: 'json' };

export * from './types.js';

interface NestedTranslation {
  [key: string]: string | NestedTranslation;
}
type TranslationData = NestedTranslation;

const TRANSLATIONS: Record<SupportedLocale, TranslationData> = {
  en: enLocale,
  tr: trLocale,
};

function getTranslations(locale: SupportedLocale): TranslationData {
  switch (locale) {
    case 'en':
      return TRANSLATIONS.en;
    case 'tr':
      return TRANSLATIONS.tr;
    default:
      return TRANSLATIONS.en;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeGet(obj: Record<string, unknown>, key: string): unknown {
  const entry = Object.entries(obj).find(([k]) => k === key);
  return entry ? entry[1] : undefined;
}

function getNestedValue(obj: TranslationData, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = safeGet(current, part);
  }

  return typeof current === 'string' ? current : undefined;
}

export type TranslationParams = Record<string, string | number>;

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) {
    return text;
  }

  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = safeGet(params, key);
    if (value === undefined) {
      return `{{${key}}}`;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    return `{{${key}}}`;
  });
}

/**
 * Translate a key to the specified locale
 */
export function t(
  key: TranslationKey,
  paramsOrLocale?: TranslationParams | SupportedLocale,
  locale?: SupportedLocale
): string {
  let params: TranslationParams | undefined;
  let effectiveLocale: SupportedLocale;

  if (typeof paramsOrLocale === 'string') {
    effectiveLocale = paramsOrLocale;
    params = undefined;
  } else {
    params = paramsOrLocale;
    effectiveLocale = locale ?? DEFAULT_LOCALE;
  }

  const translations = getTranslations(effectiveLocale);
  const value = getNestedValue(translations, key);

  if (value) {
    return interpolate(value, params);
  }

  if (effectiveLocale !== DEFAULT_LOCALE) {
    const defaultTranslations = getTranslations(DEFAULT_LOCALE);
    const defaultValue = getNestedValue(defaultTranslations, key);
    if (defaultValue) {
      return interpolate(defaultValue, params);
    }
  }

  return key;
}

export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export function parseLocale(value: string | undefined): SupportedLocale {
  if (!value) {
    return DEFAULT_LOCALE;
  }

  if (isValidLocale(value)) {
    return value;
  }

  const primaryLocale = value.split(',')[0]?.split('-')[0]?.toLowerCase();
  if (primaryLocale && isValidLocale(primaryLocale)) {
    return primaryLocale;
  }

  return DEFAULT_LOCALE;
}
