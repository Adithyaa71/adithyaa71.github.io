# adithyaa71.github.io

Portfolio of Aditya Ummadi — four open-source systems for AI agents, shown as case studies.

Live at **https://adithyaa71.github.io**

## What's on the page

One pinned scene. A single editor window stays in place while the scroll walks it through
real source files from four repositories, with one card beside it at a time: the measured
number, the trade-off, or the bug that file is about.

| chapter | repo | the file in the window | the card beside it |
|---|---|---|---|
| 01 | [kratos](https://github.com/Adithyaa71/kratos) | `kratos-decide/src/lib.rs` — `fn weakest`, its test; `kratos-shot` thresholds | measured latencies from `docs/benchmarks.md`; mean vs minimum from the test; drift vs threshold |
| 02 | [bluee-harness](https://github.com/Adithyaa71/bluee-harness) | a session log in its real serialised shape; `src/reduce.rs` | one source of truth; why 100k × 384 × f32 needs no vector database |
| 03 | [snarevec](https://github.com/Adithyaa71/snarevec) | a Three.js vector space; `daemon/main.py` | three indexes, one model each; the probe that replaced typed dimensions |
| 04 | [nyx-nvim](https://github.com/Adithyaa71/nyx-nvim) | `mcp/mcp_client.py`; LSP go-to-definition from `act.rs:446` to `lib.rs:83` | the client API; the hop |
| 05 | this repo | [`how-i-work.md`](how-i-work.md) | line counts, tests, crates |

Every code excerpt is cut from the source by line number, not retyped. The one example in the
window that is not from a repo — the session log in chapter 02 — is labelled as an example,
and uses the log's real serialised format.

## How it's built

- Hand-written HTML, CSS and JS. No framework, no build step.
- [GSAP](https://gsap.com) + ScrollTrigger: one timeline, scrubbed by scroll. Scroll back and it rewinds.
- [Lenis](https://lenis.darkroom.engineering) for the wheel.
- [Three.js](https://threejs.org) for the vector space in chapter 03 — rendered only while that chapter is on screen.
- A ~60-line syntax highlighter in `js/story.js` for the Rust, Python, JSON and Markdown in the window.
- `prefers-reduced-motion` and no-JS both get a static version. `?motion=full` overrides the preference for demos.

Animation is transform and opacity only, with two deliberate exceptions noted inline (a CSS
variable on a single highlighted line, and stroke-dashoffset on one underline).

## Run it locally

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Files

| | |
|---|---|
| `index.html` | the page; the story section is generated from the source repos |
| `css/main.css` | every style; tokens at the top |
| `js/app.js` | smooth scroll, nav, reveals, magnetic buttons, tilt, marquee |
| `js/story.js` | the pinned walkthrough and the highlighter |
| `js/space.js` | the Three.js scene |
| `how-i-work.md` | the principles file shown in chapter 05 |
