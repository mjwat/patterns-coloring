# Agent Instructions: Pattern-Based Coloring Page Generator

You are an expert Frontend Developer specializing in **HTML5 Canvas** and **Vanilla JavaScript**. 
Your goal is to build a web application that generates geometric patterns for coloring pages.

## Core Technical Stack
- **Languages:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Rendering:** 2D Canvas API.
- **Constraints:** No external frameworks (React/Vue/etc.) or heavy libraries.

## Implementation Requirements

### 1. Canvas Setup & Export
- Implement a dual-canvas system: 
a visible **Preview Canvas** 
and a high-resolution **Export Canvas** (e.g., A4 at 300 DPI: 2480 x 3508 pixels).
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
- Provide input and buttons for:
  - Layers
    - Buttons: Up/Down, Edit, Copy, Show/Hide, Remove.
    - Input: Layer name
- Provide input sliders and selects for:
  - Elements:
    - Select: Shape type (Circle, Square, Rectangle, Oval, Hexagon, Line).
    - Color picker: Color
    - Slider and Input: Page dimensions (Size for Circle, Square and Hexagon, Width/Height for Rectangle, Oval, Length for Line, all in pixels).
    - Slider and Input: Stroke weight (Line thickness) in pixels.
    - Slider and Input: Spacing (Horizontal and Vertical gaps) in pixels.
    - Slider and Input: Rotation in deg.
  - Pattern
    - Radio: Main position (Top-Left, Center).
    - Radio: Pattern type (Grid vs. Brick).
    - Slider and Input: Relative positions (X & Y)
    - Slider and Input: Rotation in deg.

- Elements confings:
  - Size/Width/Height Slider and Input: default = 100 px, min = 1 px, max = 500 px.
  - Weight: default = 4 px,
    - Slider: min = 1 px, max = 20 px.
    - Input: min = 1 px, max = 100 px.
  - Gaps: default = 100 px,
    - Slider: min = -200 px, max = 200 px.
    - Input: min = -400 px, max = 400 px.
      - Shape-Specific Exceptions:
        - Line: Slider and Input: min = 0 px, max = 500 px.
  - Positions: default = 0 px,
    - Slider: min = -200 px, max = 200 px.
    - Input: min = -400 px, max = 400 px.
  - Rotations: default = 0 deg, min = -180 deg, max = 180 deg.

### 5. Pattern Generation Rules
- Global Rules (Applies to all)
  - Layer Limit: Maximum of 5 layers.
  - Grid Step Logic: The distance between elements (Step) must be calculated as Size + Gap.
  - Negative Gaps: If Gap is negative, shapes must overlap.
  - Position Logic: Positive (+) values shift the pattern Left/Up. Negative (-) values shift the pattern Right/Down.
- Shape-Specific Exceptions
  - Line: The "Size" slider controls the length of the line. The "Gap" is the empty space between the end of one line and the start of the next in a row.


### 6. Performance Optimization
- Use `requestAnimationFrame` for rendering to ensure the UI remains responsive during slider adjustments.
- Implement a "Bleed" margin (start drawing at negative coordinates) so shapes on the edges are not cut off abruptly.

## Coding Style Guidelines
- Use clean, modular JavaScript functions (e.g., `drawShape()`, `clearCanvas()`, `generatePattern()`).
- Keep CSS simple and functional (sidebar for controls, main area for canvas).
- All UI text, titles, and comments must be in **English**.