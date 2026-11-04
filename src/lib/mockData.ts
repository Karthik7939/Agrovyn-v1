import {
  SensorReading,
  PredictionData,
  SystemStatusState,
  ActuatorState,
  AIControlDecision,
  SystemEvent,
  SystemSettingsConfig,
  PredictionEvaluationMetrics,
} from '@/types/greenhouse';

// Default system settings
export const defaultSettings: SystemSettingsConfig = {
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
  model_version: 'PhysicsHybrid-v2.0.0',
  demo_mode: true,
};

// Initial system status
export const mockSystemStatus: SystemStatusState = {
  esp8266: 'online',
  arduino: 'connected',
  supabase: 'connected',
  ml_engine: 'ready',
  last_data_timestamp: new Date().toISOString(),
};

// Current sensor snapshot
export const initialCurrentSensor: SensorReading = {
  timestamp: new Date().toISOString(),
  temperature: 28.9,
  humidity: 62.0,
  soil_moisture_raw: 540,
  soil_moisture_percent: 48.0,
  ldr_raw: 1452,
  ldr_percent: 71.0,
  esp_device_id: 'greenhouse-esp8266-01',
};

// Initial actuator state
export const initialActuatorState: ActuatorState = {
  pump_state: 'OFF',
  pump_last_activation: new Date(Date.now() - 3600000).toISOString(),
  pump_duration_minutes: 5,
  pump_control_source: 'AI',
  pdlc_opacity: 50,
  pdlc_target_opacity: 50,
  pdlc_controller_status: 'connected',
  pdlc_control_source: 'AI',
  control_mode: 'automatic',
  last_updated: new Date().toISOString(),
};

// Initial AI decision explanation
export const getAIDecision = (
  temp: number,
  soil: number,
  ldrPct: number,
  predTemp120: number,
  predSoil120: number,
  minSoil = 38,
  maxSoil = 68
): AIControlDecision => {
  const isSoilLow = predSoil120 < minSoil;
  const isHighLightTemp = ldrPct > 65 && predTemp120 > 30.0;

  return {
    soil: {
      current: temp,
      predicted_120m: predSoil120,
      desired_min: minSoil,
      desired_max: maxSoil,
      decision: isSoilLow ? 'IRRIGATION RECOMMENDED' : 'MOISTURE ADEQUATE',
      reason: isSoilLow
        ? `Predicted soil moisture (${predSoil120.toFixed(1)}%) is expected to fall below configured target range threshold (${minSoil}%).`
        : `Predicted soil moisture (${predSoil120.toFixed(1)}%) remains safely within range (${minSoil}% - ${maxSoil}%).`,
    },
    pdlc: {
      current_light: ldrPct > 70 ? 'High' : ldrPct > 35 ? 'Medium' : 'Low',
      current_light_percent: ldrPct,
      predicted_temp_120m: predTemp120,
      target_opacity: isHighLightTemp ? 75 : ldrPct > 80 ? 100 : 25,
      decision: isHighLightTemp
        ? 'INCREASE PDLC OPACITY'
        : 'MAINTAIN OPACITY',
      reason: isHighLightTemp
        ? `High solar light intensity (${ldrPct.toFixed(0)}%) combined with predicted temperature increase (${predTemp120.toFixed(1)}°C) triggers PDLC tinting to mitigate microclimate overheating.`
        : `Solar radiation and thermal trajectory are optimal. PDLC opacity set to transparent/low tinting state for solar gain.`,
    },
    timestamp: new Date().toISOString(),
  };
};

// Generate historical time-series sensor readings for charts (1h, 6h, 24h, 7d, 30d)
export const generateHistoryReadings = (hours: number = 24): SensorReading[] => {
  const readings: SensorReading[] = [];
  const now = Date.now();
  const intervalMs = (hours * 3600 * 1000) / 48; // 48 data points

  for (let i = 48; i >= 0; i--) {
    const time = new Date(now - i * intervalMs);
    const hourOfDay = time.getHours() + time.getMinutes() / 60;

    // Diurnal variation model for temperature and solar light
    const tempBase = 22 + 8 * Math.sin(((hourOfDay - 8) * Math.PI) / 12);
    const tempNoise = (Math.sin(i) * 0.4);
    const temp = Math.round((tempBase + tempNoise) * 10) / 10;

    const humBase = 75 - 20 * Math.sin(((hourOfDay - 8) * Math.PI) / 12);
    const hum = Math.round((humBase + Math.cos(i) * 1.2) * 10) / 10;

    // Soil moisture slowly decreases unless irrigation event occurred
    const soilBase = 65 - ((48 - i) * 0.5) % 35;
    const soilPct = Math.round(soilBase * 10) / 10;
    const soilRaw = Math.round(750 - (soilPct / 100) * (750 - 320));

    const ldrBase = hourOfDay >= 6 && hourOfDay <= 19
      ? Math.max(0, 90 * Math.sin(((hourOfDay - 6) * Math.PI) / 13))
      : 5;
    const ldrPct = Math.round((ldrBase + Math.random() * 5) * 10) / 10;
    const ldrRaw = Math.round(100 + (ldrPct / 100) * (1800 - 100));

    readings.push({
      timestamp: time.toISOString(),
      temperature: temp,
      humidity: hum,
      soil_moisture_raw: soilRaw,
      soil_moisture_percent: soilPct,
      ldr_raw: ldrRaw,
      ldr_percent: ldrPct,
      esp_device_id: 'greenhouse-esp8266-01',
    });
  }

  return readings;
};

