"use client";

import { memo, useMemo } from "react";

import { faceCells, parseItemOptions, sheetGrid, sheetsPerCopy, type ItemOptions } from "@/features/printing/print-options";
import { useI18n } from "@/i18n/provider";

const SHORT = 106;
const LONG = 150;
const PAPER = "#FFFFFF";
const EDGE = "#CBD5E1";
const CELL = "#1F4FD8";
const BACK_CELL = "#B4194F";

function Face({ cells, columns, rows, landscape, x, y, tint, label }: { cells: (number | null)[]; columns: number; rows: number; landscape: boolean; x: number; y: number; tint: string; label: string }) {
  const w = landscape ? LONG : SHORT;
  const h = landscape ? SHORT : LONG;
  const margin = columns * rows === 1 ? 0 : 5;
  const gap = 2.5;
  const cellW = (w - margin * 2 - (columns - 1) * gap) / columns;
  const cellH = (h - margin * 2 - (rows - 1) * gap) / rows;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={PAPER} stroke={EDGE} strokeWidth={1} />
      {cells.map((page, index) => {
        const cx = x + margin + (index % columns) * (cellW + gap);
        const cy = y + margin + Math.floor(index / columns) * (cellH + gap);
        return (
          <g key={index}>
            <rect x={cx} y={cy} width={cellW} height={cellH} rx={1.5} fill={page === null ? "none" : tint} fillOpacity={page === null ? 1 : 0.14} stroke={page === null ? "#E2E8F0" : tint} strokeDasharray={page === null ? "2 2" : undefined} strokeWidth={0.7} />
            {page !== null ? <text x={cx + cellW / 2} y={cy + cellH / 2 + Math.min(cellH * 0.18, 7)} textAnchor="middle" fontSize={Math.max(7, Math.min(cellH * 0.5, cellW * 0.5, 22))} fontWeight={700} fill="#0F172A">{page}</text> : null}
          </g>
        );
      })}
      <text x={x + w / 2} y={y + h + 12} textAnchor="middle" fontSize={9} fill="#64748B">{label}</text>
    </g>
  );
}

export interface SimulationItem {
  pages: number | null;
  copies: number;
  sides: string;
  options: ItemOptions;
}

/** Both faces of the first sheet with the grid of pages and the edge the sheet turns on: what the printer will produce. */
function SheetSimulationComponent({ item }: { item: SimulationItem }) {
  const { t } = useI18n();
  const { options } = item;
  const double = item.sides === "double_sided";
  const grid = useMemo(() => sheetGrid(options.pagesPerSheet, options.orientation), [options.pagesPerSheet, options.orientation]);
  const total = item.pages ?? 12;
  const selected = options.selectedPages ?? total;
  const pages = useMemo(() => Array.from({ length: Math.min(selected, 64) }, (_, index) => index + 1), [selected]);
  const frontCells = faceCells(pages.slice(0, options.pagesPerSheet), grid, options.nUpDirection);
  const backCells = faceCells(pages.slice(options.pagesPerSheet, options.pagesPerSheet * 2), grid, options.nUpDirection);
  const perCopy = sheetsPerCopy(selected, options.pagesPerSheet, double);
  const w = grid.landscape ? LONG : SHORT;
  const h = grid.landscape ? SHORT : LONG;
  const width = double ? w * 2 + 40 : w;
  const startX = (280 - width) / 2;
  const y = (190 - 24 - h) / 2;
  const frontX = double ? startX + w + 40 : startX; // the front sits on the right: Arabic documents are read from the right
  const flipX = startX + w + 20;
  const short = options.duplexFlip === "short_edge";
  const caption = [
    t("printing.sim.perSheet", { count: options.pagesPerSheet }),
    double ? t(short ? "printing.sim.flipShort" : "printing.sim.flipLong") : t("printing.sim.oneSide"),
    t("printing.sim.sheetsTotal", { count: perCopy * item.copies }),
  ].join(" · ");

  return (
    <figure className="space-y-1 rounded-xl bg-muted/50 p-3" aria-label={`${t("printing.sim.title")}: ${caption}`}>
      <figcaption className="text-xs font-bold text-muted-foreground">{t("printing.sim.title")}</figcaption>
      <svg viewBox="0 0 280 190" className="h-auto w-full" role="img" aria-hidden="true">
        {double ? <Face cells={backCells} columns={grid.columns} rows={grid.rows} landscape={grid.landscape} x={startX} y={y} tint={BACK_CELL} label={t("printing.sim.back")} /> : null}
        <Face cells={frontCells} columns={grid.columns} rows={grid.rows} landscape={grid.landscape} x={frontX} y={y} tint={CELL} label={t("printing.sim.front")} />
        {double ? (
          <g stroke="#64748B" fill="none">
            {short ? <line x1={flipX - 12} x2={flipX + 12} y1={y + h / 2} y2={y + h / 2} strokeDasharray="3 3" /> : <line x1={flipX} x2={flipX} y1={y + h / 2 - 22} y2={y + h / 2 + 22} strokeDasharray="3 3" />}
            <path d={short ? `M ${flipX - 9} ${y + h / 2 - 10} Q ${flipX} ${y + h / 2 - 22} ${flipX + 9} ${y + h / 2 - 10}` : `M ${flipX - 8} ${y + h / 2 - 16} Q ${flipX - 18} ${y + h / 2} ${flipX - 8} ${y + h / 2 + 16}`} stroke="#1F4FD8" strokeWidth={1.6} strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
      <p className="text-xs text-muted-foreground">{caption}</p>
      {item.copies > 1 ? <p className="text-xs text-muted-foreground">{t(options.collate ? "printing.sim.collated" : "printing.sim.uncollated", { copies: item.copies, sheets: perCopy })}</p> : null}
    </figure>
  );
}

export const SheetSimulation = memo(SheetSimulationComponent);
export { parseItemOptions };
