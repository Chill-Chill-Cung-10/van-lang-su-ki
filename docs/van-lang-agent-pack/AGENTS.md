# AGENTS.md — Văn Lang Sử Ký UI Rules

These rules apply to all coding agents implementing the Văn Lang Sử Ký opening/main-menu experience.

## Non-negotiable rules

1. Treat the screen as a **cinematic game UI**, never as a website landing page.
2. Render the title exactly as `Văn Lang Sử Ký`.
3. Keep the title in the top-center visual region.
4. Include at minimum `Bắt đầu` and `Lựa chọn`.
5. Environment/background art is the dominant layer; UI is restrained.
6. Preserve Vietnamese/Đông Sơn identity.
7. Do not directly copy any commercial game's assets or specific composition.
8. All fonts must support Vietnamese diacritics.
9. Implement idle, hover, focus, selected, and disabled states.
10. Keyboard interaction is mandatory; gamepad navigation must be architecturally supportable.
11. Respect `prefers-reduced-motion`.
12. Do not ship unreadable text over uncontrolled background detail.
13. Mobile must use intentional responsive composition, not simple scaling.
14. No generic SaaS/web UI patterns.
15. Review implementation against the acceptance checklist before marking complete.

## Recommended component architecture

For React:

```txt
<GameMenuScreen>
  <BackgroundScene />
  <AmbientFX />
  <GameTitle />
  <MainMenu>
    <MenuItem />
  </MainMenu>
</GameMenuScreen>
```

Responsibilities:

- `BackgroundScene`: image/video, focal positioning, cinematic overlays.
- `AmbientFX`: fog, particles, banners, birds, parallax.
- `GameTitle`: title, emblem, optional bronze-drum ornament.
- `MainMenu`: navigation state, input mode, focus management.
- `MenuItem`: idle/hover/focus/selected/disabled visual states.

## CSS implementation rules

Use design tokens and custom CSS rather than default component-library visuals.

Background media:

```css
object-fit: cover;
object-position: var(--scene-focal-x, 50%) var(--scene-focal-y, 50%);
```

Required readability treatment:

```css
.scene-overlay {
  background:
    linear-gradient(
      to bottom,
      rgba(7,9,8,.22) 0%,
      rgba(7,9,8,.12) 35%,
      rgba(7,9,8,.62) 100%
    ),
    radial-gradient(
      circle at 50% 45%,
      rgba(0,0,0,0) 25%,
      rgba(0,0,0,.42) 100%
    );
}
```

Title sizing must use responsive sizing such as:

```css
font-size: clamp(64px, 7vw, 136px);
```

Do not hard-code one desktop font size for every viewport.

## Interaction rules

Pointer:
- hover modifies text/ornament only subtly
- no web-style button lift

Keyboard:
- Up/Down changes selection
- Enter confirms
- Escape returns/back when applicable

Gamepad model:
- D-pad / left stick changes selection
- primary action confirms
- secondary action backs out

Focus and selected visuals must not depend on hover.

## Performance rules

- Avoid heavyweight continuous JavaScript animation.
- Prefer CSS transforms/opacity or a lightweight motion library.
- Avoid layout-thrashing animation.
- Lazy-load optional video where appropriate.
- Provide a static fallback background.
- Decorative animation should degrade gracefully on low-power devices.

## Acceptance checklist

Before completion verify:

- [ ] `Văn Lang Sử Ký` is correct and top-centered.
- [ ] `Bắt đầu` and `Lựa chọn` are present.
- [ ] Selected state is immediately legible.
- [ ] Layout reads as a game menu, not a website.
- [ ] Foreground / midground / background depth is visible.
- [ ] At least two clearly Vietnamese/Đông Sơn motifs are present.
- [ ] Vietnamese accents render correctly.
- [ ] Keyboard navigation works.
- [ ] Reduced motion works.
- [ ] Text contrast remains readable.
- [ ] 16:9, 16:10, mobile, and common ultrawide layouts do not break.
- [ ] No horizontal overflow.
- [ ] No copied commercial-game asset or proprietary UI element.
