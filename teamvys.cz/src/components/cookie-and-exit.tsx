'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const CONSENT_KEY = 'vys-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      // storage blocked — keep banner hidden rather than nag on every load
    }
  }, []);

  function choose(value: 'all' | 'necessary') {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[120] p-3 md:p-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-[#15151D] p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] md:flex-row md:items-center md:gap-5 md:p-5">
        <p className="flex-1 text-sm leading-relaxed text-white/80">
          <span className="font-bold text-white">🍪 Cookies.</span> Používáme nezbytné cookies pro chod webu a přihlášení. Volitelné
          cookies nám pomáhají web zlepšovat.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('necessary')}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            Jen nezbytné
          </button>
          <button
            type="button"
            onClick={() => choose('all')}
            className="rounded-full bg-white px-5 py-2 text-sm font-bold text-[#0B0B10] transition hover:bg-white/90"
          >
            Přijmout vše
          </button>
        </div>
      </div>
    </div>
  );
}

const EXIT_GUARD_KEY = '__vysExitGuard';

const EXIT_INTENT_KEY = 'vys-exit-intent-shown';

export function ExitGuard() {
  const [open, setOpen] = useState(false);
  const leavingRef = useRef(false);

  // Mouse leaving through the top of the viewport means the visitor is heading
  // for the back arrow / tab bar. Shown once per session so it never nags.
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    try {
      if (window.sessionStorage.getItem(EXIT_INTENT_KEY)) return;
    } catch {
      // storage blocked — still allow the one-time prompt
    }

    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget || event.clientY > 4) return;
      try {
        window.sessionStorage.setItem(EXIT_INTENT_KEY, '1');
      } catch {
        // ignore
      }
      document.removeEventListener('mouseout', onMouseOut);
      setOpen(true);
    };
    document.addEventListener('mouseout', onMouseOut);
    return () => document.removeEventListener('mouseout', onMouseOut);
  }, []);

  useEffect(() => {
    const arm = () => {
      const state = (window.history.state ?? {}) as Record<string, unknown>;
      if (state[EXIT_GUARD_KEY]) return;
      // Duplicate the entry page in history: pressing back first lands on the
      // sentinel copy (in-site back keeps working), and only popping past it
      // means the visitor is actually leaving the site.
      window.history.pushState({ ...state, [EXIT_GUARD_KEY]: true }, '', window.location.href);
    };
    arm();

    const onPop = (event: PopStateEvent) => {
      const state = (event.state ?? {}) as Record<string, unknown>;
      if (state[EXIT_GUARD_KEY] || leavingRef.current) return;
      arm();
      setOpen(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function stay() {
    setOpen(false);
  }

  function leave() {
    leavingRef.current = true;
    setOpen(false);
    // We sit on the re-armed sentinel; -2 jumps past the original entry out of
    // the site. If there is no earlier page the browser ignores it.
    window.history.go(-2);
    window.setTimeout(() => {
      leavingRef.current = false;
    }, 1500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#15151D] p-6 text-center text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
        <Image
          src="/cats/premyslim.png"
          alt="Maskot VYS přemýšlí"
          width={160}
          height={160}
          className="mx-auto h-40 w-40 object-contain"
        />
        <h2 className="mt-3 text-xl font-black">Opravdu chceš odejít?</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Ještě jsme ti toho tolik neukázali… kroužky, tábory i appku s XP.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={stay}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#0B0B10] transition hover:bg-white/90"
          >
            Zůstávám 🐾
          </button>
          <button
            type="button"
            onClick={leave}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10"
          >
            Odejít
          </button>
        </div>
      </div>
    </div>
  );
}
