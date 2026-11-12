export function PageHeader({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-11 flex-wrap items-center gap-3 px-4 py-1.5">
        <h1 className="font-display text-[15px] font-bold uppercase tracking-wide">{title}</h1>
        {description && <span className="hidden truncate text-xs text-muted-foreground md:inline">{description}</span>}
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="label-caps">{title}</div>
      {children && <div className="mt-2 max-w-md text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}
