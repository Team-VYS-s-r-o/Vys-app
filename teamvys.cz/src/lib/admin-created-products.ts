'use client';

import { useCallback, useEffect, useState } from 'react';

import { deleteAdminProduct, loadAdminProducts, loadParentProducts, loadPublicProducts, saveAdminProduct, type AdminProductRow } from '@/lib/api-client';
import type { ActivityType, ParentProduct } from '@/lib/portal-content';

type ProductState = { products: ParentProduct[]; error: string | null; loading: boolean };

/**
 * Scope určuje zdroj produktů:
 * - 'public': veřejný katalog (VYS marketing web) → /api/public/products (VYS only)
 * - 'admin': přihlášený admin vidí JEN produkty své organizace → /api/admin/products (auth, org-scoped)
 * - 'parent': přihlášený rodič vidí produkty všech svých org → /api/parent/products (auth, org-scoped)
 */
export type ProductScope = 'public' | 'admin' | 'parent';

type ProductStore = {
  cachedProducts: ParentProduct[] | null;
  cachedError: string | null;
  pendingLoad: Promise<ParentProduct[]> | null;
  listeners: Set<(state: ProductState) => void>;
};

const productStores: Record<ProductScope, ProductStore> = {
  public: { cachedProducts: null, cachedError: null, pendingLoad: null, listeners: new Set() },
  admin: { cachedProducts: null, cachedError: null, pendingLoad: null, listeners: new Set() },
  parent: { cachedProducts: null, cachedError: null, pendingLoad: null, listeners: new Set() },
};

function emitProductState(scope: ProductScope, state: ProductState) {
  const store = productStores[scope];
  store.cachedProducts = state.products;
  store.cachedError = state.error;
  for (const listener of store.listeners) listener(state);
}

async function loadProductRows(scope: ProductScope) {
  const rows = scope === 'admin' ? await loadAdminProducts() : scope === 'parent' ? await loadParentProducts() : await loadPublicProducts();
  return rows.map(rowToProduct);
}

export type AdminProductInput = {
  type: ActivityType;
  title: string;
  city: string;
  venue: string;
  primaryMeta: string;
  price: number;
  /** Cena 15vstupové varianty (jen pro Kroužek) */
  price15?: number;
  capacityTotal: number;
  capacityCurrent: number;
  description: string;
  trainingFocus: string;
  /** Kategorie kroužku: 'zacatecnici' | 'pokrocili' | 'smisene' (výchozí smisene = pro všechny) */
  skillCategory?: string;
  /** Fotky jako base64 data-URL (kroužek / tábor) */
  photos?: string[];
  /** Mapový dotaz pro automatické vyhledání polohy (např. "ZŠ Purkyňova Vyškov") */
  mapQuery?: string;
  /** Přesná GPS pozice vybraná adminem na mapě (použito pro ověření lokace při docházce) */
  latitude?: number;
  longitude?: number;
  /** Vybraní trenéři pro produkt */
  coachIds?: string[];
  /** Název triku 1 (workshop) */
  workshopTrick1?: string;
  /** Název triku 2 (workshop) */
  workshopTrick2?: string;
  /** Název souboru videa triku 1 (jen referenční) */
  workshopTrick1VideoFile?: string;
  /** Název souboru videa triku 2 (jen referenční) */
  workshopTrick2VideoFile?: string;
  /** Turnusy (jen pro Tábor) — pokud jsou vyplněné, vytvoří se samostatný produkt pro každý turnus */
  turnusy?: TurnusInput[];
};

export type TurnusInput = {
  /** ISO datum začátku, např. "2026-07-13" */
  dateFrom: string;
  /** ISO datum konce, např. "2026-07-17" */
  dateTo: string;
  /** Cena v Kč (volitelné přepsání hlavní ceny produktu) */
  price?: number;
  /** Kapacita (volitelné přepsání hlavní kapacity produktu) */
  capacity?: number;
};

function formatTurnusDateRange(dateFrom: string, dateTo: string): string {
  function fmtDay(iso: string) {
    const [, m, d] = iso.split('-');
    return `${Number(d)}. ${Number(m)}.`;
  }
  const year = dateTo.slice(0, 4);
  return `${fmtDay(dateFrom)} \u2013 ${fmtDay(dateTo)} ${year}`;
}

