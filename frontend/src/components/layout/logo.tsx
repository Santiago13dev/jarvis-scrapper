/**
 * Marca de ProspectAI: un punto de señal detectado sobre un barrido de radar
 * (mismo lenguaje visual que el ScoreRing), en vez de un logotipo genérico.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface-raised overflow-hidden">
        <div className="radar-sweep absolute inset-0 rounded-full" />
        <div className="relative h-1.5 w-1.5 rounded-full bg-signal-amber shadow-[0_0_6px_1px_rgba(232,163,61,0.7)]" />
      </div>
    </div>
  );
}
