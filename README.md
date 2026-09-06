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

The production site has no runtime package dependency or server component; GitHub Pages serves the checked static files. The existing esbuild step remains responsible only for the PDF bundle. PDF scripts execute when the PDF tool is opened; their files and auxiliary assets are still precached for a first PDF visit while offline. Direct `file:` opening retains the classic PDF worker fallback.

## Adding a tool

1. Add display metadata to `assets/js/tool-registry.js`. It supplies navigation, overview cards, document titles, route order, and mobile navigation sizing.
2. Add its `data-panel` section to `index.html`, preserving the existing markup and CSS conventions.
3. Put processing in DOM-independent functions, either in `toolbox-core.js` or a small focused file when warranted. Wire controls in `toolbox-ui.js` or a dedicated controller, as the PDF tool does.
4. Add behavior tests, then run `npm run build` and `npm test`. Add a manifest shortcut only if the new tool needs an operating-system shortcut; these are intentionally curated separately.

Existing processing modules have not been moved just to impose a directory layout. There is no plugin system or runtime framework.

## Correctness references

- Slovenian VAT uses weights 8, 7, 6, 5, 4, 3, 2: `11 - (sum % 11)` maps 10 to 0 and excludes 11. [FURS describes the eight-digit modulo 11 structure](https://www.fu.gov.si/davki_in_druge_dajatve/poslovanje_z_nami/vpis_v_davcni_register_in_davcna_stevilka), but that public page does not detail the edge cases. Those were independently corroborated against the [python-stdnum implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/si/ddv.py), without adding that library. Explicit test vectors include `15012557` (sum 81), `10000020` (sum 12), and exclusion of every checksum for body `1000010` (sum 11).
- EMŠO is unchanged. Its different handling of remainders 0 and 1 agrees with [Article 4 of the official regulation](https://www.uradni-list.si/glasilo-uradni-list-rs/vsebina/1999-01-0345/). Regression tests cover both edges and the published example.
- JSON formatting validates syntax with the native parser, then formats original tokens. It preserves number spellings (including large integers, decimals, exponents, and negative zero), escaped strings, duplicate keys, and array order. Sorting changes only object-key order and retains equally named keys in their original order. Very deeply nested input can exceed the browser call stack; the UI reports the error without emitting partial output.
- Failed PDF thumbnails are terminal until an explicit user rotation requests another attempt. Clearing documents, removing their last page, and rejected imports release the PDF.js loading task (the bundled document proxy has no `destroy()` method).

## GitHub Pages deployment

`.github/workflows/pages.yml` runs `npm ci` and `npm test` on pull requests and pushes to `master`. Only a successful check on `master` can upload and deploy the static site. `npm test` includes `build:check`, so stale committed build outputs fail instead of being silently rebuilt for deployment. Only runtime files are staged; tests and `node_modules` are excluded.

**One-time activation:** when publishing this workflow, set repository **Settings → Pages → Build and deployment → Source → GitHub Actions**. The repository was using GitHub's automatic `pages-build-deployment` branch workflow during this review. Leaving that source enabled would retain a deployment path that bypasses the tests. Keep the existing custom domain and HTTPS settings. See [GitHub's custom Pages workflow instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Local preview

Run `npm run preview` (or `serve.cmd`) and open `http://127.0.0.1:8765/`. This uses a zero-dependency static server with the same browser loading model and MIME types as GitHub Pages.

To use another port, run `npm run preview -- 8766` or `serve.cmd 8766`. Stop the server with `Ctrl+C`.

For browser regressions, open `/tests/mobile-navigation.html` on the preview server and click **Run checks**. The checks use real page layout and touch handlers in portrait, landscape, and tablet-sized iframes, verify registry navigation, and import/render a synthetic local PDF using the actual PDF engines. Use a fresh preview port after runtime edits to avoid testing an older service-worker cache; also check native finger swipes on a mobile device. These browser checks are manual; `npm test` runs the automated core, controller, and offline-infrastructure regressions.
