'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { SensorReading } from '@/types/greenhouse';
import { Activity, Calendar, SlidersHorizontal, Sparkles } from 'lucide-react';

interface EnvironmentalGraphProps {
  history: SensorReading[];
  onTimeRangeChange: (hours: number) => void;
  selectedHours: number;
}

export const EnvironmentalGraph: React.FC<EnvironmentalGraphProps> = ({
  history,
  onTimeRangeChange,
  selectedHours,
}) => {
  const [showTemp, setShowTemp] = useState(true);
  const [showHum, setShowHum] = useState(true);
  const [showSoil, setShowSoil] = useState(true);
  const [showLdr, setShowLdr] = useState(false);

  const formattedChartData = history.map((item) => {
    const d = new Date(item.timestamp);
    const timeLabel =
      selectedHours <= 24
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;

    return {
      time: timeLabel,
      Temperature: Number(item.temperature.toFixed(1)),
      Humidity: Number(item.humidity.toFixed(1)),
      SoilMoisture: Number(item.soil_moisture_percent.toFixed(1)),
      Light: Number(item.ldr_percent.toFixed(0)),
    };
  });

  const timeRanges = [
    { label: '1H', hours: 1 },
    { label: '6H', hours: 6 },
    { label: '24H', hours: 24 },
    { label: '7D', hours: 168 },
  ];

  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-4 ring-emerald-50/50">
            <Activity className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Telemetry Analytics Engine
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                Live Stream
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Multi-variable temporal correlation & microclimate dynamics
            </p>
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 text-xs">
          <Calendar className="ml-1 mr-0.5 h-3.5 w-3.5 text-slate-400" />
          {timeRanges.map((range) => (
            <button
              key={range.hours}
              onClick={() => onTimeRangeChange(range.hours)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                selectedHours === range.hours
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-variable toggles */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
          <SlidersHorizontal className="h-3 w-3" /> Channels:
        </span>
        <button
          onClick={() => setShowTemp(!showTemp)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all ${
            showTemp
              ? 'border-amber-300 bg-amber-50/80 font-bold text-amber-900 shadow-2xs'
              : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Temperature (°C)
        </button>

        <button
          onClick={() => setShowHum(!showHum)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all ${
            showHum
              ? 'border-cyan-300 bg-cyan-50/80 font-bold text-cyan-900 shadow-2xs'
              : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-cyan-500" />
          Humidity (%)
        </button>

        <button
          onClick={() => setShowSoil(!showSoil)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all ${
            showSoil
              ? 'border-emerald-300 bg-emerald-50/80 font-bold text-emerald-900 shadow-2xs'
              : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          Soil Moisture (%)
        </button>

        <button
          onClick={() => setShowLdr(!showLdr)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all ${
            showLdr
              ? 'border-violet-300 bg-violet-50/80 font-bold text-violet-900 shadow-2xs'
              : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Solar Light (%)
        </button>
      </div>

      {/* Chart container */}
      <div className="mt-4 h-72 w-full">
        {history.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-400">
            <Sparkles className="mb-2 h-6 w-6 text-slate-300" />
            <p className="font-semibold text-slate-600">Awaiting Sensor Telemetry</p>
            <p className="text-xs text-slate-400">History will automatically graph once readings stream in.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedChartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11, fill: '#64748b' }}
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#f8fafc',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  padding: '10px 14px',
                }}
                itemStyle={{ padding: '2px 0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

              {showTemp && (
                <Line
                  type="monotone"
                  dataKey="Temperature"
                  name="Temperature (°C)"
                  stroke="#f59e0b"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#f59e0b' }}
                />
              )}
              {showHum && (
                <Line
                  type="monotone"
                  dataKey="Humidity"
                  name="Humidity (%)"
                  stroke="#06b6d4"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#06b6d4' }}
                />
              )}
              {showSoil && (
                <Line
                  type="monotone"
                  dataKey="SoilMoisture"
                  name="Soil Moisture (%)"
                  stroke="#10b981"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#10b981' }}
                />
              )}
              {showLdr && (
                <Line
                  type="monotone"
                  dataKey="Light"
                  name="Solar Light (%)"
                  stroke="#8b5cf6"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#8b5cf6' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
