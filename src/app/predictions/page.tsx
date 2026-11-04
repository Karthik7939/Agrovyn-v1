'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { apiClient } from '@/lib/apiClient';
import {
  PredictionData,
  SensorReading,
  PredictionEvaluationMetrics,
  SystemStatusState,
} from '@/types/greenhouse';
import { Sparkles, BarChart3, ShieldCheck } from 'lucide-react';
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

export default function PredictionsPage() {
  const [demoMode, setDemoMode] = useState<boolean>(DEFAULT_DEMO_MODE);
  const [systemStatus, setSystemStatus] = useState<SystemStatusState>({
    esp8266: 'online',
    arduino: 'connected',
    supabase: 'connected',
    ml_engine: 'ready',
    last_data_timestamp: new Date().toISOString(),
  });

  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [metrics, setMetrics] = useState<PredictionEvaluationMetrics | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [selectedHorizon, setSelectedHorizon] = useState<'30m' | '60m' | '120m'>('120m');

  useEffect(() => {
    const load = async () => {
      apiClient.setDemoMode(demoMode);
      const st = await apiClient.getSystemStatus();
      setSystemStatus(st);
      const latest = await apiClient.getLatestSensors();
      const live = demoMode || isSensorLive(latest);
      if (!live) {
        setPrediction(null);
        setMetrics(null);
        setHistory([]);
        return;
      }
      const pred = await apiClient.getLatestPredictions();
      setPrediction(pred);
      const met = await apiClient.getPredictionMetrics();
      setMetrics(met);
      const hist = await apiClient.getSensorHistory(24);
      setHistory(hist);
    };
    load();
  }, [demoMode]);

  const last = history[history.length - 1];
  const chartComparisonData = history.map((item) => {
    const timeLabel = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      time: timeLabel,
      ActualTemperature: item.temperature,
      PredictedTemperature: undefined as number | undefined,
      ActualSoilMoisture: item.soil_moisture_percent,
      PredictedSoilMoisture: undefined as number | undefined,
    };
  });
  if (last && prediction) {
    const t0 = new Date(last.timestamp).getTime();
    ([
      [30, prediction.horizon_30m],
      [60, prediction.horizon_60m],
      [120, prediction.horizon_120m],
    ] as const).forEach(([mins, h]) => {
      chartComparisonData.push({
        time: new Date(t0 + mins * 60_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ActualTemperature: undefined as unknown as number,
        PredictedTemperature: h.temperature,
        ActualSoilMoisture: undefined as unknown as number,
        PredictedSoilMoisture: h.soil_moisture,
      });
    });
  }

  return (
    <div className="min-h-screen bg-[var(--agri-page)] text-slate-900 flex flex-col font-sans">
      <Navbar
        systemStatus={systemStatus}
        demoMode={demoMode}
        onToggleDemoMode={setDemoMode}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        
        {/* Page Title */}
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-teal-700" />
            <h1 className="font-serif text-2xl font-medium tracking-tight text-slate-900 sm:text-3xl">
              AI Microclimate Predictions & Forecast Analysis
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Physics energy-balance engine with a clipped residual ML corrector. Evening solar geometry forces cooling, not heating.
          </p>
        </div>

        {!prediction && !demoMode ? <LiveDataNotice /> : null}

        {/* Prediction Horizon Selector & Model Info */}
        {prediction && (
          <div className="agri-card p-5 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-mono text-slate-500">ACTIVE MODEL PIPELINE</span>
                <h2 className="text-lg font-mono font-bold text-emerald-700">
                  {prediction.model_version}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  Generated at: {new Date(prediction.timestamp).toLocaleString()}
                </p>
              </div>

              {/* Horizon Selector */}
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 px-2">HORIZON:</span>
                {(['30m', '60m', '120m'] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setSelectedHorizon(h)}
                    className={`px-3 py-1.5 rounded transition-all ${
                      selectedHorizon === h
                        ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    +{h}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Horizon Metrics Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              
              {/* Temperature Forecast Card */}
              <div className="border-l-2 border-l-[#c87332] bg-amber-50/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-amber-700 uppercase">
                    Temperature Forecast (+{selectedHorizon})
                  </span>
                  <span className="text-xs font-mono text-slate-500">Target Range: 22–32 °C</span>
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-mono text-3xl font-bold text-slate-900">
                    {selectedHorizon === '30m' && prediction.horizon_30m.temperature.toFixed(1)}
                    {selectedHorizon === '60m' && prediction.horizon_60m.temperature.toFixed(1)}
                    {selectedHorizon === '120m' && prediction.horizon_120m.temperature.toFixed(1)}
                  </span>
                  <span className="font-mono text-base text-amber-700">°C</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 font-mono">
                  {prediction.diagnostics?.solar_elevation_deg !== undefined
                    ? `Solar elevation ${prediction.diagnostics.solar_elevation_deg}°. Night LDR is not treated as sunlight.`
                    : 'Thermal trajectory follows outdoor air and solar gain, not raw LDR at night.'}
                </p>
              </div>

              {/* Soil Moisture Forecast Card */}
              <div className="border-l-2 border-l-[var(--agri-forest)] bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-emerald-700 uppercase">
                    Soil Moisture Forecast (+{selectedHorizon})
                  </span>
                  <span className="text-xs font-mono text-slate-500">Target Range: 38–68 %</span>
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-mono text-3xl font-bold text-slate-900">
                    {selectedHorizon === '30m' && prediction.horizon_30m.soil_moisture.toFixed(1)}
                    {selectedHorizon === '60m' && prediction.horizon_60m.soil_moisture.toFixed(1)}
                    {selectedHorizon === '120m' && prediction.horizon_120m.soil_moisture.toFixed(1)}
                  </span>
                  <span className="font-mono text-base text-emerald-700">%</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 font-mono">
                  Evapotranspiration depletion model considering ambient temperature and elapsed time since last irrigation.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Actual vs Predicted Comparison Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Temperature Comparison Chart */}
          <div className="agri-card p-5">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-3">
              <BarChart3 className="h-5 w-5 text-amber-700" />
              <h3 className="text-sm font-semibold text-slate-800">
                Actual vs Predicted Temperature (°C)
              </h3>
            </div>
            <div className="h-64 w-full">
              {!history.length ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Sensor data is not live. Nothing to chart.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <Line connectNulls type="monotone" dataKey="ActualTemperature" name="Actual Temp (°C)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line connectNulls type="monotone" dataKey="PredictedTemperature" name="Forecast Temp (°C)" stroke="#477aa0" strokeWidth={1.8} strokeDasharray="5 5" dot />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Soil Moisture Comparison Chart */}
          <div className="agri-card p-5">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-3">
              <BarChart3 className="h-5 w-5 text-emerald-700" />
              <h3 className="text-sm font-semibold text-slate-800">
                Actual vs Predicted Soil Moisture (%)
              </h3>
            </div>
            <div className="h-64 w-full">
              {!history.length ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Sensor data is not live. Nothing to chart.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <Line connectNulls type="monotone" dataKey="ActualSoilMoisture" name="Actual Soil (%)" stroke="#47764f" strokeWidth={1.8} dot={false} />
                  <Line connectNulls type="monotone" dataKey="PredictedSoilMoisture" name="Forecast Soil (%)" stroke="#7563a5" strokeWidth={1.8} strokeDasharray="5 5" dot />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* Model Accuracy & Evaluation Metrics */}
        <div className="agri-card p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-teal-700" />
              <h3 className="text-base font-semibold text-slate-800">
                Historical Model Evaluation & Error Metrics
              </h3>
            </div>
            {metrics?.sample_count ? (
              <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                Sample Size: {metrics.sample_count} cross-validated records
              </span>
            ) : null}
          </div>

          {metrics && metrics.mae_temp !== null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[10px] block">TEMP MAE</span>
                <span className="text-lg font-bold text-amber-700">{metrics.mae_temp} °C</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[10px] block">TEMP RMSE</span>
                <span className="text-lg font-bold text-amber-700">{metrics.rmse_temp} °C</span>
              </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[10px] block">TEMP R² SCORE</span>
                <span className="text-lg font-bold text-teal-700">{metrics.r2_temp}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[10px] block">SOIL MAE</span>
                <span className="text-lg font-bold text-emerald-700">{metrics.mae_soil} %</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[10px] block">SOIL RMSE</span>
                <span className="text-lg font-bold text-emerald-700">{metrics.rmse_soil} %</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[10px] block">SOIL R² SCORE</span>
                <span className="text-lg font-bold text-teal-700">{metrics.r2_soil}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 font-mono text-xs bg-slate-50 rounded-lg border border-slate-200">
              Evaluation data not available yet. Model requires minimum 100 validation samples.
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
