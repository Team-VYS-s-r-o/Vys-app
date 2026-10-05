'use client';

import { Download, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function AppInstallButton({ label = 'Nainstalovat do telefonu', compact = false }: { label?: string; compact?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

  if (installed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-brand border border-brand-purple/15 bg-white px-5 py-3.5 text-sm font-black text-brand-ink-soft shadow-brand-soft">
        <Smartphone size={18} />
        Aplikace je nainstalovaná
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={install}
      disabled={!installPrompt}
      className={cn(
        'inline-flex items-center gap-2 rounded-brand border border-brand-purple/15 bg-white text-sm font-black text-brand-ink shadow-brand-soft transition hover:-translate-y-px disabled:cursor-not-allowed disabled:text-brand-ink-soft disabled:opacity-70 disabled:hover:translate-y-0',
        compact ? 'px-4 py-2.5' : 'px-5 py-3.5'
      )}
      title={installPrompt ? 'Nainstalovat Team VYS appku' : 'V prohlížeči použij Přidat na plochu / Add to Home Screen'}
    >
      <Download size={18} />
      {label}
    </button>
  );
}