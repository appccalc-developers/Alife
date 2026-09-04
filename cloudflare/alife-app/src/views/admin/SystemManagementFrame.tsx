import type { ReactNode } from 'react'
import { Activity, ArrowLeft, Bell, CalendarRange, FileImage, Globe2, Handshake, ShieldCheck, UserCog } from 'lucide-react'
import { Link } from 'react-router-dom'

export const systemManagementIcons = {
  overview: ShieldCheck,
  roles: UserCog,
  messages: Bell,
  visitRequests: Handshake,
  pageReview: Globe2,
  eventTemplates: CalendarRange,
  eventPackagePolicies: ShieldCheck,
  files: FileImage,
  logs: Activity,
} as const

export type SystemManagementIconKey = keyof typeof systemManagementIcons

type Props = {
  title: string
  subtitle: string
  language: string
  iconKey: SystemManagementIconKey
  children: ReactNode
  actions?: ReactNode
  bodyClassName?: string
  showBackLink?: boolean
}

const SystemManagementFrame = ({
  title,
  subtitle,
  language,
  iconKey,
  children,
  actions,
  bodyClassName = '',
  showBackLink = true,
}: Props) => {
  const isZh = language === 'zh'
  const Icon = systemManagementIcons[iconKey]

  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-[#254b42] bg-white shadow-[0_24px_70px_rgba(14,47,40,0.16)]"
      data-system-management-frame
    >
      <header className="relative isolate overflow-hidden bg-gradient-to-br from-[#0d332c] via-[#145044] to-[#1f6a58] px-5 pb-6 pt-4 text-white sm:px-7 sm:pb-7 sm:pt-5">
        <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full bg-[#e37b63]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-[#8fcab5]/15 blur-3xl" aria-hidden="true" />

        <div className="relative">
          {showBackLink ? (
            <Link
              to="/admin"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-black text-emerald-100 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {isZh ? '返回系统管理' : 'Back to System Management'}
            </Link>
          ) : null}

          <div className={`${showBackLink ? 'mt-3' : ''} flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between`}>
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#f6d3b5] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">
                  {showBackLink
                    ? (isZh ? '系统管理' : 'System Management')
                    : (isZh ? '平台治理' : 'Platform administration')}
                </p>
                <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-[-0.04em] sm:text-3xl">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{subtitle}</p>
              </div>
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 self-start lg:self-auto">{actions}</div> : null}
          </div>
        </div>
      </header>

      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export default SystemManagementFrame
