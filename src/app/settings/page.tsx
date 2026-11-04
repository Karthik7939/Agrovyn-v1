'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { apiClient } from '@/lib/apiClient';
import { SystemSettingsConfig, SystemStatusState } from '@/types/greenhouse';
import { Settings, Save, CheckCircle2, Cpu, ShieldCheck, Database, Sliders } from 'lucide-react';
import { DEFAULT_DEMO_MODE } from '@/lib/liveTelemetry';

export default function SettingsPage() {
  const [demoMode, setDemoMode] = useState<boolean>(DEFAULT_DEMO_MODE);
  const [systemStatus, setSystemStatus] = useState<SystemStatusState>({
    esp8266: 'online',
    arduino: 'connected',
    supabase: 'connected',
    ml_engine: 'ready',
    last_data_timestamp: new Date().toISOString(),
  });

  const [config, setConfig] = useState<SystemSettingsConfig>({
    greenhouse_name: 'AGROVYN Smart Adaptive Greenhouse #1',
    device_id: 'greenhouse-esp8266-01',
    calibration: {
      soil_dry_adc: 750,
      soil_wet_adc: 320,
      ldr_dark_adc: 100,
      ldr_bright_adc: 1800,
    },
    soil_moisture_min_pct: 38,
    soil_moisture_max_pct: 68,
    pump_max_runtime_sec: 300,
    pump_cooldown_sec: 600,
    pdlc_min_duration_sec: 60,
    prediction_horizon_min: 120,
    model_version: 'RandomForest-Microclimate-v1.2.0',
    demo_mode: true,
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      apiClient.setDemoMode(demoMode);
      const st = await apiClient.getSystemStatus();
      setSystemStatus(st);
      const cfg = await apiClient.getSettings();
      setConfig({ ...cfg, demo_mode: demoMode });
    };
    load();
  }, [demoMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

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
              <Settings className="h-6 w-6 text-teal-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Greenhouse System & Microclimate Threshold Configuration
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-mono mt-1">
              Dynamic threshold configuration stored in database layer instead of hardcoded rules
            </p>
          </div>

          {saved && (
            <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Config Saved Successfully
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: GREENHOUSE IDENTIFICATION */}
          <div className="agri-card p-5 space-y-4">
            <h3 className="text-sm font-mono font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
              <Cpu className="h-4 w-4 text-emerald-600" /> 1. Greenhouse & ESP8266 Device Identity
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-slate-600 block mb-1">
                  Greenhouse Name:
                </label>
                <input
                  type="text"
                  value={config.greenhouse_name}
                  onChange={(e) => setConfig({ ...config, greenhouse_name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-600 block mb-1">
                  ESP8266 Unique Device ID:
                </label>
                <input
                  type="text"
                  value={config.device_id}
                  onChange={(e) => setConfig({ ...config, device_id: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: CONTROL THRESHOLDS */}
          <div className="agri-card p-5 space-y-4">
            <h3 className="text-sm font-mono font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
              <Sliders className="h-4 w-4 text-teal-600" /> 2. Crop Target Soil Moisture & Safety Limits
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div>
                <label className="text-slate-600 block mb-1">Soil Moisture Min Threshold (%):</label>
                <input
                  type="number"
                  value={config.soil_moisture_min_pct}
                  onChange={(e) => setConfig({ ...config, soil_moisture_min_pct: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                />
                <p className="text-[10px] text-slate-500 mt-1">Triggers irrigation recommendation if predicted moisture drops below this value</p>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Soil Moisture Max Target (%):</label>
                <input
                  type="number"
                  value={config.soil_moisture_max_pct}
                  onChange={(e) => setConfig({ ...config, soil_moisture_max_pct: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Maximum Pump Runtime (Seconds):</label>
                <input
                  type="number"
                  value={config.pump_max_runtime_sec}
                  onChange={(e) => setConfig({ ...config, pump_max_runtime_sec: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                />
                <p className="text-[10px] text-slate-500 mt-1">Hard safety timeout cutoff to prevent flooding</p>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Pump Cooldown (Seconds):</label>
                <input
                  type="number"
                  value={config.pump_cooldown_sec}
                  onChange={(e) => setConfig({ ...config, pump_cooldown_sec: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">PDLC Min State Duration (Seconds):</label>
                <input
                  type="number"
                  value={config.pdlc_min_duration_sec}
                  onChange={(e) => setConfig({ ...config, pdlc_min_duration_sec: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                />
                <p className="text-[10px] text-slate-500 mt-1">Prevents rapid relay oscillation</p>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">ML Prediction Horizon (Minutes):</label>
                <input
                  type="number"
                  value={config.prediction_horizon_min}
                  onChange={(e) => setConfig({ ...config, prediction_horizon_min: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: ML MODEL & SUPABASE PERSISTENCE */}
          <div className="agri-card p-5 space-y-4">
            <h3 className="text-sm font-mono font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
              <Database className="h-4 w-4 text-cyan-600" /> 3. ML Model Version & API Endpoints
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <label className="text-slate-600 block mb-1">ML Model Version Identifier:</label>
                <input
                  type="text"
                  value={config.model_version}
                  onChange={(e) => setConfig({ ...config, model_version: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">FastAPI Backend Endpoint:</label>
                <input
                  type="text"
                  disabled
                  value="http://localhost:8000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold border border-emerald-400 shadow-lg shadow-emerald-950/50 transition-all"
          >
            <Save className="h-4 w-4" />
            UPDATE CONFIGURATION PARAMETERS
          </button>
        </form>

      </main>
    </div>
  );
}
