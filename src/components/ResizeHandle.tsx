import React, { useRef } from 'react';

export interface ResizeHandleProps {
  orientation: 'vertical' | 'horizontal';
  label: string;
  value: number;
  min: number;
  max: number;
  onResize: (delta: number) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  orientation,
  label,
  value,
  min,
  max,
  onResize,
}) => {
  const lastCoordinate = useRef<number | null>(null);
  const isVertical = orientation === 'vertical';

  const coordinate = (event: React.PointerEvent<HTMLDivElement>) =>
    isVertical ? event.clientX : event.clientY;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    lastCoordinate.current = coordinate(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (lastCoordinate.current === null) return;
    const current = coordinate(event);
    const delta = current - lastCoordinate.current;
    lastCoordinate.current = current;
    if (delta) onResize(delta);
  };

  const handlePointerEnd = () => {
    lastCoordinate.current = null;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const decrement = isVertical ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
    const increment = isVertical ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
    if (!decrement && !increment) return;
    event.preventDefault();
    onResize(increment ? 16 : -16);
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onKeyDown={handleKeyDown}
      className={isVertical
        ? 'group relative z-10 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-border/50 transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none'
        : 'group relative z-10 flex h-1.5 shrink-0 cursor-row-resize items-center justify-center bg-border/50 transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none'}
    >
      <span className={isVertical ? 'h-8 w-0.5 rounded bg-muted/70 group-hover:bg-accent' : 'h-0.5 w-8 rounded bg-muted/70 group-hover:bg-accent'} />
    </div>
  );
};
