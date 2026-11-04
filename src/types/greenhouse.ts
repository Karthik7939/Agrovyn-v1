export interface SensorReading {
  id?: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  soil_moisture_raw: number;
  soil_moisture_percent: number;
  ldr_raw: number;
  ldr_percent: number;
  esp_device_id?: string;
  created_at?: string;
}

export interface HorizonForecast {
  temperature: number;
  humidity?: number;
  soil_moisture: number;
  light?: number;
}

export interface PredictionData {
  id?: string;
  timestamp: string;
  model_version: string;
  engine?: string;
  horizon_30m: HorizonForecast;
  horizon_60m: HorizonForecast;
  horizon_120m: HorizonForecast;
  confidence: number | null;
  diagnostics?: {
    hour?: number;
    solar_elevation_deg?: number;
    clear_sky_light_pct?: number;
    effective_light_pct?: number;
    used_residual_ml?: boolean;
  };
  created_at?: string;
}

export interface AgentPlan {
  timestamp: string;
  agent: string;
  gemini_enabled: boolean;
  gemini_approve?: boolean | null;
  gemini_rationale?: string | null;
  gemini_risks?: string[];
  proposed?: {
    pump: 'ON' | 'OFF' | string;
    pdlc_opacity: number;
  };
  prediction: PredictionData;
  decision: AIControlDecision;
  actions: Array<{ actuator: string; command: string | number; reason: string }>;
  status: string;
}

export interface SystemStatusState {
  esp8266: 'online' | 'offline';
  arduino: 'connected' | 'disconnected';
  supabase: 'connected' | 'disconnected';
  ml_engine: 'ready' | 'running' | 'error';
  last_data_timestamp: string;
}

export type ControlMode = 'automatic' | 'manual';

export interface ActuatorState {
  pump_state: 'ON' | 'OFF';
  pump_last_activation?: string;
  pump_duration_minutes?: number;
  pump_control_source: 'AI' | 'Manual' | 'Scheduled';
  
  pdlc_opacity: number; // 0 - 100
  pdlc_target_opacity: number;
  pdlc_controller_status: 'connected' | 'disconnected';
  pdlc_control_source: 'AI' | 'Manual';

  control_mode: ControlMode;
  last_updated: string;

  // Runtime status fields from the backend (not persisted to hardware)
  pending_command_count?: number;
  esp8266_online?: boolean;
}

export interface ActuatorCommandPayload {
  actuator: 'pump' | 'pdlc';
  command: string;
  target_value?: number | string;
  source: 'ai' | 'manual' | 'scheduled' | 'safety';
  reason: string;
  duration_seconds?: number;
}

export interface AIControlDecision {
  soil: {
    current: number;
    predicted_120m: number;
    desired_min: number;
    desired_max: number;
    decision: 'IRRIGATION RECOMMENDED' | 'MOISTURE ADEQUATE' | 'HIGH MOISTURE - NO ACTION';
    reason: string;
  };
  pdlc: {
    current_light: 'Low' | 'Medium' | 'High';
    current_light_percent: number;
    predicted_temp_120m: number;
    target_opacity: number;
    decision: string;
    reason: string;
  };
  timestamp: string;
}

export interface SystemEvent {
  id: string;
  timestamp: string;
  event_type: 'prediction' | 'actuation' | 'sensor_alert' | 'system' | 'safety';
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  source: 'ai' | 'manual' | 'esp8266' | 'arduino' | 'system';
  reason?: string;
  result?: string;
  metadata?: Record<string, unknown>;
}

export interface SensorCalibrationSettings {
  soil_dry_adc: number;
  soil_wet_adc: number;
  ldr_dark_adc: number;
  ldr_bright_adc: number;
}

export interface SystemSettingsConfig {
  greenhouse_name: string;
  device_id: string;
  calibration: SensorCalibrationSettings;
  soil_moisture_min_pct: number;
  soil_moisture_max_pct: number;
  pump_max_runtime_sec: number;
  pump_cooldown_sec: number;
  pdlc_min_duration_sec: number;
  prediction_horizon_min: number;
  model_version: string;
  demo_mode: boolean;
}

export interface PredictionEvaluationMetrics {
  mae_temp: number | null;
  rmse_temp: number | null;
  r2_temp: number | null;
  mae_soil: number | null;
  rmse_soil: number | null;
  r2_soil: number | null;
  sample_count: number;
  evaluated_at?: string;
}
