import Image from 'next/image';

import { cn } from '@/lib/utils';

type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function TeamVysLogo({ size = 48, className, priority = false }: Props) {
  return (
    <Image
      src="/vys-logo-mark.png"
      alt="Team VYS logo"
      width={size}
      height={size}
      priority={priority}
      className={cn('object-contain select-none', className)}
      style={{ width: size, height: size }}
    />
  );
}
