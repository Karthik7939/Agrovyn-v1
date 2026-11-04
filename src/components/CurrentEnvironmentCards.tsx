'use client';

import React from 'react';
import { 
  Thermometer, 
  Droplets, 
  Sprout, 
  Sun, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus,
  Activity
} from 'lucide-react';
import { SensorReading } from '@/types/greenhouse';

interface CurrentEnvironmentCardsProps {
  reading: SensorReading;
  previousReading?: SensorReading;
}

export const CurrentEnvironmentCards: React.FC<CurrentEnvironmentCardsProps> = ({
  reading,
  previousReading,
}) => {
  // Helper to determine status and range percentage for the visual gauge
  const getStatus = (val: number, min: number, max: number, invertLowBad = false) => {
    const range = max - min;
    const clampedPct = Math.min(Math.max(((val - min) / range) * 100, 0), 100);
    
    if (val < min) {
      return {
        statusText: invertLowBad ? 'Critical Low' : 'Below Range',
        statusColor: 'text-amber-700 bg-amber-50 border-amber-200',
        gaugeColor: 'bg-amber-500',
        pct: clampedPct,
        inRange: false,
      };
    }
    if (val > max) {
      return {
        statusText: 'Elevated',
        statusColor: 'text-rose-700 bg-rose-50 border-rose-200',
        gaugeColor: 'bg-rose-500',
        pct: clampedPct,
        inRange: false,
      };
    }
    return {
      statusText: 'Optimal',
      statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      gaugeColor: 'bg-emerald-500',
      pct: clampedPct,
      inRange: true,
    };
  };

  const metrics = [
    {
      label: 'Air Temperature',
      targetLabel: '22°C – 32°C',
      value: reading.temperature.toFixed(1),
      unit: '°C',
      min: 22,
      max: 32,
      delta: previousReading ? reading.temperature - previousReading.temperature : null,
      icon: Thermometer,
      theme: {
        gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
        border: 'hover:border-orange-300',
        accentBg: 'bg-orange-50 text-orange-600 ring-orange-100',
        barColor: 'from-amber-400 to-orange-500',
      },
      ...getStatus(reading.temperature, 22, 32),
    },
    {
      label: 'Relative Humidity',
      targetLabel: '50% – 80%',
      value: reading.humidity.toFixed(1),
      unit: '%',
      min: 50,
      max: 80,
      delta: previousReading ? reading.humidity - previousReading.humidity : null,
      icon: Droplets,
      theme: {
        gradient: 'from-cyan-500/10 via-blue-500/5 to-transparent',
        border: 'hover:border-cyan-300',
        accentBg: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
        barColor: 'from-cyan-400 to-blue-500',
      },
      ...getStatus(reading.humidity, 50, 80),
    },
    {
      label: 'Soil Moisture',
      targetLabel: '38% – 68%',
      value: reading.soil_moisture_percent.toFixed(1),
      unit: '%',
      min: 38,
      max: 68,
      delta: previousReading ? reading.soil_moisture_percent - previousReading.soil_moisture_percent : null,
      icon: Sprout,
      theme: {
        gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
        border: 'hover:border-emerald-300',
        accentBg: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        barColor: 'from-emerald-400 to-teal-600',
      },
      ...getStatus(reading.soil_moisture_percent, 38, 68, true),
    },
    {
      label: 'Solar Light Flux',
      targetLabel: 'PDLC trigger > 65%',
      value: reading.ldr_percent.toFixed(0),
      unit: '%',
      min: 0,
      max: 100,
      delta: previousReading ? reading.ldr_percent - previousReading.ldr_percent : null,
      icon: Sun,
      theme: {
        gradient: 'from-violet-500/10 via-amber-500/5 to-transparent',
        border: 'hover:border-violet-300',
        accentBg: 'bg-violet-50 text-violet-600 ring-violet-100',
        barColor: 'from-violet-400 to-amber-500',
      },
      ...getStatus(reading.ldr_percent, 20, 65),
    },
  ];

  return (
    <section aria-label="Current greenhouse conditions" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <article 
            key={m.label} 
            className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${m.theme.border}`}
          >
            {/* Subtle futuristic top ambient glow */}
            <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${m.theme.gradient} pointer-events-none`} />

            {/* Header row */}
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-4 ${m.theme.accentBg}`}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {m.label}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400">
                    Target: {m.targetLabel}
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.statusColor}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${m.gaugeColor} ${m.inRange ? 'animate-pulse' : ''}`} />
                {m.statusText}
              </span>
            </div>

            {/* Metric Value & Delta */}
            <div className="relative mt-4 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  {m.value}
                </span>
                <span className="text-sm font-bold text-slate-500">{m.unit}</span>
              </div>

              {m.delta !== null && (
                <span 
                  className={`inline-flex items-center gap-0.5 rounded-lg border px-2 py-1 text-xs font-semibold tabular-nums shadow-2xs ${
                    Math.abs(m.delta) < 0.05
                      ? 'border-slate-200 bg-slate-50 text-slate-500'
                      : m.delta > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-cyan-200 bg-cyan-50 text-cyan-800'
                  }`}
                >
                  {Math.abs(m.delta) < 0.05 ? (
                    <Minus className="h-3 w-3" />
                  ) : m.delta > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(m.delta) < 0.05 ? 'Stable' : `${m.delta > 0 ? '+' : ''}${m.delta.toFixed(1)}${m.unit}`}
                </span>
              )}
            </div>

            {/* High-Tech Target Range Progress Bar */}
            <div className="relative mt-4 space-y-1.5">
              <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                <span>Safe Envelope</span>
                <span className="text-slate-600 font-mono">{m.min}{m.unit} — {m.max}{m.unit}</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200/60">
                <div 
                  className={`h-full rounded-full bg-gradient-to-r ${m.theme.barColor} transition-all duration-700 ease-out`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
};
