# Choreo Collage

Redesign the Choreo Studio landing page using this brand direction: THE DESKTOP x THE SCRAPBOOK (retro-computer windows + handmade screenprint-zine collage). Keep all existing copy logic, the fee calculator and the signup form.

Tokens: tomato #E5382B, marigold #FFC21A, pool teal #14A38F, title-bar blue #2B3AD6 (window title bars only), black #000, paper #F3ECDD, window grey #C9C5BA. Remove the old #FFE500 and the cream page background. Surfaces are flat saturated colour fields. No gradients, glass, blur or soft shadows.

Fonts: Anton (display, tight line-height), Archivo (body/UI), VT323 (window title bars only).

Windows: 2px black border, no radius, box-shadow 4px 4px 0 #000, flat blue title bar with square control buttons. Buttons: flat fill, 3px hard shadow, move 3px on press.

Hero: full-bleed tomato field. Huge stacked Anton headline "Less chasing. More dancing." with a cut-out photo (white sticker outline, halftone) that crosses the letters. Beside it, a retro window "Choreo Studio" showing the real Arrive screen (student rows with a teal/marigold/tomato tape strip on the left edge plus a status word). Signup form styled as a dialog box. No emoji, no gradients, no "->" in buttons.

Rebuild the rest of the page in this order, each on its own colour field (max 3 colours per section):
1. "It's the 5th. Who paid?" problem section: register vs Choreo collage, marker doodles.
2. How it works as three windows: Arrive, Do, Done (a real sequence). Done shows a chunky segmented teal progress bar "Collecting fees... 40 of 40" and a crooked PAID stamp.
3. Features as pixel desktop icons: Fees, Attendance, Batches, Import.
4. Founding offer as an installer-style window with a progress bar.
5. FAQ styled as readme.txt dialogs.

Vary window size, rotation (max 2 degrees) and colour so it never looks like a grid of identical cards.
Do not highlight single words in headlines. No tracked-out all-caps eyebrow labels.

Add motion sparingly with GSAP ScrollTrigger and CSS only. One page-load moment: a pixel "5, 6, 7, 8" count-in in the hero window title bar, once. "Behind the type": on scroll, the hero cutout moves in front of the headline letters. One transition per section boundary only: a 300-400ms glitch tear (hero to problem) and a clip-path shard wipe (problem to solution). Stamp thud on "Mark paid" in the demo. Honour prefers-reduced-motion by replacing everything with instant changes. The signup form must be usable even if animation or 3D fails.

Signups currently save only to localStorage, so I can't see them. Store every submission (studio name, WhatsApp number, student bucket, estimated amount, timestamp, source, UTM params) in a real database, and add a simple admin view for me. Validate input and rate-limit the form.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/09a1009a-b5e9-44c7-b625-29b3deccba78).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