function activityTypeToDb(type: ActivityType): string {
  if (type === 'Krouzek') return 'Kroužek';
  if (type === 'Tabor') return 'Tábor';
  return 'Workshop';
}

function activityTypeFromDb(dbType: string): ActivityType {
  const normalized = dbType.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized === 'krouzek') return 'Krouzek';
  if (normalized === 'tabor') return 'Tabor';
  return 'Workshop';
}

function productToRow(product: ParentProduct): AdminProductRow {
  return {
    id: product.id,
    type: activityTypeToDb(product.type),
    title: product.title,
    city: product.city,
    place: product.place,
    venue: product.venue,
    price: product.price,
    original_price: product.originalPrice,
    price_label: product.priceLabel,
    entries_total: product.entriesTotal,
    primary_meta: product.primaryMeta,
    secondary_meta: product.secondaryMeta,
    description: product.description,
    important_info: product.importantInfo,
    badge: product.badge,
    event_date: undefined,
    expires_at: undefined,
    capacity_total: product.capacityTotal,
    capacity_current: product.capacityCurrent,
    hero_image: product.heroImage,
    gallery: product.gallery,
    map_query: product.mapQuery,
    latitude: product.latitude,
    longitude: product.longitude,
    coach_ids: product.coachIds ?? [],
    training_focus: product.trainingFocus,
    skill_category: product.skillCategory,
    is_published: true,
  };
}

function rowToProduct(row: AdminProductRow): ParentProduct {
  const type = activityTypeFromDb(row.type);
  const heroImage = productHeroImage(row, type);
  return {
    id: row.id,
    type,
    orgId: row.org_id ?? undefined,
    title: row.title,
    city: row.city,
    place: row.place,
    venue: row.venue,
    price: row.price,
    originalPrice: row.original_price,
    priceLabel: row.price_label,
    entriesTotal: row.entries_total,
    primaryMeta: row.primary_meta,
    secondaryMeta: row.secondary_meta,
    description: row.description,
    badge: row.badge,
    heroImage,
    gallery: productGallery(row, type, heroImage),
    mapQuery: row.map_query ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    coachIds: row.coach_ids ?? [],
    importantInfo: Array.isArray(row.important_info) && row.important_info.length > 0
      ? row.important_info
      : importantInfoFor(type, row.primary_meta, row.capacity_current, row.capacity_total ?? 0),
    trainingFocus: Array.isArray(row.training_focus) && row.training_focus.length > 0 ? row.training_focus : defaultFocus(type),
    skillCategory: row.skill_category ?? undefined,
    capacityTotal: row.capacity_total ?? 0,
    capacityCurrent: row.capacity_current,
    interestCount: row.interest_count ?? 0,
    canPurchase: row.can_purchase,
  };
}

