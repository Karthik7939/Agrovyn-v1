'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { apiClient } from '@/lib/apiClient';
import { ActuatorState, ControlMode, SystemStatusState } from '@/types/greenhouse';
import { Sliders, Power, ShieldAlert, Cpu, Sun, Droplet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { DEFAULT_DEMO_MODE } from '@/lib/liveTelemetry';

export default function ControlPage() {
  const [demoMode, setDemoMode] = useState<boolean>(DEFAULT_DEMO_MODE);
  const [systemStatus, setSystemStatus] = useState<SystemStatusState>({
    esp8266: 'online',
    arduino: 'connected',
    supabase: 'connected',
    ml_engine: 'ready',
    last_data_timestamp: new Date().toISOString(),
  });

  const [actuatorState, setActuatorState] = useState<ActuatorState | null>(null);
  const [pdlcSlider, setPdlcSlider] = useState<number>(50);
  const [pumpDurationMinutes, setPumpDurationMinutes] = useState<number>(5);

  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    actionType: 'mode_toggle' | 'pump_on' | 'pump_off' | 'pdlc_apply' | 'emergency_stop';
    targetVal?: number | string;
  } | null>(null);

  const [loading, setLoading] = useState(false);

  const loadState = async () => {
    apiClient.setDemoMode(demoMode);
    const st = await apiClient.getSystemStatus();
    setSystemStatus(st);
    const act = await apiClient.getActuatorState();
    setActuatorState(act);
    if (act) {
      setPdlcSlider(act.pdlc_opacity);
    }
  };

  useEffect(() => {
    loadState();
  }, [demoMode]);

  const requestModeChange = (newMode: ControlMode) => {
    if (actuatorState?.control_mode === newMode) return;
    setPendingAction({
      actionType: 'mode_toggle',
      title: `Switch Control Mode to ${newMode.toUpperCase()}`,
      description: newMode === 'manual'
        ? 'WARNING: Switching to MANUAL mode will disable automated AI microclimate control logic. You will assume full responsibility for irrigation timing and PDLC opacity states.'
        : 'Switching to AUTOMATIC mode will re-enable the ML predictive decision engine to manage actuators autonomously based on crop thresholds.',
      targetVal: newMode,
    });
    setModalOpen(true);
  };

  const requestPumpAction = (action: 'ON' | 'OFF') => {
    setPendingAction({
      actionType: action === 'ON' ? 'pump_on' : 'pump_off',
      title: action === 'ON' ? 'Confirm Manual Pump Activation' : 'Confirm Immediate Pump Deactivation',
      description: action === 'ON'
        ? `Command irrigation pump ON for ${pumpDurationMinutes} minute(s). Maximum safety runtime is 300 seconds.`
        : 'Deactivate irrigation pump relay immediately.',
    });
    setModalOpen(true);
  };

  const requestEmergencyStop = () => {
    setPendingAction({
      actionType: 'emergency_stop',
      title: 'EMERGENCY SAFETY OVERRIDE STOP',
      description: 'IMMEDIATELY SHUT OFF ALL ACTUATORS! Pump relay will open (OFF) and PDLC will return to default safety state. Dispatches high-priority command over Serial UART to Arduino.',
    });
    setModalOpen(true);
  };

  const requestPDLCAction = (target: number) => {
    setPendingAction({
      actionType: 'pdlc_apply',
      title: `Apply PDLC Opacity ${target}%`,
      description: `Transmit UART button pulse command sequence to Arduino Uno to change PDLC tint state to ${target}%.`,
      targetVal: target,
    });
    setModalOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setLoading(true);
    try {
      if (pendingAction.actionType === 'mode_toggle' && pendingAction.targetVal) {
        await apiClient.setControlMode(pendingAction.targetVal as ControlMode);
      } else if (pendingAction.actionType === 'pump_on') {
        await apiClient.controlPump('ON', pumpDurationMinutes * 60);
      } else if (pendingAction.actionType === 'pump_off' || pendingAction.actionType === 'emergency_stop') {
        await apiClient.controlPump('OFF', 0);
      } else if (pendingAction.actionType === 'pdlc_apply' && pendingAction.targetVal !== undefined) {
        await apiClient.controlPDLC(Number(pendingAction.targetVal));
      }
      await loadState();
    } finally {
      setLoading(false);
      setModalOpen(false);
      setPendingAction(null);
    }
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
              <Sliders className="h-6 w-6 text-emerald-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Hardware Actuator & System Control Console
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-mono mt-1">
              Autonomous AI mode override & explicit serial hardware command execution
            </p>
          </div>

          {/* Emergency Stop Button */}
          <button
            onClick={requestEmergencyStop}
            className="flex items-center justify-center gap-2 rounded-md border border-red-300 bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800"
          >
            <ShieldAlert className="h-4 w-4" />
            EMERGENCY STOP
          </button>
        </div>

        {/* CONTROL MODE TOGGLE SECTION */}
        {actuatorState && (
          <div className="agri-card border-l-2 border-l-[var(--agri-forest)] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-slate-600 uppercase tracking-wider block">
                  SYSTEM GOVERNANCE MODE
                </span>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mt-0.5">
                  Current Mode:
                  <span className={`font-mono text-base font-bold px-3 py-0.5 rounded uppercase ${
                    actuatorState.control_mode === 'automatic'
                      ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-700 border border-amber-500/40'
                  }`}>
                    {actuatorState.control_mode}
                  </span>
                </h2>
              </div>

              {/* Mode switch pills */}
              <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 font-mono text-xs">
                <button
                  onClick={() => requestModeChange('automatic')}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                    actuatorState.control_mode === 'automatic'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  AUTOMATIC (AI ML)
                </button>
                <button
                  onClick={() => requestModeChange('manual')}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                    actuatorState.control_mode === 'manual'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  MANUAL OVERRIDE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS GRID */}
        {actuatorState && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. PDLC SMART GLASS CONTROL PANEL */}
            <div className="agri-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-teal-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    PDLC Glazing Opacity Controller
                  </h3>
                </div>
                <span className="font-mono text-xs text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                  Target: {actuatorState.pdlc_target_opacity}%
                </span>
              </div>

              {/* Hardware translation note */}
              <p className="text-xs text-slate-600 font-mono bg-white p-3 rounded-lg border border-slate-200">
                <strong className="text-slate-700">HARDWARE LOGIC:</strong> Target opacity values (0–100%) are received by FastAPI backend and translated into precise physical relay button pulse timing sent to the Arduino PDLC driver board.
              </p>

              {/* Slider */}
              <div>
                <div className="flex items-center justify-between font-mono text-xs text-slate-700 mb-2">
                  <span>Opacify Level:</span>
                  <span className="text-teal-600 font-bold text-sm">{pdlcSlider}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={25}
                  value={pdlcSlider}
                  onChange={(e) => setPdlcSlider(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
              </div>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-5">
                {[
                  { label: 'CLEAR (0%)', val: 0 },
                  { label: '25%', val: 25 },
                  { label: '50%', val: 50 },
                  { label: '75%', val: 75 },
                  { label: 'OPAQUE (100%)', val: 100 },
                ].map((p) => (
                  <button
                    key={p.val}
                    onClick={() => {
                      setPdlcSlider(p.val);
                      requestPDLCAction(p.val);
                    }}
                    className={`py-2 rounded border font-bold text-[10px] ${
                      pdlcSlider === p.val
                        ? 'bg-teal-500/20 text-teal-700 border-teal-500/50'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => requestPDLCAction(pdlcSlider)}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-mono text-xs font-bold border border-teal-400 shadow-md shadow-teal-950/50 transition-all"
              >
                DISPATCH UART PDLC COMMAND ({pdlcSlider}%)
              </button>
            </div>

            {/* 2. PRECISION IRRIGATION PUMP CONTROL PANEL */}
            <div className="agri-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Droplet className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Precision Irrigation Pump Control
                  </h3>
                </div>
                <span className={`font-mono text-xs px-2.5 py-0.5 rounded border font-bold ${
                  actuatorState.pump_state === 'ON'
                    ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40'
                    : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}>
                  PUMP {actuatorState.pump_state}
                </span>
              </div>

              {/* Safety Parameters Info */}
              <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-600 text-[10px]">MAX RUNTIME LIMIT</span>
                  <span className="text-slate-800 font-bold block">300 sec (5 mins)</span>
                </div>
                <div>
                  <span className="text-slate-600 text-[10px]">COOLDOWN PERIOD</span>
                  <span className="text-slate-800 font-bold block">600 sec (10 mins)</span>
                </div>
              </div>

              {/* Duration Input */}
              <div>
                <label className="text-xs font-mono text-slate-700 block mb-1.5">
                  Target Run Duration (Minutes):
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={pumpDurationMinutes}
                  onChange={(e) => setPumpDurationMinutes(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Pump Toggle Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => requestPumpAction('ON')}
                  disabled={actuatorState.pump_state === 'ON'}
                  className={`py-3 rounded-lg font-mono text-xs font-bold transition-all border ${
                    actuatorState.pump_state === 'ON'
                      ? 'bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-950/50'
                  }`}
                >
                  TURN PUMP ON ({pumpDurationMinutes} MIN)
                </button>

                <button
                  onClick={() => requestPumpAction('OFF')}
                  className="py-3 rounded-lg font-mono text-xs font-bold transition-all border bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-md shadow-red-950/50"
                >
                  TURN PUMP OFF
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Confirmation Modal */}
      {pendingAction && (
        <ConfirmationModal
          isOpen={modalOpen}
          title={pendingAction.title}
          description={pendingAction.description}
          onConfirm={handleConfirm}
          onCancel={() => setModalOpen(false)}
          isLoading={loading}
        />
      )}
    </div>
  );
}
