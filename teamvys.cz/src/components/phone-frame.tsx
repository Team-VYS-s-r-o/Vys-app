'use client';

/**
 * iPhone kreslený v CSS: titanový rám, boční tlačítka, stavový řádek iOS a
 * uvnitř video nebo obrázek obrazovky aplikace (390 × 797, bez stavového řádku).
 * Šířku určuje rodič; výška se dopočítá z poměru stran.
 */
export function PhoneFrame({
  video,
  poster,
  alt,
  tone = '#f8f7fc',
  dark = false,
  playing = true,
  className = '',
  style,
}: {
  /** Krátké video (mp4). Bez něj se ukáže jen `poster`. */
  video?: string;
  poster: string;
  alt: string;
  /** Barva horního okraje obrazovky (pozadí stavového řádku). */
  tone?: string;
  /** Tmavá obrazovka → světlý čas a ikony. */
  dark?: boolean;
  playing?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const metal = 'linear-gradient(135deg, #5b5b63 0%, #1d1d22 22%, #3f3f47 48%, #131316 74%, #4c4c54 100%)';
  const button = 'linear-gradient(90deg, #2a2a30, #55555d 45%, #1c1c20)';
  const ink = dark ? '#ffffff' : '#0b0a1a';
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: '390 / 812', ...style }}>
      <span className="absolute rounded-l-[2px]" style={{ left: '-0.9%', top: '17.5%', width: '1.4%', height: '3.6%', background: button }} />
      <span className="absolute rounded-l-[2px]" style={{ left: '-0.9%', top: '24.5%', width: '1.4%', height: '7%', background: button }} />
      <span className="absolute rounded-l-[2px]" style={{ left: '-0.9%', top: '33%', width: '1.4%', height: '7%', background: button }} />
      <span className="absolute rounded-r-[2px]" style={{ right: '-0.9%', top: '27%', width: '1.4%', height: '11%', background: button }} />

      <div className="relative h-full w-full shadow-[0_50px_90px_-35px_rgba(0,0,0,0.8)]" style={{ background: metal, borderRadius: '17.5% / 8.4%', padding: '1.05%' }}>
        <div className="h-full w-full bg-black" style={{ borderRadius: '16.6% / 7.9%', padding: '2.35%' }}>
          <div className="relative h-full w-full overflow-hidden bg-black" style={{ borderRadius: '14% / 6.5%', containerType: 'inline-size' }}>
            <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: tone, fontSize: '4.1cqw' }}>
              <div className="relative flex shrink-0 items-center justify-between" style={{ height: '5.57%', padding: '0 7.2% 0 9.4%', color: ink }}>
                <span className="font-semibold leading-none" style={{ letterSpacing: '-0.02em' }}>9:41</span>
                <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black" style={{ top: '24%', height: '62%', width: '30.5%' }} />
                <span className="flex items-center" style={{ gap: '0.32em' }}>
                  <svg viewBox="0 0 18 12" style={{ height: '0.72em' }} fill="currentColor" aria-hidden>
                    <rect x="0" y="8.2" width="3" height="3.8" rx="0.9" />
                    <rect x="5" y="5.6" width="3" height="6.4" rx="0.9" />
                    <rect x="10" y="2.9" width="3" height="9.1" rx="0.9" />
                    <rect x="15" y="0" width="3" height="12" rx="0.9" />
                  </svg>
                  <svg viewBox="0 0 16 12" style={{ height: '0.72em' }} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                    <path d="M1.2 4.2a9.6 9.6 0 0 1 13.6 0" />
                    <path d="M3.6 6.7a6.2 6.2 0 0 1 8.8 0" />
                    <path d="M6.1 9.2a2.7 2.7 0 0 1 3.8 0" />
                  </svg>
                  <svg viewBox="0 0 27 12" style={{ height: '0.76em' }} aria-hidden>
                    <rect x="0.6" y="0.6" width="22.8" height="10.8" rx="3.4" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.4" />
                    <rect x="2.2" y="2.2" width="19.6" height="7.6" rx="2" fill="currentColor" />
                    <path d="M25 4v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill="currentColor" opacity="0.45" />
                  </svg>
                </span>
              </div>
              {video ? (
                <video
                  key={video}
                  ref={(el) => {
                    if (!el) return;
                    if (playing) {
                      el.play().catch(() => {});
                    } else {
                      el.pause();
                      el.currentTime = 0;
                    }
                  }}
                  src={video}
                  poster={poster}
                  aria-label={alt}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="block min-h-0 w-full flex-1 object-cover object-top"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={alt} decoding="async" draggable={false} className="block min-h-0 w-full flex-1 select-none object-cover object-top" />
              )}
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full" style={{ bottom: '0.95%', width: '35%', height: '0.6%', background: dark ? 'rgba(255,255,255,0.85)' : 'rgba(11,10,26,0.8)' }} />
            </div>
            <span className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 22%, transparent 38%)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
