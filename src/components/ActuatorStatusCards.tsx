'use client';

import React, { useState } from 'react';
import { ActuatorState } from '@/types/greenhouse';
import { 
  Power, 
  Sun, 
  Droplet, 
  CheckCircle2, 
  WifiOff, 
  Radio, 
  ShieldCheck, 
  Cpu, 
  Layers,
  Sparkles,
  Zap
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface ActuatorStatusCardsProps {
  actuatorState: ActuatorState;
  onControlPump: (action: 'ON' | 'OFF', durationSec?: number) => Promise<void>;
  onControlPDLC: (targetOpacity: number) => Promise<void>;
}

export const ActuatorStatusCards: React.FC<ActuatorStatusCardsProps> = ({
  actuatorState,
  onControlPump,
  onControlPDLC,
}) => {
  const PDLC_STATES = [
    { label: 'Transparent', val: 0,   stateIdx: 0, desc: 'Maximum solar penetration' },
    { label: 'Light Tint',  val: 33,  stateIdx: 1, desc: 'Glare & light heat filtering' },
    { label: 'Medium Tint', val: 66,  stateIdx: 2, desc: 'Thermal mitigation shield' },
    { label: 'Full Opaque', val: 100, stateIdx: 3, desc: 'Max solar deflection' },
  ];

  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'pump_on' | 'pump_off' | 'pdlc_change';
    title: string;
    description: string;
    value?: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);

  const triggerPumpConfirmation = (action: 'ON' | 'OFF') => {
    setPendingAction({
      type: action === 'ON' ? 'pump_on' : 'pump_off',
      title: action === 'ON' ? 'Confirm Irrigation Activation' : 'Confirm Irrigation Shutdown',
      description: action === 'ON'
        ? 'Manual override will engage the 12V DC irrigation pump for 5 minutes. The autonomous agent will yield control.'
        : 'Immediately cease irrigation pump relay power and return system to idle state.',
    });
    setModalOpen(true);
  };

  const triggerPDLCConfirmation = (target: number) => {
    const stateInfo = PDLC_STATES.find(s => s.val === target);
    const stateLabel = stateInfo ? stateInfo.label : `${target}%`;
    setPendingAction({
      type: 'pdlc_change',
      title: `Set PDLC Glass → ${stateLabel} (${target}%)`,
      description: `The Arduino controller will calculate the forward relay pulse sequence: (target − current + 4) mod 4 to cycle the smart glass to State ${stateInfo?.stateIdx}.`,
      value: target,
    });
    setModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setLoading(true);
    try {
      if (pendingAction.type === 'pump_on') {
        await onControlPump('ON', 300);
      } else if (pendingAction.type === 'pump_off') {
        await onControlPump('OFF', 0);
      } else if (pendingAction.type === 'pdlc_change' && pendingAction.value !== undefined) {
        await onControlPDLC(pendingAction.value);
      }
    } finally {
      setLoading(false);
      setModalOpen(false);
      setPendingAction(null);
    }
  };

  const formattedLastActivation = actuatorState.pump_last_activation
    ? new Date(actuatorState.pump_last_activation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'None';

  const pendingCount = actuatorState.pending_command_count ?? 0;
  const espOffline   = actuatorState.esp8266_online === false;
  const isPumpActive = actuatorState.pump_state === 'ON';

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── 1. IRRIGATION PUMP CONTROLLER ─────────────────────────── */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          {/* Top ambient glow when active */}
          {isPumpActive && (
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-500 to-cyan-400 animate-pulse" />
          )}

          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-4 ${
                  isPumpActive
                    ? 'bg-cyan-500 text-white ring-cyan-100 shadow-sm'
                    : 'bg-slate-100 text-slate-600 ring-slate-50'
                }`}>
                  <Droplet className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Precision Irrigation Subsystem</h3>
                  <p className="text-xs text-slate-400 font-mono">Arduino Relay D8 &bull; 12V Solenoid Driver</p>
                </div>
              </div>

              {/* Status Pill */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                isPumpActive
                  ? 'border border-cyan-300 bg-cyan-50 text-cyan-800 shadow-2xs'
                  : 'border border-slate-200 bg-slate-50 text-slate-600'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isPumpActive ? 'bg-cyan-500 animate-ping' : 'bg-slate-400'}`} />
                PUMP {actuatorState.pump_state}
              </span>
            </div>

            {/* Offline or queued warnings */}
            {pendingCount > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse text-amber-600" />
                <span>
                  <strong>{pendingCount} command{pendingCount > 1 ? 's' : ''} queued</strong> in hardware bridge.
                  {espOffline && <span className="ml-1 font-bold text-rose-700">ESP8266 is offline.</span>}
                </span>
              </div>
            )}

            {/* Subsystem Telemetry Specifications */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">State</span>
                <span className={`font-mono text-sm font-extrabold ${isPumpActive ? 'text-cyan-700' : 'text-slate-800'}`}>
                  {actuatorState.pump_state}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Governance</span>
                <span className="font-mono text-sm font-bold text-teal-700">{actuatorState.pump_control_source}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Last Active</span>
                <span className="font-mono text-xs font-semibold text-slate-700">{formattedLastActivation}</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Max Runtime</span>
                <span className="font-mono text-xs font-semibold text-slate-700">300s (5m)</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Thermal Cooldown</span>
                <span className="font-mono text-xs font-semibold text-slate-700">600s (10m)</span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Relay Bridge</span>
                <span className="font-mono text-xs font-bold text-emerald-700">Active Ready</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
            <button
              onClick={() => triggerPumpConfirmation('ON')}
              disabled={isPumpActive}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-mono text-xs font-bold transition-all shadow-sm ${
                isPumpActive
                  ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                  : 'border border-cyan-500 bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-cyan-600/20 hover:from-cyan-500 hover:to-teal-500'
              }`}
            >
              <Power className="h-4 w-4" />
              MANUAL START (ON)
            </button>

            <button
              onClick={() => triggerPumpConfirmation('OFF')}
              disabled={!isPumpActive}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-mono text-xs font-bold transition-all shadow-sm ${
                !isPumpActive
                  ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                  : 'border border-rose-500 bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-rose-600/20 hover:from-rose-500 hover:to-red-500'
              }`}
            >
              <Power className="h-4 w-4" />
              MANUAL SHUTOFF (OFF)
            </button>
          </div>
        </div>

        {/* ── 2. PDLC SMART GLASS CONTROLLER ────────────────────────── */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-4 ring-amber-50/50">
                  <Sun className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">PDLC Smart Glass Subsystem</h3>
                  <p className="text-xs text-slate-400 font-mono">Polymer Dispersed Liquid Crystal Shading</p>
                </div>
              </div>

              {/* Status Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-mono text-xs font-bold text-teal-900 shadow-2xs">
                <Sparkles className="h-3 w-3 text-teal-600" />
                {actuatorState.pdlc_opacity}% Opacity
              </span>
            </div>

            {/* Simulated Smart Glass Optical Preview Bar */}
            <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pb-1.5">
                <span>Optical Tint Profile:</span>
                <span className="font-mono text-teal-800 font-bold">
                  {actuatorState.pdlc_opacity === 0
                    ? 'State 0 — 100% Light Transmission'
                    : actuatorState.pdlc_opacity === 33
                    ? 'State 1 — Light Polarization'
                    : actuatorState.pdlc_opacity === 66
                    ? 'State 2 — Thermal Glare Mitigation'
                    : 'State 3 — Maximum Solar Shield'}
                </span>
              </div>
              {/* Visual simulated glass window */}
              <div className="relative h-6 w-full overflow-hidden rounded-lg border border-slate-300/80 bg-white shadow-inner">
                <div
                  className="h-full transition-all duration-700 ease-out flex items-center justify-center text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor:
                      actuatorState.pdlc_opacity === 0
                        ? '#ffffff'
                        : actuatorState.pdlc_opacity === 33
                        ? '#ccfbf1'
                        : actuatorState.pdlc_opacity === 66
                        ? '#5eead4'
                        : '#0f766e',
                    color: actuatorState.pdlc_opacity === 100 ? '#ffffff' : '#0f766e',
                  }}
                >
                  {actuatorState.pdlc_opacity}% Opacity Active
                </div>
              </div>
            </div>

            {/* 4 Physical States Tile Grid */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Select Setpoint State</span>
                <span className="text-[10px] font-mono text-slate-400">Cyclic Modulo Controller</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PDLC_STATES.map((state) => {
                  const isActive = actuatorState.pdlc_opacity === state.val;
                  return (
                    <button
                      key={state.val}
                      onClick={() => triggerPDLCConfirmation(state.val)}
                      className={`relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                        isActive
                          ? 'border-teal-700 bg-gradient-to-r from-teal-700 to-emerald-800 text-white shadow-md shadow-teal-700/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/50'
                      }`}
                    >
                      {/* Visual Swatch */}
                      <div
                        className={`h-5 w-5 shrink-0 rounded-lg border shadow-2xs ${
                          state.val === 0
                            ? 'bg-white border-slate-300'
                            : state.val === 33
                            ? 'bg-teal-100 border-teal-300'
                            : state.val === 66
                            ? 'bg-teal-300 border-teal-500'
                            : 'bg-teal-800 border-teal-900'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-mono text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-slate-900'}`}>
                          State {state.stateIdx} ({state.val}%)
                        </div>
                        <div className={`text-[10px] truncate ${isActive ? 'text-teal-100' : 'text-slate-500'}`}>
                          {state.label}
                        </div>
                      </div>
                      {isActive && <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Micro Footer Note */}
          <div className="mt-4 border-t border-slate-100 pt-3 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <Zap className="h-3.5 w-3.5 text-teal-600" />
            <span>Relay sequencer: cyclic forward pulse translation (target − current + 4) mod 4.</span>
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {pendingAction && (
        <ConfirmationModal
          isOpen={modalOpen}
          title={pendingAction.title}
          description={pendingAction.description}
          onConfirm={handleConfirmAction}
          onCancel={() => setModalOpen(false)}
          isLoading={loading}
        />
      )}
    </>
  );
};
