# Cinder Control

https://youtu.be/NebNnWuZCJo


https://devpost.com/software/fsim


Cinder Control is a decision-support dashboard that abstracts complex spatial computing into a conversational partner for incident commanders and first responders.

## 🌲 Inspiration
When I was in California when I was little, wildfires were pretty prevalent. I wasn't too aware of what caused them or how they spread, but it feels like every year I've heard another tale of a wildfire demolishing entire cities - and in some cases people aren't even aware they are coming. My hope is that with Cinder Control knowledge and awareness of Wildfires, as well as responding to them, becomes a more intuitive and easy to access process.

## 🔥 What it does
Cinder Control is a dashboard that allows accurate tracking and predictions of how a fire will spread across a certain area, what landmarks will be affected by it, and several tools to help first responders, firefighters, and those in the line of fire help understand what they can do.

* **Conversational Command:** Users are able to set environmental parameters through the dashboard, or through voice. The layout is also mobile friendly for anyone who may need it on the go.
* **HPC Simulation:** Using a Python Cellular Automata Simulation, it predicts the spread of wildfire over windows of up to 96 hours.
* **Infrastructure Ingestion:** The systems figure out what infrastructure nearby will be "ingested" by the fire, and create warnings of the estimated time that will happen.
* **Logistics & Routing:** The system can help plan routes between these points to help evacuation or first responder efforts.

## 🏗️ How we built it
The main webapp was built on a Next.js framework, using React and Typescript. Gemini was leveraged to create some of the stylistic choices for the UI.

The backend consists of a FastAPI endpoint runnin with Python, as well as OpenAI to parse natural language input. Python also used a parallelized cellular automata model, basically creating cells for the fire to spread using certain conditions.

Responses are created with OpenAI as well with ElevenLabs narration.

Additional APIs leveraged were Mapbox, Overpass OpenStreetMap, and NOAA NWS.

## 🚀 Getting Started

To run Cinder Control locally, you will need to start both the Python backend and the Next.js frontend.

### Prerequisites
* Node.js (v18+)
* Python (3.9+)
* A Mapbox Public Token

### 1. Backend Setup (Python)
Navigate to your backend directory and install the necessary dependencies:
```bash
# Install dependencies
pip install fastapi uvicorn numpy scipy pydantic openai python-dotenv

# Start the server (defaulting to port 8000)
uvicorn main:app --reload
```

Navigate to the root directory and install the UI components:

```
npm install

# Create a .env.local file in the root and add your token:
# NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here

# Run the development server
npm run dev
```

The application will be available at http://localhost:3000

