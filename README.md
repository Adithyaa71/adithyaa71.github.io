# adithyaa71.github.io

Portfolio of Aditya Ummadi, a student in Hyderabad who builds infrastructure for AI agents.

Live at **https://adithyaa71.github.io**

## The scroll

| # | Scene | How it moves |
|---|---|---|
| 1 | **The name** | Each letter is a Matter.js rigid body tied to its slot by a soft spring. Letters fall, bounce and can be flung. Scrolling on tips the floor and they slide out of frame. |
| 2 | **Why** | Three statements, lit word by word as you scroll. |
| 3–6 | **Four films**: [kratos](https://github.com/Adithyaa71/kratos), [bluee-harness](https://github.com/Adithyaa71/bluee-harness), [snarevec](https://github.com/Adithyaa71/snarevec), [nyx-nvim](https://github.com/Adithyaa71/nyx-nvim) | Pre-rendered frame sequences (WebP, 190–240 frames each, with separate landscape and portrait cuts), drawn to a canvas and scrubbed by scroll. Captions are keyed to film frames. |
| 7 | **How I work** | Four principles drop as physical slabs and stack. Each one links to the line of code that enforces it. |
| 8 | **The repos** | A sideways run, pinned to vertical scroll. |
| 9 | **Contact** | A magnetic email link on a spring. |

## The films

Each film is code. [`films/`](films) holds the compositions: one HTML file per film. Every frame is a pure
function of the frame number, rendered headless with Playwright and encoded to WebP with FFmpeg. Values
on screen come from the projects themselves. For example, kratos's 0.99 / 0.61 refusal is the case in
`kratos-decide`'s own unit test (`lib.rs:184`), and nyx's `buf[start - 1 : end]` is `mcp_client.py:139`.
The mail client, the event names and `gate.py` are illustrations.

## Stack

Hand-written HTML, CSS and JS. No build step.
- GSAP + ScrollTrigger and Lenis for the scroll.
- Matter.js for the rigid bodies.
- `js/physics.js` for the springs: a closed-form damped oscillator used as an ease, and a 240 Hz integrator.
- Fonts: Big Shoulders Display and IBM Plex, self-hosted.
