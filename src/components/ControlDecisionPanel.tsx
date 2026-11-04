'use client';

import React from 'react';
import { AIControlDecision } from '@/types/greenhouse';
import { Cpu, ShieldCheck, Sprout, Sun, Droplets, ArrowRight } from 'lucide-react';

interface ControlDecisionPanelProps {
  decision: AIControlDecision;
}

export const ControlDecisionPanel: React.FC<ControlDecisionPanelProps> = ({ decision }) => {
  const isIrrigationNeeded = decision.soil.decision.includes('RECOMMENDED');
  const isPDLCTintNeeded = decision.pdlc.target_opacity > 0;

  return (
    <section aria-labelledby="control-decisions-heading" className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-4 ring-teal-50/50">
            <Cpu className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <h2 id="control-decisions-heading" className="text-base font-bold text-slate-900">
              Automated Reasoning & Setpoints
            </h2>
            <p className="text-xs text-slate-500">
              Autonomous microclimate rules evaluating 120-minute forward trajectories
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>AUTONOMOUS ACTIVE</span>
        </div>
      </div>

      {/* Two Decision Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        
        {/* 1. IRRIGATION DECISION */}
        <div className={`relative overflow-hidden rounded-xl border p-4.5 flex flex-col justify-between transition-all ${
          isIrrigationNeeded
            ? 'border-cyan-200 bg-gradient-to-br from-cyan-50/60 via-white to-blue-50/30 shadow-2xs'
            : 'border-slate-200 bg-gradient-to-br from-slate-50/60 via-white to-slate-50/20'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                <div className={`p-1.5 rounded-lg ${isIrrigationNeeded ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                  <Droplets className="h-4 w-4" />
                </div>
                <span>Precision Irrigation</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                isIrrigationNeeded
                  ? 'bg-cyan-600 text-white shadow-2xs'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {isIrrigationNeeded ? 'Irrigation Recommended' : 'Moisture Adequate'}
              </span>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-700">
              {decision.soil.reason}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>Forecast +120m:</span>
              <strong className={`font-mono ${isIrrigationNeeded ? 'text-rose-600' : 'text-emerald-700'}`}>
                {decision.soil.predicted_120m.toFixed(1)}%
              </strong>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Target: {decision.soil.desired_min}% – {decision.soil.desired_max}%
            </span>
          </div>
        </div>

        {/* 2. PDLC GLAZING DECISION */}
        <div className={`relative overflow-hidden rounded-xl border p-4.5 flex flex-col justify-between transition-all ${
          isPDLCTintNeeded
            ? 'border-amber-200 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/30 shadow-2xs'
            : 'border-slate-200 bg-gradient-to-br from-slate-50/60 via-white to-slate-50/20'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                <div className={`p-1.5 rounded-lg ${isPDLCTintNeeded ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  <Sun className="h-4 w-4" />
                </div>
                <span>PDLC Smart Glass</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                isPDLCTintNeeded
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {decision.pdlc.target_opacity}% Opacity
              </span>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-700">
              {decision.pdlc.reason}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>Ambient Solar:</span>
              <strong className="font-mono text-slate-900">{decision.pdlc.current_light_percent.toFixed(0)}%</strong>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Projected Temp: {decision.pdlc.predicted_temp_120m.toFixed(1)}°C
            </span>
          </div>
        </div>

      </div>
    </section>
  );
};
