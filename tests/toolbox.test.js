"use strict";

const assert = require("node:assert/strict");
const nodeCrypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: nodeCrypto.webcrypto
    });
}

const core = require("../assets/js/toolbox-core.js");

function seededRandom(seed) {
    let state = seed >>> 0;
    return function (maximum) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state % maximum;
    };
}

function base64Url(value) {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
    return buffer.toString("base64url");
}

function encodedJwt(header, payload, signature) {
    return base64Url(JSON.stringify(header)) + "." + base64Url(JSON.stringify(payload)) + "." + base64Url(signature || Buffer.alloc(0));
}

async function run() {
    const projectRoot = path.resolve(__dirname, "..");
    const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
    const uiScript = fs.readFileSync(path.join(projectRoot, "assets/js/toolbox-ui.js"), "utf8");
    const toolboxCss = fs.readFileSync(path.join(projectRoot, "assets/css/toolbox.css"), "utf8");
    const privacyHtml = fs.readFileSync(path.join(projectRoot, "zasebnost.html"), "utf8");
    const pdfScript = fs.readFileSync(path.join(projectRoot, "assets/js/pdf-merger.mjs"), "utf8");
    const pdfBundle = fs.readFileSync(path.join(projectRoot, "assets/js/pdf-merger.js"), "utf8");
    const fileOutputScript = fs.readFileSync(path.join(projectRoot, "assets/js/file-output.js"), "utf8");
    const localServer = fs.readFileSync(path.join(projectRoot, "scripts/serve.mjs"), "utf8");
    const gitignore = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    const tools = require("../assets/js/tool-registry.js");
    const pdfCore = await import(pathToFileURL(path.join(projectRoot, "assets/js/pdf-merger-core.mjs")).href);

    assert.match(indexHtml, /<title>Delavnica<\/title>/);
    assert.match(indexHtml, />U\/<\/span>[\s\S]*?>DELAVNICA<\/span>/);
    assert.match(indexHtml, /class="tool-nav-link mobile-home-link"[^>]+href="#overview"[^>]+data-route="overview"/);
    assert.doesNotMatch(indexHtml, /LOKALNA OBDELAVA/);
    assert.doesNotMatch(privacyHtml, /LOKALNA OBDELAVA/);
    assert.doesNotMatch(indexHtml, /ODPRI PRVO ORODJE/);
    assert.match(indexHtml, /id="pwa-header-action" class="button pwa-action pwa-header-action"/);
    assert.match(indexHtml, /class="install-tip" data-pwa-surface hidden/);
    assert.match(indexHtml, /class="install-tip-name">Delavnico<\/strong>/);
    assert.match(indexHtml, /Dodajte <strong class="install-tip-name">Delavnico<\/strong> na začetni zaslon za delo brez povezave/);
    assert.match(indexHtml, /class="install-tip-heading">[\s\S]*?<span>NAMIG<\/span>/);
    assert.match(indexHtml, /id="pwa-overview-action"[^>]+data-pwa-install-label="NAMESTI"/);
    assert.match(indexHtml, /id="mobile-info-hint" class="mobile-info-hint"[^>]+aria-controls="mobile-info-rail"/);
    assert.match(indexHtml, /id="mobile-info-rail"[^>]+aria-hidden="true" inert/);
    assert.match(indexHtml, /class="mobile-info-rail-content">[\s\S]*?>ZASEBNOST<\/a>[\s\S]*?>IZVORNA KODA ↗<\/a>[\s\S]*?class="mobile-info-author">DELAVNICA \/ URBAN KOCMUT<\/span>/);
    assert.match(indexHtml, /class="site-footer landing-footer"/);
    assert.match(privacyHtml, /id="pwa-header-action" class="button pwa-action pwa-header-action"/);
    assert.match(privacyHtml, /class="policy-back-button" href="index\.html#overview" aria-label="Nazaj v Delavnico"/);
    assert.doesNotMatch(indexHtml, /BREZ NALAGANJA|warning-box/);
    assert.match(indexHtml, /<h1 id="jwt-title">Preverjanje JWT<\/h1>/);
    assert.match(indexHtml, /<h1 id="json-title">Formatiranje JSON<\/h1>/);
    assert.match(indexHtml, /id="qif-remember-settings"/);
    assert.equal(tools.find((tool) => tool.id === "qif").name, "CSV/QIF");
    assert.doesNotMatch(indexHtml, /<strong>CSV → QIF<\/strong>/);
    assert.match(indexHtml, /id="emso-date-clear"[^>]+disabled>POČISTI/);
    assert.match(indexHtml, /<h1 id="pdf-title">Združevanje <span class="pdf-title-word">PDF-jev<\/span><\/h1>/);
    assert.match(indexHtml, /id="pdf-file"[^>]+accept="\.pdf,application\/pdf"[^>]+multiple/);
    assert.match(indexHtml, /id="pdf-pages"[^>]+aria-label="Strani novega dokumenta"/);
    assert.match(indexHtml, /id="qif-download"[^>]+disabled>SHRANI QIF/);
    assert.match(indexHtml, /id="pdf-download"[^>]+disabled>USTVARI IN SHRANI PDF/);
    assert.match(indexHtml, /defer src="assets\/js\/pdf-loader\.js"/);
    assert.doesNotMatch(indexHtml, /<script[^>]+src="assets\/(?:vendor\/pdfjs\/pdf\.worker\.classic|js\/pdf-merger)\.js"/);
    assert.doesNotMatch(indexHtml, /type="module" src="assets\/js\/pdf-merger/);
    assert.match(indexHtml, /href="zasebnost\.html"/);
    assert.match(uiScript, /delavnica\.qif\.settings\.v1/);
    assert.match(uiScript, /localStorage\.setItem/);
    assert.match(uiScript, /localStorage\.removeItem/);
    assert.deepEqual(tools.map((tool) => tool.id), ["emso", "vat", "jwt", "json", "qif", "pdf"]);
    assert.equal(new Set(tools.map((tool) => tool.id)).size, tools.length);
    for (const tool of tools) {
        assert.ok(indexHtml.includes('data-panel="' + tool.id + '"'), "Every registered tool needs a panel");
        assert.ok(tool.title && tool.name && tool.description);
    }
    assert.match(uiScript, /addEventListener\("touchstart"/);
    assert.match(uiScript, /addEventListener\("touchmove"/);
    assert.match(uiScript, /addEventListener\("touchend"/);
    assert.match(uiScript, /window\.innerHeight <= 500/);
    assert.match(uiScript, /targetPanel\.style\.top = gesture\.scrollY \+ "px"/);
    assert.match(uiScript, /scrollToTopInstantly\(\)/);
    assert.match(uiScript, /function initMobileInfoRail\(\)/);
    assert.match(uiScript, /window\.innerWidth <= 640 && window\.innerWidth <= window\.innerHeight/);
    assert.match(uiScript, /document\.body\.classList\.toggle\("is-mobile-info-open"/);
    assert.match(uiScript, /overviewPanel\.style\.transform = "translate3d\(" \+ progress/);
    // Rail drag bounds are checked against the actual logo geometry in mobile-navigation.browser.js.
    assert.match(uiScript, /addEventListener\("pageshow"[\s\S]*?event\.persisted/);
    assert.match(uiScript, /rail\.addEventListener\("click"[\s\S]*?event\.target\.closest\("a"\)/);
    assert.match(uiScript, /dateInput\.disabled = adultOnly/);
    assert.match(uiScript, /dateInput\.value = ""/);
    assert.doesNotMatch(uiScript, /closest\("a, button, input, select, textarea/);
    assert.match(toolboxCss, /\.sidebar\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;[\s\S]*?border-bottom:\s*var\(--line\);/);
    assert.match(toolboxCss, /@media \(max-width: 640px\)[\s\S]*?\.tool-nav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(var\(--tool-route-count, 7\), minmax\(0, 1fr\)\);/);
    assert.match(toolboxCss, /\.mobile-home-link\s*\{[\s\S]*?display:\s*flex;[\s\S]*?aspect-ratio:\s*auto;/);
    assert.match(toolboxCss, /@media \(orientation: landscape\) and \(max-height: 500px\) and \(pointer: coarse\)/);
    assert.match(toolboxCss, /@media \(orientation: landscape\) and \(max-width: 640px\),[\s\S]*?\.mobile-info-hint,[\s\S]*?\.mobile-info-rail\s*\{\s*display:\s*none;/);
    assert.match(toolboxCss, /grid-template-rows:\s*calc\(100vw \/ var\(--tool-route-count, 7\)\);/);
    assert.match(toolboxCss, /grid-template-columns:\s*calc\(\(100dvh \/ var\(--tool-route-count, 7\)\) \+ var\(--line-width\)\) minmax\(0, 1fr\);/);
    assert.match(toolboxCss, /\.site-footer\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?font-size:\s*clamp\(7px, 2vw, 9px\);/);
    assert.match(toolboxCss, /\.toast\s*\{[\s\S]*?border:\s*var\(--line\);[\s\S]*?color:\s*var\(--ink\);[\s\S]*?background:\s*var\(--white\);/);
    assert.match(toolboxCss, /@media \(hover: hover\) and \(pointer: fine\)/);
    assert.doesNotMatch(toolboxCss, /\.tool-nav-link:hover,\s*\.tool-nav-link\[aria-current/);
    assert.match(toolboxCss, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.tool-nav-link:hover\s*\{/);
    assert.match(toolboxCss, /\.text-link\s*\{[\s\S]*?padding-right:\s*4px;/);
    assert.match(toolboxCss, /\.text-link:hover\s*\{[\s\S]*?transform:\s*translate\(-2px, -2px\);[\s\S]*?box-shadow:\s*3px 3px 0 var\(--ink\);/);
    assert.match(toolboxCss, /\.tool-card\s*\{[\s\S]*?border:\s*var\(--line\);/);
    assert.doesNotMatch(toolboxCss, /\.overview-grid\s*\{[^}]*border-(?:top|left):/);
    assert.match(toolboxCss, /\.button\s*\{[\s\S]*?border:\s*1px solid transparent;[\s\S]*?border-bottom:\s*2px solid currentColor;[\s\S]*?background:\s*transparent;/);
    assert.match(toolboxCss, /\.button\.primary\s*\{[\s\S]*?color:\s*var\(--ink\);[\s\S]*?background:\s*var\(--white\);/);
    assert.doesNotMatch(toolboxCss, /\.button\.primary:hover[^}]*background:/);
    assert.match(toolboxCss, /\.button:hover:not\(:disabled\)\s*\{[\s\S]*?box-shadow:\s*3px 3px 0 var\(--ink\);[\s\S]*?transform:\s*translate\(-2px, -2px\);/);
    assert.match(toolboxCss, /\.button\.pwa-overview-action\s*\{\s*display:\s*none;/);
    assert.match(toolboxCss, /\.pwa-header-action\[data-pwa-mode="install"\]::before[\s\S]*?content:\s*"→";/);
    assert.match(toolboxCss, /\.pwa-header-action\[data-pwa-mode="install"\]::after[\s\S]*?content:\s*"←";/);
    const fileDropHover = toolboxCss.match(/\.file-drop:hover\s*\{([^}]*)\}/);
    assert.ok(fileDropHover);
    assert.doesNotMatch(fileDropHover[1], /box-shadow|transform/);
    assert.match(toolboxCss, /@media \(max-width: 640px\)[\s\S]*?\.button\.pwa-overview-action\s*\{[\s\S]*?display:\s*inline-flex;/);
    assert.match(toolboxCss, /@media \(max-width: 640px\)[\s\S]*?\.install-tip\s*\{[\s\S]*?display:\s*block;[\s\S]*?border:\s*var\(--line\);/);
    assert.match(toolboxCss, /body\.is-mobile-info-open \.mobile-info-rail\s*\{[\s\S]*?transform:\s*translate3d\(0, 0, 0\);/);
    assert.match(toolboxCss, /\.mobile-info-rail::before\s*\{[\s\S]*?width:\s*100vw;[\s\S]*?background:\s*var\(--ink\);/);
    assert.match(toolboxCss, /body\.is-mobile-info-open \.overview-panel\s*\{[\s\S]*?translate3d\(var\(--mobile-info-width\), 0, 0\);/);
    assert.match(toolboxCss, /\.mobile-info-close\s*\{[\s\S]*?border:\s*0;/);
    assert.match(toolboxCss, /\.mobile-info-author\s*\{\s*margin-top:\s*auto;/);
    assert.match(toolboxCss, /@media \(max-width: 640px\)[\s\S]*?\.mobile-info-rail-content\s*\{[\s\S]*?bottom:\s*28px;/);
    assert.match(toolboxCss, /\.policy-back-button\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*46px;/);
    assert.match(toolboxCss, /\.policy-back-button\s*\{[\s\S]*?right:\s*max\(22px, var\(--safe-right\)\);[\s\S]*?left:\s*auto;/);
    assert.doesNotMatch(toolboxCss, /height:\s*85vh/);
    assert.match(toolboxCss, /@media \(max-width: 640px\)[\s\S]*?\.mobile-info-hint\s*\{[\s\S]*?width:\s*16px;[\s\S]*?height:\s*34px;/);
    assert.match(toolboxCss, /\.mobile-info-rail-content > \*\s*\{[\s\S]*?writing-mode:\s*vertical-rl;[\s\S]*?transform:\s*rotate\(180deg\);/);
    assert.match(toolboxCss, /\.landing-footer\s*\{\s*display:\s*none;/);
    assert.match(toolboxCss, /@media \(max-width: 640px\)[\s\S]*?\.overview-grid \.tool-card:nth-child\(n\)\s*\{[\s\S]*?margin-left:\s*0;/);
    assert.match(toolboxCss, /\.pdf-page-grid\s*\{/);
    assert.match(pdfScript, /output\.copyPages/);
    assert.match(pdfScript, /copy\.setRotation\(degrees/);
    assert.match(pdfScript, /fileOutput\.writeOrDownload/);
    assert.match(fileOutputScript, /URL\.createObjectURL/);
    assert.ok(pdfBundle.length > 900000);
    assert.match(localServer, /createServer/);
    assert.match(localServer, /127\.0\.0\.1/);
    assert.match(localServer, /"\.mjs", "text\/javascript; charset=utf-8"/);
    assert.match(localServer, /"\.wasm", "application\/wasm"/);
    assert.doesNotMatch(gitignore, /Cenik-12\.1\.2026|Info-izracun_VW_ID4|Spletnastran_osnutek/);
    assert.doesNotMatch(readme, /Cenik-12\.1\.2026|Info-izracun_VW_ID4|Spletnastran_osnutek/);
    assert.ok(fs.statSync(path.join(projectRoot, "assets/vendor/pdfjs/pdf.min.mjs")).size > 400000);
    assert.ok(fs.statSync(path.join(projectRoot, "assets/vendor/pdfjs/pdf.worker.min.mjs")).size > 1000000);
    assert.ok(fs.statSync(path.join(projectRoot, "assets/vendor/pdf-lib/pdf-lib.esm.min.js")).size > 400000);
    assert.match(privacyHtml, /ZEKom-2/);
    assert.match(privacyHtml, /GDPR/);
    assert.match(privacyHtml, /GitHub Pages/);
    assert.match(privacyHtml, /Urban ne prejme, ne vidi in ne more dostopati/);
    assert.doesNotMatch(privacyHtml, /UPRAVLJAVEC|PREJEMNIKI IN PRENOSI|VAŠE PRAVICE/);

    assert.equal(core.clampCount(9000, 5000), 5000);
    assert.equal(core.clampCount(0, 5000), 1);

    assert.equal(core.calculateVatCheckDigit("5022305"), 4);
    assert.deepEqual(core.validateSlovenianVat("SI50223054"), {
        valid: true,
        digits: "50223054",
        formatted: "SI50223054",
        reason: "Checksum valid."
    });
    assert.equal(core.validateSlovenianVat("SI50223055").valid, false);
    assert.equal(core.validateSlovenianVat("SI01234567").valid, false);

    const vats = core.generateSlovenianVats(1000, { prefix: true, rng: seededRandom(12345) });
    assert.equal(vats.length, 1000);
    assert.ok(vats.every((vat) => /^SI[1-9]\d{7}$/.test(vat)));
    assert.ok(vats.every((vat) => core.validateSlovenianVat(vat).valid));

    const date = core.parseIsoDate("1990-06-15");
    assert.ok(date instanceof Date);
    assert.equal(core.parseIsoDate("2025-02-29"), null);

    for (const gender of ["male", "female"]) {
        const emsos = core.generateEmsos(500, {
            date,
            gender,
            rng: seededRandom(gender === "male" ? 77 : 99)
        });
        assert.equal(emsos.length, 500);
        emsos.forEach((emso) => {
            const validation = core.validateEmso(emso, new Date("2026-08-08T00:00:00Z"));
            assert.equal(validation.valid, true, emso + " should be valid");
            assert.equal(validation.date, "1990-06-15");
            assert.equal(validation.gender, gender);
            assert.ok(validation.register >= 50 && validation.register <= 59);
            assert.ok(gender === "male" ? validation.serial < 500 : validation.serial >= 500);
        });
    }

    const adultEmsos = core.generateEmsos(1000, {
        adultOnly: true,
        now: new Date("2026-08-08T00:00:00Z"),
        rng: seededRandom(20260808)
    });
    assert.ok(adultEmsos.every((emso) => {
        const validation = core.validateEmso(emso, new Date("2026-08-08T00:00:00Z"));
        return validation.valid && validation.date <= "2008-08-08";
    }));

    const now = 1_800_000_000;
    const unsignedToken = encodedJwt(
        { alg: "none", typ: "JWT" },
        { sub: "test-user", iat: now - 20, exp: now + 300 }
    );
    const parsed = core.parseJwt(unsignedToken);
    assert.equal(parsed.header.alg, "none");
    assert.equal(parsed.payload.sub, "test-user");
    assert.equal(core.analyzeJwtClaims(parsed.payload, now).valid, true);
    assert.equal(core.analyzeJwtClaims({ exp: now - 1 }, now).valid, false);
    assert.throws(() => core.parseJwt("not.a.jwt.with.too.many.parts"), /three dot-separated/i);
    assert.throws(
        () => core.parseJwt(encodedJwt({ alg: "HS256" }, { sub: "missing-signature" })),
        /must include a signature/i
    );
    await assert.rejects(() => core.verifyJwtSignature(unsignedToken, "unused"), /never treated as signature-valid/i);

    const secret = "correct horse battery staple";
    const hmacHeader = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const hmacPayload = base64Url(JSON.stringify({ sub: "123", exp: now + 120 }));
    const hmacInput = hmacHeader + "." + hmacPayload;
    const hmacSignature = nodeCrypto.createHmac("sha256", secret).update(hmacInput).digest();
    const hmacToken = hmacInput + "." + base64Url(hmacSignature);
    assert.equal((await core.verifyJwtSignature(hmacToken, secret)).valid, true);
    assert.equal((await core.verifyJwtSignature(hmacToken, "wrong secret")).valid, false);
    assert.equal((await core.verifyJwtSignature(hmacToken, Buffer.from(secret).toString("base64"), { keyEncoding: "base64" })).valid, true);

    const rsaKeys = nodeCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const rsaHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const rsaPayload = base64Url(JSON.stringify({ aud: "toolbox" }));
    const rsaInput = rsaHeader + "." + rsaPayload;
    const rsaSignature = nodeCrypto.sign("sha256", Buffer.from(rsaInput), rsaKeys.privateKey);
    const rsaToken = rsaInput + "." + base64Url(rsaSignature);
    const rsaPublicPem = rsaKeys.publicKey.export({ type: "spki", format: "pem" });
    assert.equal((await core.verifyJwtSignature(rsaToken, rsaPublicPem)).valid, true);

    const pssHeader = base64Url(JSON.stringify({ alg: "PS256", typ: "JWT" }));
    const pssInput = pssHeader + "." + rsaPayload;
    const pssSignature = nodeCrypto.sign("sha256", Buffer.from(pssInput), {
        key: rsaKeys.privateKey,
        padding: nodeCrypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32
    });
    const pssToken = pssInput + "." + base64Url(pssSignature);
    assert.equal((await core.verifyJwtSignature(pssToken, rsaPublicPem)).valid, true);

    const ecKeys = nodeCrypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const ecHeader = base64Url(JSON.stringify({ alg: "ES256", typ: "JWT" }));
    const ecInput = ecHeader + "." + rsaPayload;
    const ecSignature = nodeCrypto.sign("sha256", Buffer.from(ecInput), {
        key: ecKeys.privateKey,
        dsaEncoding: "ieee-p1363"
    });
    const ecToken = ecInput + "." + base64Url(ecSignature);
    const ecPublicPem = ecKeys.publicKey.export({ type: "spki", format: "pem" });
    assert.equal((await core.verifyJwtSignature(ecToken, ecPublicPem)).valid, true);

    assert.deepEqual(core.parseEuDecimalToCents("1.234,565"), { cents: 123457n, nonZero: true });
    assert.deepEqual(core.parseEuDecimalToCents("−24,085 EUR"), { cents: -2409n, nonZero: true });
    assert.equal(core.parseEuDecimalToCents(""), null);

    const sparkasseCsv = [
        "Sparkasse transaction export",
        "",
        "Datum knjiženja;Naziv prejemnika;V breme;V dobro;Valuta;Namen;Referenca prejemnika;Status;Datum izvršitve;Partnerjeva referenca;Naša referenca;Referenca soglasja;Komentar",
        '01.01.2026;"Trgovina; Center";24,085;;EUR;"Nakup ""kosila""";SI00-1;;;;SI00-2;;Opomba',
        "02.01.2026;Sparkasse;;1.234,56;EUR;Obresti;;;;;;;",
        "03.01.2026;Brez zneska;;;EUR;Test;;;;;;;"
    ].join("\r\n");
    const conversion = core.convertSparkasseCsv(sparkasseCsv);
    assert.equal(conversion.transactionCount, 2);
    assert.equal(conversion.warningCount, 1);
    assert.equal(conversion.qif, [
        "!Type:Bank",
        "D01.01.2026",
        "T-24.09",
        "PTrgovina; Center",
        'MNakup "kosila" | SI00-1 | SI00-2 | Opomba',
        "^",
        "D02.01.2026",
        "T1234.56",
        "PSparkasse",
        "MObresti",
        "^",
        ""
    ].join("\n"));
    assert.throws(
        () => core.convertSparkasseCsv(sparkasseCsv, { stopOnError: true }),
        /no amount/i
    );
    const classified = core.convertSparkasseCsv(sparkasseCsv, { appendCode: true });
    assert.match(classified.qif, /MObresti;INTE/);
    assert.match(classified.qif, /MNakup "kosila" \| SI00-1 \| SI00-2 \| Opomba;OTHR/);

    const centralEuropeanText = "ČŠŽčšž€";
    const cp1250 = core.encodeTextBytes(centralEuropeanText, "windows-1250");
    assert.equal(core.decodeTextBytes(cp1250, "windows-1250").text, centralEuropeanText);
    assert.throws(() => core.encodeTextBytes("emoji: 🙂", "windows-1250"), /cannot be encoded/i);

    const formatted = core.formatJson('{"z":1,"a":{"d":4,"b":2},"list":[{"y":2,"x":1}]}', {
        indent: 2,
        sortKeys: true
    });
    assert.equal(formatted, [
        "{",
        '  "a": {',
        '    "b": 2,',
        '    "d": 4',
        "  },",
        '  "list": [',
        "    {",
        '      "x": 1,',
        '      "y": 2',
        "    }",
        "  ],",
        '  "z": 1',
        "}"
    ].join("\n"));
    assert.equal(core.formatJson("{\"ready\": true}", { minify: true }), '{"ready":true}');
    assert.throws(() => core.formatJson("{broken}"), SyntaxError);
    assert.equal(core.formatBytes(0), "0 B");
    assert.equal(core.formatBytes(1536), "1.5 KB");

    assert.equal(pdfCore.normalizeRotation(-90), 270);
    assert.equal(pdfCore.normalizeRotation(451), 90);
    const pdfPages = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    assert.deepEqual(pdfCore.movePage(pdfPages, "b", 1).map((page) => page.id), ["a", "c", "b", "d"]);
    assert.deepEqual(pdfCore.movePage(pdfPages, "a", -1).map((page) => page.id), ["a", "b", "c", "d"]);
    assert.deepEqual(pdfCore.reorderPage(pdfPages, "a", "c", true).map((page) => page.id), ["b", "c", "a", "d"]);
    assert.deepEqual(pdfCore.reorderPage(pdfPages, "d", "b", false).map((page) => page.id), ["a", "d", "b", "c"]);

    console.log("toolbox tests: all checks passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
