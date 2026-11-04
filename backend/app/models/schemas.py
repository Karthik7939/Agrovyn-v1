from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class SensorReadingCreate(BaseModel):
    device_id: str = "greenhouse-01"
    temperature: float = Field(..., description="Temperature in °C")
    humidity: float = Field(..., description="Humidity in %")
    soil_moisture_raw: int = Field(..., description="ADS1015 A0 ADC raw integer")
    soil_moisture_percent: float = Field(..., description="Calibrated soil moisture %")
    ldr_raw: int = Field(..., description="ADS1015 A1 LDR ADC raw integer")
    ldr_percent: float = Field(..., description="Normalized light intensity %")

class SensorReadingResponse(SensorReadingCreate):
    id: Optional[str] = None
    timestamp: str
    created_at: Optional[str] = None

class HorizonPrediction(BaseModel):
    temperature: float
    humidity: Optional[float] = None
    soil_moisture: float
    light: Optional[float] = None

class PredictionResponse(BaseModel):
    id: Optional[str] = None
    timestamp: str
    model_version: str
    engine: Optional[str] = "physics-hybrid"
    horizon_30m: HorizonPrediction
    horizon_60m: HorizonPrediction
    horizon_120m: HorizonPrediction
    confidence: Optional[float] = 0.82
    diagnostics: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None

class PumpControlPayload(BaseModel):
    command: str = Field(..., example="ON")
    duration_seconds: int = Field(300, example=300)
    source: str = Field("manual", example="manual")

class PDLCControlPayload(BaseModel):
    target_opacity: int = Field(..., example=50)
    source: str = Field("manual", example="manual")

class ControlModePayload(BaseModel):
    mode: str = Field(..., example="automatic")

class ActuatorStateResponse(BaseModel):
    pump_state: str
    pump_last_activation: Optional[str] = None
    pump_duration_minutes: float = 5.0
    pump_control_source: str
    pdlc_opacity: int
    pdlc_target_opacity: int
    pdlc_controller_status: str
    pdlc_control_source: str
    control_mode: str
    last_updated: str

class HardwareCommandPayload(BaseModel):
    command: str = Field(..., example="PUMP:ON")
    device_id: str = Field("greenhouse-01", example="greenhouse-01")

class HardwareHeartbeatPayload(BaseModel):
    device_id: str
    device_type: str = "esp8266"
    status: str = "online"
    firmware_version: str = "v1.2.0"

class AgentAction(BaseModel):
    actuator: str
    command: Any
    reason: str

class AgentProposed(BaseModel):
    pump: str
    pdlc_opacity: int

class AgentPlanResponse(BaseModel):
    timestamp: str
    agent: str = "GreenhouseAgent"
    gemini_enabled: bool = False
    gemini_approve: Optional[bool] = None
    gemini_rationale: Optional[str] = None
    gemini_risks: List[str] = []
    proposed: Optional[AgentProposed] = None
    prediction: Optional[Dict[str, Any]] = None
    decision: Optional[Dict[str, Any]] = None
    actions: List[AgentAction] = []
    status: str = "observing"
