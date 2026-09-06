# Repository rules

- Keep this app static and browser-only. Keep user input and files local; never add remote processing.
- Do not add analytics, telemetry, or frontend frameworks without explicit instruction.
- Prefer native browser APIs, small focused modules, and minimal dependencies over abstractions.
- Keep processing logic independent of the DOM where practical.
- Bundle runtime dependencies locally where practical and preserve installability and offline behavior.
- Preserve the existing UI and URLs unless explicitly asked to redesign them.
- Add regression tests for bugs. Run `npm run build` and `npm test` after runtime changes.
- Do not manually edit generated files (`assets/js/pdf-merger.js` and `precache-manifest.js`); use the build scripts.
