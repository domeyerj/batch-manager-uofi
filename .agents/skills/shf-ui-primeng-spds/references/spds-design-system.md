# SailPoint Design System (SPDS) & PrimeNG Reference

SailPoint UI Plugins achieve a native look and feel by pairing [PrimeNG](https://primeng.org/) with the SailPoint Design System (SPDS) preset.

## Theme Architecture

The SPDS preset (`src/app/core/spds-prime-theme.ts`) defines design tokens across three levels:
1. **Primitive Tokens**: Base palette (blues, slates, grays, emeralds, ambers, reds).
2. **Semantic Tokens**: Contextual roles (`primary`, `surface`, `formField`, `focusRing`).
3. **Component Tokens**: Overrides for specific PrimeNG controls (Button, InputText, Tag, Card, Table).

### Dark Mode Selector
Dark mode is activated via the `.spds-dark` class on the root element:
```ts
export const SPDS_DARK_MODE_SELECTOR = '.spds-dark';
export const SPDS_THEME_PREFIX = 'spds';
```

---

## Typography Utilities

The theme preset registers global heading rules and utility classes:

| Utility Class | Bold Variant (Default) | Semibold Variant | Standard Element |
| :--- | :--- | :--- | :--- |
| `.spds-h1` | `font-weight: 700; font-size: 2.25rem` | `.spds-h1--semibold` | `<h1>` |
| `.spds-h2` | `font-weight: 700; font-size: 1.875rem` | `.spds-h2--semibold` | `<h2>` |
| `.spds-h3` | `font-weight: 700; font-size: 1.5rem` | `.spds-h3--semibold` | `<h3>` |
| `.spds-h4` | `font-weight: 700; font-size: 1.25rem` | `.spds-h4--semibold` | `<h4>` |
| `.spds-h5` | `font-weight: 700; font-size: 1.125rem` | `.spds-h5--semibold` | `<h5>` |
| `.spds-h6` | `font-weight: 700; font-size: 1rem` | `.spds-h6--semibold` | `<h6>` |

Example:
```html
<h2 class="spds-h4">Sub-section Header</h2>
<p class="spds-h5--semibold">Emphasis Text</p>
```

---

## Iframe CSS Isolation Rules

The plugin executes in an isolated `<iframe>`. Keep in mind:
- **No Style Inheritance**: Styles from the parent App Shell do not bleed into the iframe.
- **Global Styles**: Global fonts, CSS resets, and root variables must be included in `src/styles.scss`.
- **PrimeNG Styles**: PrimeNG injects component styles into the `<head>` of the plugin document at runtime.
- **Relative Asset Paths for Fonts/Images**: Always reference assets using relative paths (`./assets/...`) so CDN hosting functions properly.
