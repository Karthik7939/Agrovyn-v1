'use client';

import React from 'react';
import { PredictionData, SensorReading } from '@/types/greenhouse';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus,
  Sparkles, 
  SunMedium, 
  Cpu, 
  CheckCircle2,
  Clock
} from 'lucide-react';

interface PredictionPanelProps {
  currentReading: SensorReading;
  prediction: PredictionData;
}

type RowSpec = {
  label: string;
  unit: string;
  color: string;
  badgeBg: string;
  now: number;
  h30: number | undefined;
  h60: number | undefined;
  h120: number | undefined;
  invertBad?: boolean;
};

export const PredictionPanel: React.FC<PredictionPanelProps> = ({
  currentReading,
  prediction,
}) => {
  const rows: RowSpec[] = [
    {
      label: 'Temperature',
      unit: '°C',
      color: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      now: currentReading.temperature,
      h30: prediction.horizon_30m.temperature,
      h60: prediction.horizon_60m.temperature,
      h120: prediction.horizon_120m.temperature,
    },
    {
      label: 'Humidity',
      unit: '%',
      color: 'text-cyan-700',
      badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      now: currentReading.humidity,
      h30: prediction.horizon_30m.humidity,
      h60: prediction.horizon_60m.humidity,
      h120: prediction.horizon_120m.humidity,
    },
    {
      label: 'Soil Moisture',
      unit: '%',
      color: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      now: currentReading.soil_moisture_percent,
      h30: prediction.horizon_30m.soil_moisture,
      h60: prediction.horizon_60m.soil_moisture,
      h120: prediction.horizon_120m.soil_moisture,
      invertBad: true,
    },
    {
      label: 'Solar Light',
      unit: '%',
      color: 'text-violet-700',
      badgeBg: 'bg-violet-50 text-violet-800 border-violet-200',
      now: currentReading.ldr_percent,
      h30: prediction.horizon_30m.light,
      h60: prediction.horizon_60m.light,
      h120: prediction.horizon_120m.light,
    },
  ];

  const hour = prediction.diagnostics?.hour;
  const engine = prediction.engine || prediction.model_version;
  const confidence = prediction.confidence ? Math.round(prediction.confidence * 100) : 85;

  return (
    <section aria-labelledby="forecast-heading" className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-4 ring-violet-50/50">
            <TrendingUp className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="forecast-heading" className="text-base font-bold text-slate-900">
                Physics-Hybrid Predictive Matrix
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-violet-100/70 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                <Sparkles className="h-3 w-3 text-violet-600" />
                Multi-Horizon
              </span>
            </div>
            <p className="text-xs text-slate-500">
              First-principles energy balance & evapotranspiration simulation
              {hour !== undefined ? ` · Solar Hour ${hour.toFixed(1)}` : ''}
            </p>
          </div>
        </div>

        {/* Model Confidence Tag */}
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>{confidence}% Confidence</span>
        </div>
      </div>

      {/* Futuristic Trajectory Matrix Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-3">Parameter</th>
              <th className="py-2.5 px-3 text-center bg-slate-100/80 text-slate-900 font-extrabold border-x border-slate-200">
                Live (Now)
              </th>
              <th className="py-2.5 px-3 text-center text-slate-600 font-semibold">+30 Min</th>
              <th className="py-2.5 px-3 text-center text-slate-600 font-semibold">+60 Min</th>
              <th className="py-2.5 px-3 text-center text-amber-900 font-bold bg-amber-50/60 border-x border-amber-200/70">
                +120 Min (Target)
              </th>
              <th className="py-2.5 px-3 text-right">Net Shift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const delta = (row.h120 ?? row.now) - row.now;
              const isUp = delta > 0.05;
              const isDown = delta < -0.05;

              return (
                <tr key={row.label} className="transition-colors hover:bg-slate-50/70">
                  {/* Parameter Label */}
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${row.color.replace('text-', 'bg-')}`} />
                      {row.label}
                      <span className="text-[10px] text-slate-400">({row.unit})</span>
                    </span>
                  </td>

                  {/* Now Column */}
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 bg-slate-50/60 border-x border-slate-200">
                    {row.now.toFixed(1)} {row.unit}
                  </td>

                  {/* +30m */}
                  <td className="py-3 px-3 text-center font-mono text-slate-700">
                    {row.h30 !== undefined ? row.h30.toFixed(1) : '—'} {row.unit}
                  </td>

                  {/* +60m */}
                  <td className="py-3 px-3 text-center font-mono text-slate-700">
                    {row.h60 !== undefined ? row.h60.toFixed(1) : '—'} {row.unit}
                  </td>

                  {/* +120m Key Decision Driver */}
                  <td className="py-3 px-3 text-center font-mono font-bold text-amber-950 bg-amber-50/50 border-x border-amber-200/60">
                    {row.h120 !== undefined ? row.h120.toFixed(1) : '—'} {row.unit}
                  </td>

                  {/* Delta Badge */}
                  <td className="py-3 px-3 text-right font-mono">
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
                        isUp
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : isDown
                          ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {isUp ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : isDown ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(1)} {row.unit}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Diagnostic Tag */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span>Rollout Step: 5-min Euler Integration</span>
        </span>
        <span className="flex items-center gap-1.5 font-mono">
          <Cpu className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-slate-600 font-semibold">{engine}</span>
        </span>
      </div>
    </section>
  );
};
