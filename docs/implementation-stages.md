# Crawlable tools and local agent operations

Implementation starts from revision `5c369f3`. The existing untracked
`docs/seo-ai-audit.md` is retained as supplied background.

## Stage gates

1. Baseline: pin Playwright, capture the seven existing workspaces at 390×844,
   500×844, 844×390, 768×1024, 1280×720 and 1440×900; automate the existing
   real-PDF and gesture harness and check 639/640/641, 859/860/861 and
   1179/1180/1181 px. Original `npm test`: all 33 Node subtests pass.
2. Structure: HTML partials, focused UI modules, ordered CSS assembly and
   extracted PDF composition. Gate: build, Node tests and unchanged workspace
   screenshots/gesture tests.
3. Routing: generated entry points, one History router, hash/file compatibility,
   root-relative resource resolution and offline page mapping. Gate: direct
   HTML, navigation, history, anchors, retained state and offline checks.
4. Content: Slovenian help, registry metadata, structured data, robots/sitemap,
   English agent documentation and machine-readable discovery. Gate: generated
   output freshness, metadata/link checks and original workspace comparisons.
5. Operations: versioned local adapter shared with controllers, session files,
   bounded artifact reads, cancellation and optional WebMCP registration.
   Gate: all six operations, visible/manual parity, failure/race tests, output
   content checks and complete build/Node/browser suites.

## Completed local validation — 10 September 2026

- Baseline and structural refactor gates passed: `npm run build`, `npm test`
  (33 Node subtests plus toolbox checks), and 52 Playwright tests. No application
  CSS rules changed. Screenshot comparisons cover the visible workspace region;
  full-page capture can alter landscape media queries, so corrected references
  were captured from an isolated copy of the original revision.

- Routing/content gates pass: all seven application entry points return the
  appropriate visible panel before JavaScript; metadata, links and discovery
  documents are checked. History, old hashes, section anchors, modified clicks,
  new tabs, root `file://` navigation and fresh offline deep links are covered.
- Operations gate passes: all six operations share the manual workspace,
  strict versioned schemas and cancellation rules. Tests read actual generated
  QIF/PDF bytes, check page order/rotation, exercise native file selection,
  bounded artifact reads, late cancellation, clearing pending imports and
  second-click PDF sharing. WebMCP absence, registration failures and its
  registration/cancellation contract are tested with browser mocks.
- Final local suite: `npm run build`, `npm test` (40 Node subtests plus toolbox
  checks), and `npm run test:browser` (67 passing tests). Browser runs use the
  pinned Playwright 1.58.2 / Chromium 145 headless engine on Windows.
- Deployment staging was checked against the runtime allowlist: all 248 files
  match their source bytes and no extra files are present. Mobile JSON help
  and desktop agent documentation were also inspected visually.
- Offline tests cover atomic cache installation, failure cleanup, upgrades from
  the frozen `5c369f3` release fixture, explicit update activation and retention
  of unsaved input before activation. Privacy checks inspect network, URLs,
  storage and cache entries for user content.
- The original 42 full-page screenshots remain as evidence; 42 separate
  workspace comparisons gate the controls without treating new help as a
  regression. Nine breakpoint tests and the original mobile/PDF harness also
  pass. Existing CSS blocks preserve their original order and contents; help
  styles are appended separately.

## Release handoff — not performed locally

- Real Android Chrome and iOS Safari require physical-device testing. Emulated
  touch events cannot certify native browser gesture arbitration. Check
  consecutive/reversed/cancelled swipes, navigation during settling, vertical
  scroll arbitration, orientation changes, the information panel, retained PDF
  edits and native saving/sharing on both platforms.
- Run the checked workflow on GitHub's Linux runner; local Windows screenshot
  comparisons do not establish a successful Linux CI run. Also smoke-test
  registration and cancellation in a browser exposing the current native
  `document.modelContext` API; mocked contract tests do not certify that host.
- Before release, verify Pages uses `.github/workflows/pages.yml`, with Source
  set to GitHub Actions, and that its check job gates deployment. Preserve the
  custom domain/HTTPS configuration. The workflow stages only static runtime
  files after build freshness, Node tests and browser regressions pass.
- Search Console requires owner access. Inspect `/` and the six canonical tool
  URLs, submit `/sitemap.xml`, and record indexing status, Google-selected
  canonical, crawl date and query impressions with the reporting date/range.
- After deployment, verify the published canonical URLs, `/agents/`,
  `/tools.json`, `/robots.txt` and `/sitemap.xml`, then install the published
  version and repeat offline deep-link and explicit-update checks.
- No deployment or indexing claim is implied by local implementation checks.

## Browser API reference

The implementation follows the imperative API documentation updated September
1, 2026: https://developer.chrome.com/docs/ai/webmcp/imperative-api . It uses
`document.modelContext.registerTool`, handles execution cancellation via the
second argument's `signal`, and does not grant cross-origin exposure.
