import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { primaryNavItems, routes } from '../lib/routes';

/* ─── Shell ─── Sidebar + Main content layout ─── */

type ShellProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}>;

export function Shell({ children, title, subtitle, actions }: ShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-6 py-6 lg:px-10 lg:py-8">
          {title ? (
            <header className="mb-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  {subtitle ? (
                    <p className="mb-1 text-sm font-medium text-(--text-secondary)">{subtitle}</p>
                  ) : null}
                  <h1 className="text-[2rem] font-bold tracking-tight leading-tight">{title}</h1>
                </div>
                {actions}
              </div>
            </header>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}

/* ─── Sidebar ─── Fixed left navigation ─── */

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sticky top-0 flex h-screen w-[var(--sidebar-width)] shrink-0 flex-col bg-(--bg-elevated) max-lg:hidden">
      <div className="px-6 py-6">
        <Link to={routes.root} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--accent)">
            <span className="text-sm font-bold text-black">S</span>
          </div>
          <span className="text-sm font-bold tracking-tight">Spot Hist</span>
        </Link>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-0.5">
          {primaryNavItems.map((item) => {
            const isActive = item.patterns.some((pattern) =>
              Boolean(matchPath({ path: pattern, end: pattern === item.to }, location.pathname)),
            );

            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className={[
                    'flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-(--accent) text-black'
                      : 'text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-hover)',
                  ].join(' ')}
                >
                  <NavIcon name={item.key} active={isActive} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-(--border-subtle) px-6 py-4">
        <p className="text-[11px] font-medium text-(--text-subdued)">Self-hosted tracker</p>
      </div>
    </aside>
  );
}

/* ─── Mobile Nav ─── Bottom bar for small screens ─── */

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-(--border-subtle) bg-(--bg-elevated) lg:hidden">
      <ul className="flex items-center justify-around px-2 py-2">
        {primaryNavItems.map((item) => {
          const isActive = item.patterns.some((pattern) =>
            Boolean(matchPath({ path: pattern, end: pattern === item.to }, location.pathname)),
          );

          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className={[
                  'flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-(--text-primary)' : 'text-(--text-subdued)',
                ].join(' ')}
              >
                <NavIcon name={item.key} active={isActive} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ─── Nav Icons (simple SVG-free text icons) ─── */

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const icons: Record<string, string> = {
    home: '◉',
    scrobbles: '≋',
    artists: '♫',
    albums: '▣',
    tracks: '♪',
    settings: '⚙',
  };

  return (
    <span aria-hidden="true" className={`text-base leading-none ${active ? 'opacity-100' : 'opacity-60'}`}>
      {icons[name] ?? '•'}
    </span>
  );
}

/* ─── Button ─── */

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    kind?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md';
  }
>;

export function Button({ children, kind = 'primary', size = 'md', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'rounded px-3 py-1.5 text-xs',
    md: 'rounded-full px-5 py-3 text-sm',
  };
  const variants = {
    primary: 'bg-(--accent) text-black hover:bg-(--accent-highlight) hover:scale-[1.02] active:scale-[0.98]',
    secondary:
      'border border-(--border-strong) text-(--text-primary) hover:border-(--text-secondary) hover:bg-(--bg-hover)',
    danger: 'bg-(--error) text-white hover:brightness-110',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[kind]}`} {...props}>
      {children}
    </button>
  );
}

/* ─── TextInput ─── */

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded bg-(--bg-tinted) px-4 py-3 text-sm text-(--text-primary) outline-none transition placeholder:text-(--text-subdued) focus:ring-1 focus:ring-(--accent) focus:bg-(--bg-hover)"
      {...props}
    />
  );
}

/* ─── Field ─── */

export function Field({
  label,
  hint,
  children,
}: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="block space-y-2">
      <div>
        <span className="block text-sm font-medium text-(--text-primary)">{label}</span>
        {hint ? <span className="text-xs text-(--text-subdued)">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

/* ─── InlineNotice ─── */

export function InlineNotice({
  tone = 'neutral',
  children,
}: PropsWithChildren<{ tone?: 'neutral' | 'error' | 'success' }>) {
  const styles = {
    neutral: 'bg-(--bg-tinted) text-(--text-secondary)',
    error: 'bg-[rgba(241,94,108,0.1)] text-[#ffa0a8]',
    success: 'bg-[rgba(29,185,84,0.1)] text-(--accent-highlight)',
  };

  return (
    <div className={`rounded px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

/* ─── EmptyState ─── */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-start justify-center gap-4 rounded bg-(--bg-elevated) p-6">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">{body}</p>
      </div>
      {action}
    </div>
  );
}

/* ─── LoadingView ─── */

export function LoadingView({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm font-medium text-(--text-secondary) animate-pulse">{label}</p>
    </div>
  );
}

/* ─── Legacy exports for compatibility ─── */

export { Shell as AppFrame };
export function ShellNav() {
  return null;
}
export function Panel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`rounded bg-(--bg-elevated) p-5 ${className}`}>{children}</div>;
}

export function MetricCard({ label, value, hint, to }: { label: string; value: string; hint: string; to?: string }) {
  const content = (
    <div className="space-y-1">
      <p className="text-xs font-medium text-(--text-subdued) uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-(--text-secondary)">{hint}</p>
    </div>
  );

  if (!to) return content;

  return (
    <Link to={to} className="group block transition-colors hover:text-(--accent-highlight)">
      {content}
    </Link>
  );
}

export function BrandLink() {
  return (
    <Link to={routes.root} className="text-sm font-bold text-(--text-primary)">
      Spot Hist
    </Link>
  );
}
