Demo: https://delavnica.kocmut.com/

Delavnica is a static, installable PWA. Its application files are cached for offline use, while selected and generated user files stay local unless the user explicitly saves or shares them through the operating system.

## Development

Install the exactly pinned build dependency once:

```powershell
npm install
```

Rebuild the committed PDF bundle and content-hashed offline precache manifest after changing runtime files:

```powershell
npm run build
```

Run the deterministic build checks and the complete automated test suite:

```powershell
npm test
```

The production site has no runtime package dependency or server component; GitHub Pages serves the committed static files directly.

## Local preview

Run `npm run preview` (or `serve.cmd`) and open `http://127.0.0.1:8765/`. This uses a zero-dependency static server with the same browser loading model and MIME types as GitHub Pages.

To use another port, run `npm run preview -- 8766` or `serve.cmd 8766`. Stop the server with `Ctrl+C`.
