/** Page header in the minimal language: number + label, display title, one description, one action, then a rule. */
export function PageHeader({ n, label, title, description, action, children }: {
  n?: string; label?: string; title: string; description?: string; action?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="mb-10">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          {(n || label) && (
            <p className="mb-3 flex items-baseline gap-3">
              {n && <span className="t-num">{n}</span>}
              {label && <span className="t-label">{label}</span>}
            </p>
          )}
          <h1 className="t-display">{title}</h1>
          {description && <p className="mt-4 max-w-prose text-sm text-muted-foreground">{description}</p>}
        </div>
        {(action || children) && (
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            {children}
            {action}
          </div>
        )}
      </div>
      <hr className="rule mt-8" />
    </header>
  );
}
