# Web Drum Scratchpad & Sequence Lab

This repository now contains two related Web Audio experiments:

- **Web Drum Scratchpad** – the original timing and sound-design playground that lives at the project root (`index.html`, `script.js`, `styles.css`).
- **Sequence Lab** – a user-programmable sequencer stored in [`sequence-lab/`](sequence-lab/) with its own HTML, CSS, and JavaScript bundle.

## Previewing the Web Drum Scratchpad

Serve the repository root with any static file server and open `index.html`:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/index.html
```

## Previewing Sequence Lab

Serve the same root and navigate directly to the new app:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/sequence-lab/sequencer.html
```

Because Sequence Lab lives in its own folder, you can copy `sequence-lab/` into a fresh Git repository without disturbing the original Web Drum Scratchpad files.
