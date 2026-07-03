# Dwarf Colour Studio

A static web app for customising layered dwarf portrait artwork.

## Run locally

Open `index.html` in a browser, or run:

```bash
python -m http.server
```

Then open `http://localhost:8000`.

## Host on GitHub Pages

1. Create a new GitHub repository.
2. Upload everything inside this folder.
3. Go to **Settings → Pages**.
4. Set source to **Deploy from a branch**.
5. Choose `main` and `/root`.
6. Save, then open the Pages URL GitHub gives you.

## Files

- `index.html` splash, gallery and editor screens
- `styles.css` visual styling
- `app.js` editor/rendering logic
- `app-config.js` portrait set and layer configuration
- `assets/sets/` image layers
- `manifest.json` and `service-worker.js` PWA support
