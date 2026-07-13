# Cinder Control

[![Watch the demo](https://img.youtube.com/vi/NebNnWuZCJo/maxresdefault.jpg)](https://youtu.be/NebNnWuZCJo)

**[Watch the demo](https://youtu.be/NebNnWuZCJo)** · **[Devpost writeup](https://devpost.com/software/fsim)**

Cinder Control turns wildfire response into a conversation. Instead of static maps and spreadsheets, it gives incident commanders and first responders a live dashboard that predicts where a fire is heading, what it's about to hit, and how to get people out of the way — all through voice or text.

Built solo in 36 hours at TAMUHack 2026. Took 2nd place and Best Solo Project.

## Why I built this

I grew up around wildfire season in California. As a kid I never understood how fast these things moved or why people sometimes didn't see them coming until it was too late. That stuck with me. Cinder Control is my attempt at making the tools that track and respond to wildfires feel less like specialized GIS software and more like something anyone in an emergency operations center could pick up and use in the first five minutes.

## What it does

- **Conversational control** — set fire parameters and query the system by typing or by voice, on desktop or mobile.
- **Fire spread simulation** — a parallelized cellular automata model in Python projects wildfire spread up to 96 hours out.
- **Infrastructure risk detection** — cross-references the simulation against real infrastructure data to flag what's in the fire's path and roughly when it'll get there.
- **Evacuation routing** — generates evacuation and access routes around the predicted burn area.

## How it's built

The frontend is Next.js, React, and TypeScript, with Gemini used to help shape some of the UI's visual language. The backend is a FastAPI service in Python running the cellular automata spread model, with OpenAI handling natural language parsing so the dashboard can be driven conversationally. Voice responses are synthesized with OpenAI and narrated through ElevenLabs. Mapping and geospatial context come from Mapbox, OpenStreetMap (via Overpass), and NOAA's National Weather Service API.

## Running it locally

You'll need Node 18+, Python 3.9+, and a Mapbox public token.

**Backend**
```bash
pip install fastapi uvicorn numpy scipy pydantic openai python-dotenv
uvicorn main:app --reload
```

**Frontend**
```bash
npm install
# add NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here to .env.local
npm run dev
```

The app runs at `http://localhost:3000`.
