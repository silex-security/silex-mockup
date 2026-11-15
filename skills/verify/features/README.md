# Feature map

What a visitor can do on the SILEX demo console, and the journey that proves each feature. Journeys are in [`../journeys/`](../journeys/) and run with `node skills/verify/scripts/drive.mjs run skills/verify/journeys/<name>.mjs`.

| Feature | File | Journey | Sub-features the journey covers |
|---|---|---|---|
| Console navigation | [console-navigation.md](console-navigation.md) | `console-navigation.mjs` | sidebar, every view, Back |
| Runtime Observation scenarios | [runtime-observation.md](runtime-observation.md) | `runtime-scenario.mjs` | scenario run, allowed and blocked outcomes |
| Agent Gym | [agent-gym.md](agent-gym.md) | `gym-queue.mjs` | experiment queue filter, URL sync, reload |
| Speedrun | [speedrun.md](speedrun.md) | none yet | |
| Enterprise World Model | [world-model.md](world-model.md) | none yet | |

Not mapped yet: Blueprint Studio and the Workflow Library (`#view=blueprint`, `#view=library`), Incidents & Decisions (`#view=incidents`), the home page and its two sub-pages (`#view=assurance`, `#view=product-suite`, `#view=assurance-case`), and the standalone `jev-observability/` page.

A sub-feature listed in a feature file without a journey step is unproven. Add the step to the journey, or write a new journey, before relying on it.
