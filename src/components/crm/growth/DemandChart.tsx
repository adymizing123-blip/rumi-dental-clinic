"use client";

import { useRef, useState } from "react";

export type DemandPoint = { label: string; enquiries: number; booked: number };

const W = 800;
const H = 250;
const PAD = { l: 34, r: 14, t: 14, b: 30 };
// Validated pair (scripts/validate_palette.js): teal = enquiries (solid + area), indigo = appointments (dashed).
const TEAL = "#2558c9";
const INDIGO = "#f2735b";

function niceMax(v: number) {
  if (v <= 5) return 5;
  const step = v <= 20 ? 5 : v <= 50 ? 10 : v <= 200 ? 25 : 100;
  return Math.ceil(v / step) * step;
}

export function DemandChart({ data }: { data: DemandPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => Math.max(d.enquiries, d.booked))));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;

  const line = (key: "enquiries" | "booked") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const area = `${line("enquiries")} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, Math.round((data.length - 1) / 3), Math.round(((data.length - 1) * 2) / 3), data.length - 1];
  const last = data.length - 1;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || data.length === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Enquiries and appointments booked per day over the last ${data.length} days`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="demand-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity="0.22" />
            <stop offset="100%" stopColor={TEAL} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray={v === 0 ? undefined : "4 4"} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
              {v}
            </text>
          </g>
        ))}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize="11" fill="#94a3b8">
            {data[i]?.label}
          </text>
        ))}

        <path d={area} fill="url(#demand-fill)" />
        <path d={line("enquiries")} fill="none" stroke={TEAL} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line("booked")} fill="none" stroke={INDIGO} strokeWidth="2" strokeDasharray="6 5" strokeLinejoin="round" strokeLinecap="round" />
        {last >= 0 && <circle cx={x(last)} cy={y(data[last]!.enquiries)} r="4.5" fill={TEAL} stroke="#fff" strokeWidth="2" />}

        {h && hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={y(0)} stroke="#94a3b8" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.enquiries)} r="5" fill={TEAL} stroke="#fff" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(h.booked)} r="5" fill={INDIGO} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-44 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-soft backdrop-blur"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 88px), calc(100% - 176px))` }}
        >
          <p className="font-semibold text-ink">{h.label}</p>
          <p className="mt-1 flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded" style={{ background: TEAL }} /> Enquiries
            </span>
            <b className="text-ink">{h.enquiries}</b>
          </p>
          <p className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded border-t-2 border-dashed" style={{ borderColor: INDIGO }} /> Appointments
            </span>
            <b className="text-ink">{h.booked}</b>
          </p>
        </div>
      )}

      <div className="mt-2 flex gap-4 px-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TEAL }} /> Enquiries per day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: INDIGO }} /> Appointments booked
        </span>
      </div>

      <table className="sr-only">
        <caption>Enquiries and appointments per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Enquiries</th>
            <th>Appointments booked</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{d.enquiries}</td>
              <td>{d.booked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
