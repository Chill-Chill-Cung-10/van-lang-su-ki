# SKILL.md — van-lang-main-menu

## Purpose
Use this skill whenever implementing or revising the opening screen, title screen, save-selection screen, or main menu for **Văn Lang Sử Ký**.

## Required context
Before coding, read:
1. `docs/design-guidelines.md`
2. `AGENTS.md`

These files are authoritative for visual language and implementation constraints.

## Workflow

### Step 1 — Classify the task
Treat the requested feature as game UI.

Never begin from a generic landing-page template.

### Step 2 — Establish scene hierarchy
Identify:
- title zone
- environment focal point
- foreground silhouette
- menu zone
- safe areas
- responsive focal point

### Step 3 — Build structural layers
Implement in this order:
1. background media
2. cinematic overlays
3. environmental/ambient FX
4. title
5. menu
6. interaction states
7. responsive adaptations
8. accessibility/reduced motion

### Step 4 — Preserve Vietnamese identity
Check the screen for at least two explicit, coherent visual cues from Vietnamese/Đông Sơn culture.

If the scene reads as generic East Asian fantasy, revise it.

### Step 5 — Implement input states
Each menu action must support:
- idle
- hover
- focused
- selected
- disabled

Pointer hover cannot be the only discoverable state.

### Step 6 — Responsive composition
Do not scale everything uniformly.

For each breakpoint, explicitly tune:
- background focal position
- title size/position
- menu position
- ornament density
- foreground crop

### Step 7 — Motion pass
Add only motion that increases atmosphere or communicates interaction.

Remove any animation that competes with the title or selected menu action.

### Step 8 — Final review
Run the acceptance checklist from `AGENTS.md`.

Do not mark the feature complete while any mandatory item fails.

## Coding-agent prompt

Build the opening/main-menu screen for **Văn Lang Sử Ký**, a cinematic historical game about Vietnam. This is a AAA-style game interface, not a website hero section. The environment should dominate the composition while UI remains restrained and ceremonial. Use a distinctly Vietnamese/Đông Sơn visual language—bronze, charcoal, mist, river valleys, Lạc-bird or bronze-drum motifs—without falling into generic East Asian fantasy clichés.

Place `Văn Lang Sử Ký` at the top center. Place the main menu in the lower-middle region. Include at minimum `Bắt đầu` and `Lựa chọn`. Implement proper idle, hover, focus, selected, and disabled states. Use cinematic overlays, responsive focal cropping, subtle ambient motion, Vietnamese-safe typography, keyboard navigation, reduced-motion handling, and an architecture that can support gamepad navigation.

Do not reproduce any existing commercial game's exact layout, assets, icons, logo treatment, typography, or composition.

## Definition of done
The result should be believable as the first screen of a premium Vietnamese historical action-adventure game.

If it resembles a website hero section, generic fantasy menu, mobile app, dashboard, or direct imitation of another commercial game, it is not done.
