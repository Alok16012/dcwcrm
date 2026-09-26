// Public-facing app URL — used in every link we share outward (WhatsApp
// invoices, Meta ad form links, printed receipts). The old crmrahul.vercel.app
// domain still serves the app, but shared links should show the DCW branding.
// Served at distancecourseswala.com/crm (see next.config.ts). Links shared
// before the move still resolve: the old host rewrites /i and /f to /crm.
export const APP_URL = 'https://distancecourseswala.com/crm'
export const APP_HOST = 'distancecourseswala.com'
