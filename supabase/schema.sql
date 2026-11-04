-- ==================================================
-- AGROVYN: Smart Adaptive Greenhouse Database Schema
-- Supabase PostgreSQL Persistent Storage
-- ==================================================

-- 1. SENSOR READINGS TABLE
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    temperature NUMERIC(4,2) NOT NULL,
    humidity NUMERIC(4,2) NOT NULL,
    soil_moisture_raw INT NOT NULL,
    soil_moisture_percent NUMERIC(4,2) NOT NULL,
    ldr_raw INT NOT NULL,
    ldr_percent NUMERIC(4,2) NOT NULL,
    esp_device_id TEXT NOT NULL DEFAULT 'greenhouse-esp8266-01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp ON public.sensor_readings (timestamp DESC);

-- 2. PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_version TEXT NOT NULL,
    prediction_horizon_minutes INT NOT NULL DEFAULT 120,
    predicted_temperature NUMERIC(4,2) NOT NULL,
    predicted_soil_moisture NUMERIC(4,2) NOT NULL,
    confidence NUMERIC(3,2) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON public.predictions (timestamp DESC);

-- 3. ACTUATOR COMMANDS AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.actuator_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actuator TEXT NOT NULL CHECK (actuator IN ('pump', 'pdlc')),
    command TEXT NOT NULL,
    target_value TEXT NULL,
    source TEXT NOT NULL CHECK (source IN ('ai', 'manual', 'scheduled', 'safety')),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'dispatched',
    device_id TEXT NOT NULL DEFAULT 'greenhouse-esp8266-01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actuator_commands_timestamp ON public.actuator_commands (timestamp DESC);

-- 4. ACTUATOR STATE SNAPSHOT TABLE
CREATE TABLE IF NOT EXISTS public.actuator_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pump_state TEXT NOT NULL DEFAULT 'OFF',
    pdlc_opacity INT NOT NULL DEFAULT 50,
    arduino_status TEXT NOT NULL DEFAULT 'connected',
    esp_status TEXT NOT NULL DEFAULT 'online',
    control_mode TEXT NOT NULL DEFAULT 'automatic'
);

-- 5. SYSTEM EVENTS LOG TABLE
CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    source TEXT NOT NULL DEFAULT 'system',
    reason TEXT NULL,
    result TEXT NULL,
    metadata JSONB NULL
);

-- 6. SYSTEM CONFIGURATION & THRESHOLDS TABLE
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    greenhouse_name TEXT NOT NULL DEFAULT 'AGROVYN Smart Adaptive Greenhouse',
    device_id TEXT NOT NULL DEFAULT 'greenhouse-esp8266-01',
    soil_dry_adc INT NOT NULL DEFAULT 750,
    soil_wet_adc INT NOT NULL DEFAULT 320,
    ldr_dark_adc INT NOT NULL DEFAULT 100,
    ldr_bright_adc INT NOT NULL DEFAULT 1800,
    soil_moisture_min_pct NUMERIC(4,2) NOT NULL DEFAULT 38.0,
    soil_moisture_max_pct NUMERIC(4,2) NOT NULL DEFAULT 68.0,
    pump_max_runtime_sec INT NOT NULL DEFAULT 300,
    pump_cooldown_sec INT NOT NULL DEFAULT 600,
    pdlc_min_duration_sec INT NOT NULL DEFAULT 60,
    prediction_horizon_min INT NOT NULL DEFAULT 120,
    model_version TEXT NOT NULL DEFAULT 'RandomForest-Microclimate-v1.2.0',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row_config CHECK (id = 1)
);

-- Seed default initial configuration
INSERT INTO public.system_settings (id, greenhouse_name)
VALUES (1, 'AGROVYN Smart Adaptive Greenhouse #1')
ON CONFLICT (id) DO NOTHING;
