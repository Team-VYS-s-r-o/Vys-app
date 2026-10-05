'use client';

import Image from 'next/image';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  frontSrc?: string;
  backSrc?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  frontImageClassName?: string;
  defaultActive?: boolean;
  initialRevealX?: string;
  initialRevealY?: string;
  shapeScale?: number;
};

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 150;
const IDLE_REVEAL_SCALE = 0.58;
const MIN_REVEAL_SCALE = 0.52;
const MAX_REVEAL_SCALE = 1.26;
const SPEED_DEAD_ZONE = 85;
const SPEED_SCALE_FACTOR = 0.0021;

const FACEPLATE_POINTS = [
  { x: -0.16, y: -1.02 },
  { x: 0.28, y: -0.98 },
  { x: 0.62, y: -0.78 },
  { x: 0.82, y: -0.45 },
  { x: 0.86, y: -0.08 },
  { x: 0.72, y: 0.28 },
  { x: 0.52, y: 0.66 },
  { x: 0.22, y: 0.96 },
  { x: -0.04, y: 1.08 },
  { x: -0.34, y: 0.94 },
  { x: -0.56, y: 0.62 },
  { x: -0.72, y: 0.22 },
  { x: -0.76, y: -0.16 },
  { x: -0.64, y: -0.52 },
  { x: -0.42, y: -0.82 },
] as const;

