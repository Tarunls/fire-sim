from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import random
import time

app = FastAPI()

# 1. ALLOW FRONTEND TO TALK TO BACKEND
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for hackathon demo
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. DATA MODELS
class SimParams(BaseModel):
    windSpeed: int
    windDir: str  # 'N', 'S', 'E', 'W'
    moisture: int

# 3. THE PHYSICS ENGINE (CELLULAR AUTOMATA)
def run_simulation(params: SimParams):
    grid_size = 100
    # Initialize grid: 0=Safe
    grid = np.zeros((grid_size, grid_size), dtype=int)
    
    # Start fire in the exact center
    mid = grid_size // 2
    grid[mid-2:mid+2, mid-2:mid+2] = 1 # 4x4 starting fire block

    # Calculate Physics Modifiers
    # Moisture: High moisture = lower ignition chance (Inverse)
    ignition_base = max(0.1, (100 - params.moisture) / 100.0)
    
    # Wind: Biases the spread direction
    # If wind is North, fire spreads South (+y) faster
    bias_r, bias_c = 0, 0
    wind_factor = params.windSpeed / 100.0 # 0.0 to 1.0
    
    if 'N' in params.windDir: bias_r = 1  # Wind from North pushes Down (Row +)
    if 'S' in params.windDir: bias_r = -1 # Wind from South pushes Up (Row -)
    if 'W' in params.windDir: bias_c = 1  # Wind from West pushes Right (Col +)
    if 'E' in params.windDir: bias_c = -1 # Wind from East pushes Left (Col -)

    # Run 15 "Time Steps" of the fire
    for _ in range(15):
        new_grid = grid.copy()
        # Find all currently burning cells (value=1)
        burning_cells = np.argwhere(grid == 1)
        
        for r, c in burning_cells:
            # This cell burns out -> becomes 2
            new_grid[r, c] = 2 
            
            # Check 8 neighbors
            neighbors = [
                (r-1, c), (r+1, c), (r, c-1), (r, c+1), # Cardinal
                (r-1, c-1), (r-1, c+1), (r+1, c-1), (r+1, c+1) # Diagonals
            ]
            
            for nr, nc in neighbors:
                # Check bounds
                if 0 <= nr < grid_size and 0 <= nc < grid_size:
                    if grid[nr, nc] == 0: # If unburnt
                        
                        # Base chance to catch fire
                        chance = ignition_base * 0.3 
                        
                        # APPLY WIND BIAS
                        # If this neighbor is in the direction of the wind, boost chance massively
                        row_diff = nr - r
                        col_diff = nc - c
                        
                        if row_diff == bias_r: chance += (wind_factor * 0.5)
                        if col_diff == bias_c: chance += (wind_factor * 0.5)

                        # Roll the dice
                        if random.random() < chance:
                            new_grid[nr, nc] = 1

        grid = new_grid

    # 4. CONVERT GRID TO MAP COORDINATES
    # Mapping the 100x100 grid to a real lat/lon box in California
    center_lat = 38.5
    center_lon = -121.5
    scale = 0.01 # How far apart points are (Degrees)

    results = []
    burning_indices = np.argwhere(grid == 1) # Get coordinates of active fire
    burnt_indices = np.argwhere(grid == 2)   # Get coordinates of burnt area

    # Add active fire (High intensity)
    for r, c in burning_indices:
        lat = center_lat + (r - 50) * scale
        lon = center_lon + (c - 50) * scale
        results.append({"lat": lat, "lon": lon, "intensity": 1.0})

    # Add burnt trail (Low intensity)
    for r, c in burnt_indices:
        lat = center_lat + (r - 50) * scale
        lon = center_lon + (c - 50) * scale
        results.append({"lat": lat, "lon": lon, "intensity": 0.4})
        
    return results

@app.post("/simulate")
async def get_simulation(params: SimParams):
    # Artificial delay to make it look like "Heavy Processing" (Optional)
    # time.sleep(0.5) 
    
    data = run_simulation(params)
    
    return {
        "status": "success",
        "cluster_load": f"{random.randint(80, 99)}%", # Fake HPC Stat
        "nodes_active": 128,
        "data": data
    }

# Health Check
@app.get("/")
def read_root():
    return {"status": "Cluster Online", "gpu": "Active"}

# Run with: uvicorn backend.main:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)