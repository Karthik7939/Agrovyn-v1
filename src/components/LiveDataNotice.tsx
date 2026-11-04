'use client';

import React from 'react';
import { Radio, Clock, Wifi } from 'lucide-react';

interface LiveDataNoticeProps {
  message?: string;
  lastSeenTimestamp?: string;
}

function formatRelative(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const LiveDataNotice: React.FC<LiveDataNoticeProps> = ({
  message = 'Waiting for the ESP8266 to post telemetry to the backend.',
  lastSeenTimestamp,
}) => (
  <div className="agri-card border-l-2 border-l-amber-500 p-8">
    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <Radio className="h-5 w-5 text-amber-600" strokeWidth={1.8} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">Sensor data is not live</p>
        <p className="mt-0.5 text-xs text-slate-500">{message}</p>
        {lastSeenTimestamp && (
          <p className="mt-1.5 flex items-center justify-center gap-1 text-xs text-amber-700 sm:justify-start">
            <Clock className="h-3 w-3" />
            Last seen: {formatRelative(lastSeenTimestamp)}
            <span className="text-slate-400">({new Date(lastSeenTimestamp).toLocaleString()})</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
        <Wifi className="h-3.5 w-3.5" />
        ESP offline / no data
      </div>
    </div>
    <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-800">
      <strong>Tip:</strong> Ensure the ESP8266 is powered and connected to Wi-Fi, then verify it is POSTing to{' '}
      <code className="font-mono text-amber-900">POST /api/sensors</code>. You can also enable{' '}
      <strong>Demo Mode</strong> in the navbar to explore the dashboard with simulated data.
    </div>
  </div>
);
