Demo: https://delavnica.kocmut.com/

Delavnica is a static, installable PWA. Its application files are cached for offline use, while selected and generated user files stay local unless the user explicitly saves or shares them through the operating system.

## Development

Install the exactly pinned development dependencies once:

```powershell
npm install
```

Rebuild the committed HTML, CSS, browser bundles and content-hashed offline precache manifest after source changes:

```powershell
npm run build
```

Run build freshness and processing/controller checks:

```powershell
npm test
```

Install Chromium with `npx playwright install chromium`, then run browser regressions with `npm run test:browser`.

The production site has no runtime package dependency or server component; GitHub Pages serves the checked static files. The pinned esbuild step bundles the UI modules and the lazy PDF controller. PDF scripts execute when the PDF tool is opened; their files and auxiliary assets are still precached for a first PDF visit while offline. Direct `file:` opening retains the classic PDF worker fallback.

## Adding a tool

1. Add display metadata to `assets/js/tool-registry.js`. It supplies navigation, overview cards, document titles, route order, and mobile navigation sizing.
2. Add its `data-panel` partial to `src/html/panels/`, preserving existing markup and CSS conventions.
3. Put processing in DOM-independent functions, either in `toolbox-core.js` or a small focused file when warranted. Wire controls in `src/ui/tools/` or the lazy `assets/js/pdf-merger.mjs` controller.
4. Add behavior tests, then run `npm run build` and `npm test`. Add a manifest shortcut only if the new tool needs an operating-system shortcut; these are intentionally curated separately.

Edit source files, not generated outputs:

- Shell and panels: `src/html/shell.html`, `src/html/panels/*.html`, `src/html/help.mjs` and `src/html/agents.html`.
- Browser UI: `src/ui/bootstrap.mjs`, router, shared helpers, tool controllers and mobile modules.
- Styles: `src/css/*.css`; assembly order is explicit in `scripts/assemble-site.mjs`. Shared, desktop/tablet, mobile/landscape, standalone, mobile standalone, then accessibility/print rules retain the original cascade.
- PDF composition: `assets/js/pdf-composition.mjs`; thumbnail/workspace UI: `assets/js/pdf-merger.mjs`.
- Operations and schemas: `src/operations/`; controller integration and WebMCP: `src/ui/services.mjs`.
- Generated: root/tool/agent HTML, `robots.txt`, `sitemap.xml`, `llms.txt`, `tools.json`, `assets/css/toolbox.css`, `assets/js/toolbox-ui.js`, `assets/js/pdf-merger.js` and `precache-manifest.js`. All are checked by `build:check`.

Workspace baselines exclude intentionally added help below the controls. Full-page original screenshots are retained separately under `tests/browser/baseline-pages/`.
There is no plugin system or runtime framework.

## Correctness references

- Slovenian VAT uses weights 8, 7, 6, 5, 4, 3, 2: `11 - (sum % 11)` maps 10 to 0 and excludes 11. [FURS describes the eight-digit modulo 11 structure](https://www.fu.gov.si/davki_in_druge_dajatve/poslovanje_z_nami/vpis_v_davcni_register_in_davcna_stevilka), but that public page does not detail the edge cases. Those were independently corroborated against the [python-stdnum implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/si/ddv.py), without adding that library. Explicit test vectors include `15012557` (sum 81), `10000020` (sum 12), and exclusion of every checksum for body `1000010` (sum 11).
- EMŠO is unchanged. Its different handling of remainders 0 and 1 agrees with [Article 4 of the official regulation](https://www.uradni-list.si/glasilo-uradni-list-rs/vsebina/1999-01-0345/). Regression tests cover both edges and the published example.
- JSON formatting validates syntax with the native parser, then formats original tokens. It preserves number spellings (including large integers, decimals, exponents, and negative zero), escaped strings, duplicate keys, and array order. Sorting changes only object-key order and retains equally named keys in their original order. Very deeply nested input can exceed the browser call stack; the UI reports the error without emitting partial output.
- Failed PDF thumbnails are terminal until an explicit user rotation requests another attempt. Clearing documents, removing their last page, and rejected imports release the PDF.js loading task (the bundled document proxy has no `destroy()` method).

## GitHub Pages deployment

`.github/workflows/pages.yml` runs `npm ci`, checks committed outputs, builds, runs `npm test`, installs pinned Chromium and runs `npm run test:browser` on pull requests and pushes to `master`. Only a successful check on `master` can upload and deploy the static site. `npm test` includes `build:check`, so stale committed build outputs fail instead of being silently rebuilt for deployment. Only runtime files are staged; tests and `node_modules` are excluded.

**One-time activation:** when publishing this workflow, set repository **Settings → Pages → Build and deployment → Source → GitHub Actions**. The earlier audit recorded GitHub's automatic `pages-build-deployment` branch workflow; live settings must be rechecked before release. Leaving that source enabled would retain a deployment path that bypasses the tests. Keep the existing custom domain and HTTPS settings. See [GitHub's custom Pages workflow instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Local preview

Run `npm run preview` (or `serve.cmd`) and open `http://127.0.0.1:8765/`. This uses a zero-dependency static server with the same browser loading model and MIME types as GitHub Pages.

To use another port, run `npm run preview -- 8766` or `serve.cmd 8766`. Stop the server with `Ctrl+C`.

For browser regressions, open `/tests/mobile-navigation.html` on the preview server and click **Run checks**. The checks use real page layout and touch handlers in portrait, landscape, and tablet-sized iframes, verify registry navigation, and import/render a synthetic local PDF using the actual PDF engines. Use a fresh preview port after runtime edits to avoid testing an older service-worker cache; also check native finger swipes on a mobile device. `npm run test:browser` also runs this harness automatically, plus routing, AI operations, real-file artifacts, reduced-motion/orientation and offline upgrade tests. `npm test` runs the core, controller, discovery and offline-infrastructure regressions. Physical Android Chrome and iOS Safari checks remain a release step.

## Public pages and local agent API

The build emits `/`, `/emso/`, `/davcna-stevilka/`, `/jwt/`, `/json/`, `/sparkasse-csv-qif/`, `/pdf/` and English documentation at `/agents/`. Each tool entry has real HTML, metadata and navigation. The router preserves original hashes and root `file://` opening. Unknown paths remain missing pages.

Read `/agents/` and `/tools.json` for the versioned schemas, limits, examples, error codes, local file lifecycle and bounded artifact reads. `window.DelavnicaAgent.execute(name, input, { signal })` and optional `document.modelContext.registerTool` registrations use the same adapter as manual controls. Runtime dependencies, files and processing remain local. Processing never triggers saving/sharing automatically.

App versions hash generated templates/bundles and runtime sources/assets after newline normalization. The precache separately hashes deployed runtime content. `scripts/stage-site.mjs` uses the precache allowlist to stage the site into a fresh `_site` directory in CI; `src/`, tests, build tooling and selected/generated user files are excluded.

See [implementation stages and release handoff](docs/implementation-stages.md) for verified checks and owner-dependent release steps. The prior-release upgrade fixtures under `tests/fixtures/previous-release/` are intentionally frozen at `5c369f3`; do not rebuild them.
