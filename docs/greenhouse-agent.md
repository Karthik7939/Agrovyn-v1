# Greenhouse Autonomous Agent

This document describes the **GreenhouseAgent** control loop, the optional **Gemini supervisor**, APIs, dashboard UI, safety rules, and how to enable the language-model layer.

The physics forecast and hardware safety controllers remain authoritative. Gemini can explain the plan and suggest conservative adjustments; it cannot bypass cooldowns, max pump runtime, or night PDLC rules.

---

## Why this exists

AGROVYN already forecasts microclimate (+30 / +60 / +120 minutes) and evaluates irrigation / PDLC rules. The agent wraps that into one cycle that:

1. Observes live sensors
2. Forecasts the next two hours
3. Proposes pump and PDLC commands from explainable rules
4. Optionally asks Gemini to review the snapshot
5. Actuates only in **automatic** mode, through the safety layer

Operators can see the latest plan on the dashboard without reading backend logs.

---

## Architecture

```
ESP8266  --POST /api/sensors-->  FastAPI
                                      |
                                      v
                              GreenhouseAgent.run_cycle()
                                      |
          +---------------------------+---------------------------+
          |                           |                           |
     Predictor                  MicroclimateController        GeminiReasoner
  (physics-hybrid              (irrigation + PDLC              (optional JSON
   +30/60/120 min)              rule engine)                    review)
          |                           |                           |
          +---------------------------+---------------------------+
                                      |
                               SafetySystem
                          (cooldown, max runtime)
                                      |
                               HardwareBridge
                          queue: PUMP:ON/OFF, PDLC:0|33|66|100
                                      |
                               Arduino relays
```

| Component | Path | Role |
|-----------|------|------|
| `GreenhouseAgent` | `backend/app/agent/greenhouse_agent.py` | Orchestrates one observe → actuate cycle |
| `GeminiReasoner` | `backend/app/agent/gemini_reasoner.py` | Optional Google Gemini JSON review |
| `SafetySystem` | `backend/app/control/safety.py` | Pump start cooldown (600 s) and max runtime (300 s) |
| FastAPI wiring | `backend/app/main.py` | Runs the agent on sensor POST; exposes plan + health |
| Dashboard panel | `src/components/AgentPlanPanel.tsx` | Shows approve, proposed commands, risks, actions |
| Types | `src/types/greenhouse.ts` | `AgentPlan` contract for the UI |

---

## Control loop (one cycle)

`GreenhouseAgent.run_cycle(reading, actuator_state, execute=True)`:

