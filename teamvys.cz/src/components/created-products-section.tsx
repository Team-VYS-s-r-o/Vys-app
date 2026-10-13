'use client';

import { ArrowRight, CalendarDays, CheckCircle2, MapPin, Users } from 'lucide-react';
import Link from 'next/link';

import { useAdminCreatedProducts } from '@/lib/admin-created-products';
import { type ActivityType, type ParentProduct } from '@/lib/portal-content';
import { usePublicCoaches, type PublicCoachSummary } from '@/lib/use-public-coaches';

export function CreatedProductsSection({ type }: { type: ActivityType }) {
  const { products } = useAdminCreatedProducts();
  const { coachesForIds } = usePublicCoaches();
  const visibleProducts = products.filter((product) => product.type === type);

  if (visibleProducts.length === 0) return null;

  return (
    <section className="section-shell py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-brand-purple">Nově z administrace</p>
          <h2 className="mt-2 text-2xl font-black text-brand-ink md:text-4xl">Přidané {createdProductsHeading(type)}</h2>
        </div>
        <p className="max-w-[520px] text-sm font-bold leading-6 text-brand-ink-soft md:text-right">
          Tyto položky vytvořil admin a rodiče je vidí také v rodičovském portálu v části Platby.
        </p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleProducts.map((product) => (
          <CreatedProductCard key={product.id} product={product} coaches={coachesForIds(product.coachIds ?? [])} />
        ))}
      </div>
    </section>
  );
}

function CreatedProductCard({ product, coaches = [] }: { product: ParentProduct; coaches?: PublicCoachSummary[] }) {
  const remaining = Math.max(product.capacityTotal - product.capacityCurrent, 0);
  const capacityPercent = Math.min(100, Math.round((product.capacityCurrent / product.capacityTotal) * 100));

  return (
    <article className="h-full overflow-hidden rounded-[26px] border border-brand-purple/12 bg-white shadow-brand-soft">
      <div className="relative min-h-[170px] bg-gradient-brand p-5 text-white">
        <div aria-hidden className="absolute inset-0 diagonal-rails opacity-12" />
        <span className="relative inline-flex rounded-[16px] bg-white px-3 py-2 text-xs font-black uppercase text-brand-purple">
          {product.badge}
        </span>
        <div className="relative pt-10">
          <h3 className="text-2xl font-black leading-tight text-white">{product.title}</h3>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-white/82"><MapPin size={16} /> {product.place}</p>
        </div>
      </div>
      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info icon={<CalendarDays size={16} />} label="Termín" value={product.primaryMeta} />
          <Info icon={<Users size={16} />} label="Kapacita" value={`${product.capacityCurrent}/${product.capacityTotal}`} />
        </div>
        <div className="mt-4 rounded-[18px] bg-brand-paper p-3">
          <div className="flex items-center justify-between gap-3 text-xs font-black">
            <span className="text-brand-ink">Aktuálně {product.capacityCurrent}/{product.capacityTotal}</span>
            <span className="text-brand-cyan">{remaining} volných míst</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand-cyan" style={{ width: `${capacityPercent}%` }} />
          </div>
        </div>
        {product.importantInfo.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {product.importantInfo.map((item) => (
              <div key={item.label} className="flex items-start gap-2 text-xs">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-cyan" />
                <span className="font-bold text-brand-ink-soft"><span className="font-black text-brand-ink">{item.label}:</span> {item.value}</span>
              </div>
            ))}
          </div>
        )}
        {coaches.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-black uppercase text-brand-purple">Trenéři</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {coaches.map((coach) => (
                <div key={coach.id} className="flex items-center gap-2 rounded-[16px] bg-brand-paper px-3 py-1.5">
                  {coach.photoUrl && (
                    <img src={coach.photoUrl} alt={coach.name} className="h-6 w-6 rounded-full object-cover" />
                  )}
                  <span className="text-xs font-black text-brand-ink">{coach.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="mt-4 text-sm font-bold leading-6 text-brand-ink-soft">{product.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {product.trainingFocus.slice(0, 4).map((focus) => (
            <span key={focus} className="rounded-[16px] bg-brand-cyan/10 px-3 py-2 text-xs font-black text-brand-cyan">{focus}</span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/10 pt-4">
          <p className="text-sm font-black text-brand-purple">{product.priceLabel}</p>
          <Link href="/rodic" className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-brand-purple px-4 py-3 text-sm font-black text-white shadow-brand transition hover:bg-brand-purple-deep">
            Rodič
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-brand-paper p-3">
      <p className="flex items-center gap-2 text-xs font-black uppercase text-brand-ink-soft">{icon}{label}</p>
      <p className="mt-1 text-sm font-black text-brand-ink">{value}</p>
    </div>
  );
}

function createdProductsHeading(type: ActivityType) {
  if (type === 'Krouzek') return 'kroužky';
  if (type === 'Tabor') return 'tábory';
  return 'workshopy s youtuberem';
}
