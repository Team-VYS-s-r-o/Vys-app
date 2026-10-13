'use client';

import { useEffect, useRef } from 'react';

import { useAdminCreatedProducts } from '@/lib/admin-created-products';
import { publicMarqueeItems } from '@/lib/public-product-summary';

const coreItems = ['NFC docházka', 'Stripe platby', 'Skill tree', 'Rodičovský profil', 'QR workshopy s youtuberem'];

export function TrustMarquee() {
  const { products } = useAdminCreatedProducts();
  const liveItems = publicMarqueeItems(products);
  const items = [...liveItems, ...coreItems];

  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const wrapWidthRef = useRef(0);
  const positionRef = useRef(0);
  const lastTimeRef = useRef(0);
  const directionRef = useRef(-1);
  const targetDirectionRef = useRef(-1);

  useEffect(() => {
    const track = trackRef.current;
    const setEl = setRef.current;
    if (!track || !setEl) {
      return;
    }

    const updateWrapWidth = () => {
      const style = window.getComputedStyle(track);
      const gap = Number.parseFloat(style.columnGap || '0') || 0;
      wrapWidthRef.current = setEl.offsetWidth + gap;
      positionRef.current = -wrapWidthRef.current / 2;
      track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
    };

    updateWrapWidth();

    const resizeObserver = new ResizeObserver(() => updateWrapWidth());
    resizeObserver.observe(setEl);

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY.current;

        if (Math.abs(delta) > 1) {
          // Scroll down => move right, scroll up => move left.
          targetDirectionRef.current = delta > 0 ? 1 : -1;
        }

        lastScrollY.current = currentScrollY;
        scrollFrameRef.current = null;
      });
    };

    const tick = (time: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
      }

      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      // Smoothly steer toward the requested direction to avoid visible snapping.
      directionRef.current += (targetDirectionRef.current - directionRef.current) * 0.12;

      const pxPerSecond = 120;
      let next = positionRef.current + directionRef.current * pxPerSecond * dt;
      const wrapWidth = wrapWidthRef.current;

      if (wrapWidth > 0) {
        // Keep transform in a stable range for seamless looping.
        while (next <= -wrapWidth) {
          next += wrapWidth;
        }
        while (next > 0) {
          next -= wrapWidth;
        }
      }

      positionRef.current = next;
      track.style.transform = `translate3d(${next}px, 0, 0)`;
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    lastScrollY.current = window.scrollY;
    window.addEventListener('scroll', handleScroll, { passive: true });
    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <section className="relative overflow-hidden py-5">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-white" />
      <div className="overflow-hidden marquee-mask py-2">
        <div ref={trackRef} className="flex w-max gap-8 will-change-transform">
          <div ref={setRef} className="flex shrink-0 gap-8">
            {items.map((item, index) => (
              <span
                key={`a-${item}-${index}`}
                className="flex items-center gap-3 whitespace-nowrap rounded-brand border border-brand-purple/12 bg-white px-4 py-2.5 text-sm font-black text-brand-ink shadow-brand-soft"
              >
                <span className="h-2 w-2 rounded-full bg-brand-pink" />
                {item}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 gap-8" aria-hidden="true">
            {items.map((item, index) => (
              <span
                key={`b-${item}-${index}`}
                className="flex items-center gap-3 whitespace-nowrap rounded-brand border border-brand-purple/12 bg-white px-4 py-2.5 text-sm font-black text-brand-ink shadow-brand-soft"
              >
                <span className="h-2 w-2 rounded-full bg-brand-pink" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