1. **Forecast** using current temperature, humidity, soil moisture, LDR, PDLC opacity, and whether the pump is already on.
2. **Rules** via `MicroclimateController.evaluate_system()` using current soil/light and the +120 min forecast.
3. **Night override**: if solar elevation ≤ 0°, force PDLC target **0%** (clear) so residual light and morning photosynthesis are not blocked.
4. **Gemini review** (only if `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set):
   - Sends a compact snapshot (sensors, forecast, proposed plan, current actuators).
   - Expects JSON: `approve`, `pump`, `pdlc_opacity`, `rationale`, `risks`.
   - If Gemini fails (timeout, bad JSON, HTTP error), the cycle continues on rules only.
5. **Merge Gemini suggestions** (see [Gemini authority](#gemini-authority)).
6. **Actuate** if `execute=True` **and** `control_mode == "automatic"`:
   - Pump ON only after `validate_pump_start` (cooldown).
   - Pump OFF if soil no longer needs irrigation, or max runtime (300 s) is exceeded.
   - PDLC snapped to `{0, 33, 66, 100}` and queued only if the target changed.
7. Store the plan in `agent.last_plan` for `GET /api/agent/latest`.

Manual control mode still receives telemetry; the agent does **not** dispatch hardware in that mode.

---

## Gemini authority

Gemini is a **supervisor**, not the plant controller.

| Gemini output | What the agent does |
|---------------|---------------------|
| No API key / request failed | Ignore Gemini; run rules + safety |
| `approve: false` | Keep the **rules** pump/PDLC plan. Store rationale + “Rules controller retained.” |
| `approve: true` (or omitted after a successful parse) | May turn pump **OFF** extra-conservatively. May not force pump **ON** against soil rules. May set daytime PDLC to 0/33/66/100. Night PDLC stays 0. |
| `risks` | Copied into the plan (up to 8 strings) for the UI |
| `rationale` | Shown on the dashboard |

Hard limits Gemini cannot override:

- Pump cooldown (600 s after last OFF)
- Pump max runtime (300 s) — forced OFF even if the plan still wants ON
- Night PDLC clear (opacity 0)
- Discrete PDLC states only: 0, 33, 66, 100

Prompt-side rules sent to Gemini: do not irrigate if soil is already above 68%; do not command pumps during cooldown; do not increase temperature forecasts (no HVAC).

---

## Enabling Gemini

Put the key in **`d:\AGROVYN\.env.local`** (project root — same folder as `package.json`). FastAPI loads `.env.local` then `.env` on startup. Do **not** put the key in the Next.js `NEXT_PUBLIC_*` variables.

```bash
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-2.5-flash-lite
```

`gemini-2.5-flash-lite` is the default supervisor (fast JSON, 6s timeout). If your Google AI Studio project lists a Gemini 3.x Flash-Lite ID, set `GEMINI_MODEL` to that exact model name.

Restart the backend:

```bash
python -m uvicorn backend.app.main:app --reload --port 8000
```

Confirm:

```bash
curl http://localhost:8000/health
```

`gemini_enabled` should be `true`. Without a key it is `false` and the dashboard shows **Rules only**.

The HTTP call to Gemini uses a **6 second** timeout so a slow model cannot stall irrigation safety.

---

## HTTP API

### `GET /health`

Includes agent fields:

| Field | Meaning |
|-------|---------|
| `gemini_enabled` | Whether an API key was loaded |
| `agent_status` | `idle` (no cycle yet), `observing`, or `executed` |
| `control_mode` | `automatic` or `manual` |

### `POST /api/sensors`

ESP8266 telemetry ingest. If `control_mode` is `automatic`, runs `run_cycle(..., execute=True)`.

### `GET /api/agent/latest`

Returns the last plan. If none exists yet but sensors are present, runs a **dry cycle** (`execute=False`) so the UI can still render a proposal.

### Plan payload (shape)

```json
{
  "timestamp": "2026-04-13T18:30:00",
  "agent": "GreenhouseAgent",
  "gemini_enabled": true,
  "gemini_approve": true,
  "gemini_rationale": "Soil trajectory is recovering; hold irrigation.",
  "gemini_risks": ["Afternoon heat may still stress canopy"],
  "proposed": { "pump": "OFF", "pdlc_opacity": 33 },
  "prediction": { "horizon_30m": {}, "horizon_60m": {}, "horizon_120m": {} },
  "decision": { "soil": {}, "pdlc": {} },
  "actions": [
    { "actuator": "pdlc", "command": 33, "reason": "..." }
  ],
  "status": "executed"
}
```

- `status: observing` — no hardware command this cycle (already at target, or blocked).
- `status: executed` — at least one `PUMP:` or `PDLC:` command was queued.

Pydantic models: `AgentPlanResponse`, `AgentProposed`, `AgentAction` in `backend/app/models/schemas.py`.

---

## Dashboard

The dashboard polls `getAgentPlan()` (`src/lib/apiClient.ts`) and renders `AgentPlanPanel`.

The panel shows:

- **Gemini on / Rules only** and cycle **status**
- **Gemini approved / withheld** when a review ran
- Rationale text (or setup hint if Gemini is off)
- Proposed pump + PDLC, irrigation decision, PDLC decision
- Risk list from Gemini
- Dispatched actions, or “holding state”

Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) returns a synthetic plan with Gemini off so the UI still renders without the backend.

---

## Safety recap

| Guard | Value | Where |
|-------|-------|--------|
| Max pump ON time | 300 s | `SafetySystem`; agent forces `PUMP:OFF` |
| Cooldown after OFF | 600 s | `validate_pump_start` blocks a new ON |
| Night PDLC | 0% | Agent night override |
| Fail-safe relays | Active LOW, default open | Firmware |

Gemini suggestions are applied **before** these checks; actuation still goes through `_apply_pump` / `_apply_pdlc`.

---

## Operational notes

- Plans are **in-memory**. Restarting FastAPI clears `last_plan` until the next sensor POST (or a dry-run GET).
- The agent has its own `Predictor` / `MicroclimateController` instances. `GET /api/predictions/latest` and `GET /api/control/decision` use the global instances in `main.py` — same algorithms, not the same object.
- Hardware only moves when the proposed state **differs** from current pump/PDLC.

---

## File map

```
backend/app/agent/
  greenhouse_agent.py    # cycle + hardware apply
  gemini_reasoner.py     # Gemini REST + JSON parse
  __init__.py
backend/app/main.py         # POST sensors, GET /api/agent/latest, /health
backend/app/models/schemas.py
src/components/AgentPlanPanel.tsx
src/types/greenhouse.ts
src/lib/apiClient.ts     # getAgentPlan()
.env.example             # GEMINI_API_KEY comments
```
