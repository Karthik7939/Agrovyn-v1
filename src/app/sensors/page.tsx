'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { apiClient } from '@/lib/apiClient';
import { SensorReading, SensorCalibrationSettings, SystemStatusState } from '@/types/greenhouse';
import { Thermometer, Cpu, Droplets, Sun, Sprout, CheckCircle2, Sliders, Save, RefreshCw } from 'lucide-react';
import { DEFAULT_DEMO_MODE, isSensorLive } from '@/lib/liveTelemetry';
import { LiveDataNotice } from '@/components/LiveDataNotice';

export default function SensorsPage() {
  const [demoMode, setDemoMode] = useState<boolean>(DEFAULT_DEMO_MODE);
  const [systemStatus, setSystemStatus] = useState<SystemStatusState>({
    esp8266: 'online',
    arduino: 'connected',
    supabase: 'connected',
    ml_engine: 'ready',
    last_data_timestamp: new Date().toISOString(),
  });

  const [sensorData, setSensorData] = useState<SensorReading | null>(null);
  const [calibration, setCalibration] = useState<SensorCalibrationSettings>({
    soil_dry_adc: 750,
    soil_wet_adc: 320,
    ldr_dark_adc: 100,
    ldr_bright_adc: 1800,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadData = async () => {
    apiClient.setDemoMode(demoMode);
    const st = await apiClient.getSystemStatus();
    setSystemStatus(st);
    const reading = await apiClient.getLatestSensors();
    setSensorData(demoMode || isSensorLive(reading) ? reading : null);
  };

  useEffect(() => {
    loadData();
  }, [demoMode]);

  const handleSaveCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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
              <Thermometer className="h-6 w-6 text-cyan-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Hardware Sensor Diagnostic & ADC Calibration Console
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-mono mt-1">
              ADS1015 I2C 12-Bit External ADC & Digital DHT11 telemetry calibration mapping
            </p>
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700 hover:text-slate-900"
          >
            <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
            Refresh Telemetry
          </button>
        </div>

        {!sensorData ? <LiveDataNotice /> : null}

        {/* SENSOR HEALTH & TELEMETRY CARDS */}
        {sensorData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. DHT11 TEMP */}
            <div className="agri-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
                    <Thermometer className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800 uppercase">DHT11 Temperature</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono badge-online">
                  ONLINE
                </span>
              </div>
              <div className="font-mono text-3xl font-semibold text-amber-800">
                {sensorData.temperature.toFixed(1)} °C
              </div>
              <div className="text-[11px] font-mono text-slate-600 border-t border-slate-200 pt-2 flex justify-between">
                <span>Bus: Single Wire GPIO</span>
                <span>Status: Normal</span>
              </div>
            </div>

            {/* 2. DHT11 HUMIDITY */}
            <div className="agri-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-sky-50 text-sky-700 border border-sky-200">
                    <Droplets className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800 uppercase">DHT11 Humidity</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono badge-online">
                  ONLINE
                </span>
              </div>
              <div className="font-mono text-3xl font-semibold text-sky-800">
                {sensorData.humidity.toFixed(1)} %
              </div>
              <div className="text-[11px] font-mono text-slate-600 border-t border-slate-200 pt-2 flex justify-between">
                <span>Bus: Single Wire GPIO</span>
                <span>Status: Normal</span>
              </div>
            </div>

            {/* 3. CAPACITIVE SOIL MOISTURE */}
            <div className="agri-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <Sprout className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800 uppercase">Soil Moisture</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono badge-online">
                  ONLINE
                </span>
              </div>
              <div className="font-mono text-3xl font-semibold text-emerald-800">
                {sensorData.soil_moisture_percent.toFixed(1)} %
              </div>
              <div className="text-[11px] font-mono text-slate-600 border-t border-slate-200 pt-2 flex justify-between">
                <span>ADS1015 Channel A0</span>
                <span className="text-emerald-600 font-semibold">Raw ADC: {sensorData.soil_moisture_raw}</span>
              </div>
            </div>

            {/* 4. ANALOG LDR */}
            <div className="agri-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded bg-violet-50 text-violet-700 border border-violet-200">
                    <Sun className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800 uppercase">Analog LDR</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono badge-online">
                  ONLINE
                </span>
              </div>
              <div className="font-mono text-3xl font-semibold text-violet-800">
                {sensorData.ldr_percent.toFixed(0)} %
              </div>
              <div className="text-[11px] font-mono text-slate-600 border-t border-slate-200 pt-2 flex justify-between">
                <span>ADS1015 Channel A1</span>
                <span className="text-violet-700 font-semibold">Raw ADC: {sensorData.ldr_raw}</span>
              </div>
            </div>

          </div>
        )}

        {/* CALIBRATION SETTINGS FORM */}
        <div className="agri-card p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Sensor ADC Calibration & Linear Mapping
                </h3>
                <p className="text-xs text-slate-600 font-mono">
                  Map raw 12-bit ADC integers from ADS1015 (0–2047) into calibrated moisture & light percentages
                </p>
              </div>
            </div>

            {savedSuccess && (
              <span className="flex items-center gap-1 font-mono text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> Calibration Saved
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCalibration} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Soil Calibration Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <h4 className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Sprout className="h-4 w-4" /> Capacitive Soil Moisture Calibration
                </h4>

                <div>
                  <label className="text-xs font-mono text-slate-600 block mb-1">
                    Dry Air ADC Value (0% Soil Moisture):
                  </label>
                  <input
                    type="number"
                    value={calibration.soil_dry_adc}
                    onChange={(e) => setCalibration({ ...calibration, soil_dry_adc: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    Higher ADC voltage in dry air (~750)
                  </p>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-600 block mb-1">
                    Submerged Water ADC Value (100% Soil Moisture):
                  </label>
                  <input
                    type="number"
                    value={calibration.soil_wet_adc}
                    onChange={(e) => setCalibration({ ...calibration, soil_wet_adc: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    Lower ADC voltage in water (~320)
                  </p>
                </div>
              </div>

              {/* LDR Calibration Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <h4 className="text-xs font-mono font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sun className="h-4 w-4" /> Analog LDR Light Calibration
                </h4>

                <div>
                  <label className="text-xs font-mono text-slate-600 block mb-1">
                    Dark Covered ADC Value (0% Light):
                  </label>
                  <input
                    type="number"
                    value={calibration.ldr_dark_adc}
                    onChange={(e) => setCalibration({ ...calibration, ldr_dark_adc: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-600 block mb-1">
                    Direct Sunlight ADC Value (100% Light):
                  </label>
                  <input
                    type="number"
                    value={calibration.ldr_bright_adc}
                    onChange={(e) => setCalibration({ ...calibration, ldr_bright_adc: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold border border-emerald-400 shadow-md shadow-emerald-950/40 transition-all"
            >
              <Save className="h-4 w-4" />
              SAVE CALIBRATION MATRIX
            </button>
          </form>
        </div>

      </main>
    </div>
  );
}
