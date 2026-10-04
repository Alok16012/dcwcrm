import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })
// The phone layout of the CRM uses Poppins (see .crm-shell in globals.css).
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins' })

export const metadata: Metadata = {
  title: 'DCW',
  description: 'Manage leads, students, finance and HR for Distance Courses Wala consultancy',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'DCW',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#111827',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${poppins.variable}`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