export function useAdminCreatedProducts(scope: ProductScope = 'public') {
  const store = productStores[scope];
  const [products, setProducts] = useState<ParentProduct[]>(store.cachedProducts ?? []);
  const [loading, setLoading] = useState(store.cachedProducts === null);
  const [error, setError] = useState<string | null>(store.cachedError);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      store.pendingLoad ??= loadProductRows(scope).finally(() => {
        store.pendingLoad = null;
      });
      const loadedProducts = await store.pendingLoad;
      setProducts(loadedProducts);
      emitProductState(scope, { products: loadedProducts, error: null, loading: false });
    } catch (loadError) {
      setProducts([]);
      const message = loadError instanceof Error ? loadError.message : 'Produkty se nepodařilo načíst.';
      setError(message);
      emitProductState(scope, { products: [], error: message, loading: false });
    } finally {
      setLoading(false);
    }
  }, [scope, store]);

  useEffect(() => {
    const listener = (state: ProductState) => {
      setProducts(state.products);
      setError(state.error);
      setLoading(state.loading);
    };
    store.listeners.add(listener);

    if (store.cachedProducts === null) {
      void refresh();
    }

    return () => {
      store.listeners.delete(listener);
    };
  }, [refresh, store]);

  const addProduct = useCallback(async (input: AdminProductInput) => {
    const product = createAdminCreatedProduct(input);
    setError(null);
    try {
      // Tábor s turnusy: vytvoř jeden produkt pro každý turnus
      if (input.type === 'Tabor' && input.turnusy && input.turnusy.length > 0) {
        const baseId = product.id;
        const turnusProducts: ParentProduct[] = input.turnusy.map((turnus, index) => {
          const label = `${index + 1}. turnus`;
          const dateRange = formatTurnusDateRange(turnus.dateFrom, turnus.dateTo);
          const turnusPrice = turnus.price ?? product.price;
          const turnusCapacity = turnus.capacity ?? product.capacityTotal;
          return {
            ...product,
            id: `${baseId}-t${index + 1}`,
            price: turnusPrice,
            priceLabel: `${label} \u00b7 ${turnusPrice.toLocaleString('cs-CZ')} K\u010d`,
            primaryMeta: `${label} \u00b7 ${dateRange}`,
            secondaryMeta: 'Dokumenty online, příchod hlášením jména',
            capacityTotal: turnusCapacity,
            badge: 'Táborový turnus',
            importantInfo: [
              { label: 'Turnus', value: `${label} \u00b7 ${dateRange}` },
              { label: 'Dokumenty', value: 'GDPR, souhlas, anamnéza, bezinfekčnost, vyzvedávání a věci s sebou' },
              { label: 'Nástup', value: '1. den nahlaste jméno u vstupu — trenér zkontroluje přihlášku v systému' },
              { label: 'V ceně', value: 'jídlo, pitný režim a táborové tričko' },
            ],
          };
        });
        for (const turnusProduct of turnusProducts) {
          await saveAdminProduct(productToRow(turnusProduct));
        }
        const currentProducts = store.cachedProducts ?? products;
        const nextProducts = [
          ...turnusProducts,
          ...currentProducts.filter((p) => !turnusProducts.some((t) => t.id === p.id)),
        ];
        setProducts(nextProducts);
        emitProductState(scope, { products: nextProducts, error: null, loading: false });
        return turnusProducts[0];
      }

      const saved = await saveAdminProduct(productToRow(product));
      const savedProduct = saved.id && saved.id !== product.id ? { ...product, id: saved.id } : product;

      // Pro kroužek auto-vytvoř 15vstupovou variantu
      let variant15: ParentProduct | null = null;
      if (input.type === 'Krouzek') {
        const p15 = input.price15 && input.price15 > 0 ? input.price15 : Math.round(savedProduct.price * 1.45);
        const product15Row: AdminProductRow = {
          ...productToRow(savedProduct),
          id: `${savedProduct.id}-15`,
          price: p15,
          original_price: undefined,
          price_label: `15 vstupů · ${p15.toLocaleString('cs-CZ')} Kč`,
          entries_total: 15,
          important_info: [
            { label: 'Permanentka', value: '15 vstupů na vybranou lokalitu' },
            { label: 'Čas', value: savedProduct.primaryMeta },
            { label: 'Kapacita', value: `${savedProduct.capacityCurrent}/${savedProduct.capacityTotal} dětí aktuálně přihlášeno` },
          ],
        };
        await saveAdminProduct(product15Row);
        variant15 = rowToProduct(product15Row);
      }

      const currentProducts = store.cachedProducts ?? products;
      const nextProducts = [
        savedProduct,
        ...(variant15 ? [variant15] : []),
        ...currentProducts.filter((item) => item.id !== savedProduct.id && item.id !== `${savedProduct.id}-15`),
      ];
      setProducts(nextProducts);
      emitProductState(scope, { products: nextProducts, error: null, loading: false });
      return savedProduct;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Produkt se nepodařilo uložit.';
      setError(message);
      throw new Error(message);
    }
  }, [products, scope, store]);

  const removeProduct = useCallback(async (productId: string) => {
    setError(null);
    try {
      await deleteAdminProduct(productId);
      const nextProducts = (store.cachedProducts ?? products).filter((product) => product.id !== productId);
      setProducts(nextProducts);
      emitProductState(scope, { products: nextProducts, error: null, loading: false });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Produkt se nepodařilo smazat.';
      setError(message);
      throw new Error(message);
    }
  }, [products, scope, store]);

  const updateProduct = useCallback(async (product: ParentProduct) => {
    setError(null);
    try {
      await saveAdminProduct(productToRow(product));
      const nextProducts = [product, ...(store.cachedProducts ?? products).filter((item) => item.id !== product.id)];
      setProducts(nextProducts);
      emitProductState(scope, { products: nextProducts, error: null, loading: false });
      return product;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Produkt se nepodařilo uložit.';
      setError(message);
      throw new Error(message);
    }
  }, [products, scope, store]);

  return { products, loading, error, refresh, addProduct, removeProduct, updateProduct };
}

