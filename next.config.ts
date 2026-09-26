import type { NextConfig } from "next";

/*
 * The CRM lives at distancecourseswala.com/crm — the website proxies /crm/* to
 * this deployment — so every page, asset and API route is served under /crm.
 * lib/base-path.ts covers the places Next does not prefix on its own.
 *
 * Everything that was ever shared at the root keeps working:
 * · Root API routes are rewritten, not redirected — webhooks (Meta, WhatsApp,
 *   biometric, IVR) do not follow redirects and a POST must stay a POST. Next
 *   only allows a rewrite outside basePath to an absolute URL, so it points
 *   back at this deployment's own /crm/api.
 * · Every other old root URL — invoice short links (/i/…), lead forms (/f/…),
 *   bookmarks, the Android app's start URL — redirects to its /crm twin.
 */
const BASE_PATH = '/crm'
const SELF = process.env.CRM_SELF_ORIGIN || 'https://dcwcrm.vercel.app'

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ['@react-pdf/renderer'],
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${SELF}${BASE_PATH}/api/:path*`, basePath: false },
    ]
  },
  async redirects() {
    return [
      { source: '/', destination: `${BASE_PATH}/login`, basePath: false, permanent: false },
      {
        source: '/:path((?!crm(?:/|$)|api/|_next/).*)',
        destination: `${BASE_PATH}/:path`,
        basePath: false,
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
