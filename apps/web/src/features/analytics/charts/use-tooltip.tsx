'use client';

import { useState } from 'react';

export interface TooltipContent {
  value: string;
  label: string;
}

/**
 * Per-mark tooltip shown on hover and on keyboard focus. Values lead, labels follow.
 * Positioned relative to the chart container (`relative` on the parent).
 */
export function useChartTooltip() {
  const [tip, setTip] = useState<(TooltipContent & { x: number; y: number }) | null>(null);

  const bind = (content: TooltipContent) => ({
    onPointerEnter: (event: React.PointerEvent<HTMLElement | SVGElement>) =>
      show(event.currentTarget, content),
    onPointerLeave: () => setTip(null),
    onFocus: (event: React.FocusEvent<HTMLElement | SVGElement>) =>
      show(event.currentTarget, content),
    onBlur: () => setTip(null),
  });

  const show = (target: Element, content: TooltipContent) => {
    const container = target.closest('[data-chart]');
    if (!container) return;
    const box = container.getBoundingClientRect();
    const mark = target.getBoundingClientRect();
    setTip({ ...content, x: mark.left - box.left + mark.width / 2, y: mark.top - box.top });
  };

  const element = tip ? (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
      style={{ left: tip.x, top: tip.y - 6 }}
    >
      <span className="block text-sm font-semibold text-popover-foreground">{tip.value}</span>
      <span className="text-muted-foreground">{tip.label}</span>
    </div>
  ) : null;

  return { bind, element };
}