export function isAdminCreatedProduct(product: ParentProduct) {
  return product.id.startsWith('admin-created-');
}

function createAdminCreatedProduct(input: AdminProductInput): ParentProduct {
  const type = input.type;
  const city = input.city.trim() || 'Vyškov';
  const venue = input.venue.trim() || (type === 'Workshop' ? 'Workshop hala' : 'Nová lokalita');
  const place = `${city} · ${venue}`;
  const price = Math.max(0, Math.round(input.price || defaultPrice(type)));
  const capacityTotal = Math.max(1, Math.round(input.capacityTotal || defaultCapacity(type)));
  const capacityCurrent = Math.max(0, Math.min(capacityTotal, Math.round(input.capacityCurrent || 0)));
  const primaryMeta = input.primaryMeta.trim() || defaultPrimaryMeta(type);
  const heroImage = defaultHeroImage(type);

  // Workshop název automaticky z triků
  const trick1 = input.workshopTrick1?.trim() ?? '';
  const trick2 = input.workshopTrick2?.trim() ?? '';
  const workshopAutoTitle = trick1 && trick2 ? `Workshop: ${trick1} + ${trick2}` : trick1 || trick2 ? `Workshop: ${trick1 || trick2}` : '';

  const title = input.title.trim() || workshopAutoTitle || defaultTitle(type, city, venue);
  const trainingFocus = input.trainingFocus
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  // Fotky: použij nahrané nebo výchozí
  const uploadedPhotos = input.photos && input.photos.length > 0 ? input.photos : null;
  const gallery = uploadedPhotos ? uploadedPhotos : [heroImage];

  return {
    id: `admin-created-${type.toLowerCase()}-${slugify(city)}-${slugify(venue)}-${Date.now()}`,
    type,
    title,
    city,
    place,
    venue,
    price,
    priceLabel: priceLabelFor(type, price),
    entriesTotal: type === 'Krouzek' ? 10 : undefined,
    capacityTotal,
    capacityCurrent,
    primaryMeta,
    secondaryMeta: secondaryMetaFor(type),
    description: input.description.trim() || defaultDescription(type, city),
    badge: badgeFor(type),
    heroImage: uploadedPhotos ? uploadedPhotos[0] : heroImage,
    gallery,
    mapQuery: input.mapQuery?.trim() || undefined,
    latitude: input.latitude,
    longitude: input.longitude,
    coachIds: input.coachIds ?? [],
    importantInfo: importantInfoFor(type, primaryMeta, capacityCurrent, capacityTotal, trick1, trick2, input.workshopTrick1VideoFile, input.workshopTrick2VideoFile),
    trainingFocus: trainingFocus.length ? trainingFocus : defaultFocus(type),
    skillCategory: type === 'Krouzek' ? (input.skillCategory || 'smisene') : undefined,
  };
}

function productHeroImage(row: AdminProductRow, type: ActivityType) {
  const fallback = fallbackHeroImage(type, [row.id, row.city, row.venue, row.place].join(' '));
  const genericFallback = defaultHeroImage(type);
  const uploadedGallery = Array.isArray(row.gallery) ? row.gallery.filter(Boolean).filter((src) => src !== genericFallback) : [];
  if (uploadedGallery.length > 0) return uploadedGallery[0];
  if (!row.hero_image || row.hero_image === genericFallback) return fallback;
  return row.hero_image;
}

function productGallery(row: AdminProductRow, type: ActivityType, heroImage: string) {
  const identity = [row.id, row.city, row.venue, row.place].join(' ');
  const genericFallback = defaultHeroImage(type);
  const gallery = Array.isArray(row.gallery) ? row.gallery.filter(Boolean) : [];
  const cleaned = gallery.filter((src) => src !== genericFallback || src === heroImage);
  if (cleaned.length > 0) return Array.from(new Set([...(heroImage ? [heroImage] : []), ...cleaned]));
  if (!heroImage) return [];
  return fallbackGalleryImages(type, identity, heroImage);
}

