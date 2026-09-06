'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { TeamVysLogo } from '@/components/brand/team-vys-logo';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Kroužky', href: '/krouzky' },
  { label: 'Tábory', href: '/tabory' },
  { label: 'Workshopy', href: '/workshopy' },
  { label: 'O nás', href: '/o-nas' },
  { label: 'Kontakty', href: '/kontakty' },
  { label: 'Aplikace', href: '/aplikace' },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [desktopHover, setDesktopHover] = useState(false);

  useEffect(() => {
    const updateScrollProgress = () => {
      const maxScroll = 140;
      const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
      setScrollProgress(progress);
    };

    updateScrollProgress();
    window.addEventListener('scroll', updateScrollProgress, { passive: true });

    return () => window.removeEventListener('scroll', updateScrollProgress);
  }, []);

  const effectiveProgress = desktopHover ? 0 : scrollProgress;
  const navWidth = 100 - effectiveProgress * 32;
  const navScale = 1 - effectiveProgress * 0.1;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 py-4 transition-all duration-500 ease-out">
      <div className="mx-auto max-w-6xl px-4">
        <div
          className="group mx-auto flex w-full origin-center items-center gap-4 rounded-2xl border border-white/65 bg-transparent px-4 py-3 shadow-none backdrop-blur-xl transition-all duration-300 ease-out hover:border-black/5 hover:bg-[#f5f3ef]/95 hover:shadow-[0_24px_80px_rgba(12,10,28,0.18)] max-md:border-white/20 md:w-[var(--nav-width)] md:scale-x-[var(--nav-scale)]"
          onMouseEnter={() => setDesktopHover(true)}
          onMouseLeave={() => setDesktopHover(false)}
          style={{ '--nav-width': `${navWidth}%`, '--nav-scale': `${navScale}` } as React.CSSProperties}
        >
          <div className="hidden h-9 md:flex md:flex-1 md:items-center md:overflow-hidden">
            <Link
              href="/"
              aria-label="Přejít na úvodní stránku"
              className="inline-flex items-center opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
            >
              <TeamVysLogo size={32} priority />
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden md:flex-[2]">
            <nav className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full font-bold text-black opacity-0 transition-all duration-500 ease-out hover:bg-black/5 group-hover:opacity-100 ${
                    'px-3 py-2 text-sm group-hover:px-3 group-hover:py-2 group-hover:text-sm'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex justify-end md:flex-1">
            <button
              aria-label="Menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 md:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 min-h-dvh overflow-y-auto bg-white text-brand-ink md:hidden"
          >
            <div className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col px-6 py-6">
              <div className="flex items-center justify-between gap-4">
                <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 transition-opacity hover:opacity-80">
                  <TeamVysLogo size={42} priority />
                  <span className="text-2xl font-black leading-none text-brand-ink">
                    TEAM<span className="gradient-text">VYS</span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label="Zavřít menu"
                  onClick={() => setOpen(false)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-brand-purple/[0.16] bg-white/[0.88] text-brand-ink shadow-brand-soft ring-1 ring-white/60 backdrop-blur-xl transition hover:bg-white"
                >
                  <X size={25} />
                </button>
              </div>

              <nav className="mt-10 flex flex-1 flex-col justify-center gap-3 pb-8">
                {navItems.map((item, index) => {
                  const active = pathname?.startsWith(item.href);
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.26, delay: 0.04 + index * 0.035, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'block py-3 transition-colors',
                          active ? 'text-brand-purple' : 'text-brand-ink hover:text-brand-purple'
                        )}
                      >
                        <span className="text-[clamp(1.9rem,7vw,3rem)] font-black leading-none">{item.label}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
