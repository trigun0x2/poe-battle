import { useEffect, useRef, useState } from 'react';
import { mountFxCanvas, vaalMotes } from '../lib/fx';
import { useDraft } from '../store';

/**
 * Global FX: the ember canvas, the Vaal vignette + staged reveal, toasts.
 * The reveal holds a beat of silence before the verdict — fear is the feature.
 */
export function FxLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vaalReveal = useDraft((s) => s.vaalReveal);
  const clearVaal = useDraft((s) => s.clearVaal);
  const toast = useDraft((s) => s.toast);
  const [phase, setPhase] = useState<'idle' | 'dread' | 'verdict'>('idle');

  useEffect(() => {
    if (canvasRef.current) mountFxCanvas(canvasRef.current);
  }, []);

  useEffect(() => {
    if (!vaalReveal) { setPhase('idle'); return; }
    setPhase('dread');
    vaalMotes();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setPhase('verdict'), reduced ? 50 : 1400);
    return () => window.clearTimeout(t);
  }, [vaalReveal]);

  const verdictText =
    vaalReveal?.outcome === 'brick' ? 'Bricked.'
    : vaalReveal?.outcome === 'upgrade' ? 'Empowered.'
    : 'Unchanged.';
  const verdictSub =
    vaalReveal?.outcome === 'brick' ? 'The Vaal take more than they give.'
    : vaalReveal?.outcome === 'upgrade' ? 'The corruption favours you. This time.'
    : 'The orb hums, and falls silent.';

  return (
    <>
      <canvas ref={canvasRef} className="fx-canvas" aria-hidden="true" />
      <div className={`vaal-vignette${vaalReveal ? ' active' : ''}`} aria-hidden="true" />
      {vaalReveal && (
        <div
          className="vaal-reveal"
          role="alertdialog"
          aria-label={`Corruption result for ${vaalReveal.name}`}
          onClick={() => phase === 'verdict' && clearVaal()}
        >
          <div className="inner">
            {phase === 'dread' ? (
              <div className="verdict none" aria-hidden="true">…</div>
            ) : (
              <>
                <div className={`verdict ${vaalReveal.outcome}`}>{verdictText}</div>
                <p className="which">
                  {vaalReveal.name} — {verdictSub}
                </p>
                <button className="btn" style={{ marginTop: '1.4rem' }} onClick={clearVaal} autoFocus>
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
