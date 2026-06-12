export const metadata = {
  title: 'Privacy Policy — Distance Courses Wala',
  description: 'Privacy Policy for the Distance Courses Wala CRM application.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: 12 June 2026</p>

      <p className="mb-6">
        This Privacy Policy describes how <strong>Distance Courses Wala</strong> (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses and protects information when you use the
        Distance Courses Wala CRM application and website (the &ldquo;Service&rdquo;). The Service is an
        internal education-consultancy management tool used by our staff, counselors, associates and
        enrolled students.
      </p>

      <Section title="1. Information We Collect">
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>Account information:</strong> name, email address, phone number and role used to sign in.</li>
          <li><strong>Student & lead records:</strong> details entered by staff such as name, contact number, course, fees and admission status.</li>
          <li><strong>Documents:</strong> files you upload (e.g. identity proofs, receipts) for admission and verification.</li>
          <li><strong>Usage data:</strong> basic technical information needed to operate and secure the Service.</li>
        </ul>
      </Section>

      <Section title="2. How We Use Information">
        <ul className="list-disc pl-6 space-y-1.5">
          <li>To provide and operate the CRM (managing leads, admissions, fees, mentorship and dispatch).</li>
          <li>To authenticate users and control access based on role.</li>
          <li>To communicate important updates and notifications.</li>
          <li>To maintain the security and integrity of the Service.</li>
        </ul>
      </Section>

      <Section title="3. Data Storage & Security">
        <p>
          Data is stored securely using industry-standard cloud infrastructure (Supabase) with
          encryption in transit. Access is restricted to authorized users through role-based
          permissions. We take reasonable measures to protect your information against unauthorized
          access, alteration or disclosure.
        </p>
      </Section>

      <Section title="4. Data Sharing">
        <p>
          We do <strong>not</strong> sell your personal information. Data is only accessible to
          authorized staff of Distance Courses Wala and to service providers that help us operate the
          Service (such as hosting and database providers), bound by confidentiality obligations.
        </p>
      </Section>

      <Section title="5. Data Retention">
        <p>
          We retain records for as long as necessary to provide the Service and to meet legal and
          operational requirements. You may request deletion of your data by contacting us.
        </p>
      </Section>

      <Section title="6. Your Rights">
        <p>
          You may request access to, correction of, or deletion of your personal information by
          contacting us at the details below.
        </p>
      </Section>

      <Section title="7. Children’s Privacy">
        <p>
          The Service is intended for use by staff and enrolled students. Student records are managed
          by authorized staff. We do not knowingly collect data directly from children without
          appropriate authorization.
        </p>
      </Section>

      <Section title="8. Contact Us">
        <p>
          If you have any questions about this Privacy Policy, contact us at:
        </p>
        <p className="mt-2">
          <strong>Distance Courses Wala</strong><br />
          Email: <a href="mailto:askdistancecourseswala@gmail.com" className="text-blue-600 hover:underline">askdistancecourseswala@gmail.com</a><br />
          Phone: +91 99395 87009
        </p>
      </Section>

      <p className="text-xs text-gray-400 mt-12 border-t pt-6">
        © {new Date().getFullYear()} Distance Courses Wala. All rights reserved.
      </p>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-lg font-bold mb-2 text-gray-900">{title}</h2>
      <div className="text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  )
}
