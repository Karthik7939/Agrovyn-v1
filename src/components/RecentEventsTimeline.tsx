'use client';

import React, { useState } from 'react';
import { SystemEvent } from '@/types/greenhouse';
import { 
  History, 
  Bot, 
  User, 
  ShieldAlert, 
  Cpu, 
  Radio, 
  Filter, 
  ArrowRight,
  Sliders
} from 'lucide-react';

interface RecentEventsTimelineProps {
  events: SystemEvent[];
}

export const RecentEventsTimeline: React.FC<RecentEventsTimelineProps> = ({ events }) => {
  const [filter, setFilter] = useState<'all' | 'ai' | 'manual' | 'safety' | 'system'>('all');

  const filteredEvents = events.filter((evt) => {
    if (filter === 'all') return true;
    if (filter === 'ai') return evt.source === 'ai';
    if (filter === 'manual') return evt.source === 'manual';
    if (filter === 'safety') return evt.event_type === 'safety' || evt.severity === 'critical';
    if (filter === 'system') return evt.source === 'system' || evt.event_type === 'system';
    return true;
  });

  const getSourceBadge = (source: SystemEvent['source'], eventType: SystemEvent['event_type']) => {
    if (eventType === 'safety') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800">
          <ShieldAlert className="h-3 w-3 text-rose-600" />
          Safety Guardrail
        </span>
      );
    }

    switch (source) {
      case 'ai':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            <Bot className="h-3 w-3 text-emerald-600" />
            AI Autonomous
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
            <User className="h-3 w-3 text-indigo-600" />
            Manual Override
          </span>
        );
      case 'system':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            <Cpu className="h-3 w-3 text-slate-500" />
            System
          </span>
        );
    }
  };

  const cleanReason = (reason?: string) => {
    if (!reason) return null;
    return reason
      .replace(/^REASON:\s*/i, '')
      .replace(/Manual override — control mode set to MANUAL so the agent will not re-actuate\./i, 'Manual operator override engaged — automated agent yielded control.');
  };

  const cleanResult = (result?: string) => {
    if (!result) return null;
    return result.replace(/^RESULT:\s*/i, '');
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      {/* 1. Header with Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-4 ring-teal-50/50 border border-teal-200">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Live Operations & Actuation Log
            </h2>
            <p className="text-xs text-slate-500">
              Chronological audit trail of autonomous AI actuations, manual overrides, and hardware events.
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              filter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({events.length})
          </button>
          <button
            onClick={() => setFilter('ai')}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              filter === 'ai'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Agent ({events.filter((e) => e.source === 'ai').length})
          </button>
          <button
            onClick={() => setFilter('manual')}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              filter === 'manual'
                ? 'bg-indigo-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manual ({events.filter((e) => e.source === 'manual').length})
          </button>
          <button
            onClick={() => setFilter('safety')}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              filter === 'safety'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Safety ({events.filter((e) => e.event_type === 'safety' || e.severity === 'critical').length})
          </button>
        </div>
      </div>

      {/* 2. Timeline List */}
      <div className="p-5 sm:p-6">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
            <Radio className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium">No events matching this filter category</p>
            <p className="text-xs text-slate-400">Telemetry and hardware events will appear here as they occur.</p>
          </div>
        ) : (
          <div className="relative space-y-4 pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-3 before:w-0.5 before:bg-slate-200">
            {filteredEvents.map((evt) => {
              const time = new Date(evt.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });
              const reason = cleanReason(evt.reason);
              const result = cleanResult(evt.result);

              return (
                <div key={evt.id} className="relative group">
                  {/* Timeline Node Dot */}
                  <div className="absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-300 shadow-2xs group-hover:scale-110 transition-transform">
                    {evt.source === 'ai' ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    ) : evt.source === 'manual' ? (
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    ) : evt.event_type === 'safety' ? (
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                    )}
                  </div>

                  {/* Event Card */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-sm">
                    {/* Top Row: Meta info */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getSourceBadge(evt.source, evt.event_type)}
                        <span className="text-xs font-semibold text-slate-500">{time}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        {evt.event_type}
                      </span>
                    </div>

                    {/* Headline */}
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {evt.message}
                    </p>

                    {/* Explainability Callout (Why it happened) */}
                    {reason && (
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs text-slate-700">
                        <span className="font-bold text-slate-800">Operational Context: </span>
                        <span>{reason}</span>
                      </div>
                    )}

                    {/* Hardware Action Outcome */}
                    {result && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-teal-800">
                        <ArrowRight className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                        <span className="font-semibold text-teal-900">Hardware Dispatch: </span>
                        <code className="rounded bg-teal-50 px-1.5 py-0.5 font-mono text-[11px] text-teal-800 border border-teal-200/60">
                          {result}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
