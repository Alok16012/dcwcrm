import { NextRequest, NextResponse } from 'next/server'

// Public short link for invoices: /i/{slug} -> the invoice PDF in storage.
// The slug is also the storage filename (invoices/{slug}.pdf), so no lookup table is needed.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params

    // Only allow safe slug characters to prevent path traversal into storage.
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return new NextResponse('Not found', { status: 404 })
    }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return new NextResponse('Not found', { status: 404 })

    const url = `${base}/storage/v1/object/public/student-documents/invoices/${slug}.pdf`
    return NextResponse.redirect(url, 302)
}
