from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimParams(BaseModel):
    windSpeed: int
    windDir: str 
    moisture: int
    humidity: int    # NEW
    temperature: int # NEW
    slope: int       # NEW (0-45 degrees)

def run_simulation(params: SimParams):
    grid_size = 100
    # Current intensity of the fire
    grid = np.zeros((grid_size, grid_size), dtype=float)
    # How much "wood/fuel" is left in each cell (starts at 1.0)
    fuel = np.ones((grid_size, grid_size), dtype=float)
    
    mid = grid_size // 2
    grid[mid-2:mid+3, mid-2:mid+3] = 0.8 # Initial ignition

    # Physics Adjustments
    ignition_base = max(0.1, ((100 - params.moisture) / 100.0) + (params.temperature / 200.0))
    
    # Wind & Slope
    bias_r, bias_c = 0, 0
    if 'N' in params.windDir: bias_r = 1
    elif 'S' in params.windDir: bias_r = -1
    if 'W' in params.windDir: bias_c = 1
    elif 'E' in params.windDir: bias_c = -1

    for _ in range(25):
        new_grid = grid.copy()
        
        # 1. SMARTER DECAY (Based on fuel consumption)
        active_fire = grid > 0
        # Fire "eats" fuel. When fuel is low, intensity drops.
        fuel_consumption = 0.15 * (1 + (params.temperature / 100))
        fuel[active_fire] -= fuel_consumption * grid[active_fire]
        fuel = np.clip(fuel, 0, 1)
        
        # Intensity follows fuel availability (Creates the gradient/gaps)
        new_grid = grid * fuel 
        
        # 2. SPREAD LOGIC (Stochastic)
        burning_cells = np.argwhere(grid > 0.2)
        for r, c in burning_cells:
            for dr, dc in [(-1,0), (1,0), (0,-1), (0,1), (-1,-1), (1,1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < grid_size and 0 <= nc < grid_size and grid[nr, nc] == 0:
                    if fuel[nr, nc] < 0.1: continue # Can't ignite empty fuel
                    
                    chance = ignition_base * 0.25
                    if dr == bias_r: chance += (params.windSpeed / 200.0)
                    if dc == bias_c: chance += (params.windSpeed / 200.0)
                    if dr == 1: chance += (params.slope / 100.0)
                    
                    if random.random() < chance:
                        # Randomize initial intensity so it's not a "giant block"
                        new_grid[nr, nc] = random.uniform(0.6, 1.0)
                        
        grid = np.clip(new_grid, 0, 1)

    # Export to Mapbox
    center_lat, center_lon = 38.5, -121.5
    scale = 0.008 
    results = []
    # Send all active spots to create a rich heatmap gradient
    active_indices = np.argwhere(grid > 0.01)
    for r, c in active_indices:
        results.append({
            "lat": float(center_lat + (r - 50) * scale),
            "lon": float(center_lon + (c - 50) * scale),
            "intensity": float(grid[r, c]) # This value now varies!
        })
    return results

@app.post("/simulate")
async def get_simulation(params: SimParams):
    data = run_simulation(params)
    return {"status": "success", "data": data}

@app.post("/parse-command")
def parse_agent_command(cmd: dict):
    text = cmd['prompt'].lower()
    # Logic to map keywords to humidity/temp/slope can be added here
    return {
        "status": "parsed", 
        "params": {
            "windSpeed": 40 if "gale" in text else 20, 
            "windDir": "N", 
            "moisture": 5 if "bone dry" in text else 15,
            "humidity": 10 if "desert" in text else 40,
            "temperature": 100 if "heatwave" in text else 75,
            "slope": 30 if "mountain" in text else 0
        },
        "ai_response": "Environment recalibrated for extreme conditions."
    }

if __name__ == "__main__":
    import uvicorn
    # This line MUST be reached to keep the process alive
    print("STAGING FIRE ENGINE...") 
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")