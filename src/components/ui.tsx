import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40';
  const styles: Record<Variant, string> = {
    primary: 'bg-grad text-white shadow-md shadow-accent/20 hover:brightness-105',
    secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
    ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
  };
  return <button type="button" className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function StepHeader({ n, title, hint }: { n: number; title: string; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2.5">
        <span className="bg-grad grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white">{n}</span>
        <h2 className="text-[15px] font-bold">{title}</h2>
      </div>
      {hint && <p className="mt-1.5 pl-8.5 text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}
