'use client';

import { useScroll, useSpring, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef } from 'react';

/**
 * 3D NFC kartička, která se otáčí scrollováním. Rotace je předrenderovaná
 * jako 60 průhledných WebP snímků (public/nfc-card/f000–f059.webp) a kreslí
 * se do canvasu podle pozice sekce ve viewportu — pružina (useSpring) dotahuje
 * cílový snímek, takže pohyb je plynulý i při trhaném scrollu.
 */
// Všech 180 snímků videa (krok 2° rotace) — při 60 bylo při pomalém scrollu
// znát krokování. Dohromady ~2 MB WebP, načítají se líně na pozadí.
const FRAME_COUNT = 180;
// Rozměr exportovaných snímků (poměr stran canvasu).
const FRAME_W = 950;
const FRAME_H = 740;

const frameSrc = (index: number) => `/nfc-card/f${String(index).padStart(3, '0')}.webp`;

export function NfcCardSpin({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const lastFrameRef = useRef(-1);
  const reduceMotion = useReducedMotion();

  const draw = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Posun o půl otočky: uprostřed viewportu (progress 0.5) je karta logem
    // dopředu, ne zády. Rotace je 360° smyčka, takže modulo je bezztrátové.
    const raw = Math.round(progress * (FRAME_COUNT - 1)) + FRAME_COUNT / 2;
    const index = ((raw % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
    if (index === lastFrameRef.current) return;
    const img = imagesRef.current[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);
    ctx.drawImage(img, 0, 0, FRAME_W, FRAME_H);
    lastFrameRef.current = index;
  }, []);

  // Přednačtení všech snímků; první se vykreslí hned, jak je k dispozici.
  useEffect(() => {
    if (reduceMotion) return;
    imagesRef.current = Array.from({ length: FRAME_COUNT }, (_, i) => {
      const img = new window.Image();
      img.src = frameSrc(i);
      if (i === 0) img.onload = () => { lastFrameRef.current = -1; draw(0); };
      return img;
    });
  }, [draw, reduceMotion]);

  // Scroll sekce → snímek rotace. Pružina vyhladí i kolečko myši.
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start end', 'end start'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 48, damping: 17, mass: 0.35 });
  useMotionValueEvent(smooth, 'change', (value) => draw(value));

  return (
    <div ref={wrapRef} className={className}>
      {reduceMotion ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={frameSrc(0)} alt="NFC kartička Team VYS" className="w-full" />
      ) : (
        <canvas
          ref={canvasRef}
          width={FRAME_W}
          height={FRAME_H}
          aria-label="Otáčející se NFC kartička Team VYS"
          role="img"
          className="w-full"
        />
      )}
    </div>
  );
}
