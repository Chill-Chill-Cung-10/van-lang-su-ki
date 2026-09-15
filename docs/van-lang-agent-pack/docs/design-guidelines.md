# Văn Lang Sử Ký — Design Guidelines

## Product intent
Create a premium cinematic opening/main-menu screen for **Văn Lang Sử Ký**, a historical game about Vietnam. The result must feel like a AAA game interface, not a website hero section.

## Visual direction
Keywords: Vietnamese historical epic, Văn Lang, Đông Sơn, bronze, charcoal, mist, mountains, river valley, ancient settlement, Lạc bird, bronze drum, restrained ceremonial UI.

The screen should communicate scale, mystery, historical weight, and immersion.

## Visual hierarchy
1. `Văn Lang Sử Ký`
2. Environment focal point / main character silhouette
3. `Bắt đầu`
4. Secondary menu actions

## Vietnamese identity
Prefer:
- Đông Sơn bronze-drum patterns
- Lạc bird motifs
- ancient boats
- stilt houses
- wooden/earthen fortifications
- northern Vietnamese mountains, rivers, wetlands
- historically plausible materials: wood, bronze, woven fabric, stone

Avoid generic Chinese/Japanese visual shorthand unless historically justified.

## Composition
Target canvas: 1920×1080, 16:9.

- Title: top center, ~8–12vh from top.
- Character silhouette: lower-left or left third.
- Main architecture/environment focal point: center-right or distant center.
- Menu: lower-middle, ~64–72% viewport height.
- Decorative bronze-drum motif: behind title at low opacity.
- Preserve a clear safe area around title and menu.

## Layering
Background art should read in at least four layers:

1. Foreground: rocks, grass, banners, silhouette.
2. Midground: mist, river, boats, village.
3. Focal depth: main gate/citadel/temple.
4. Far background: mountains, clouds, waterfalls/haze.

Use atmospheric perspective, volumetric fog, vignette, subtle grain, restrained bloom.

## Typography
### Main title
Text: `Văn Lang Sử Ký`

Use a display serif or calligraphic-inspired serif that fully supports Vietnamese diacritics.

Recommended desktop sizing:
`font-size: clamp(64px, 7vw, 136px);`
`line-height: .9–1;`

Title material can use restrained bronze/gold treatment with subtle bevel/highlight. Avoid exaggerated fantasy/Gothic typography.

### Menu text
24–32px desktop, serif or humanist serif, medium contrast, modest tracking.

Never ship a font that renders Vietnamese accents incorrectly.

## Color tokens

```css
:root {
  --vl-bg-950: #0d100f;
  --vl-bg-900: #151917;
  --vl-bg-800: #222823;

  --vl-fog-100: #d8d6cb;
  --vl-fog-300: #aaa99f;

  --vl-bronze-700: #6f4e28;
  --vl-bronze-500: #9a6b32;
  --vl-gold-400: #c49a55;
  --vl-gold-300: #d7b875;

  --vl-text-primary: #efe8d8;
  --vl-text-muted: #a8a49a;

  --vl-danger: #8c3f35;
}
```

Use roughly:
- 70% dark neutral/charcoal
- 20% fog/natural tones
- 10% bronze/gold accents

Gold is a focal accent, not a default surface color.

## Main menu
Required:
- `Bắt đầu`
- `Lựa chọn`

Optional:
- `Tiếp tục`
- `Biên niên sử`
- `Thoát`

`Tiếp tục` should only appear when a save exists.

### Selected state
- dark translucent ceremonial plate
- bronze/gold outline
- subtle Đông Sơn corner ornament
- restrained animated shimmer
- stronger text contrast

### Unselected state
- no heavy container
- muted text
- opacity around .65–.8

### Interaction timing
- hover: 180–260ms
- selection: 250–400ms
- screen transition: 600–1200ms

Focus/gamepad selection must be visually equivalent to pointer selection.

## Motion
Idle animation must be subtle:
- fog drift: 20–45s
- low-amplitude banner movement
- title highlight cycle: 6–12s
- parallax: 2–8px
- selected-item shimmer only

Respect `prefers-reduced-motion`.

## Audio direction
Atmosphere may include:
- wind
- river
- distant ceremonial drum
- forest ambience
- subtle bronze percussion

UI sounds should feel physical/ceremonial, not digital.

## Responsive behavior
### Desktop >1280px
Keep full cinematic composition.

### Tablet 768–1279px
Reduce title scale, preserve menu readability, avoid overlap with character.

### Mobile <768px
Do not merely scale down the desktop layout.
- crop around a defined focal point
- allow title to wrap to max 2 lines
- menu width 80–90vw
- touch targets >=48px
- simplify ornament
- adjust silhouette crop intentionally

## Accessibility
- keyboard navigation
- visible focus
- gamepad-ready focus model
- adequate text/background contrast
- no state conveyed only by color
- reduced-motion support
- decorative graphics `aria-hidden=true`

## Anti-patterns
Do not use:
- website navbar
- SaaS cards
- glassmorphism panels
- pills
- dashboard layouts
- neon effects
- generic Tailwind starter appearance
- excessive particles
- modern app iconography

The environment must remain the primary visual layer.

## Originality rule
Do not reproduce layouts, assets, logos, typography, icons, or specific visual compositions from Black Myth: Wukong or any commercial game. High-level inspiration such as cinematic hierarchy, atmosphere, minimal UI, and dramatic lighting is acceptable.
