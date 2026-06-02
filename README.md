# TerraTwin

*A civic simulation and visualization platform for bamboo agroforestry*

---

## What Was Built

TerraTwin is a browser-based application with four technically interesting components. This document covers both the engineering and the product reasoning behind it.

### 1. A navigable 3D tile map engine

The NASA/Cesium tile renderer ([3d-tiles-renderer](https://github.com/NASA-AMAC/3DTilesRendererJS)) is a powerful library but ships without user navigation controls. This project adds a full control layer: **OrbitControls** for close-in ground-level views of individual plots, and **GlobeControls** for planetary-scale orbiting — with properly configured near/far clip planes, distance clamping, and damping so the transition between zoom levels feels natural rather than jittery. Getting the camera math right across twelve orders of magnitude of scale (from a 500m plot boundary up to a 160,000km orbital view) required careful tuning of the projection parameters.

The result is a globe you can fly around, zoom smoothly into a specific hillside in Mindanao, and then inspect individual bamboo plot locations as georeferenced markers in a satellite terrain context.

### 2. Shader-based terrain carving

A more unusual feature: the map can be configured to **clip the terrain to an arbitrary polygon**, rendering only the tiles inside a user-defined boundary and discarding everything outside it. This is done entirely in the GPU via a custom GLSL fragment shader that performs a ray-casting point-in-polygon test in world space:

```glsl
bool isPointInPolygon(vec2 p) {
  bool inside = false;
  for (int i = 0, j = numPoints - 1; i < numPoints; j = i++) {
    vec2 pi = boundaryPoints[i];
    vec2 pj = boundaryPoints[j];
    if ((pi.y > p.y) != (pj.y > p.y) &&
        p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y) + pi.x)
      inside = !inside;
  }
  return inside;
}
```

Tiles outside the polygon are discarded at the fragment stage. The boundary points are passed in as a uniform array. The effect is that any arbitrary parcel of the Earth can be carved out on demand, showing real DEM terrain and satellite imagery, with clean edges at the boundary walls.

This technique descends from an earlier project, [aterrain](https://github.com/anselm/aterrain), which explored on-demand terrain carving for WebGL. That work was covered in [Mozilla Hacks](https://hacks.mozilla.org) and demonstrated that it was possible to take an arbitrary geographic region, pull the elevation and imagery tiles, and render it as a self-contained 3D object inside a browser.

### 3. An agent-based crop growth simulation

The simulation core uses [Orbital Foundation](https://orbital.foundation), a framework for agent-based environmental modeling. The bamboo growth model runs at one simulation step per day over a 20-year horizon and incorporates:

- Soil conditions (nitrogen, microbial mass, earthworm density, salinity, pH, fertility)
- Climate variables (rainfall, elevation, slope and aspect)
- Pest load (bamboo borer, aphids, fungal pathogens)
- Intervention choices (weeding, mulching, fertilization, pest control)
- Intercropping strategies (legumes, herbs, specialty crops, animals)
- Harvest schedule (years to first harvest, annual harvest rate)

The output tracks biomass accumulation, carbon sequestration, harvest yield, economic return, and ecosystem health indicators over the full simulation period. The model is designed to be sensitive to the combinations of variables in ways a spreadsheet formula would miss — soil feedback loops, the compounding benefit of legume intercropping on nitrogen over multi-year cycles, the interaction between pest load and intervention timing.

### 4. A storytelling interface

The application is designed to be run in front of an audience. A built-in story mode steps through a narrated walkthrough — navigating between pages, scrolling to relevant components, and speaking each caption aloud. In server mode, narration uses OpenAI TTS; in local/static mode it uses the browser's built-in `speechSynthesis` API. The story is designed to turn a technically complex tool into a five-minute demo that a farmer cooperative or development organization can follow.

---

## Product Context

### Earth modeling as an emerging discipline

We are at an early point in the development of what might be called **earth modeling** — the capability to build predictive simulations of bioregional systems. The infrastructure for this is beginning to materialize:

- **Data**: A generation of Earth observing satellites has produced extraordinary freely available datasets — MODIS spectral imagery, USGS elevation data, EUMETSAT weather simulations, gravity maps from GOCE, reef coverage from Allen Coral Atlas, biome maps from OneEarth. The raw material exists.

- **Semantic extraction**: Deep learning models are now being applied to satellite imagery for feature detection — identifying road incursions into protected forest, mapping crop coverage, detecting water turbidity changes. See for example [Earth Index](https://www.earthgenome.org/earth-index).

- **Gaps**: What's still missing is coherent multi-layer simulation (most models address one phenomenon at a time), temporal relationship discovery across system layers, and accessible tooling for non-expert stakeholders. A city council or farmer cooperative wanting to evaluate a policy option — say, changing buffer zones between farms and a local river — typically can't run that scenario themselves.

### The verification problem

The commercialization of ecological work runs through MRV: Measurement, Reporting, and Verification. Buyers of carbon credits, biodiversity credits, or the emerging class of **resilience credits** want verified evidence of impact over time. Organizations like [NatureMetrics](https://www.naturemetrics.com/), [the Science Based Targets Network](https://sciencebasedtargetsnetwork.org/), [the NatureTech Collective](https://www.naturetechcollective.org/), and [Earthly](https://earthly.org/) are building the plumbing for this.

The framing of "resilience credits" is worth unpacking. Conventional ecological valuation rewards *preservation of what exists* — don't cut the trees, don't drain the wetland. A more useful frame, argued by practitioners including Ben Ceverny, is to reward *preservation of the capacity to change*. Natural systems are not static; they have always changed. What matters for long-term ecosystem health is maintaining the adaptive capacity — the redundancy, the genetic diversity, the functional variety — that allows ecosystems to recover from shocks. A framework that rewards resilience rather than stasis leads to better incentives.

Bamboo farming sits at an interesting edge of this. Commercial *Dendrocalamus asper* monocultures are straightforwardly a carbon and timber play — they don't qualify for biodiversity or resilience credits. But protecting *native bamboo forests*, where bamboo is part of a diverse ecosystem, is a different matter. TerraTwin doesn't conflate these; the current tool addresses commercial agroforestry economics.

### Why bamboo

Compared to timber trees: bamboo reaches harvestable maturity in three to five years rather than twenty to thirty. It regenerates from the root system after harvest without replanting. Per-hectare carbon sequestration is competitive with fast-growing hardwoods. The harvesting is labor-intensive, which creates rural employment in communities where alternatives are scarce. The applications — construction materials, textiles, bamboo shoots, bioenergy, composites — span multiple markets.

The carbon math for a bamboo farm is also simpler to verify than native forest restoration, which makes it more tractable for smallholders entering credit markets for the first time.

### What exists, what's planned

**Today:** A demonstration and forecasting tool. Farmers register plots, set parameters, run growth simulations, and share a visual presentation with funders or cooperatives. The static demo runs entirely in the browser with no server required; a PostgreSQL backend exists for production use.

**Near term:** Real data integration — automatic parameter estimation from regional satellite/DEM sources, MRV-compatible export formats for credit registry submission.

**Later:** Early tokenization of carbon credits at planting time based on forecast yield, with periodic reissuance tied to verified measurements. A ledger suited to conditional logic — releasing the next credit tranche when a verified biomass threshold is met — is more tractable with an intent-based system like [Anoma](https://anoma.net/) than with conventional smart contracts.

**Eventually:** Portfolio aggregation for regional cooperatives managing dozens of smallholder plots — aggregate risk modeling, consolidated MRV reporting, and the full digital twin loop where the simulation is continuously updated from field sensor data.

---

## Running

### Static demo (no server required)

```bash
npm install
npm run dev:local
```

The globe requires a free [Cesium ion](https://ion.cesium.com) access token:

```
echo "VITE_CESIUM_KEY=your_token_here" > .env.local
npm run dev:local
```

The AI chat works in demo mode without a key; for live responses paste a free [Groq API key](https://console.groq.com) into the key icon in the chat header.

### Server mode (with database, OpenAI TTS, and persistent storage)

```bash
export DATABASE_URL="postgresql://..."
export OPENAI_API_KEY="sk-..."
export CESIUM_KEY="..."
npm run dev
```

### GitHub Pages

Push to `main`. The workflow in [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) builds the static bundle and deploys automatically. Add `VITE_CESIUM_KEY` as a repository secret to enable the map on the live demo.

---

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- **3D/Map**: Three.js, 3D Tiles Renderer, Cesium ion, NASA/USGS tile sources
- **Shader pipeline**: Custom GLSL polygon-clipping shaders for terrain carving
- **Simulation**: [Orbital Foundation](https://orbital.foundation) (agent-based environmental modeling)
- **Backend** (optional): Express, PostgreSQL via Neon, Drizzle ORM
- **AI** (optional): OpenAI GPT + TTS (server mode) / Groq Llama + Web Speech API (browser mode)
