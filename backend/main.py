import os
import json
import numpy as np
import random
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# 1. SETUP OPENAI CLIENT
# Ensure your terminal has access to this variable, or hardcode it for the demo (carefully!)
api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
class SimParams(BaseModel):
    windSpeed: int
    windDir: str 
    moisture: int

class TextCommand(BaseModel):
    prompt: str

# --- SIMULATION ENGINE (The "Physics") ---
def run_simulation(params: SimParams):
    grid_size = 100
    grid = np.zeros((grid_size, grid_size), dtype=float)
    
    # Start Blob Fire
    mid = grid_size // 2
    for r in range(mid-3, mid+4):
        for c in range(mid-3, mid+4):
            if random.random() > 0.3:
                grid[r, c] = 1.0

    # Physics Constants
    decay_rate = 0.15 
    ignition_base = max(0.1, (100 - params.moisture) / 100.0)
    
    # Wind Vectors
    bias_r, bias_c = 0, 0
    wind_factor = params.windSpeed / 80.0 
    
    if 'N' in params.windDir: bias_r = 1  
    if 'S' in params.windDir: bias_r = -1 
    if 'W' in params.windDir: bias_c = 1  
    if 'E' in params.windDir: bias_c = -1 

    # Run Time Steps
    for _ in range(25): # Increased steps for dramatic effect
        new_grid = grid.copy()
        active_fire = np.where(grid > 0)
        new_grid[active_fire] -= decay_rate
        new_grid[new_grid < 0] = 0 

        burning_cells = np.argwhere(grid > 0.3)
        
        for r, c in burning_cells:
            neighbors = [
                (r-1, c), (r+1, c), (r, c-1), (r, c+1),
                (r-1, c-1), (r-1, c+1), (r+1, c-1), (r+1, c+1)
            ]
            for nr, nc in neighbors:
                if 0 <= nr < grid_size and 0 <= nc < grid_size:
                    if grid[nr, nc] == 0:
                        chance = ignition_base * 0.4
                        # Wind Bias
                        row_diff = nr - r
                        col_diff = nc - c
                        if row_diff == bias_r: chance += (wind_factor * 0.7)
                        if col_diff == bias_c: chance += (wind_factor * 0.7)

                        if random.random() < chance:
                            new_grid[nr, nc] = 1.0 # New fire is hot
        grid = new_grid

    # Export to Mapbox
    center_lat, center_lon = 38.5, -121.5
    scale = 0.008 
    results = []
    active_indices = np.argwhere(grid > 0.05)
    
    for r, c in active_indices:
        lat = center_lat + (r - 50) * scale
        lon = center_lon + (c - 50) * scale
        results.append({"lat": lat, "lon": lon, "intensity": grid[r, c]})
        
    return results

@app.post("/simulate")
async def get_simulation(params: SimParams):
    return {"status": "success", "data": run_simulation(params)}

# --- THE AI BRAIN ---
@app.post("/parse-command")
def parse_agent_command(cmd: TextCommand):
    try:
        # THE PROMPT ENGINEERING
        # We force GPT to return JSON so our code can read it.
        system_prompt = """
        You are an Incident Commander AI for a wildfire simulation. 
        Extract 3 parameters from the user's description:
        1. windSpeed (0-100 mph)
        2. windDir (N, S, E, W, NE, NW, SE, SW)
        3. moisture (0-100%)
        
        Return ONLY valid JSON. No markdown. No chatter.
        Example output: {"windSpeed": 60, "windDir": "NE", "moisture": 5, "response": "Copy that. Simulating Santa Ana winds."}
        """

        completion = client.chat.completions.create(
            model="gpt-4o", # Or "gpt-3.5-turbo" if you want to save credits
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": cmd.prompt}
            ],
            temperature=0.7,
        )

        # Parse the JSON from OpenAI
        raw_content = completion.choices[0].message.content
        ai_data = json.loads(raw_content)

        return {
            "status": "parsed", 
            "params": {
                "windSpeed": ai_data.get("windSpeed", 15), 
                "windDir": ai_data.get("windDir", "N"), 
                "moisture": ai_data.get("moisture", 15)
            },
            "ai_response": ai_data.get("response", "Parameters updated.")
        }

    except Exception as e:
        print(f"OpenAI Error: {e}")
        # Fallback if API fails (so the demo doesn't die)
        return {
            "status": "error",
            "params": {"windSpeed": 10, "windDir": "N", "moisture": 50},
            "ai_response": "Link to AI Core unstable. Switching to manual backup."
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)