import uvicorn
import numpy as np
import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- IMPORT THE NEW AI FUNCTIONS ---
from ai_engine import get_ai_parameters, analyze_risk_data 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimParams(BaseModel):
    temperature: float
    humidity: float
    moisture: float
    windSpeed: float
    windDir: str
    slope: float
    duration: int = 24 
    originLat: float
    originLon: float

# --- PHYSICS ENGINE ---
def run_simulation(params: SimParams):
    print(f"--- SIMULATING AT: {params.originLat}, {params.originLon} ---")

    grid_size = 200 
    fire = np.zeros((grid_size, grid_size), dtype=float)
    fuel = np.ones((grid_size, grid_size), dtype=float)
    
    terrain_roughness = np.random.normal(1.0, 0.3, (grid_size, grid_size))
    terrain_roughness = np.clip(terrain_roughness, 0.5, 1.5)
    
    fuel += np.random.normal(0, 0.1, (grid_size, grid_size))
    fuel = np.clip(fuel, 0.5, 1.0)
    
    mid = grid_size // 2
    fire[mid-3:mid+4, mid-3:mid+4] = 1.0

    vectors = {
        'N': (-1, 0), 'S': (1, 0), 'E': (0, 1), 'W': (0, -1),
        'NE': (-1, 1), 'NW': (-1, -1), 'SE': (1, 1), 'SW': (1, -1)
    }
    wind_vec = np.array(vectors.get(params.windDir, (0, 0)), dtype=float)
    wind_magnitude = (params.windSpeed / 50.0)
    
    base_prob = 0.25 
    slope_factor = params.slope / 50.0

    history = [] 
    total_steps = params.duration * 2 
    scale = 0.004 

    for step in range(total_steps):
        new_fire = fire.copy()
        
        burning_mask = fire > 0.1
        consumption = 0.04 * fire 
        fuel[burning_mask] -= consumption[burning_mask]
        
        new_fire = fire * 0.98
        new_fire[fuel < 0.1] *= 0.6 
        
        source_indices = np.argwhere(fire > 0.1)
        
        if len(source_indices) > 800:
             indices_to_process = source_indices[np.random.choice(len(source_indices), 800, replace=False)]
        else:
             indices_to_process = source_indices

        for r, c in indices_to_process:
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr==0 and dc==0: continue
                    nr, nc = r+dr, c+dc
                    if not (0<=nr<grid_size and 0<=nc<grid_size): continue
                    if fuel[nr, nc] < 0.1: continue 
                    if new_fire[nr, nc] > 0.4: continue 
                    
                    dist = np.sqrt(dr**2 + dc**2)
                    n_vec = np.array([dr, dc], dtype=float)
                    
                    w_align = 0
                    if np.linalg.norm(wind_vec) > 0:
                        w_align = np.dot(wind_vec, n_vec) / dist
                    
                    wind_boost = 1.0
                    if w_align > 0: wind_boost += (w_align * wind_magnitude * 5.0)
                    
                    s_boost = 1.0
                    if dr < 0: s_boost += slope_factor * 2.0
                    
                    local_roughness = terrain_roughness[nr, nc]
                    prob = base_prob * (1.0/dist) * wind_boost * s_boost * local_roughness
                    
                    if random.random() < min(1.0, prob):
                        new_fire[nr, nc] = max(new_fire[nr, nc], random.uniform(0.5, 0.8))

        fire = np.clip(new_fire, 0, 1)

        frame_data = []
        active_cells = np.argwhere(fire > 0.05)
        
        for r, c in active_cells:
            if random.random() > 0.3: continue 
            real_lat = params.originLat + (mid - r) * scale
            real_lon = params.originLon + (c - mid) * scale
            frame_data.append({
                "lat": round(float(real_lat), 5),
                "lon": round(float(real_lon), 5),
                "intensity": round(float(fire[r, c]), 2)
            })
        
        history.append(frame_data)

    return history

@app.post("/simulate")
async def get_simulation(params: SimParams):
    data = run_simulation(params)
    return {"status": "success", "data": data}

@app.post("/parse-command")
async def parse_command_endpoint(cmd: dict):
    prompt = cmd.get('prompt', '')
    params = get_ai_parameters(prompt)
    return {"status": "parsed", "params": params}

# --- THIS WAS THE MISSING PIECE ---
@app.post("/query-impact")
async def query_impact_endpoint(payload: dict):
    prompt = payload.get('prompt', '')
    risk_data = payload.get('risk_data', [])
    
    # Call the new RAG function
    result = analyze_risk_data(prompt, risk_data)
    
    # Return 'response' so the frontend can read aiResponse.answer
    return {"status": "success", "response": result}

if __name__ == "__main__":
    print("STAGING FIRE ENGINE...") 
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")