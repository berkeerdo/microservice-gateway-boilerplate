/**
 * i18n Type Definitions
 */

export type SupportedLocale = 'en' | 'tr';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'tr'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Translation keys - update as you add new translations
 */
export type TranslationKey =
  | 'common.internalError'
  | 'common.success'
  | 'validation.failed'
  | 'validation.error'
  | 'auth.sessionExpired'
  | 'auth.invalidToken'
  | 'auth.unauthorized'
  | 'route.notFound';
