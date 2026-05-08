# Design System Strategy: The Kinetic Pantry

## 1. Overview & Creative North Star
The "Kinetic Pantry" serves as the Creative North Star for this design system. It moves away from the cold, clinical nature of traditional financial dashboards, replacing it with a "High-End Editorial" experience that feels as fresh and vibrant as the snacks it tracks. 

The system is defined by **Dynamic Precision**. We achieve this by leveraging the clean, spacious DNA of elite typography while injecting a high-energy color palette that organizes data through emotion rather than just logic. We break the "template" look by using intentional asymmetry—where a hero budget figure might sit off-center—and overlapping "glass" containers that create a sense of physical space and abundance.

---

## 2. Colors & Surface Logic
The palette is a sophisticated blend of high-energy vibrance and stable neutrals.

*   **Primary (#0846ed):** The "Logistical Anchor." Used for main navigation and core budget actions.
*   **Secondary (#702ae1):** The "Status Purple." Represents premium snack categories or healthy budget cycles.
*   **Tertiary (#9c3f00):** The "Alert Orange." Used for urgent budget warnings or indulgent "treat" categories.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for sectioning. Structural boundaries must be defined through **Background Tonal Shifts**. For example, a main content area using `surface` should contain sections using `surface-container-low`, allowing the eye to perceive edges through color contrast rather than artificial lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers:
1.  **Base Layer:** `surface` (#f9f6f5) – The canvas.
2.  **Section Layer:** `surface-container-low` (#f3f0ef) – Defines broad functional areas.
3.  **Object Layer:** `surface-container-lowest` (#ffffff) – The highest point of focus, like an individual snack card.

### The "Glass & Gradient" Rule
To ensure the dashboard feels premium, floating elements (like modals or hovering budget summaries) must utilize **Glassmorphism**. Use `surface-container-lowest` at 70% opacity with a `24px` backdrop blur. Main CTAs should avoid flat fills in favor of a subtle gradient transitioning from `primary` (#0846ed) to `primary-container` (#859aff) at a 135-degree angle.

---

## 3. Typography
The system uses a dual-font approach to balance editorial authority with functional clarity.

*   **The Editorial Voice (Plus Jakarta Sans):** Used for `display` and `headline` scales. This font’s wider apertures and modern geometry convey a "friendly but professional" tone. Use `display-lg` (3.5rem) for the total remaining budget to make it the undisputed focal point.
*   **The Utility Voice (Inter):** Used for `title`, `body`, and `label` scales. Inter provides the high-readability required for dense data tables and snack nutritional information.

**Visual Hierarchy Tip:** Use `label-md` in all-caps with 5% letter-spacing for category tags (e.g., "FRUIT," "CRUNCHY") to provide an "archival" editorial feel.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** and ambient light simulation, not structural boxes.

*   **The Layering Principle:** Place a `surface-container-lowest` card atop a `surface-container-low` background. The subtle shift from #f3f0ef to #ffffff creates a natural "lift."
*   **Ambient Shadows:** If a card requires a floating state (e.g., on hover), use a shadow with a `40px` blur and `6%` opacity. The shadow color must be a tinted version of `on-surface` (#2f2f2e) to mimic natural light.
*   **The "Ghost Border" Fallback:** If a container sits on a background of the same color, use a "Ghost Border": `outline-variant` (#afadac) at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components

### Buttons
*   **Primary:** `rounded-md` (0.75rem), using the `primary` to `primary-container` gradient. Text is `on-primary` (#f2f1ff).
*   **Secondary:** Ghost-style. No fill, with a `Ghost Border` and `primary` colored text.
*   **Tertiary:** `surface-container-high` fill with `on-surface` text for low-priority actions like "Cancel."

### Chips (Snack Tags)
*   **Style:** `rounded-full` (9999px).
*   **Visuals:** Use `secondary-container` (#dcc9ff) for "Healthy" snacks and `tertiary-container` (#ff9560) for "Budget Warnings." Avoid solid backgrounds; use 20% opacity of the color for a sophisticated, airy feel.

### Cards & Lists
*   **Strict Rule:** No divider lines. Separate items using `8px` to `16px` of vertical whitespace. 
*   **Layout:** Use asymmetrical padding (e.g., `padding-left: 24px`, `padding-right: 16px`) to create a bespoke, non-grid feel that guides the eye.

### Input Fields
*   **State:** Default state uses `surface-container-highest` background with no border. On focus, transition to a `Ghost Border` using the `primary` color.
*   **Typography:** Use `body-md` for user input and `label-sm` for floating labels.

### Budget Progress Bars
*   **Visual Soul:** Instead of a flat bar, use a `primary` to `secondary` gradient for the "filled" portion. The "empty" track should be `surface-container-high` to look recessed into the page.

---

## 6. Do's and Don'ts

### Do:
*   **Do** embrace whitespace. Use the `xl` (1.5rem) roundedness scale for large image containers to make them feel friendly.
*   **Do** use `headline-lg` for section titles to ensure the user always knows where they are in the snack-ordering journey.
*   **Do** use the `on-surface-variant` (#5c5b5b) for secondary data to maintain a clear hierarchy against the bold headers.

### Don't:
*   **Don't** use pure black (#000000) for text. Use `on-background` (#2f2f2e) to keep the "Editorial" softness.
*   **Don't** use standard "Success Green." Rely on the `secondary` purple and `primary` blue palette to signal "Safe/Good" statuses, keeping the system unique.
*   **Don't** use sharp corners. Everything must adhere to the `roundedness` scale, specifically `md` (0.75rem) for cards and `lg` (1.0rem) for hero sections.