// Initial forecast payload
export function demoForecastFromNow() {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  const evening = hour >= 16.5 || hour < 6;
  const t0 = initialCurrentSensor.temperature;
  const s0 = initialCurrentSensor.soil_moisture_percent;
  const h0 = initialCurrentSensor.humidity;
  const l0 = initialCurrentSensor.ldr_percent;
  const tSign = evening ? -1 : 1;
  const lSign = evening ? -1 : hour < 12 ? 1 : -1;
  return {
    timestamp: new Date().toISOString(),
    model_version: 'PhysicsHybrid-v2.0.0',
    engine: 'physics-hybrid',
    horizon_30m: {
      temperature: parseFloat((t0 + tSign * 0.6).toFixed(1)),
      humidity: parseFloat((h0 - tSign * 0.8).toFixed(1)),
      soil_moisture: parseFloat((s0 - 0.6).toFixed(1)),
      light: parseFloat(Math.max(0, l0 + lSign * 4).toFixed(1)),
    },
    horizon_60m: {
      temperature: parseFloat((t0 + tSign * 1.2).toFixed(1)),
      humidity: parseFloat((h0 - tSign * 1.5).toFixed(1)),
      soil_moisture: parseFloat((s0 - 1.4).toFixed(1)),
      light: parseFloat(Math.max(0, l0 + lSign * 8).toFixed(1)),
    },
    horizon_120m: {
      temperature: parseFloat((t0 + tSign * 2.1).toFixed(1)),
      humidity: parseFloat((h0 - tSign * 2.4).toFixed(1)),
      soil_moisture: parseFloat((s0 - 2.8).toFixed(1)),
      light: parseFloat(Math.max(0, l0 + lSign * 14).toFixed(1)),
    },
    confidence: 0.84,
  } as PredictionData;
}

export const initialPredictionData: PredictionData = demoForecastFromNow();

// Historical evaluation metrics
export const mockEvaluationMetrics: PredictionEvaluationMetrics = {
  mae_temp: 0.42,
  rmse_temp: 0.58,
  r2_temp: 0.92,
  mae_soil: 1.15,
  rmse_soil: 1.48,
  r2_soil: 0.89,
  sample_count: 1420,
  evaluated_at: new Date(Date.now() - 14400000).toISOString(),
};

// Event timeline
export const mockEvents: SystemEvent[] = [
  {
    id: 'evt-105',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    event_type: 'actuation',
    message: 'PDLC opacity adjusted to 50%',
    severity: 'info',
    source: 'ai',
    reason: 'High ambient solar irradiance detected by analog LDR via ADS1015 A1.',
    result: 'PDLC controller command dispatched to Arduino Uno relay pulse.',
  },
  {
    id: 'evt-104',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    event_type: 'actuation',
    message: 'Irrigation deactivated after 5-minute cycle',
    severity: 'success',
    source: 'ai',
    reason: 'Configured runtime duration completed safely.',
    result: 'Pump relay deactivated via Arduino Uno pin D7.',
  },
  {
    id: 'evt-103',
    timestamp: new Date(Date.now() - 1500000).toISOString(),
    event_type: 'actuation',
    message: 'Irrigation pump activated',
    severity: 'warning',
    source: 'ai',
    reason: 'ML model predicted soil moisture at +120m (35.8%) dropping below target threshold (38.0%).',
    result: 'Pump command queued: FastAPI → ESP8266 → Serial UART → Arduino Uno.',
  },
  {
    id: 'evt-102',
    timestamp: new Date(Date.now() - 1600000).toISOString(),
    event_type: 'prediction',
    message: 'AI forecast updated for horizon +30m, +60m, +120m',
    severity: 'info',
    source: 'ai',
    reason: 'Periodic microclimate feature matrix inference.',
    result: 'Model prediction written to Supabase `predictions` table.',
  },
  {
    id: 'evt-101',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    event_type: 'system',
    message: 'ESP8266 & Arduino UART communication established',
    severity: 'success',
    source: 'esp8266',
    reason: 'Device boot sequence & heartbeat registration.',
    result: 'Baud rate 115200 hardware bridge online.',
  },
];