function defaultTitle(type: ActivityType, city: string, venue: string) {
  if (type === 'Krouzek') return `Kroužek ${city}`;
  if (type === 'Tabor') return `Příměstský tábor ${city}`;
  return `${city} · ${venue}`;
}

function priceLabelFor(type: ActivityType, price: number) {
  if (type === 'Krouzek') return `10 vstupů · ${price.toLocaleString('cs-CZ')} Kč`;
  if (type === 'Tabor') return `Turnus ${price.toLocaleString('cs-CZ')} Kč`;
  return `${price.toLocaleString('cs-CZ')} Kč`;
}

function secondaryMetaFor(type: ActivityType) {
  if (type === 'Krouzek') return 'Digitální permanentka přes NFC čip';
  if (type === 'Tabor') return 'Dokumenty online, příchod hlášením jména';
  return 'QR ticket po zaplacení';
}

function badgeFor(type: ActivityType) {
  if (type === 'Krouzek') return 'Nový kroužek';
  if (type === 'Tabor') return 'Nový tábor';
  return 'Nový workshop';
}

function defaultPrice(type: ActivityType) {
  if (type === 'Krouzek') return 1790;
  if (type === 'Tabor') return 3890;
  return 890;
}

function defaultCapacity(type: ActivityType) {
  if (type === 'Krouzek') return 25;
  if (type === 'Tabor') return 30;
  return 40;
}

function defaultPrimaryMeta(type: ActivityType) {
  if (type === 'Krouzek') return 'Pondělí 16:00-17:00';
  if (type === 'Tabor') return 'Léto 2026';
  return 'Nový termín';
}

function defaultDescription(type: ActivityType, city: string) {
  if (type === 'Krouzek') return `Nový parkour kroužek v lokalitě ${city} s NFC docházkou, skill tree a rodičovským přehledem.`;
  if (type === 'Tabor') return `Nový příměstský tábor v lokalitě ${city} s digitálními dokumenty a prezenční listinou trenéra.`;
  return `Nový workshop v lokalitě ${city} s QR ticketem a jasným zaměřením na konkrétní triky.`;
}

function defaultHeroImage(type: ActivityType) {
  if (type === 'Krouzek') return '/courses/prostejov_Prostejov_parkour_main.webp';
  if (type === 'Tabor') return '/courses/nadrazka_ZS-Nadrazka-Foto3.webp';
  return '/courses/brandys_BR4.webp';
}

function fallbackHeroImage(type: ActivityType, identity: string) {
  const normalized = normalizeIdentity(identity);

  if (type === 'Krouzek') {
    if (normalized.includes('blansko') || normalized.includes('erbenova')) return '/courses/blansko_ZS-Erbenova-Main.webp';
    if (normalized.includes('brandys') || normalized.includes('vysluni')) return '/courses/brandys_BR_main.webp';
    if (normalized.includes('jesenik') || normalized.includes('komenskeho')) return '/courses/jesenik_JS_Main.webp';
    if (normalized.includes('prostejov') || normalized.includes('melantrichova')) return '/courses/prostejov_Prostejov_parkour_main.webp';
    if (normalized.includes('nadrazni') || normalized.includes('nadrazka')) return '/courses/nadrazka_ZS-Nadrazka-Main.webp';
    if (normalized.includes('purkynova') || normalized.includes('purkyn')) return '/courses/purkynka_Purkynova_Main.webp';
    return pickByIdentity(identity, [
      '/courses/blansko_ZS-Erbenova-Main.webp',
      '/courses/brandys_BR_main.webp',
      '/courses/jesenik_JS_Main.webp',
      '/courses/prostejov_Prostejov_parkour_main.webp',
      '/courses/nadrazka_ZS-Nadrazka-Main.webp',
      '/courses/purkynka_Purkynova_Main.webp',
    ]);
  }

  if (type === 'Tabor') {
    // No location-specific fallback for camps — avoid showing photos from unrelated venues
    return '';
  }

  // Workshop: no safe generic fallback either
  return '';
}

function fallbackGalleryImages(type: ActivityType, identity: string, heroImage: string) {
  const normalized = normalizeIdentity(identity);
  const images = fallbackGalleryCandidates(type, normalized);
  return Array.from(new Set([heroImage, ...images]));
}

