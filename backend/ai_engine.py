import os
import json
import openai
from dotenv import load_dotenv

# Load Env
load_dotenv()
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=OPENAI_KEY)

# --- BRAIN 1: SIMULATION CONTROLLER (Wind, Heat, Location) ---
def get_ai_parameters(user_prompt: str):
    """
    Analyzes natural language to extract simulation parameters AND location.
    """
    
    system_instructions = """
    You are an Incident Command AI. Your job is to configure a wildfire simulation based on natural language.
    
    Output a JSON object with these keys (infer values if not specified):
    - windSpeed (float, 0-100 mph)
    - windDir (str: N, S, E, W, NE, NW, SE, SW)
    - temperature (float, 30-120 F)
    - humidity (float, 0-100 %)
    - moisture (float, 0-100 %)
    - slope (float, 0-45 degrees)
    - duration (int, 2-96 hours)
    - originLat (float, optional): ONLY if a specific location is named.
    - originLon (float, optional): ONLY if a specific location is named.

    LOGIC RULES:
    1. CONTEXT: "Heatwave" = Temp > 100, Hum < 15. "Morning" = Temp < 65, Hum > 60.
    2. LOCATION: If the user names a city/place (e.g. "Dallas", "Central Park"), you MUST output its approximate 'originLat' and 'originLon'. 
    3. COORDINATES: If user gives explicit coords, use them.
    4. DEFAULTS: If input is vague, keep standard defaults (Temp 75, Wind 10, etc).
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        # Parse JSON
        params = json.loads(response.choices[0].message.content)
        
        # Clean up keys
        if 'time' in params: params['duration'] = int(params['time'])
        
        return params

    except Exception as e:
        print(f"AI Sim Error: {e}")
        return {"error": "Failed to parse command"}


# --- BRAIN 2: CONTEXT-AWARE RAG (New & Improved) ---
def analyze_risk_data(user_prompt: str, risk_data: list):
    """
    RAG ENGINE: Takes the full list of risks and the user's question.
    Returns a natural language answer AND a filtered list of IDs to highlight.
    """
    
    # 1. Simplify Data for Token Efficiency
    # We only send what the AI needs to understand the situation.
    context_str = json.dumps([
        {"id": r['id'], "name": r['name'], "type": r['type'], "time": r['timeToImpact']}
        for r in risk_data
    ])

    system_instructions = f"""
    You are the AI Co-Pilot for an Incident Commander.
    
    CONTEXT DATA (Live Impact Report):
    {context_str}
    
    YOUR GOAL:
    Answer the user's question based strictly on the data above.
    
    OUTPUT FORMAT (JSON):
    {{
        "answer": "A natural language summary for the commander (and voice synthesis).",
        "highlight_ids": [123, 456] // List of IDs referenced in your answer (to filter the map).
    }}
    
    RULES:
    1. If the user asks about a specific place ("Rock Prairie"), find it in the list.
    2. If the user asks about time ("Next 2 hours"), check the "time" field.
    3. If nothing matches, say "I don't see that asset in the current risk zone."
    4. Keep answers concise and tactical.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"RAG Error: {e}")
        return {
            "answer": "System malfunction. Unable to analyze risk data.",
            "highlight_ids": []
        }