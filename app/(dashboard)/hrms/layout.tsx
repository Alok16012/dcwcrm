import HrmsNav from '@/components/hrms/HrmsNav'

export default function HrmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <HrmsNav />
      {children}
    </div>
  )
}
