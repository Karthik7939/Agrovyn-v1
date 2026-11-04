import {
  SensorReading,
  PredictionData,
  SystemStatusState,
  ActuatorState,
  AIControlDecision,
  SystemEvent,
  SystemSettingsConfig,
  ControlMode,
  PredictionEvaluationMetrics,
  AgentPlan,
} from '@/types/greenhouse';
import {
  initialCurrentSensor,
  demoForecastFromNow,
  mockSystemStatus,
  initialActuatorState,
  getAIDecision,
  generateHistoryReadings,
  mockEvents,
  defaultSettings,
  mockEvaluationMetrics,
} from './mockData';
import { DEFAULT_DEMO_MODE } from './liveTelemetry';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const OFFLINE_STATUS: SystemStatusState = {
  esp8266: 'offline',
  arduino: 'disconnected',
  supabase: 'disconnected',
  ml_engine: 'error',
  last_data_timestamp: '',
};

export class ApiClient {
  private isDemoMode: boolean;

  constructor() {
    this.isDemoMode = DEFAULT_DEMO_MODE;
  }

  public setDemoMode(mode: boolean) {
    this.isDemoMode = mode;
  }

  public getDemoMode(): boolean {
    return this.isDemoMode;
  }

  async getSystemStatus(): Promise<SystemStatusState> {
    if (this.isDemoMode) {
      return mockSystemStatus;
    }
    try {
      const res = await fetch(`${BASE_URL}/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Backend health check failed');
      return await res.json();
    } catch {
      return OFFLINE_STATUS;
    }
  }

  async getLatestSensors(): Promise<SensorReading | null> {
    if (this.isDemoMode) {
      const noiseT = (Math.random() - 0.5) * 0.2;
      const noiseH = (Math.random() - 0.5) * 0.4;
      return {
        ...initialCurrentSensor,
        timestamp: new Date().toISOString(),
        temperature: parseFloat((initialCurrentSensor.temperature + noiseT).toFixed(1)),
        humidity: parseFloat((initialCurrentSensor.humidity + noiseH).toFixed(1)),
      };
    }
    try {
      const res = await fetch(`${BASE_URL}/api/sensors/latest`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async getSensorHistory(hours: number = 24): Promise<SensorReading[]> {
    if (this.isDemoMode) {
      return generateHistoryReadings(hours);
    }
    try {
      const res = await fetch(`${BASE_URL}/api/sensors/history?hours=${hours}`, { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getLatestPredictions(): Promise<PredictionData | null> {
    if (this.isDemoMode) {
      return demoForecastFromNow();
    }
    try {
      const res = await fetch(`${BASE_URL}/api/predictions/latest`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async getAIControlDecision(
    currentTemp: number,
    currentSoil: number,
    currentLdrPct: number
  ): Promise<AIControlDecision | null> {
    if (this.isDemoMode) {
      const pred = demoForecastFromNow();
      return getAIDecision(
        currentTemp,
        currentSoil,
        currentLdrPct,
        pred.horizon_120m.temperature,
        pred.horizon_120m.soil_moisture
      );
    }
    try {
      const res = await fetch(`${BASE_URL}/api/control/decision`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async getActuatorState(): Promise<ActuatorState | null> {
    if (this.isDemoMode) {
      return initialActuatorState;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/actuators/status`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async setControlMode(mode: ControlMode): Promise<{ success: boolean; mode: ControlMode }> {
    if (this.isDemoMode) {
      initialActuatorState.control_mode = mode;
      return { success: true, mode };
    }
    try {
      const res = await fetch(`${BASE_URL}/api/control/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      return await res.json();
    } catch (err) {
      console.error(err);
      return { success: false, mode };
    }
  }

  async controlPump(action: 'ON' | 'OFF', durationSec: number = 300): Promise<{ success: boolean; message: string }> {
    if (this.isDemoMode) {
      initialActuatorState.pump_state = action;
      initialActuatorState.pump_control_source = 'Manual';
      initialActuatorState.pump_last_activation = new Date().toISOString();
      initialActuatorState.control_mode = 'manual';
      return { success: true, message: `Pump switched to ${action} via Demo mode` };
    }
    try {
      const res = await fetch(`${BASE_URL}/api/actuators/pump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: action, duration_seconds: durationSec, source: 'manual' }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  async controlPDLC(targetOpacity: number): Promise<{ success: boolean; message: string }> {
    if (this.isDemoMode) {
      initialActuatorState.pdlc_opacity = targetOpacity;
      initialActuatorState.pdlc_target_opacity = targetOpacity;
      initialActuatorState.pdlc_control_source = 'Manual';
      return { success: true, message: `PDLC opacity updated to ${targetOpacity}% via Demo mode` };
    }
    try {
      const res = await fetch(`${BASE_URL}/api/actuators/pdlc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_opacity: targetOpacity, source: 'manual' }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  async getEvents(): Promise<SystemEvent[]> {
    if (this.isDemoMode) {
      return mockEvents;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/events`, { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getPredictionMetrics(): Promise<PredictionEvaluationMetrics | null> {
    if (this.isDemoMode) {
      return mockEvaluationMetrics;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/predictions/metrics`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async getSettings(): Promise<SystemSettingsConfig> {
    return defaultSettings;
  }

  async getAgentPlan(): Promise<AgentPlan | null> {
    if (this.isDemoMode) {
      const pred = demoForecastFromNow();
      const decision = getAIDecision(
        initialCurrentSensor.temperature,
        initialCurrentSensor.soil_moisture_percent,
        initialCurrentSensor.ldr_percent,
        pred.horizon_120m.temperature,
        pred.horizon_120m.soil_moisture
      );
      return {
        timestamp: new Date().toISOString(),
        agent: 'GreenhouseAgent',
        gemini_enabled: false,
        gemini_approve: null,
        gemini_rationale: null,
        gemini_risks: [],
        proposed: {
          pump: decision.soil.decision === 'IRRIGATION RECOMMENDED' ? 'ON' : 'OFF',
          pdlc_opacity: decision.pdlc.target_opacity,
        },
        prediction: pred,
        decision,
        actions: [],
        status: 'observing',
      };
    }
    try {
      const res = await fetch(`${BASE_URL}/api/agent/latest`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export const apiClient = new ApiClient();
