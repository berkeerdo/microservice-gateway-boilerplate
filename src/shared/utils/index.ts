/**
 * Shared Utilities
 */

/**
 * Extract language from request headers
 */
export function extractLanguage(headers: Record<string, string | string[] | undefined>): string {
  const xLang = headers['x-language'];
  if (typeof xLang === 'string') {
    return xLang;
  }

  const acceptLang = headers['accept-language'];
  if (typeof acceptLang === 'string') {
    return acceptLang.split(',')[0]?.split('-')[0] || 'en';
  }

  return 'en';
}

/**
 * Parse pagination parameters
 */
export function parsePagination(
  page?: string | number,
  limit?: string | number,
  maxLimit = 100
): { page: number; limit: number; offset: number } {
  const parsedPage = Math.max(1, typeof page === 'string' ? parseInt(page, 10) || 1 : page || 1);
  const parsedLimit = Math.min(
    maxLimit,
    Math.max(1, typeof limit === 'string' ? parseInt(limit, 10) || 20 : limit || 20)
  );

  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit,
  };
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON without throwing
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
