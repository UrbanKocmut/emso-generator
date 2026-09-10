# Local runtime dependencies

- `pdfjs/`: PDF.js 6.1.200, Apache-2.0. The browser build, worker, CMaps, standard fonts, ICC profile, and WASM decoders are included for local page previews.
- `pdf-lib/`: pdf-lib 1.17.1, MIT. The ESM browser build is included for copying, ordering, rotating, and exporting PDF pages.

Both packages are pinned and served from this repository so documents can be processed without sending their contents to a third party.

- `fflate` 0.8.3, MIT: exactly pinned in package.json and package-lock.json. The build bundles its ZIP code into toolbox-ui.js for offline use and copies its license to `fflate/LICENSE`. No CDN or remote worker is used.
