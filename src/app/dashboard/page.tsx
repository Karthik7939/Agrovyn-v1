'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import greenhouseImage from '@/images/bg-img.png';
import { Navbar } from '@/components/Navbar';
import { CurrentEnvironmentCards } from '@/components/CurrentEnvironmentCards';
import { EnvironmentalGraph } from '@/components/EnvironmentalGraph';
import { PredictionPanel } from '@/components/PredictionPanel';
import { ControlDecisionPanel } from '@/components/ControlDecisionPanel';
import { ActuatorStatusCards } from '@/components/ActuatorStatusCards';
import { RecentEventsTimeline } from '@/components/RecentEventsTimeline';
import { apiClient } from '@/lib/apiClient';
import { AgentPlanPanel } from '@/components/AgentPlanPanel';
import { LiveDataNotice } from '@/components/LiveDataNotice';
import {
  SensorReading,
  PredictionData,
  SystemStatusState,
  ActuatorState,
  AIControlDecision,
  SystemEvent,
  AgentPlan,
} from '@/types/greenhouse';
import { RefreshCw, Leaf } from 'lucide-react';
import { DEFAULT_DEMO_MODE, isSensorLive } from '@/lib/liveTelemetry';

export default function DashboardPage() {
  const [demoMode, setDemoMode] = useState<boolean>(DEFAULT_DEMO_MODE);
  const [systemStatus, setSystemStatus] = useState<SystemStatusState>({
    esp8266: 'online',
    arduino: 'connected',
    supabase: 'connected',
    ml_engine: 'ready',
    last_data_timestamp: new Date().toISOString(),
  });

  const [currentReading, setCurrentReading] = useState<SensorReading | null>(null);
  const [previousReading, setPreviousReading] = useState<SensorReading | undefined>(undefined);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [selectedHours, setSelectedHours] = useState<number>(24);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [aiDecision, setAiDecision] = useState<AIControlDecision | null>(null);
  const [actuatorState, setActuatorState] = useState<ActuatorState | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [agentPlan, setAgentPlan] = useState<AgentPlan | null>(null);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      apiClient.setDemoMode(demoMode);

      const status = await apiClient.getSystemStatus();
      setSystemStatus(status);

      const latest = await apiClient.getLatestSensors();
      const live = demoMode || isSensorLive(latest);
      if (!live) {
        // Preserve the stale timestamp so the notice can show "last seen X ago"
        if (latest?.timestamp) setLastSeenTimestamp(latest.timestamp);
        setCurrentReading(null);
        setPreviousReading(undefined);
        setHistory([]);
        setPrediction(null);
        setAiDecision(null);
        setAgentPlan(null);
        setEvents([]);
        const act = await apiClient.getActuatorState();
        setActuatorState(act);
        return;
      }
      // Clear stale timestamp once live data arrives
      setLastSeenTimestamp(null);

      if (latest && currentReading) {
        setPreviousReading(currentReading);
      }
      setCurrentReading(latest);

      const hist = await apiClient.getSensorHistory(selectedHours);
      setHistory(hist);

      const pred = await apiClient.getLatestPredictions();
      setPrediction(pred);

      const dec = latest
        ? await apiClient.getAIControlDecision(
            latest.temperature,
            latest.soil_moisture_percent,
            latest.ldr_percent
          )
        : null;
      setAiDecision(dec);

      const act = await apiClient.getActuatorState();
      setActuatorState(act);

      const evts = await apiClient.getEvents();
      setEvents(evts);

      const plan = await apiClient.getAgentPlan();
      setAgentPlan(plan);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, [demoMode, selectedHours]);

  useEffect(() => {
    setCurrentTime(new Date());
    const clock = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(clock);
  }, []);

  const handleToggleDemoMode = (val: boolean) => {
    setDemoMode(val);
    apiClient.setDemoMode(val);
  };

  const handleControlPump = async (action: 'ON' | 'OFF', durationSec: number = 300) => {
    await apiClient.controlPump(action, durationSec);
    await loadDashboardData();
  };

  const handleControlPDLC = async (targetOpacity: number) => {
    await apiClient.controlPDLC(targetOpacity);
    await loadDashboardData();
  };

  return (
    <div className="min-h-screen bg-[var(--agri-page)] text-slate-900 flex flex-col font-sans">
      <Navbar
        systemStatus={systemStatus}
        demoMode={demoMode}
        onToggleDemoMode={handleToggleDemoMode}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#183a27] shadow-sm">
          <div className="relative min-h-[340px] sm:min-h-[400px] lg:min-h-[440px]">
            <Image
              src={greenhouseImage}
              alt="Sunlit greenhouse plants"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#10291e]/85 via-[#173c29]/55 to-[#173c29]/10" />
            <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
              <p className="text-sm font-medium tabular-nums text-white/90" aria-live="off">
                {currentTime
                  ? currentTime.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : 'Local date and time'}
              </p>
              <button
                onClick={loadDashboardData}
                disabled={refreshing}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/40 bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 px-5 pb-8 pt-24 sm:px-8 sm:pb-12 lg:px-12 lg:pb-16">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#d5e9c9]">
                <Leaf className="h-4 w-4" /> Greenhouse operations
              </p>
              <h1 className="max-w-3xl font-serif text-4xl font-medium leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Greenhouse Control Dashboard
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:text-base sm:leading-7">
                Live telemetry monitoring, AI forecasting, and automated microclimate control
              </p>
            </div>
          </div>
        </section>

        {!currentReading ? (
          <LiveDataNotice lastSeenTimestamp={lastSeenTimestamp ?? undefined} />
        ) : (
          <CurrentEnvironmentCards
            reading={currentReading}
            previousReading={previousReading}
          />
        )}

        {currentReading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnvironmentalGraph
            history={history}
            onTimeRangeChange={(hrs) => setSelectedHours(hrs)}
            selectedHours={selectedHours}
          />

          {prediction && (
            <PredictionPanel
              currentReading={currentReading}
              prediction={prediction}
            />
          )}
        </div>
        ) : null}

        {/* 3. CONTROL & ACTUATION GRID (2 COLUMNS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {aiDecision && (
            <ControlDecisionPanel decision={aiDecision} />
          )}

          {actuatorState && (
            <ActuatorStatusCards
              actuatorState={actuatorState}
              onControlPump={handleControlPump}
              onControlPDLC={handleControlPDLC}
            />
          )}
        </div>

        {agentPlan && <AgentPlanPanel plan={agentPlan} />}

        {/* 4. RECENT EVENTS AUDIT TRAIL */}
        <RecentEventsTimeline events={events} />

      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-200 bg-[var(--agri-surface)] px-4 py-4 text-center text-xs text-slate-500">
        AGROVYN Smart Adaptive Greenhouse &bull; NodeMCU ESP8266 &bull; Arduino Uno &bull; Supabase & FastAPI ML Engine
      </footer>
    </div>
  );
}
