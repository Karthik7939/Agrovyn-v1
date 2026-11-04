'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { apiClient } from '@/lib/apiClient';
import { SensorReading, SystemStatusState } from '@/types/greenhouse';
import { History, Calendar, Filter, FileSpreadsheet } from 'lucide-react';
import { DEFAULT_DEMO_MODE, isSensorLive } from '@/lib/liveTelemetry';
import { LiveDataNotice } from '@/components/LiveDataNotice';
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

export default function HistoryPage() {
  const [demoMode, setDemoMode] = useState<boolean>(DEFAULT_DEMO_MODE);
  const [systemStatus, setSystemStatus] = useState<SystemStatusState>({
    esp8266: 'online',
    arduino: 'connected',
    supabase: 'connected',
    ml_engine: 'ready',
    last_data_timestamp: new Date().toISOString(),
  });

  const [historyData, setHistoryData] = useState<SensorReading[]>([]);
  const [hoursFilter, setHoursFilter] = useState<number>(24);
  const [sensorFilter, setSensorFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      apiClient.setDemoMode(demoMode);
      const st = await apiClient.getSystemStatus();
      setSystemStatus(st);
      const latest = await apiClient.getLatestSensors();
      const live = demoMode || isSensorLive(latest);
      if (!live) {
        setHistoryData([]);
        return;
      }
      const data = await apiClient.getSensorHistory(hoursFilter);
      setHistoryData(data);
    };
    load();
  }, [demoMode, hoursFilter]);

  // Download CSV export
  const exportToCSV = () => {
    if (!historyData.length) return;
    const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Soil Moisture (%)', 'Soil Raw ADC', 'Light (%)', 'LDR Raw ADC'];
    const rows = historyData.map((item) => [
      item.timestamp,
      item.temperature,
      item.humidity,
      item.soil_moisture_percent,
      item.soil_moisture_raw,
      item.ldr_percent,
      item.ldr_raw,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agrovyn_greenhouse_telemetry_${hoursFilter}h.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartData = historyData.map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    Temperature: item.temperature,
    Humidity: item.humidity,
    SoilMoisture: item.soil_moisture_percent,
    Light: item.ldr_percent,
  }));

  return (
    <div className="min-h-screen bg-[var(--agri-page)] text-slate-900 flex flex-col font-sans">
      <Navbar
        systemStatus={systemStatus}
        demoMode={demoMode}
        onToggleDemoMode={setDemoMode}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-6 w-6 text-emerald-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Historical Telemetry & Dataset Exporter
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-mono mt-1">
              Query historical Supabase database records and export research dataset as CSV
            </p>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold border border-emerald-400 shadow-md transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            EXPORT CSV DATASET
          </button>
        </div>

        {/* Filters bar */}
        <div className="agri-card p-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-600 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-emerald-600" /> TIME RANGE:
            </span>
            {[
              { label: '6 Hours', hrs: 6 },
              { label: '24 Hours', hrs: 24 },
              { label: '7 Days', hrs: 168 },
              { label: '30 Days', hrs: 720 },
            ].map((r) => (
              <button
                key={r.hrs}
                onClick={() => setHoursFilter(r.hrs)}
                className={`px-3 py-1 rounded transition-all ${
                  hoursFilter === r.hrs
                    ? 'bg-emerald-500/20 text-emerald-700 font-bold border border-emerald-500/40'
                    : 'bg-slate-50 text-slate-600 border border-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="text-slate-600">
            Total Records Returned: <strong className="text-slate-900">{historyData.length}</strong>
          </div>
          <label className="flex items-center gap-2 text-slate-600">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Chart series
            <select
              value={sensorFilter}
              onChange={(event) => setSensorFilter(event.target.value)}
              className="min-h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
            >
              <option value="all">All parameters</option>
              <option value="temperature">Temperature</option>
              <option value="humidity">Humidity</option>
              <option value="soil">Soil moisture</option>
              <option value="light">Light intensity</option>
            </select>
          </label>
        </div>

        {!historyData.length ? <LiveDataNotice /> : null}

        {/* Chart */}
        <div className="agri-card p-5">
          <h3 className="text-sm font-mono font-semibold text-slate-800 mb-3">
            Multi-Parameter Time-Series Chart
          </h3>
          <div className="h-72 w-full">
            {!historyData.length ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Sensor data is not live. Nothing to chart.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                {(sensorFilter === 'all' || sensorFilter === 'temperature') && <Line type="monotone" dataKey="Temperature" stroke="#c87332" strokeWidth={1.6} dot={false} />}
                {(sensorFilter === 'all' || sensorFilter === 'humidity') && <Line type="monotone" dataKey="Humidity" stroke="#477aa0" strokeWidth={1.6} dot={false} />}
                {(sensorFilter === 'all' || sensorFilter === 'soil') && <Line type="monotone" dataKey="SoilMoisture" stroke="#47764f" strokeWidth={1.6} dot={false} />}
                {(sensorFilter === 'all' || sensorFilter === 'light') && <Line type="monotone" dataKey="Light" stroke="#7563a5" strokeWidth={1.6} dot={false} />}
              </LineChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Table View */}
        <div className="agri-card p-5">
          <h3 className="text-sm font-mono font-semibold text-slate-800 mb-3">
            Telemetry Database Log Table
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-2">TIMESTAMP</th>
                  <th className="pb-2">TEMP (°C)</th>
                  <th className="pb-2">HUMIDITY (%)</th>
                  <th className="pb-2">SOIL MOISTURE (%)</th>
                  <th className="pb-2">SOIL RAW ADC</th>
                  <th className="pb-2">LIGHT (%)</th>
                  <th className="pb-2">LDR RAW ADC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {historyData.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-2.5 text-slate-600">{new Date(row.timestamp).toLocaleString()}</td>
                    <td className="py-2.5 text-amber-700 font-bold">{row.temperature.toFixed(1)}</td>
                    <td className="py-2.5 text-sky-700">{row.humidity.toFixed(1)}</td>
                    <td className="py-2.5 text-emerald-600 font-bold">{row.soil_moisture_percent.toFixed(1)}</td>
                    <td className="py-2.5 text-slate-600">{row.soil_moisture_raw}</td>
                    <td className="py-2.5 text-violet-700">{row.ldr_percent.toFixed(0)}</td>
                    <td className="py-2.5 text-slate-600">{row.ldr_raw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
