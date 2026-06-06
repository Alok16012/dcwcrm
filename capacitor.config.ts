import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dcw.crm',
  appName: 'DCW CRM',
  // Minimal local fallback dir (real content loaded from server.url below)
  webDir: 'capacitor-www',
  server: {
    // App loads the live site directly — same Vercel backend + Supabase DB
    url: 'https://crmrahul.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#111827',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}

export default config