type ShapePoint = {
  coordinateX: number;
  coordinateY: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function resolvePosition(position: string | undefined, size: number, fallback: number) {
  if (!position) return fallback;

  const trimmedPosition = position.trim();
  if (trimmedPosition.endsWith('%')) {
    const percentage = Number.parseFloat(trimmedPosition);
    return Number.isFinite(percentage) ? (percentage / 100) * size : fallback;
  }

  const numericPosition = Number.parseFloat(trimmedPosition);
  return Number.isFinite(numericPosition) ? numericPosition : fallback;
}

function formatCoordinate(value: number) {
  return value.toFixed(2);
}

function pointsToSmoothPath(points: ShapePoint[]) {
  const firstPoint = points[0];
  let path = `M ${formatCoordinate(firstPoint.coordinateX)} ${formatCoordinate(firstPoint.coordinateY)}`;

  points.forEach((currentPoint, currentIndex) => {
    const previousPoint = points[(currentIndex - 1 + points.length) % points.length];
    const nextPoint = points[(currentIndex + 1) % points.length];
    const followingPoint = points[(currentIndex + 2) % points.length];

    const firstControlX = currentPoint.coordinateX + (nextPoint.coordinateX - previousPoint.coordinateX) / 6;
    const firstControlY = currentPoint.coordinateY + (nextPoint.coordinateY - previousPoint.coordinateY) / 6;
    const secondControlX = nextPoint.coordinateX - (followingPoint.coordinateX - currentPoint.coordinateX) / 6;
    const secondControlY = nextPoint.coordinateY - (followingPoint.coordinateY - currentPoint.coordinateY) / 6;

    path += ` C ${formatCoordinate(firstControlX)} ${formatCoordinate(firstControlY)}, ${formatCoordinate(secondControlX)} ${formatCoordinate(secondControlY)}, ${formatCoordinate(nextPoint.coordinateX)} ${formatCoordinate(nextPoint.coordinateY)}`;
  });

  return `${path} Z`;
}

function buildOrganicRevealPath(centerX: number, centerY: number, timestamp: number, velocityX: number, velocityY: number, shapeScale: number) {
  const speed = clamp(Math.hypot(velocityX, velocityY), 0, 8);
  const baseRadiusX = (24 + speed * 0.62) * shapeScale;
  const baseRadiusY = (33 + speed * 0.28) * shapeScale;
  const tilt = clamp(velocityX * 0.018, -0.22, 0.22) + Math.sin(timestamp * 0.0011) * 0.04;
  const cosineTilt = Math.cos(tilt);
  const sineTilt = Math.sin(tilt);

  const points = FACEPLATE_POINTS.map((point, pointIndex) => {
    const wobble = 1 + Math.sin(timestamp * 0.0026 + pointIndex * 1.38) * 0.055 + Math.cos(timestamp * 0.0017 - pointIndex * 1.9) * 0.032;
    const sidePush = Math.sin(timestamp * 0.0019 + pointIndex * 2.1) * (point.x > 0 ? 0.82 : 0.56);
    const localX = point.x * baseRadiusX * wobble + sidePush;
    const localY = point.y * baseRadiusY * (1 + Math.cos(timestamp * 0.0014 + pointIndex * 1.2) * 0.035);

    return {
      coordinateX: clamp(centerX + localX * cosineTilt - localY * sineTilt, -12, VIEWBOX_WIDTH + 12),
      coordinateY: clamp(centerY + localX * sineTilt + localY * cosineTilt, -12, VIEWBOX_HEIGHT + 12),
    };
  });

  return pointsToSmoothPath(points);
}

export function MascotReveal({
  frontSrc = '/vys-maskot-no-logo.png',
  backSrc = '/lvl5-poza1.png',
  priority = false,
  sizes,
  className,
  frontImageClassName,
  defaultActive = false,
  initialRevealX = '58%',
  initialRevealY = '35%',
  shapeScale = 1,
}: Props) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const clipPathId = `mascotRevealClip${safeId}`;
  const glowFilterId = `mascotRevealGlow${safeId}`;
  const strokeGradientId = `mascotRevealStroke${safeId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const clipPathRef = useRef<SVGPathElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);
  const edgePathRef = useRef<SVGPathElement>(null);
  const rafRef = useRef<number | null>(null);
  const defaultCenterRef = useRef({
    coordinateX: resolvePosition(initialRevealX, VIEWBOX_WIDTH, 58),
    coordinateY: resolvePosition(initialRevealY, VIEWBOX_HEIGHT, 52),
  });
  const motionStateRef = useRef({
    coordinateX: defaultCenterRef.current.coordinateX,
    coordinateY: defaultCenterRef.current.coordinateY,
    targetX: defaultCenterRef.current.coordinateX,
    targetY: defaultCenterRef.current.coordinateY,
    velocityX: 0,
    velocityY: 0,
    speedScale: IDLE_REVEAL_SCALE,
    targetScale: IDLE_REVEAL_SCALE,
    lastPointerX: defaultCenterRef.current.coordinateX,
    lastPointerY: defaultCenterRef.current.coordinateY,
    lastPointerTime: 0,
  });
  const activeRef = useRef(defaultActive);
  const [active, setActive] = useState(defaultActive);

  useEffect(() => {
    const updateRevealPath = (timestamp: number) => {
      const motionState = motionStateRef.current;
      const deltaX = motionState.targetX - motionState.coordinateX;
      const deltaY = motionState.targetY - motionState.coordinateY;

      motionState.velocityX = motionState.velocityX * 0.72 + deltaX * 0.11;
      motionState.velocityY = motionState.velocityY * 0.72 + deltaY * 0.11;
      motionState.coordinateX += motionState.velocityX;
      motionState.coordinateY += motionState.velocityY;
      motionState.speedScale += (motionState.targetScale - motionState.speedScale) * 0.14;
      motionState.targetScale += (IDLE_REVEAL_SCALE - motionState.targetScale) * 0.055;

      const revealPath = buildOrganicRevealPath(
        motionState.coordinateX,
        motionState.coordinateY,
        timestamp,
        motionState.velocityX,
        motionState.velocityY,
        shapeScale * motionState.speedScale,
      );

      clipPathRef.current?.setAttribute('d', revealPath);
      glowPathRef.current?.setAttribute('d', revealPath);
      edgePathRef.current?.setAttribute('d', revealPath);

      rafRef.current = requestAnimationFrame(updateRevealPath);
    };

    rafRef.current = requestAnimationFrame(updateRevealPath);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shapeScale]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coordinateX = clamp(((e.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH, 10, VIEWBOX_WIDTH - 10);
    const coordinateY = clamp(((e.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT, 15, VIEWBOX_HEIGHT - 14);
    const motionState = motionStateRef.current;
    const eventTime = e.timeStamp || performance.now();

    if (!activeRef.current) {
      activeRef.current = true;
      setActive(true);
      motionState.coordinateX = coordinateX;
      motionState.coordinateY = coordinateY;
      motionState.velocityX = 0;
      motionState.velocityY = 0;
      motionState.speedScale = IDLE_REVEAL_SCALE;
      motionState.targetScale = IDLE_REVEAL_SCALE;
      motionState.lastPointerX = coordinateX;
      motionState.lastPointerY = coordinateY;
      motionState.lastPointerTime = eventTime;
    }

    const elapsed = Math.max((eventTime - motionState.lastPointerTime) / 1000, 0.016);
    const pointerSpeed = Math.hypot(coordinateX - motionState.lastPointerX, coordinateY - motionState.lastPointerY) / elapsed;
    const effectiveSpeed = Math.max(pointerSpeed - SPEED_DEAD_ZONE, 0);
    motionState.targetScale = clamp(IDLE_REVEAL_SCALE + effectiveSpeed * SPEED_SCALE_FACTOR, MIN_REVEAL_SCALE, MAX_REVEAL_SCALE);
    motionState.lastPointerX = coordinateX;
    motionState.lastPointerY = coordinateY;
    motionState.lastPointerTime = eventTime;

    motionState.targetX = coordinateX;
    motionState.targetY = coordinateY;
  }, []);

  const handlePointerLeave = useCallback(() => {
    const motionState = motionStateRef.current;
    motionState.targetX = motionState.coordinateX;
    motionState.targetY = motionState.coordinateY;
    motionState.velocityX = 0;
    motionState.velocityY = 0;
    motionState.targetScale = motionState.speedScale;

    if (!defaultActive) {
      activeRef.current = false;
      setActive(false);
    }
  }, [defaultActive]);

  return (
    <div
      ref={containerRef}
      className={cn('relative aspect-[2/3] w-full select-none', active ? 'cursor-none' : 'cursor-pointer', className)}
      onPointerEnter={handlePointerMove}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Image
        src={frontSrc}
        alt="Team VYS maskot"
        fill
        priority={priority}
        sizes={sizes}
        draggable={false}
        className={cn('pointer-events-none object-contain', frontImageClassName)}
      />

      <svg
        aria-hidden
        className="absolute inset-0 z-10 overflow-visible transition-opacity duration-300 ease-out"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        style={{ opacity: active ? 1 : 0 }}
      >
        <defs>
          <clipPath id={clipPathId} clipPathUnits="userSpaceOnUse">
            <path ref={clipPathRef} />
          </clipPath>
          <filter id={glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.72 0 1 0 0 0.12 0 0 1 0 1 0 0 0 0.66 0"
            />
          </filter>
          <linearGradient id={strokeGradientId} x1="20" y1="20" x2="86" y2="126" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.74" />
            <stop offset="0.46" stopColor="#F12BB3" stopOpacity="0.7" />
            <stop offset="1" stopColor="#FFB21A" stopOpacity="0.62" />
          </linearGradient>
        </defs>

        <image
          href={backSrc}
          width={VIEWBOX_WIDTH}
          height={VIEWBOX_HEIGHT}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipPathId})`}
        />
        <g clipPath={`url(#${clipPathId})`} opacity="0.28">
          <path className="mascot-reveal-scan" d="M -16 23 L 118 76 M -18 43 L 116 96 M -20 64 L 112 118 M -12 87 L 106 137" stroke="white" strokeWidth="0.45" strokeLinecap="round" />
        </g>
        <path ref={glowPathRef} fill="none" stroke="#F12BB3" strokeWidth="3" opacity="0.4" filter={`url(#${glowFilterId})`} />
        <path ref={edgePathRef} className="mascot-reveal-edge" fill="rgba(255,255,255,0.04)" stroke={`url(#${strokeGradientId})`} strokeWidth="0.55" strokeDasharray="7 5" />
      </svg>
    </div>
  );
}