function fallbackGalleryCandidates(type: ActivityType, normalized: string) {
  if (type === 'Krouzek') {
    if (normalized.includes('blansko') || normalized.includes('erbenova')) return ['/courses/blansko_ZS-Erbenova-Main.webp', '/courses/blansko_ZS-Erbenova-Foto1.webp', '/courses/blansko_ZS-Erbenova-Foto2.webp'];
    if (normalized.includes('brandys') || normalized.includes('vysluni')) return ['/courses/brandys_BR_main.webp', '/courses/brandys_BR1.webp', '/courses/brandys_BR2.webp', '/courses/brandys_BR3.webp', '/courses/brandys_BR4.webp', '/courses/brandys_BR5.webp', '/courses/brandys_BR6.webp'];
    if (normalized.includes('jesenik') || normalized.includes('komenskeho')) return ['/courses/jesenik_JS_Main.webp', '/courses/jesenik_JS1.webp', '/courses/jesenik_JS2.webp', '/courses/jesenik_JS3.webp'];
    if (normalized.includes('prostejov') || normalized.includes('melantrichova')) return ['/courses/prostejov_Prostejov_parkour_main.webp', '/courses/prostejov_Prostejov_parkour_1.webp', '/courses/prostejov_Prostejov_parkour_2.webp', '/courses/prostejov_Prostejov_parkour_3.webp', '/courses/prostejov_Prostejov_parkour_4.webp'];
    if (normalized.includes('nadrazni') || normalized.includes('nadrazka')) return ['/courses/nadrazka_ZS-Nadrazka-Main.webp', '/courses/nadrazka_ZS-Nadrazka-Foto1.webp', '/courses/nadrazka_ZS-Nadrazka-Foto2.webp', '/courses/nadrazka_ZS-Nadrazka-Foto3.webp'];
    if (normalized.includes('purkynova') || normalized.includes('purkyn')) return ['/courses/purkynka_Purkynova_Main.webp'];
  }

  if (type === 'Tabor') return [];
  return [];
}

function normalizeIdentity(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pickByIdentity(identity: string, images: string[]) {
  const hash = Array.from(identity).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return images[hash % images.length];
}

function defaultFocus(type: ActivityType) {
  if (type === 'Krouzek') return ['bezpečné dopady', 'přeskoky', 'skill tree', 'NFC docházka'];
  if (type === 'Tabor') return ['parkour základy', 'týmové hry', 'venkovní výzvy', 'bezpečný režim'];
  return ['tic-tac', 'kong vault', 'flow', 'QR ticket'];
}

function importantInfoFor(type: ActivityType, primaryMeta: string, capacityCurrent: number, capacityTotal: number, trick1?: string, trick2?: string, trick1VideoFile?: string, trick2VideoFile?: string): ParentProduct['importantInfo'] {
  if (type === 'Krouzek') {
    return [
      { label: 'Permanentka', value: '10 vstupů na vybranou lokalitu' },
      { label: 'Čas', value: primaryMeta },
      { label: 'Kapacita', value: `${capacityCurrent}/${capacityTotal} dětí aktuálně přihlášeno` },
    ];
  }

  if (type === 'Tabor') {
    return [
      { label: 'Termín', value: primaryMeta },
      { label: 'Dokumenty', value: 'GDPR, souhlas, anamnéza, bezinfekčnost a vyzvedávání' },
      { label: 'Kapacita', value: `${capacityCurrent}/${capacityTotal} dětí aktuálně přihlášeno` },
    ];
  }

  // Workshop
  const info: ParentProduct['importantInfo'] = [
    { label: 'Ticket', value: 'QR ticket po zaplacení' },
    { label: 'Termín', value: primaryMeta },
    { label: 'Kapacita', value: `${capacityCurrent}/${capacityTotal} míst` },
  ];
  if (trick1) info.push({ label: 'Trik 1', value: trick1 + (trick1VideoFile ? ` · ${trick1VideoFile}` : '') });
  if (trick2) info.push({ label: 'Trik 2', value: trick2 + (trick2VideoFile ? ` · ${trick2VideoFile}` : '') });
  return info;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'produkt';
}
