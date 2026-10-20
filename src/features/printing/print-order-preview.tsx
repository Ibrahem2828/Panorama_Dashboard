"use client";

import { memo, useMemo } from "react";

import { useI18n } from "@/i18n/provider";
import { buildPreview, countLabel, spiralRingCount, type Binding, type OrderItemView, type PreviewModel } from "@/features/printing/print-order-rules";

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 220;
// Paper stays white in dark mode too: a printed sheet does not change colour with the dashboard theme.
const PAPER = "#FFFFFF";
const PAPER_EDGE = "#CBD5E1";
const TEXT_LINE = "#CBD5E1";
const PICTURE_GRAY = "#D1D5DB";
const GHOST_INK = "#1F2937";
const COIL = "#6B7280";
const STAPLE = "#9CA3AF";
const INK_COLORS = { primary: "#1F4FD8", accent: "#B4194F", warm: "#F5A524" } as const;
const LINE_WIDTHS = [1, 0.92, 0.97, 0.7, 1, 0.88, 0.95, 0.6, 1, 0.9, 0.78, 0.94, 0.55, 1];

function Sheet({ model, x, y, front }: { model: PreviewModel; x: number; y: number; front: boolean }) {
  const { sheetWidth: w, sheetHeight: h, colored, doubleSided, binding } = model;
  const margin = Math.max(6, Math.round(w * 0.1));
  const spine = binding === "thermal" ? 8 : 0;
  const right = x + w - margin - spine;
  const textWidth = w - margin * 2 - spine;
  const imageHeight = Math.round(h * 0.2);
  const imageTop = y + margin + 12 + 3 * 8.5;
  const lineCount = Math.max(5, Math.floor((h - margin * 3) / 9) - 3);

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2.5} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={1} />
      {front ? (
        <>
          {/* Text starts at the right edge, like Arabic text does. */}
          <rect x={right - textWidth * 0.5} y={y + margin} width={textWidth * 0.5} height={4.5} rx={1.5} fill={colored ? INK_COLORS.primary : COIL} />
          {Array.from({ length: lineCount }, (_, index) => {
            const ratio = LINE_WIDTHS[index % LINE_WIDTHS.length] ?? 1;
            const top = y + margin + 12 + index * 8.5 + (index >= 3 ? imageHeight + 6 : 0);
            return <rect key={index} x={right - textWidth * ratio} y={top} width={textWidth * ratio} height={2.6} rx={1.2} fill={TEXT_LINE} />;
          })}
          <rect x={right - textWidth * 0.46} y={imageTop} width={textWidth * 0.46} height={imageHeight} rx={2} fill={colored ? INK_COLORS.primary : PICTURE_GRAY} />
          {colored ? (
            <>
              <rect x={right - textWidth * 0.46} y={imageTop} width={textWidth * 0.18} height={imageHeight} fill={INK_COLORS.accent} />
              <rect x={right - textWidth * 0.3} y={imageTop + imageHeight * 0.55} width={textWidth * 0.14} height={imageHeight * 0.45} rx={1} fill={INK_COLORS.warm} />
            </>
          ) : null}
          {doubleSided && h > 100 ? (
            // The other face showing through the paper, so "two sides" reads at a glance.
            <g opacity={0.16} stroke={GHOST_INK}>
              {Array.from({ length: 3 }, (_, index) => (
                <line key={index} x1={x + margin + 4} x2={x + margin + 4 + textWidth * (0.5 + (index % 3) * 0.15)} y1={y + h - margin - 8 - index * 8} y2={y + h - margin - 8 - index * 8} strokeWidth={2} />
              ))}
            </g>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function BindingMark({ model, x, y }: { model: PreviewModel; x: number; y: number }) {
  const { sheetWidth: w, sheetHeight: h, binding } = model;
  const edge = x + w;
  if (binding === "spiral") {
    const rings = spiralRingCount(h);
    const gap = (h - 12) / rings;
    return (
      <g>
        {Array.from({ length: rings }, (_, index) => {
          const cy = y + 9 + index * gap;
          return (
            <g key={index}>
              <circle cx={edge - 5} cy={cy} r={1.7} fill="#E2E8F0" />
              <ellipse cx={edge - 1} cy={cy} rx={6} ry={2.6} fill="none" stroke={COIL} strokeWidth={1.7} />
            </g>
          );
        })}
      </g>
    );
  }
  if (binding === "thermal") {
    return (
      <g>
        <rect x={edge - 8} y={y} width={8} height={h} rx={1.5} fill={INK_COLORS.primary} />
        <rect x={edge - 6} y={y + 3} width={1.6} height={h - 6} fill="#FFFFFF" opacity={0.22} />
      </g>
    );
  }
  if (binding === "beads") {
    // A string of beads threaded along the edge.
    const count = Math.max(5, Math.floor((h - 10) / 11));
    const gap = (h - 10) / count;
    return (
      <g>
        <line x1={edge - 3} x2={edge - 3} y1={y + 4} y2={y + h - 4} stroke={COIL} strokeWidth={0.8} />
        {Array.from({ length: count }, (_, index) => (
          <g key={index}>
            <circle cx={edge - 3} cy={y + 7 + index * gap} r={3.2} fill={index % 2 ? INK_COLORS.accent : INK_COLORS.primary} />
            <circle cx={edge - 4.1} cy={y + 5.9 + index * gap} r={0.9} fill="#FFFFFF" opacity={0.7} />
          </g>
        ))}
      </g>
    );
  }
  if (binding === "staple") {
    const sx = edge - 22;
    const sy = y + 10;
    return (
      <g transform={`rotate(-38 ${sx + 8} ${sy})`}>
        <line x1={sx + 0.6} x2={sx + 16.6} y1={sy + 1.4} y2={sy + 1.4} stroke="#000" strokeOpacity={0.18} strokeWidth={3.6} strokeLinecap="round" />
        <line x1={sx} x2={sx + 16} y1={sy} y2={sy} stroke={STAPLE} strokeWidth={3.2} strokeLinecap="round" />
        <line x1={sx + 1.5} x2={sx + 14.5} y1={sy - 0.8} y2={sy - 0.8} stroke="#FFF" strokeOpacity={0.75} strokeWidth={0.9} strokeLinecap="round" />
      </g>
    );
  }
  return null;
}

type PreviewItem = Pick<OrderItemView, "paperSize" | "colorMode" | "sides" | "binding" | "copies">;

function PrintOrderPreviewComponent({ item, pages, className }: { item: PreviewItem; pages?: number | null; className?: string }) {
  const { t, enumLabel, locale } = useI18n();
  const model = useMemo(() => buildPreview(item), [item.paperSize, item.colorMode, item.sides, item.binding, item.copies]); // eslint-disable-line react-hooks/exhaustive-deps
  const frontX = (CANVAS_WIDTH - model.sheetWidth) / 2 + model.stackDepth * 2;
  const frontY = (CANVAS_HEIGHT - model.sheetHeight) / 2 - model.stackDepth * 2;
  const back = Array.from({ length: model.stackDepth }, (_, index) => model.stackDepth - index);
  const caption = [
    item.copies > 1 ? countLabel(locale, item.copies, "copies") : null,
    pages ? countLabel(locale, pages, "pages") : null,
    item.paperSize,
    enumLabel(item.colorMode),
    enumLabel(item.sides),
    enumLabel(item.binding),
  ].filter(Boolean).join(" · ");

  return (
    <figure className={`relative m-0 rounded-2xl bg-primary/5 p-3 ${className ?? ""}`} aria-label={`${t("printing.previewTitle")}: ${caption}`}>
      <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} className="mx-auto h-auto w-full max-w-[260px]" role="img" aria-hidden="true" focusable="false">
        <ellipse cx={CANVAS_WIDTH / 2} cy={CANVAS_HEIGHT - 8} rx={model.sheetWidth * 0.62} ry={5} fill="#000000" opacity={0.14} />
        {back.map((depth) => {
          const x = frontX - depth * 4;
          const y = frontY + depth * 4;
          // Loose sheets are not squared up: every copy sits at a slightly different angle.
          const tilt = model.binding === "none" ? (depth % 2 === 0 ? 1.6 : -1.3) : 0;
          return (
            <g key={depth} transform={`rotate(${tilt} ${x + model.sheetWidth / 2} ${y + model.sheetHeight / 2})`}>
              <Sheet model={model} x={x} y={y} front={false} />
              <BindingMark model={model} x={x} y={y} />
            </g>
          );
        })}
        <Sheet model={model} x={frontX} y={frontY} front />
        <BindingMark model={model} x={frontX} y={frontY} />
      </svg>
      {item.copies > 1 ? <span className="absolute start-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground" dir="ltr">×{item.copies}</span> : null}
      <figcaption className="mt-2 space-y-1 text-xs">
        <p className="font-semibold text-foreground/80">{caption}</p>
        <p className="leading-5 text-muted-foreground">{t(`printing.bindingHint.${item.binding}` as const)}</p>
      </figcaption>
    </figure>
  );
}

export const PrintOrderPreview = memo(PrintOrderPreviewComponent);
export type { Binding };
