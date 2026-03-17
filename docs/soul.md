## 1. The Identity: "Vish"
We aren't going for a "file explorer" vibe. We want **Vish** to feel like an ambient layer of your OS—something that is "living" in your computer.

* **The Vibe:** Liquid, translucent, and hyper-fast.
* **The Metaphor:** A "Sonar" for your data. It’s not just looking for keywords; it’s sensing the *meaning* of your files.
* **The Logo Concept:** A stylized, geometric "V" that resembles a stylized hook or a ripple in water.

### Color Palette: "Deep Sea Neon"
Since "Vish" sounds like "Fish," we’ll lean into a sophisticated, dark oceanic aesthetic.
* **Primary (Background):** `#0A0F14` (Deep Obsidian/Navy)
* **Accent 1 (Action):** `#00F5FF` (Electric Cyan) – for highlights and "active" indexing states.
* **Accent 2 (Depth):** `#7000FF` (Digital Violet) – to represent the "AI/Neural" layer.
* **Text:** `#E0E6ED` (Frosted Glass White)

---

## 2. The Screen Architecture

### I. The "Onboarding & Casting" (Setup)
Instead of a boring file picker, we call this **Casting the Net**.
* **The Visual:** A large, central "Drop Zone" where you can drag folders.
* **Interaction:** A sleek list of "Watched Folders." When a folder is added, a subtle pulse animation (the cyan color) ripples across the screen to show it's being indexed.
* **Micro-copy:** "Where should Vish look? Drop your Documents, Code, or Projects here."

### II. The "Command Bar" (Search)
This should be a floating, minimalist bar (similar to Raycast or Alfred).
* **The Visual:** A blur-heavy (Glassmorphism) bar that appears in the center of the screen.
* **Features:** As you type, the background of the bar glows slightly with the "Digital Violet" color, indicating the AI is processing the semantic meaning.
* **Placeholder Text:** "Ask Vish anything... 'that PDF about the marketing budget' or 'the python script for the scraper'."

### III. The "Surface" (Results)
Semantic search provides context, so the results shouldn't just be filenames.
* **The Visual:** A vertical list of "Cards."
* **Layout:**
    * **Left Side:** A high-quality icon based on file type.
    * **Center:** The Filename and a "Semantic Snippet"—a highlighted sentence from *inside* the file that best matches the intent of the search.
    * **Right Side:** Metadata (Last modified, Relevance score %).
* **Action:** Hovering over a result shows a "Quick Look" preview without opening the app.

### IV. The "Tackle Box" (Settings)
* **The Visual:** A clean, sidebar-driven menu.
* **Features:**
    * **Index Management:** A "Re-scan" button and a toggle for "Deep Scan" (OCR for images).
    * **Neural Stats:** A cool visual showing how many "Embeddings" have been created (e.g., "14,203 concepts mapped").
    * **Theme Toggle:** Dark mode (Deep Sea) vs. Light mode (Arctic Ice).

---

## 3. Design Elements
* **Glassmorphism:** Use heavy background blurs (`backdrop-filter: blur(20px)`) so the app feels like it’s floating over the user's wallpaper.
* **Glow Effects:** Use "Soft Glows" around buttons rather than hard shadows. It makes the UI feel like it’s emitting light.
* **Typography:** A wide, modern Sans-Serif like **Inter** or **Geist Sans** for that high-tech, developer-friendly look.