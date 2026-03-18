# Agent Instructions: Pattern-Based Coloring Page Generator

You are an expert Frontend Developer specializing in **HTML5 Canvas** and **Vanilla JavaScript**. Your goal is to build a web application that generates geometric patterns for coloring pages.

## Core Technical Stack
- **Languages:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Rendering:** 2D Canvas API.
- **Constraints:** No external frameworks (React/Vue/etc.) or heavy libraries.

## Implementation Requirements

### 1. Canvas Setup & Export
- Implement a dual-canvas system: a visible **Preview Canvas** and a high-resolution **Export Canvas** (e.g., A4 at 300 DPI: 2480 x 3508 pixels).
- Functionality to download the canvas as a `.png` or `.jpg` file using `canvas.toDataURL()`.

### 2. Geometry Engine
- **Shapes:** Create drawing functions for:
  - **Circle:** `context.arc()`
  - **Square:** `context.rect()`
  - **Polygon:** A generic function to draw N-sided shapes.
- **Styling:** Support dynamic `lineWidth` (stroke thickness) and no-fill (outline only).

### 3. Pattern Logic (Nested Loops)
- **Grid Layout:** Basic $X/Y$ iteration.
- **Brick Layout:** Offset every even row by $StepX / 2$.
- **Transformations:** - Apply `context.translate()` to the center of each cell before drawing the shape.
  - Apply `context.rotate(angle * Math.PI / 180)` for global element rotation.

### 4. UI Controls
- Provide input sliders and selects for:
  - Page dimensions (Width/Height in pixels).
  - Shape type (Circle, Square, Triangle, Hexagon).
  - Pattern type (Grid vs. Brick).
  - Spacing (Horizontal and Vertical gaps).
  - Stroke weight (Line thickness).
  - Rotation angle (0-360).

### 5. Performance Optimization
- Use `requestAnimationFrame` for rendering to ensure the UI remains responsive during slider adjustments.
- Implement a "Bleed" margin (start drawing at negative coordinates) so shapes on the edges are not cut off abruptly.

## Coding Style Guidelines
- Use clean, modular JavaScript functions (e.g., `drawShape()`, `clearCanvas()`, `generatePattern()`).
- Keep CSS simple and functional (sidebar for controls, main area for canvas).
- All UI text, titles, and comments must be in **English**.