'use client';

import Image from 'next/image';

import { cn } from '@/lib/utils';

type VysMaskotImageProps = {
  src?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
  alt?: string;
};

export function VysMaskotImage({
  src = '/vys-maskot-no-logo.png',
  className,
  imageClassName,
  priority = false,
  sizes = '(max-width: 768px) 180px, 320px',
  alt = 'Team VYS maskot',
}: VysMaskotImageProps) {
  return (
    <div className={cn('relative aspect-[2/3] w-full', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn('object-contain select-none', imageClassName)}
      />
    </div>
  );
}