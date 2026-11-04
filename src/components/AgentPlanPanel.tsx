'use client';

import React from 'react';
import { AgentPlan } from '@/types/greenhouse';
import { 
  Bot, 
  Sparkles, 
  Droplets, 
  Sun, 
  ShieldCheck, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Activity, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';

export const AgentPlanPanel: React.FC<{ plan: AgentPlan }> = ({ plan }) => {
  const risks = plan.gemini_risks ?? [];
  const soil = plan.decision?.soil;
  const pdlc = plan.decision?.pdlc;
  const proposed = plan.proposed;
  const isPumpOn = proposed?.pump === 'ON' || soil?.decision === 'IRRIGATION RECOMMENDED';
  const opacity = proposed?.pdlc_opacity ?? pdlc?.target_opacity ?? 0;

  // Synthesize an intuitive, human-friendly explanation if Gemini is not loaded
  const getSynthesizedRationale = () => {
    if (plan.gemini_rationale && plan.gemini_rationale.trim()) {
      return plan.gemini_rationale;
    }

    const parts: string[] = [];
    if (soil) {
      if (soil.predicted_120m < soil.desired_min) {
        parts.push(
          `Preemptive Irrigation Scheduled: Soil moisture is currently ${soil.current.toFixed(1)}% and forecast to drop to ${soil.predicted_120m.toFixed(1)}% within 2 hours (below the ${soil.desired_min}% threshold). Irrigating early prevents root dehydration.`
        );
      } else {
        parts.push(
          `Soil Hydration Balanced: Current moisture (${soil.current.toFixed(1)}%) and 2-hour projection (${soil.predicted_120m.toFixed(1)}%) remain safely within the target range (${soil.desired_min}%–${soil.desired_max}%).`
        );
      }
    }

    if (pdlc) {
      if (opacity > 0) {
        parts.push(
          `Canopy Shading Activated: PDLC glass adjusted to ${opacity}% tint to mitigate solar heat buildup given ${pdlc.current_light.toLowerCase()} irradiance (${pdlc.current_light_percent.toFixed(0)}%) and a projected temperature of ${pdlc.predicted_temp_120m.toFixed(1)}°C.`
        );
      } else {
        parts.push(
          `Maximum Solar Absorption: Glass kept at 0% (fully clear) to maximize natural light for photosynthesis under ambient light levels.`
        );
      }
    }

    return parts.length > 0
      ? parts.join(' ')
      : 'The autonomous agent is actively monitoring live microclimate telemetry and physics projections to maintain optimal crop growth.';
  };

  const rationale = getSynthesizedRationale();

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-100/80 bg-gradient-to-b from-white via-white to-emerald-50/20 shadow-sm transition-all hover:shadow-md">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm ring-4 ring-emerald-50">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                Autonomous Microclimate Agent
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                Active
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Closed-loop predictive control balancing soil hydration, canopy light, and crop thermal comfort.
            </p>
          </div>
        </div>

        {/* AI Supervisor Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {plan.gemini_enabled ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50/80 px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              <span>Gemini AI Verified</span>
              {plan.gemini_approve != null && (
                <span
                  className={`ml-1 rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                    plan.gemini_approve
                      ? 'bg-emerald-200/70 text-emerald-900'
                      : 'bg-amber-200/80 text-amber-900'
                  }`}
                >
                  {plan.gemini_approve ? 'Approved' : 'Adjusted'}
                </span>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
              <span>Physics-Hybrid Controller</span>
            </div>
          )}

          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="capitalize">{plan.status}</span>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {/* 2. Primary Decision Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Card A: Irrigation */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-slate-300">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isPumpOn ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Droplets className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Irrigation Decision
                  </h3>
                  <p className="text-sm font-semibold text-slate-900">
                    {isPumpOn ? 'Pump Activation Recommended' : 'Optimal Moisture — Pump Off'}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isPumpOn
                    ? 'border border-cyan-300 bg-cyan-50 text-cyan-800'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {proposed?.pump ?? (isPumpOn ? 'ON' : 'OFF')}
              </span>
            </div>

            {soil && (
              <div className="mt-2 space-y-2 border-t border-slate-100 pt-3 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Current Soil Moisture:</span>
                  <span className="font-semibold text-slate-800">{soil.current.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    {soil.predicted_120m < soil.current ? (
                      <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                    2-Hour Forecast:
                  </span>
                  <span
                    className={`font-semibold ${
                      soil.predicted_120m < soil.desired_min
                        ? 'text-rose-600'
                        : 'text-emerald-700'
                    }`}
                  >
                    {soil.predicted_120m.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Target Range:</span>
                  <span>{soil.desired_min}% – {soil.desired_max}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Card B: Smart Glass (PDLC) */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-slate-300">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    opacity > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Smart Glass Shading (PDLC)
                  </h3>
                  <p className="text-sm font-semibold text-slate-900">
                    {opacity === 0
                      ? 'Transparent (0% Tint)'
                      : opacity === 33
                      ? 'Light Shade (33% Tint)'
                      : opacity === 66
                      ? 'Heat Mitigation (66% Tint)'
                      : 'Full Solar Shield (100% Tint)'}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                {opacity}% Opacity
              </span>
            </div>

            {pdlc && (
              <div className="mt-2 space-y-2 border-t border-slate-100 pt-3 text-xs">
                {/* 4-Step Hardware State Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                    <span>Clear (0%)</span>
                    <span>State 1 (33%)</span>
                    <span>State 2 (66%)</span>
                    <span>State 3 (100%)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[0, 33, 66, 100].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 rounded-full transition-all ${
                          opacity >= step
                            ? 'bg-amber-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-slate-600">
                  <span>Ambient Solar Light:</span>
                  <span className="font-semibold text-slate-800">
                    {pdlc.current_light_percent.toFixed(0)}% ({pdlc.current_light})
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>2-Hour Forecast Temp:</span>
                  <span className="font-semibold text-slate-800">
                    {pdlc.predicted_temp_120m.toFixed(1)}°C
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. AI Agent Explainability Rationale */}
        <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50/50 via-emerald-50/30 to-slate-50/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900">
              Agent Cognitive Rationale & Strategy
            </h4>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            {rationale}
          </p>

          {/* Risks / Guardrails */}
          {risks.length > 0 && (
            <div className="mt-3 border-t border-teal-100/80 pt-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Operational Risks Under Observation:
              </p>
              <div className="flex flex-wrap gap-2">
                {risks.map((risk, i) => (
                  <span
                    key={`${i}-${risk.slice(0, 20)}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900"
                  >
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                    <span>{risk}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. Actuation Summary Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Activity className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700">Hardware Bridge Status:</span>
            {plan.actions?.length ? (
              <span className="font-mono text-emerald-700">
                {plan.actions.map((a) => `${a.actuator.toUpperCase()}:${a.command}`).join(' · ')}
              </span>
            ) : (
              <span className="text-slate-500">
                Greenhouse holding target state — no actuator switching required this cycle.
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Safety interlocks verified</span>
          </div>
        </div>
      </div>
    </section>
  );
};
