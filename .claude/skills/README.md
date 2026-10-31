# Project skills

Game-development skills that Claude sessions working on this repo can use. They come from
[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
at commit 19d93f9, under the Apache License 2.0 (see LICENSE-gamedev-skills and NOTICE-gamedev-skills).
They were copied unchanged, except that the OpenAI agent configs (agents/openai.yaml) were left out.

Only engine-neutral skills that fit Pet Farm (a web game in plain JS, CSS and SVG with a simulated
economy and town bots) were taken:

| Skill | Use for |
|---|---|
| game-ui-ux | HUDs, menus, overlays, responsive layout, accessibility |
| game-feel | juice: easing, squash and stretch, feedback (respect prefers-reduced-motion) |
| create-game-assets | art direction, style bible, sprite/icon/background families, provenance |
| performance-optimization | frame budget, profiling, fixing slow screens |
| game-ai | state machines, steering and pathfinding for NPCs and bots |
| ai-behavior-trees-utility-ai | behaviour trees and utility AI (town bot brain) |
| camera-systems | 2D follow camera with deadzone and bounds (park) |
| audio-design | sound and music, if the game gets audio |
| level-design | layout and flow of maps (town map, park) |
| prototype-fast | timeboxed prototypes for new features |

Skipped: the Unity, Unreal, Godot, Ebitengine, Phaser, PixiJS and three.js skills, the genre
templates and the Steam and itch publishing workflows. They do not match this stack.

House rules still win over these skills: no external asset hosts (CSP allows only 'self'), only
original art, Vietnamese UI copy, and every deploy goes through the deploy session.
