import os
import json
import openai
from dotenv import load_dotenv

load_dotenv()
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=OPENAI_KEY)

# --- 1. SIMULATION LOGIC (Unchanged) ---
def get_ai_parameters(user_prompt: str):
    system_instructions = """
    You are an Incident Command AI. Configure a wildfire simulation.
    Output JSON keys: windSpeed (0-100), windDir (N/S/E/W...), temperature (30-120), humidity (0-100), moisture (0-100), slope (0-45), duration (2-96), originLat, originLon.
    RULES: If user names a city ("Dallas"), infer originLat/Lon.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system_instructions}, {"role": "user", "content": user_prompt}],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        params = json.loads(response.choices[0].message.content)
        if 'time' in params: params['duration'] = int(params['time'])
        return params
    except Exception as e:
        return {"error": str(e)}

# --- 2. QUERY LOGIC (The Fix: Return Filters) ---
def analyze_query_intent(user_prompt: str):
    """
    Extracts filtering criteria from the user's question.
    """
    system_instructions = """
    You are a Data Query Engine. Convert the user's question into structured filters.
    
    Output JSON keys:
    - min_time (float, default 0)
    - max_time (float, default 999)
    - asset_types (list of strings: 'medical', 'school', 'power', 'response'). Empty = All.
    - name_query (str): Keyword to search for (e.g. "Rock Prairie").
    - ai_reply (str): A short confirmation message (e.g. "Showing hospitals impacted between 2-3 hours.").
    
    Examples:
    "Hospitals in 2-3 hours" -> { "min_time": 2, "max_time": 3, "asset_types": ["medical"], "ai_reply": "Scanning for medical facilities impacted between T+2 and T+3 hours." }
    "Is Rock Prairie safe?" -> { "name_query": "Rock Prairie", "ai_reply": "Checking status of 'Rock Prairie'..." }
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system_instructions}, {"role": "user", "content": user_prompt}],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        return {"ai_reply": "Error parsing query.", "min_time": 0}

# --- 3. THE ROUTER ---
def route_and_process(user_prompt: str, risk_data: list):
    system_instructions = """
    Classify intent with strict priority:

    1. ACTION: Move the ENTIRE simulation to a new city or change environmental constants. 
       Look for: "Go to [City Name]", "Move to [City Name]", "Set wind to 50".
       (Example: "Go to Dallas") -> intent: ACTION
       
    2. QUERY: Ask about data/safety.
    
    Output JSON: { "intent": "ACTION" | "QUERY" }
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system_instructions}, {"role": "user", "content": user_prompt}],
            response_format={"type": "json_object"},
            temperature=0.0
        )
        intent = json.loads(response.choices[0].message.content).get("intent", "QUERY")
        
        if intent == "ACTION":
            params = get_ai_parameters(user_prompt)
            return {"type": "action", "payload": params}
        else:
            # We don't send risk_data anymore, just the prompt
            filters = analyze_query_intent(user_prompt)
            return {"type": "knowledge", "payload": filters}

    except Exception as e:
        return {"type": "error", "message": str(e)}