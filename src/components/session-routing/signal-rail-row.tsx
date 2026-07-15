export function SignalRailRow({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border-b border-secondary bg-primary last:border-b-0">
      <div className="absolute inset-y-0 left-0 w-0.5" style={{ background: color }} />
      <div className="pl-3">{children}</div>
    </div>
  );
}
