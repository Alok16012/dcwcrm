/**
 * The CRM is served under /crm on distancecourseswala.com (next.config.ts
 * `basePath`). Next adds that prefix to <Link>, router.push and redirect() on
 * its own; it does NOT add it to fetch(), window.location, plain <a>/<img>
 * tags or middleware redirects — those go through withBase().
 */
export const BASE_PATH = '/crm'

export function withBase(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  if (path === BASE_PATH || path.startsWith(BASE_PATH + '/') || path.startsWith(BASE_PATH + '?')) return path
  return BASE_PATH + path
}
