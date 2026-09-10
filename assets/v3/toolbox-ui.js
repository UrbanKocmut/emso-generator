(() => {
  // src/ui/shared.mjs
  var core = window.ToolboxCore;
  var fileOutput = window.DelavnicaFileOutput;
  var toastTimer = 0;
  function byId(id) {
    return document.getElementById(id);
  }
  function localizedError(error) {
    if (error?.localized) return error.message;
    const operationErrors = {
      INVALID_ARGUMENT: "Parametri niso veljavni. Preverite obvezna polja, dovoljene mo\u017Enosti in obsege v navodilih za agente.",
      FILE_NOT_FOUND: "Izbrana datoteka ni ve\u010D na voljo v tej delovni povr\u0161ini. Izberite jo znova.",
      ARTIFACT_NOT_FOUND: "Pripravljena datoteka ni ve\u010D na voljo. Znova ustvarite rezultat.",
      LIMIT_EXCEEDED: "Prese\u017Eena je omejitev velikosti datotek ali rezultatov. Po\u010Distite delovno povr\u0161ino ali uporabite manj\u0161e datoteke.",
      INVALID_PDF: "PDF-ja ni bilo mogo\u010De sestaviti. Preverite datoteke, \u0161tevilke strani in za\u0161\u010Dito z geslom.",
      CANCELLED: "Opravilo je preklicano."
    };
    if (operationErrors[error?.code]) return operationErrors[error.code];
    const message = error && error.message ? error.message : String(error);
    const exact = {
      "There is nothing to copy.": "Ni vsebine za kopiranje.",
      "Clipboard access was denied.": "Dostop do odlo\u017Ei\u0161\u010Da je bil zavrnjen.",
      "A JWT must contain three dot-separated segments.": "JWT mora vsebovati tri dele, lo\u010Dene s pikami.",
      "The JWT header must be a JSON object.": "Glava JWT mora biti objekt JSON.",
      "The JWT payload must be a JSON object.": "Vsebina JWT mora biti objekt JSON.",
      "The JWT header is missing a string alg value.": "V glavi JWT manjka besedilna vrednost alg.",
      "Unencoded JWS payloads are not valid JWTs.": "Nekodirane vsebine JWS niso veljavni JWT.",
      "The JWT crit header must be an array of strings.": "Polje crit v glavi JWT mora biti polje besedilnih vrednosti.",
      "An unsecured JWT must have an empty signature segment.": "Nepodpisan JWT mora imeti prazen del za podpis.",
      "A signed JWT must include a signature segment.": "Podpisan JWT mora vsebovati del s podpisom.",
      "Unsigned JWTs are never treated as signature-valid.": "Nepodpisani JWT se nikoli ne \u0161teje kot veljavno podpisan.",
      "Critical JOSE header extensions are not supported by this verifier.": "Ta preverjevalnik ne podpira kriti\u010Dnih raz\u0161iritev glave JOSE.",
      "Web Crypto is unavailable in this browser context.": "Web Crypto v tem okolju brskalnika ni na voljo.",
      "A non-empty HMAC secret is required.": "Vnesite neprazno skrivnost HMAC.",
      "Expected an SPKI PEM key with BEGIN PUBLIC KEY markers.": "Pri\u010Dakovan je javni klju\u010D SPKI PEM z oznakama BEGIN PUBLIC KEY.",
      "Invalid base64url encoding.": "Neveljavno kodiranje base64url.",
      "The CSV ends inside a quoted field.": "Datoteka CSV se kon\u010Da znotraj polja v narekovajih.",
      "Sparkasse header 'Datum knji\u017Eenja' was not found.": "Glava Sparkasse \xBBDatum knji\u017Eenja\xAB ni bila najdena.",
      "The QIF type cannot contain a line break.": "Vrsta QIF ne sme vsebovati preloma vrstice."
    };
    if (exact[message]) {
      return exact[message];
    }
    if (message.startsWith("Invalid JWT header:")) {
      return "Neveljavna glava JWT:" + message.slice("Invalid JWT header:".length);
    }
    if (message.startsWith("Invalid JWT payload:")) {
      return "Neveljavna vsebina JWT:" + message.slice("Invalid JWT payload:".length);
    }
    if (message.startsWith("Unsupported JWT algorithm:")) {
      return message.replace("Unsupported JWT algorithm:", "Nepodprt algoritem JWT:");
    }
    if (message.startsWith("Unsupported date token:")) {
      return message.replace("Unsupported date token:", "Nepodprt zapis datuma:");
    }
    if (message.startsWith("Unsupported text encoding:")) {
      return message.replace("Unsupported text encoding:", "Nepodprto kodiranje besedila:");
    }
    if (message.startsWith("Unsupported QIF encoding:")) {
      return message.replace("Unsupported QIF encoding:", "Nepodprto kodiranje QIF:");
    }
    if (/^Line \d+: can't parse date/.test(message)) {
      return message.replace(/^Line (\d+): can't parse date/, "Vrstica $1: datuma ni mogo\u010De raz\u010Dleniti");
    }
    if (/^Line \d+: no amount/.test(message)) {
      return message.replace(/^Line (\d+): no amount/, "Vrstica $1: manjka znesek");
    }
    if (message.includes("cannot be encoded as Windows-1250")) {
      return message.replace("cannot be encoded as Windows-1250", "ni mogo\u010De kodirati kot Windows-1250");
    }
    if (error instanceof SyntaxError) {
      return "JSON ni veljaven: " + message;
    }
    return message;
  }
  function setStatus(element, message, isError) {
    element.textContent = message;
    element.classList.toggle("is-error", Boolean(isError));
  }
  function setValidationState(element, text, state) {
    element.textContent = text;
    element.className = "state " + (state || "neutral");
  }
  function showToast(message) {
    const toast = byId("toast");
    window.clearTimeout(toastTimer);
    const revision = String((Number(toast.dataset.toastRevision) || 0) + 1);
    toast.dataset.toastRevision = revision;
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(function() {
      if (toast.dataset.toastRevision === revision) {
        toast.hidden = true;
      }
    }, 1900);
  }
  function getElementText(element) {
    return "value" in element ? element.value : element.textContent;
  }
  async function copyText(value) {
    if (!value) {
      throw new Error("There is nothing to copy.");
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const fallback = document.createElement("textarea");
    fallback.value = value;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.appendChild(fallback);
    fallback.select();
    const copied = document.execCommand("copy");
    fallback.remove();
    if (!copied) {
      throw new Error("Clipboard access was denied.");
    }
  }
  function initCopyButtons() {
    document.addEventListener("click", async function(event) {
      const button = event.target.closest("[data-copy-target]");
      if (!button) {
        return;
      }
      const target = byId(button.dataset.copyTarget);
      if (!target) {
        return;
      }
      try {
        await copyText(getElementText(target));
        showToast("KOPIRANO V ODLO\u017DI\u0160\u010CE");
      } catch (error) {
        showToast(localizedError(error).toUpperCase());
      }
    });
  }
  function utcToday() {
    const now = /* @__PURE__ */ new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  function capAtMaximum(input, maximum, onCap) {
    function enforceMaximum() {
      if (Number(input.value) > maximum) {
        input.value = String(maximum);
        if (onCap) {
          onCap(maximum);
        }
      }
    }
    input.addEventListener("input", enforceMaximum);
    input.addEventListener("change", enforceMaximum);
  }

  // src/operations/catalog.mjs
  var API_VERSION = "1.1.0";
  var LIMITS = Object.freeze({ textCharacters: 16 * 1024 * 1024, fileBytes: 64 * 1024 * 1024, sessionFileBytes: 128 * 1024 * 1024, artifactBytes: 128 * 1024 * 1024, chunkBytes: 65536, pages: 5e3 });
  var string = (maxLength = LIMITS.textCharacters) => ({ type: "string", maxLength });
  var boolean = (defaultValue) => ({ type: "boolean", default: defaultValue });
  var enumeration = (values, defaultValue = values[0]) => ({ type: "string", enum: values, default: defaultValue });
  var count = { type: "integer", minimum: 1, maximum: 5e3, default: 10 };
  var fileId = { ...string(80), minLength: 1 };
  var filename = { ...string(180), minLength: 1, pattern: '^[^<>:"/\\\\|?*\\u0000-\\u001f]+$' };
  var dateFormat = { ...string(32), minLength: 1, default: "%d.%m.%Y" };
  var schema = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
  var OPERATIONS = [
    {
      name: "generate_emso",
      tool: "emso",
      description: "Generate synthetic Slovenian EM\u0160O strings in the visible workspace. Checksums only; no population-register lookup or proof that an identifier is unassigned.",
      inputSchema: schema({ count, date: { ...string(10), default: "" }, gender: enumeration(["random", "male", "female"]), adultOnly: boolean(false) }),
      example: { count: 3, date: "1990-06-15", gender: "female" }
    },
    {
      name: "generate_si_tax_numbers",
      tool: "vat",
      description: "Generate synthetic eight-digit Slovenian tax-number strings with an optional SI prefix. Validates modulo-11 checksums, not registration or VAT status.",
      inputSchema: schema({ count, prefix: boolean(true) }),
      example: { count: 3, prefix: true }
    },
    {
      name: "format_json",
      tool: "json",
      description: "Format original JSON text in the visible workspace, preserving numeric spelling, duplicate keys and string escapes. Returns text; optional stable object-key sorting.",
      inputSchema: schema({ text: string(), indent: { enum: [2, 4, "tab"], default: 2 }, minify: boolean(false), sortKeys: boolean(false) }, ["text"]),
      example: { text: '{"n":9007199254740993,"n":-0}', indent: 2 }
    },
    {
      name: "inspect_jwt",
      tool: "jwt",
      description: "Decode a JWT, check its time claims and optionally verify its signature with a supplied HMAC secret or SPKI public key. Returns separate structure, claims and signature states. Supplied-key verification does not establish issuer trust.",
      inputSchema: schema({ token: string(), verifySignature: boolean(false), key: { ...string(), default: "" }, keyEncoding: enumeration(["text", "base64"]) }, ["token"]),
      example: { token: "eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vIn0." }
    },
    {
      name: "convert_sparkasse_csv",
      tool: "qif",
      description: "Convert local Sparkasse CSV text or a selected CSV file ID into QIF. Exactly one source is required. Shows conversion warnings and returns a local artifact; never saves, shares or uploads automatically.",
      inputSchema: { ...schema({ text: string(), fileId, csvEncoding: enumeration(["auto", "utf-8", "windows-1250", "latin1"]), outputEncoding: enumeration(["utf-8", "windows-1250"]), qifType: enumeration(["Bank", "CCard", "Cash"]), inputDateFormat: dateFormat, outputDateFormat: dateFormat, appendCode: boolean(false), stopOnError: boolean(false), filename }), oneOf: [{ required: ["text"], not: { required: ["fileId"] } }, { required: ["fileId"], not: { required: ["text"] } }] },
      example: { text: "Datum knji\u017Eenja;Naziv prejemnika;V breme;V dobro;Namen\n10.09.2026;Izmi\u0161ljena trgovina;12,34;;Test\n" }
    },
    {
      name: "compose_pdf",
      tool: "pdf",
      description: "Compose a PDF from session-local IDs of already selected PDF files. Pages are one-based; quarterTurns is 0\u20133 clockwise relative to the original page. Replaces the visible page arrangement, preserving the source documents. Returns a local artifact without saving or sharing. Encrypted PDFs are unsupported; existing signatures are not preserved as valid.",
      inputSchema: schema({ pages: { type: "array", minItems: 1, maxItems: LIMITS.pages, items: schema({ fileId, page: { type: "integer", minimum: 1 }, quarterTurns: { type: "integer", minimum: 0, maximum: 3, default: 0 } }, ["fileId", "page"]) }, filename: { ...filename, default: "zdruzen-dokument.pdf" } }, ["pages"]),
      example: { pages: [{ fileId: "file-1", page: 2, quarterTurns: 1 }, { fileId: "file-1", page: 1 }] }
    },
    {
      name: "format_xml",
      tool: "xml",
      description: 'Validate and format original XML tokens. Preserves mixed-content subtrees and xml:space="preserve"; rejects DTD/entity declarations. Returns text without importing or inserting XML into the page.',
      inputSchema: schema({ text: string(), indent: { enum: [2, 4, "tab"], default: 2 } }, ["text"]),
      example: { text: '<root><item id="1"/></root>', indent: 2 }
    },
    {
      name: "generate_jwt",
      tool: "jwt-generator",
      description: "Sign a JWT locally using Web Crypto HMAC. Requires at least 32/48/64 decoded secret bytes for HS256/384/512. Guided timestamps use local YYYY-MM-DDTHH:mm[:ss] and convert to Unix seconds. Blank claims are omitted. Custom JSON must be an object without iss/sub/aud/iat/nbf/exp. Returns token, header and payload; keeps inputs only in memory.",
      inputSchema: schema({ algorithm: enumeration(["HS256", "HS384", "HS512"]), secret: string(), secretEncoding: enumeration(["text", "base64"]), issuer: { ...string(), default: "" }, subject: { ...string(), default: "" }, audience: { ...string(), default: "" }, issuedAt: { ...string(19), default: "" }, notBefore: { ...string(19), default: "" }, expiresAt: { ...string(19), default: "" }, customClaims: { ...string(), default: "{}" } }, ["secret"]),
      example: { secret: "example-only-32-byte-secret-12345", subject: "demo", customClaims: '{"role":"test"}' }
    },
    {
      name: "resize_images",
      tool: "image-resizer",
      description: "Resize up to 50 selected JPEG/PNG/WebP images sequentially with shared settings. Oriented decoding; 40 MP input, 16 MP output and 8192 pixels per output side. Lossy quality is 90%, JPEG background white. Outputs are still images without original metadata. Returns per-image success/error and local artifacts, plus a ZIP of successes when possible. Never downloads automatically.",
      inputSchema: schema({ fileIds: { type: "array", minItems: 1, maxItems: 50, items: fileId }, mode: enumeration(["fit", "percentage"]), maxWidth: { type: "integer", minimum: 1, maximum: 8192, default: 1920 }, maxHeight: { type: "integer", minimum: 1, maximum: 8192, default: 1080 }, enlarge: boolean(false), percentage: { type: "integer", minimum: 1, maximum: 400, default: 100 }, format: enumeration(["source", "image/jpeg", "image/png", "image/webp"]) }, ["fileIds"]),
      example: { fileIds: ["file-1"], mode: "fit", maxWidth: 1920, maxHeight: 1080, enlarge: false, format: "source" }
    },
    {
      name: "list_selected_files",
      description: "List metadata and session-local file IDs from native CSV/PDF/image selection. No file contents, local paths, remote fetching or file-picker access.",
      readOnly: true,
      inputSchema: schema({}),
      example: {}
    },
    {
      name: "read_artifact",
      description: "Read a generated local artifact as base64, at most 65536 raw bytes per call. Offset and length are raw byte counts. Does not expose selected input-file contents.",
      readOnly: true,
      inputSchema: schema({ id: fileId, offset: { type: "integer", minimum: 0, default: 0 }, length: { type: "integer", minimum: 1, maximum: LIMITS.chunkBytes, default: LIMITS.chunkBytes } }, ["id"]),
      example: { id: "artifact-1", offset: 0, length: 65536 }
    }
  ];

  // src/operations/validation.mjs
  function fail(code, message) {
    throw Object.assign(new Error(message), { code });
  }
  function failLocal(code, message) {
    throw Object.assign(new Error(message), { code, localized: true });
  }
  function validate(schema2, value, location = "input") {
    if (schema2.enum && !schema2.enum.includes(value)) fail("INVALID_ARGUMENT", location + ": unsupported value.");
    if (schema2.type === "object") {
      if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_ARGUMENT", location + ": expected an object.");
      for (const name of Object.keys(value)) if (!Object.hasOwn(schema2.properties, name)) fail("INVALID_ARGUMENT", location + ": unknown property " + name + ".");
      for (const name of schema2.required || []) if (!Object.hasOwn(value, name)) fail("INVALID_ARGUMENT", location + ": missing " + name + ".");
      const result = {};
      for (const [name, property] of Object.entries(schema2.properties)) {
        if (Object.hasOwn(value, name)) result[name] = validate(property, value[name], location + "." + name);
        else if (Object.hasOwn(property, "default")) result[name] = property.default;
      }
      return result;
    }
    if (schema2.type === "array") {
      if (!Array.isArray(value) || value.length < (schema2.minItems || 0) || value.length > (schema2.maxItems || Infinity)) fail("INVALID_ARGUMENT", location + ": invalid array length.");
      return value.map((item, index) => validate(schema2.items, item, location + "[" + index + "]"));
    }
    if (schema2.type === "integer" && (!Number.isSafeInteger(value) || value < (schema2.minimum ?? -Infinity) || value > (schema2.maximum ?? Infinity))) fail("INVALID_ARGUMENT", location + ": integer out of range.");
    if (schema2.type === "boolean" && typeof value !== "boolean") fail("INVALID_ARGUMENT", location + ": expected a boolean.");
    if (schema2.type === "string") {
      if (typeof value !== "string" || value.length < (schema2.minLength || 0) || value.length > (schema2.maxLength || Infinity)) fail("INVALID_ARGUMENT", location + ": invalid text length or type.");
      if (schema2.pattern && !new RegExp(schema2.pattern).test(value)) fail("INVALID_ARGUMENT", location + ": invalid text format.");
    }
    return value;
  }
  function validateOperation(definition, input, core2) {
    const args = validate(definition.inputSchema, input);
    if (definition.name === "generate_emso" && args.date) {
      const date = core2.parseIsoDate(args.date);
      const now = /* @__PURE__ */ new Date();
      const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) || !date || date.getUTCFullYear() < 1900 || date > today || args.adultOnly) fail("INVALID_ARGUMENT", "Use a real date from 1900 through today; date and adultOnly cannot be combined.");
    }
    if (definition.name === "convert_sparkasse_csv") {
      if (Object.hasOwn(args, "text") === Object.hasOwn(args, "fileId")) fail("INVALID_ARGUMENT", "Supply exactly one of text or fileId.");
      for (const key of ["inputDateFormat", "outputDateFormat"]) {
        const format = args[key];
        if (/[^%]*%[^dmYy]|%$|[\r\n]/.test(format) || !format.includes("%d") || !format.includes("%m") || !/%[Yy]/.test(format)) fail("INVALID_ARGUMENT", "Date formats need day, month and year using %d, %m, %Y or %y.");
      }
    }
    if (definition.name === "inspect_jwt" && args.verifySignature && !args.key) fail("INVALID_ARGUMENT", "A key is required for signature verification.");
    if (args.filename && (/[. ]$/.test(args.filename) || args.filename.trim() !== args.filename)) fail("INVALID_ARGUMENT", "Filename cannot begin or end with whitespace, or end with a dot.");
    return args;
  }

  // src/processing/xml.mjs
  function xmlTokens(text) {
    const tokens = [];
    let offset = 0;
    while (offset < text.length) {
      const start = offset;
      let kind = "text";
      if (text[offset] !== "<") {
        offset = text.indexOf("<", offset);
        if (offset < 0) offset = text.length;
      } else {
        const endMarker = text.startsWith("<!--", offset) ? "-->" : text.startsWith("<![CDATA[", offset) ? "]]>" : text.startsWith("<?", offset) ? "?>" : null;
        if (endMarker) {
          kind = endMarker === "]]>" ? "cdata" : "markup";
          const end = text.indexOf(endMarker, offset + (endMarker === "-->" ? 4 : endMarker === "]]>" ? 9 : 2));
          if (end < 0) failLocal("INVALID_XML", "XML vsebuje nezaklju\u010Den komentar, CDATA ali navodilo.");
          offset = end + endMarker.length;
        } else {
          if (text.startsWith("<!", offset)) failLocal("INVALID_XML", "Deklaracije DTD in entitet niso dovoljene.");
          kind = text.startsWith("</", offset) ? "close" : "open";
          let quote = "";
          for (offset++; offset < text.length; offset++) {
            const c = text[offset];
            if (quote) {
              if (c === quote) quote = "";
            } else if (c === '"' || c === "'") quote = c;
            else if (c === ">") break;
          }
          if (offset === text.length) failLocal("INVALID_XML", "XML vsebuje nezaklju\u010Deno oznako.");
          offset++;
          if (kind === "open" && text[offset - 2] === "/") kind = "empty";
        }
      }
      tokens.push({ kind, start, end: offset });
    }
    return tokens;
  }
  function formatXml(text, { indent = 2 } = {}, Parser = globalThis.DOMParser) {
    if (typeof text !== "string" || text.length > LIMITS.textCharacters) failLocal("LIMIT_EXCEEDED", "XML lahko vsebuje najve\u010D 16 MiB znakov.");
    if (![2, 4, "tab"].includes(indent)) failLocal("INVALID_ARGUMENT", "Izberite 2 ali 4 presledke oziroma tabulator.");
    const bom = text.startsWith("\uFEFF") ? "\uFEFF" : "";
    if (bom) text = text.slice(1);
    const tokens = xmlTokens(text);
    if (!Parser) failLocal("PROCESSING_FAILED", "Raz\u010Dlenjevalnik XML v tem brskalniku ni na voljo.");
    const parser = new Parser();
    let doc = parser.parseFromString(text, "application/xml");
    const hasError = (value) => !value.documentElement || ["http://www.mozilla.org/newlayout/xml/parsererror.xml", "http://www.w3.org/1999/xhtml"].some((namespace) => value.getElementsByTagNameNS(namespace, "parsererror").length);
    if (hasError(doc)) {
      const probe = tokens.map((token) => {
        const raw = text.slice(token.start, token.end);
        return ["open", "empty", "close"].includes(token.kind) ? raw.replace(/^(<\/?)([^\s/>]+)/, (all, prefix, name) => name.split(":").at(-1) === "parsererror" ? prefix + name.replace(/parsererror$/, "delavnica-xml-validation") : all) : raw;
      }).join("");
      if (probe !== text) doc = parser.parseFromString(probe, "application/xml");
    }
    if (hasError(doc)) {
      failLocal("INVALID_XML", "XML ni veljaven. Preverite oznake, atribute in imenske prostore.");
    }
    const elements = doc.getElementsByTagName("*");
    let elementIndex = 0;
    const root2 = { children: [], start: 0, end: text.length, preserve: false };
    const stack = [root2];
    for (const token of tokens) {
      const parent = stack.at(-1);
      if (token.kind === "close") {
        const node = stack.pop();
        node.close = token.start;
        node.end = token.end;
      } else {
        const node = { ...token };
        parent.children.push(node);
        if (token.kind === "open" || token.kind === "empty") {
          const space = elements[elementIndex++].getAttributeNS("http://www.w3.org/XML/1998/namespace", "space");
          node.preserve = space === "preserve" || space !== "default" && parent.preserve;
          node.children = [];
          parent.hasElements = true;
          if (token.kind === "open") {
            node.openEnd = token.end;
            stack.push(node);
          }
        } else if (token.kind === "cdata" || token.kind === "text" && /[^\x20\t\r\n]/.test(text.slice(token.start, token.end))) parent.mixed = true;
      }
    }
    const unit = indent === "tab" ? "	" : " ".repeat(indent);
    const output = [];
    let length = 0;
    const append = (value) => {
      length += value.length;
      if (length > LIMITS.textCharacters) failLocal("LIMIT_EXCEEDED", "Oblikovan XML presega omejitev 16 MiB znakov.");
      output.push(value);
    };
    const work = [{ node: root2, depth: -1 }];
    while (work.length) {
      const { node, depth, closing } = work.pop();
      if (closing) {
        append("\n" + unit.repeat(depth) + text.slice(node.close, node.end));
        continue;
      }
      if (node !== root2) append((output.length ? "\n" : "") + unit.repeat(depth));
      if (node !== root2 && (node.kind !== "open" || node.preserve || node.mixed || !node.hasElements)) {
        append(text.slice(node.start, node.end));
        continue;
      }
      if (node !== root2) {
        append(text.slice(node.start, node.openEnd));
        work.push({ node, depth, closing: true });
      }
      const children = node.children.filter((child) => child.kind !== "text" || /[^\x20\t\r\n]/.test(text.slice(child.start, child.end)));
      for (let i2 = children.length - 1; i2 >= 0; i2--) work.push({ node: children[i2], depth: depth + 1 });
    }
    return bom + output.join("");
  }

  // src/processing/jwt-generator.mjs
  var HMAC = Object.freeze({ HS256: { hash: "SHA-256", bytes: 32 }, HS384: { hash: "SHA-384", bytes: 48 }, HS512: { hash: "SHA-512", bytes: 64 } });
  var guided = { issuer: "iss", subject: "sub", audience: "aud", issuedAt: "iat", notBefore: "nbf", expiresAt: "exp" };
  function base64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  var base64url = (bytes) => base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  function decodeSecret(secret, encoding = "text") {
    if (typeof secret !== "string" || secret.length > LIMITS.textCharacters) failLocal("LIMIT_EXCEEDED", "Skrivnost presega omejitev besedila.");
    if (encoding === "text") return new TextEncoder().encode(secret);
    if (encoding !== "base64") failLocal("INVALID_ARGUMENT", "Neveljavno kodiranje skrivnosti.");
    const value = secret.trim();
    if (!/^(?:[A-Za-z0-9+/]*|[A-Za-z0-9_-]*)={0,2}$/.test(value)) failLocal("INVALID_ARGUMENT", "Skrivnost ni veljaven Base64/base64url.");
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const raw = normalized.replace(/=+$/, "");
    if (raw.length % 4 === 1 || value.includes("=") && (value.length % 4 !== 0 || value.length - raw.length !== (4 - raw.length % 4) % 4)) failLocal("INVALID_ARGUMENT", "Skrivnost ni veljaven Base64/base64url.");
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    if (base64(bytes).replace(/=+$/, "") !== raw) failLocal("INVALID_ARGUMENT", "Skrivnost ni veljaven Base64/base64url.");
    return bytes;
  }
  function localDateTime(date = /* @__PURE__ */ new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  function unixSeconds(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) failLocal("INVALID_ARGUMENT", "Vnesite veljaven lokalni datum in \u010Das.");
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || localDateTime(date) !== (value.length === 16 ? value + ":00" : value) || date.getFullYear() < 1) failLocal("INVALID_ARGUMENT", "Vnesite veljaven lokalni datum in \u010Das.");
    return Math.floor(date.getTime() / 1e3);
  }
  function randomSecret(algorithm = "HS256", crypto = globalThis.crypto) {
    if (!HMAC[algorithm]) failLocal("INVALID_ARGUMENT", "Izberite HS256, HS384 ali HS512.");
    if (!crypto?.getRandomValues) failLocal("PROCESSING_FAILED", "Varni generator naklju\u010Dnih vrednosti ni na voljo.");
    return base64(crypto.getRandomValues(new Uint8Array(HMAC[algorithm].bytes)));
  }
  async function generateJwt(args, check = () => {
  }, crypto = globalThis.crypto) {
    check();
    const algorithm = args.algorithm ?? "HS256";
    if (!HMAC[algorithm]) failLocal("INVALID_ARGUMENT", "Izberite HS256, HS384 ali HS512.");
    if (!crypto?.subtle) failLocal("PROCESSING_FAILED", "Web Crypto v tem okolju brskalnika ni na voljo.");
    const secret = decodeSecret(args.secret, args.secretEncoding ?? "text");
    try {
      if (secret.length < HMAC[algorithm].bytes) failLocal("INVALID_ARGUMENT", `${algorithm} zahteva skrivnost z najmanj ${HMAC[algorithm].bytes} bajti.`);
      const custom = args.customClaims ?? "{}";
      if (typeof custom !== "string" || custom.length > LIMITS.textCharacters) failLocal("LIMIT_EXCEEDED", "Zahtevki presegajo omejitev besedila.");
      let payload;
      try {
        payload = JSON.parse(custom);
      } catch {
        failLocal("INVALID_JSON", "Dodatni zahtevki morajo biti veljaven objekt JSON.");
      }
      if (!payload || Array.isArray(payload) || typeof payload !== "object") failLocal("INVALID_ARGUMENT", "Dodatni zahtevki morajo biti objekt JSON.");
      for (const [field, claim] of Object.entries(guided)) {
        if (Object.hasOwn(payload, claim)) failLocal("INVALID_ARGUMENT", `Zahtevek ${claim} vnesite v namensko polje, ne v dodatne zahtevke.`);
        const value = args[field];
        if (value !== void 0 && value !== "") payload[claim] = ["iat", "nbf", "exp"].includes(claim) ? unixSeconds(value) : value;
      }
      const header = { alg: algorithm, typ: "JWT" };
      const encoder = new TextEncoder();
      const unsigned = [header, payload].map((value) => base64url(encoder.encode(JSON.stringify(value)))).join(".");
      if (unsigned.length > LIMITS.textCharacters) failLocal("LIMIT_EXCEEDED", "\u017Deton presega omejitev besedila.");
      const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: HMAC[algorithm].hash }, false, ["sign"]);
      check();
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));
      check();
      return { token: unsigned + "." + base64url(new Uint8Array(signature)), header, payload };
    } finally {
      secret.fill(0);
    }
  }

  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i2 = 0; i2 < 31; ++i2) {
      b[i2] = start += 1 << eb[i2 - 1];
    }
    var r = new i32(b[30]);
    for (var i2 = 1; i2 < 30; ++i2) {
      for (var j = b[i2]; j < b[i2 + 1]; ++j) {
        r[j] = j - b[i2] << 5 | i2;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    // determined by compression function
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var et = /* @__PURE__ */ new u8(0);
  var crct = /* @__PURE__ */ (function() {
    var t = new Int32Array(256);
    for (var i2 = 0; i2 < 256; ++i2) {
      var c = i2, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i2] = c;
    }
    return t;
  })();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i2 = 0; i2 < d.length; ++i2)
          cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var mrg = function(a, b) {
    var o = {};
    for (var k in a)
      o[k] = a[k];
    for (var k in b)
      o[k] = b[k];
    return o;
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i2 = 0; i2 < str.length; ++i2)
        ar_1[i2] = str.charCodeAt(i2);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i2 = 0; i2 < l; ++i2) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i2 << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i2);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  var exfl = function(ex) {
    var le = 0;
    if (ex) {
      for (var k in ex) {
        var l = ex[k].length;
        if (l > 65535)
          err(9);
        le += l + 4;
      }
    }
    return le;
  };
  var wzh = function(d, b, f, fn, u, c, ce, co) {
    var fl2 = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
    if (ce != null)
      d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2;
    d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
      err(10);
    wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
    if (c != -1) {
      wbytes(d, b, f.crc);
      wbytes(d, b + 4, c < 0 ? -c - 2 : c);
      wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl2);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
      wbytes(d, b, col);
      wbytes(d, b + 6, f.attrs);
      wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl2;
    if (exl) {
      for (var k in ex) {
        var exf = ex[k], l = exf.length;
        wbytes(d, b, +k);
        wbytes(d, b + 2, l);
        d.set(exf, b + 4), b += 4 + l;
      }
    }
    if (col)
      d.set(co, b), b += col;
    return b;
  };
  var wzf = function(o, b, c, d, e) {
    wbytes(o, b, 101010256);
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
  };
  var ZipPassThrough = /* @__PURE__ */ (function() {
    function ZipPassThrough2(filename2) {
      this.filename = filename2;
      this.c = crc();
      this.size = 0;
      this.compression = 0;
    }
    ZipPassThrough2.prototype.process = function(chunk, final) {
      this.ondata(null, chunk, final);
    };
    ZipPassThrough2.prototype.push = function(chunk, final) {
      if (!this.ondata)
        err(5);
      this.c.p(chunk);
      this.size += chunk.length;
      if (final)
        this.crc = this.c.d();
      this.process(chunk, final || false);
    };
    return ZipPassThrough2;
  })();
  var Zip = /* @__PURE__ */ (function() {
    function Zip2(cb) {
      this.ondata = cb;
      this.u = [];
      this.d = 1;
    }
    Zip2.prototype.add = function(file) {
      var _this = this;
      if (!this.ondata)
        err(5);
      if (this.d & 2)
        this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, false);
      else {
        var f = strToU8(file.filename), fl_1 = f.length;
        var com = file.comment, o = com && strToU8(com);
        var u = fl_1 != file.filename.length || o && com.length != o.length;
        var hl_1 = fl_1 + exfl(file.extra) + 30;
        if (fl_1 > 65535)
          this.ondata(err(11, 0, 1), null, false);
        var header = new u8(hl_1);
        wzh(header, 0, file, f, u, -1);
        var chks_1 = [header];
        var pAll_1 = function() {
          for (var _i = 0, chks_2 = chks_1; _i < chks_2.length; _i++) {
            var chk = chks_2[_i];
            _this.ondata(null, chk, false);
          }
          chks_1 = [];
        };
        var tr_1 = this.d;
        this.d = 0;
        var ind_1 = this.u.length;
        var uf_1 = mrg(file, {
          f,
          u,
          o,
          t: function() {
            if (file.terminate)
              file.terminate();
          },
          r: function() {
            pAll_1();
            if (tr_1) {
              var nxt = _this.u[ind_1 + 1];
              if (nxt)
                nxt.r();
              else
                _this.d = 1;
            }
            tr_1 = 1;
          }
        });
        var cl_1 = 0;
        file.ondata = function(err2, dat, final) {
          if (err2) {
            _this.ondata(err2, dat, final);
            _this.terminate();
          } else {
            cl_1 += dat.length;
            chks_1.push(dat);
            if (final) {
              var dd = new u8(16);
              wbytes(dd, 0, 134695760);
              wbytes(dd, 4, file.crc);
              wbytes(dd, 8, cl_1);
              wbytes(dd, 12, file.size);
              chks_1.push(dd);
              uf_1.c = cl_1, uf_1.b = hl_1 + cl_1 + 16, uf_1.crc = file.crc, uf_1.size = file.size;
              if (tr_1)
                uf_1.r();
              tr_1 = 1;
            } else if (tr_1)
              pAll_1();
          }
        };
        this.u.push(uf_1);
      }
    };
    Zip2.prototype.end = function() {
      var _this = this;
      if (this.d & 2) {
        this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, true);
        return;
      }
      if (this.d)
        this.e();
      else
        this.u.push({
          r: function() {
            if (!(_this.d & 1))
              return;
            _this.u.splice(-1, 1);
            _this.e();
          },
          t: function() {
          }
        });
      this.d = 3;
    };
    Zip2.prototype.e = function() {
      var bt = 0, l = 0, tl = 0;
      for (var _i = 0, _a2 = this.u; _i < _a2.length; _i++) {
        var f = _a2[_i];
        tl += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0);
      }
      var out = new u8(tl + 22);
      for (var _b2 = 0, _c = this.u; _b2 < _c.length; _b2++) {
        var f = _c[_b2];
        wzh(out, bt, f, f.f, f.u, -f.c - 2, l, f.o);
        bt += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0), l += f.b;
      }
      wzf(out, bt, this.u.length, tl, l);
      this.ondata(null, out, true);
      this.d = 2;
    };
    Zip2.prototype.terminate = function() {
      for (var _i = 0, _a2 = this.u; _i < _a2.length; _i++) {
        var f = _a2[_i];
        f.t();
      }
      this.d = 2;
    };
    return Zip2;
  })();

  // src/processing/images.mjs
  var IMAGE_LIMITS = Object.freeze({ files: 50, decodedPixels: 4e7, outputPixels: 16e6, side: 8192 });
  var IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));
  function decodedLimit(width, height) {
    if (!width || !height) failLocal("INVALID_IMAGE", "Slika nima veljavnih dimenzij.");
    if (width * height > IMAGE_LIMITS.decodedPixels) failLocal("LIMIT_EXCEEDED", "Slika presega 40 milijonov slikovnih pik.");
  }
  function imageHeader(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset, value) => [...value].every((c, i2) => bytes[offset + i2] === c.charCodeAt(0));
    let width, height, mimeType;
    if (bytes.length >= 24 && bytes[0] === 137 && tag(1, "PNG\r\n\n") && tag(12, "IHDR")) {
      mimeType = "image/png";
      width = view.getUint32(16);
      height = view.getUint32(20);
    } else if (bytes.length >= 12 && tag(0, "RIFF") && tag(8, "WEBP")) {
      mimeType = "image/webp";
      for (let offset = 12; offset + 8 <= bytes.length; ) {
        const size = view.getUint32(offset + 4, true), p = offset + 8;
        if (p + size > bytes.length) break;
        if (tag(offset, "VP8X") && size >= 10) {
          width = 1 + bytes[p + 4] + (bytes[p + 5] << 8) + (bytes[p + 6] << 16);
          height = 1 + bytes[p + 7] + (bytes[p + 8] << 8) + (bytes[p + 9] << 16);
          break;
        }
        if (tag(offset, "VP8 ") && size >= 10 && tag(p + 3, "\x9D*")) {
          width = view.getUint16(p + 6, true) & 16383;
          height = view.getUint16(p + 8, true) & 16383;
          break;
        }
        if (tag(offset, "VP8L") && size >= 5 && bytes[p] === 47) {
          const bits = view.getUint32(p + 1, true);
          width = (bits & 16383) + 1;
          height = (bits >>> 14 & 16383) + 1;
          break;
        }
        offset = p + size + size % 2;
      }
    } else if (bytes[0] === 255 && bytes[1] === 216) {
      mimeType = "image/jpeg";
      let offset = 2;
      while (offset + 3 < bytes.length) {
        if (bytes[offset++] !== 255) break;
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++];
        if (marker === 217 || marker === 218) break;
        if (marker === 1 || marker >= 208 && marker <= 215) continue;
        if (offset + 2 > bytes.length) break;
        const size = view.getUint16(offset);
        if (size < 2 || offset + size > bytes.length) break;
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 8) {
          height = view.getUint16(offset + 3);
          width = view.getUint16(offset + 5);
          break;
        }
        offset += size;
      }
    }
    if (!mimeType || !width || !height) failLocal("INVALID_IMAGE", "Datoteka ni veljavna slika JPEG, PNG ali WebP.");
    decodedLimit(width, height);
    return { width, height, mimeType };
  }
  function resizeDimensions(width, height, { mode = "fit", maxWidth = 1920, maxHeight = 1080, enlarge = false, percentage = 100 } = {}) {
    decodedLimit(width, height);
    let scale;
    if (mode === "fit") {
      if (![maxWidth, maxHeight].every((n) => Number.isInteger(n) && n >= 1 && n <= IMAGE_LIMITS.side)) failLocal("INVALID_ARGUMENT", "Najve\u010Dja \u0161irina in vi\u0161ina morata biti med 1 in 8192.");
      scale = Math.min(maxWidth / width, maxHeight / height, enlarge ? Infinity : 1);
    } else if (mode === "percentage") {
      if (!Number.isInteger(percentage) || percentage < 1 || percentage > 400) failLocal("INVALID_ARGUMENT", "Odstotek mora biti celo \u0161tevilo med 1 in 400.");
      scale = percentage / 100;
    } else failLocal("INVALID_ARGUMENT", "Izberite prilagoditev meram ali odstotek.");
    const result = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    if (result.width > IMAGE_LIMITS.side || result.height > IMAGE_LIMITS.side || result.width * result.height > IMAGE_LIMITS.outputPixels) failLocal("LIMIT_EXCEEDED", "Izhod presega 16 milijonov slikovnih pik ali 8192 pik na stranico. Zmanj\u0161ajte mere ali odstotek.");
    return result;
  }
  async function decodeImage(file, check = () => {
  }) {
    check();
    if (file.size > LIMITS.fileBytes) failLocal("LIMIT_EXCEEDED", "Datoteka presega omejitev 64 MiB.");
    const header = imageHeader(new Uint8Array(await file.arrayBuffer()));
    check();
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      check();
      failLocal("INVALID_IMAGE", "Slike ni mogo\u010De odpreti. Datoteka je po\u0161kodovana ali nepodprta.");
    }
    try {
      check();
      decodedLimit(bitmap.width, bitmap.height);
    } catch (error) {
      bitmap.close();
      throw error;
    }
    return { bitmap, width: bitmap.width, height: bitmap.height, mimeType: header.mimeType };
  }
  function canvasBlob(canvas, mimeType, quality = 0.9) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => {
      if (!blob) reject(Object.assign(new Error("Kodiranje slike ni uspelo."), { code: "INVALID_IMAGE" }));
      else if (blob.type !== mimeType) reject(Object.assign(new Error("Brskalnik ne podpira izbranega izhodnega formata: " + mimeType + "."), { code: "UNSUPPORTED_FORMAT" }));
      else resolve(blob);
    }, mimeType, quality));
  }
  async function encoderSupported(mimeType) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    try {
      await canvasBlob(canvas, mimeType);
      return true;
    } catch {
      return false;
    } finally {
      canvas.width = canvas.height = 0;
    }
  }
  async function imagePreview(file, check = () => {
  }) {
    const image = await decodeImage(file, check);
    const canvas = document.createElement("canvas");
    try {
      const scale = Math.min(256 / image.width, 256 / image.height, 1);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image.bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob(canvas, "image/png");
      check();
      return { blob, width: image.width, height: image.height, mimeType: image.mimeType };
    } finally {
      image.bitmap.close();
      canvas.width = canvas.height = 0;
    }
  }
  function outputFilename(name, mimeType, used) {
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mimeType];
    let stem = name.replace(/\.[^.]*$/, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").trim().slice(0, 120) || "slika";
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = "_" + stem;
    let result = `${stem}.${extension}`, suffix = 1;
    while (used.has(result.normalize("NFC").toLowerCase())) result = `${stem} (${++suffix}).${extension}`;
    used.add(result.normalize("NFC").toLowerCase());
    return result;
  }
  async function resizeImage(file, args, check = () => {
  }) {
    const image = await decodeImage(file, check);
    const canvas = document.createElement("canvas");
    try {
      const dimensions = resizeDimensions(image.width, image.height, args);
      const mimeType = args.format === "source" || !args.format ? image.mimeType : args.format;
      if (!IMAGE_TYPES.includes(mimeType) || !await encoderSupported(mimeType)) failLocal("UNSUPPORTED_FORMAT", "Brskalnik ne podpira izbranega izhodnega formata: " + mimeType + ".");
      check();
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) failLocal("PROCESSING_FAILED", "Risanje na platno v tem brskalniku ni na voljo.");
      if (mimeType === "image/jpeg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(image.bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob(canvas, mimeType);
      check();
      if (blob.size > LIMITS.fileBytes) failLocal("LIMIT_EXCEEDED", "Izhodna slika presega omejitev 64 MiB.");
      return { blob, ...dimensions, sourceWidth: image.width, sourceHeight: image.height, mimeType };
    } finally {
      image.bitmap.close();
      canvas.width = canvas.height = 0;
    }
  }
  async function imageZip(entries, check = () => {
  }) {
    const chunks = [];
    let size = 0;
    const zip = new Zip((error, data) => {
      if (error) throw error;
      size += data.length;
      if (size > LIMITS.artifactBytes) failLocal("LIMIT_EXCEEDED", "ZIP presega omejitev 128 MiB.");
      chunks.push(data);
    });
    try {
      for (const file of entries) {
        check();
        const entry = new ZipPassThrough(file.name);
        zip.add(entry);
        for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
          const bytes = new Uint8Array(await file.slice(offset, offset + 1024 * 1024).arrayBuffer());
          check();
          entry.push(bytes, offset + bytes.length === file.size);
          await yieldTask();
          check();
        }
        if (!file.size) entry.push(new Uint8Array(), true);
      }
      zip.end();
      check();
      return new File(chunks, "pomanjsane-slike.zip", { type: "application/zip" });
    } catch (error) {
      zip.terminate();
      throw error;
    }
  }
  async function resizeImages(args, { files: files2, artifacts: artifacts2, check = () => {
  }, progress = () => {
  }, resize = resizeImage, zip = imageZip }) {
    if (!args.fileIds.length || args.fileIds.length > IMAGE_LIMITS.files) failLocal("LIMIT_EXCEEDED", "Izberite od 1 do 50 slik.");
    const results = [], successful = [], used = /* @__PURE__ */ new Set(), warnings = [];
    for (const fileId2 of args.fileIds) {
      check();
      progress({ fileId: fileId2, state: "processing" });
      let result;
      try {
        const record = files2.get(fileId2, "image-resizer");
        const resized = await resize(record.file, args, check);
        check();
        const file = new File([resized.blob], outputFilename(record.file.name, resized.mimeType, used), { type: resized.mimeType });
        const { blob, ...dimensions } = resized;
        const artifact = artifacts2.add(file, "image-resizer", dimensions);
        successful.push(file);
        result = { fileId: fileId2, success: true, ...dimensions, artifact };
      } catch (error) {
        check();
        result = { fileId: fileId2, success: false, error: { code: error.code || "INVALID_IMAGE", message: error.message, localized: !!error.localized } };
      }
      results.push(result);
      progress({ fileId: fileId2, state: result.success ? "complete" : "error", result });
      await yieldTask();
      check();
    }
    let zipArtifact = null;
    if (successful.length) {
      try {
        const file = await zip(successful, check);
        check();
        zipArtifact = artifacts2.add(file, "image-resizer");
      } catch (error) {
        check();
        warnings.push("ZIP ni bil ustvarjen: " + error.message + " Posamezni prenosi so \u0161e vedno na voljo.");
      }
    }
    return { images: results, count: successful.length, zipArtifact, warnings };
  }

  // src/operations/adapter.mjs
  function createAdapter({ core: core2, files: files2, artifacts: artifacts2, pdf, navigate: navigate2 = () => {
  }, appVersion, onInvalidate = () => {
  } }) {
    const definitions = new Map(OPERATIONS.map((operation) => [operation.name, operation]));
    const controllers = /* @__PURE__ */ new Map();
    const jobs = /* @__PURE__ */ new Map();
    const tails = /* @__PURE__ */ new Map();
    function invalidate(tool) {
      jobs.get(tool)?.abort();
      artifacts2.clear(tool);
      onInvalidate(tool);
      controllers.get(tool)?.invalidate?.();
    }
    async function process(name, args, check) {
      if (name === "format_xml") return { text: formatXml(args.text, args) };
      if (name === "generate_jwt") return generateJwt(args, check);
      if (name === "resize_images") return resizeImages(args, { files: files2, artifacts: artifacts2, check, progress: (update) => {
        check();
        controllers.get("image-resizer")?.fileProgress?.(update);
      } });
      if (name === "generate_emso") {
        const identifiers = core2.generateEmsos(args.count, { date: args.date ? core2.parseIsoDate(args.date) : null, gender: args.gender, adultOnly: args.adultOnly });
        if (!identifiers.every((value) => core2.validateEmso(value).valid)) fail("PROCESSING_FAILED", "Internal EM\u0160O checksum check failed.");
        return { identifiers, count: identifiers.length };
      }
      if (name === "generate_si_tax_numbers") {
        const identifiers = core2.generateSlovenianVats(args.count, { prefix: args.prefix });
        if (!identifiers.every((value) => core2.validateSlovenianVat(value).valid)) fail("PROCESSING_FAILED", "Internal tax-number checksum check failed.");
        return { identifiers, count: identifiers.length, checksumScope: "Slovenian eight-digit modulo 11 only; registration and VAT status unchecked." };
      }
      if (name === "format_json") return { text: core2.formatJson(args.text, { indent: args.indent === "tab" ? "	" : args.indent, minify: args.minify, sortKeys: args.sortKeys }) };
      if (name === "inspect_jwt") {
        const parsed = core2.parseJwt(args.token);
        const result = { structure: { valid: true, algorithm: parsed.algorithm, header: parsed.header, payload: parsed.payload }, claims: core2.analyzeJwtClaims(parsed.payload), signature: { state: "unchecked", valid: null } };
        if (args.verifySignature) {
          try {
            const verification = await core2.verifyJwtSignature(parsed.token, args.key, { keyEncoding: args.keyEncoding });
            check();
            result.signature = { state: verification.valid ? "valid" : "invalid", ...verification, trust: "supplied-key-only" };
          } catch (error) {
            check();
            result.signature = { state: "error", valid: false, message: error.message, trust: "supplied-key-only" };
          }
        }
        return result;
      }
      if (name === "convert_sparkasse_csv") {
        let text = args.text;
        let encoding = "text";
        let name2 = args.filename || "sparkasse.qif";
        if (args.fileId) {
          const record = files2.get(args.fileId, "qif");
          const bytes2 = new Uint8Array(await record.file.arrayBuffer());
          check();
          const decoded = core2.decodeTextBytes(bytes2, args.csvEncoding);
          text = decoded.text;
          encoding = decoded.encoding;
          if (!args.filename) name2 = record.file.name.replace(/\.[^.]+$/, "") + ".qif";
        }
        const converted = core2.convertSparkasseCsv(text, args);
        const bytes = core2.encodeTextBytes(converted.qif, args.outputEncoding);
        check();
        const file = new File([bytes], /\.qif$/i.test(name2) ? name2 : name2 + ".qif", { type: "application/x-qif" });
        return { qif: converted.qif, count: converted.transactionCount, warnings: converted.warnings, warningCount: converted.warningCount, inputEncoding: encoding, artifact: artifacts2.add(file, "qif", { transactionCount: converted.transactionCount }) };
      }
      if (name === "compose_pdf") {
        const composed = await pdf(args, check);
        check();
        return { pageCount: composed.pageCount, artifact: artifacts2.add(composed.file, "pdf", { pageCount: composed.pageCount }) };
      }
      if (name === "list_selected_files") return { files: files2.list() };
      if (name === "read_artifact") return artifacts2.read(args);
      fail("UNKNOWN_OPERATION", "Unknown operation.");
    }
    function envelope(operation, result, error) {
      return {
        success: !error,
        operation,
        apiVersion: API_VERSION,
        appVersion,
        result: error ? null : result,
        warnings: error ? [] : result?.warnings || [],
        error: error ? { code: error.code || "PROCESSING_FAILED", message: error.message || String(error) } : null
      };
    }
    function execute(name, input = {}, { signal, source = "agent" } = {}) {
      const definition = definitions.get(name);
      if (!definition) return Promise.resolve(envelope(name, null, { code: "UNKNOWN_OPERATION", message: "Unknown operation." }));
      const tool = definition.tool;
      let argumentsSnapshot;
      let argumentError;
      try {
        argumentsSnapshot = validateOperation(definition, input, core2);
      } catch (error) {
        argumentError = error;
      }
      const job = new AbortController();
      const abort = () => job.abort();
      if (tool) {
        invalidate(tool);
        jobs.set(tool, job);
      }
      if (signal?.aborted) job.abort();
      else signal?.addEventListener("abort", abort, { once: true });
      function check() {
        if (job.signal.aborted) fail("CANCELLED", "Operation cancelled or superseded.");
      }
      const run = async () => {
        let controller = controllers.get(tool);
        try {
          check();
          if (tool && source !== "manual") navigate2(tool);
          if (argumentError) throw argumentError;
          const args = argumentsSnapshot;
          await controller?.apply?.(args, source);
          check();
          controller?.progress?.(args);
          await Promise.resolve();
          check();
          const result = await process(name, args, check);
          check();
          controller = controllers.get(tool);
          controller?.render?.(result, args);
          return envelope(name, result, null);
        } catch (error) {
          controller = controllers.get(tool);
          if (tool) {
            artifacts2.clear(tool);
            onInvalidate(tool);
          }
          if (job.signal.aborted) error = { code: "CANCELLED", message: "Operation cancelled or superseded." };
          else {
            if (!error.code) error.code = { format_json: "INVALID_JSON", inspect_jwt: "INVALID_JWT", convert_sparkasse_csv: "INVALID_CSV", compose_pdf: "INVALID_PDF" }[name] || "PROCESSING_FAILED";
            controller?.error?.(error);
          }
          return envelope(name, null, error);
        } finally {
          signal?.removeEventListener("abort", abort);
          if (!tool || jobs.get(tool) === job) {
            controller?.settled?.(job.signal.aborted);
            jobs.delete(tool);
          }
        }
      };
      const promise = (tails.get(tool) || Promise.resolve()).then(run);
      if (tool) {
        tails.set(tool, promise);
        void promise.finally(() => {
          if (tails.get(tool) === promise) tails.delete(tool);
        });
      }
      return promise;
    }
    return { execute, invalidate, whenIdle(tool) {
      return tails.get(tool) || Promise.resolve();
    }, register(tool, controller) {
      controllers.set(tool, controller);
    }, dispose() {
      for (const tool of jobs.keys()) invalidate(tool);
      files2.clear();
      artifacts2.clear();
    } };
  }

  // src/operations/session.mjs
  function createFileStore() {
    const records = /* @__PURE__ */ new Map();
    let sequence = 0;
    return {
      add(file, tool, extra = {}) {
        const existing = [...records.values()].find((record) => record.file === file && record.tool === tool);
        if (existing) return existing.id;
        if (!file || typeof file.arrayBuffer !== "function") fail("INVALID_ARGUMENT", "Select a browser file first.");
        if (file.size > LIMITS.fileBytes || [...records.values()].reduce((sum, record) => sum + record.file.size, 0) + file.size > LIMITS.sessionFileBytes) fail("LIMIT_EXCEEDED", "Selected files exceed the session size limit.");
        const id = "file-" + ++sequence;
        records.set(id, { id, file, tool, ...extra });
        return id;
      },
      get(id, tool) {
        const record = records.get(id);
        if (!record || tool && record.tool !== tool) fail("FILE_NOT_FOUND", "Selected file is unavailable in this workspace.");
        return record;
      },
      update(id, metadata) {
        Object.assign(this.get(id), metadata);
      },
      list() {
        return [...records.values()].map(({ file, ...metadata }) => ({ ...metadata, name: file.name, mimeType: file.type, size: file.size }));
      },
      release(id) {
        records.delete(id);
      },
      clear(tool) {
        for (const [id, record] of records) if (!tool || record.tool === tool) records.delete(id);
      }
    };
  }
  function createArtifactStore(urls = URL) {
    const records = /* @__PURE__ */ new Map();
    let sequence = 0;
    return {
      getFile(id) {
        const record = records.get(id);
        if (!record) fail("ARTIFACT_NOT_FOUND", "Artifact expired or does not exist.");
        return record.file;
      },
      add(file, tool, counts = {}) {
        const total = [...records.values()].reduce((sum, record) => sum + record.file.size, 0);
        if (total + file.size > LIMITS.artifactBytes) fail("LIMIT_EXCEEDED", "Generated artifacts exceed the session size limit.");
        const metadata = { id: "artifact-" + ++sequence, filename: file.name, mimeType: file.type, size: file.size, ...counts, downloadUrl: urls.createObjectURL(file) };
        records.set(metadata.id, { metadata, file, tool });
        return metadata;
      },
      async read({ id, offset, length }) {
        const record = records.get(id);
        if (!record) fail("ARTIFACT_NOT_FOUND", "Artifact expired or does not exist.");
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > record.file.size || !Number.isInteger(length) || length < 1 || length > LIMITS.chunkBytes) fail("INVALID_ARGUMENT", "Artifact byte range is out of bounds.");
        const bytes = new Uint8Array(await record.file.slice(offset, offset + length).arrayBuffer());
        if (records.get(id) !== record) fail("ARTIFACT_NOT_FOUND", "Artifact was invalidated during reading.");
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return { id, offset, bytesRead: bytes.length, nextOffset: offset + bytes.length, eof: offset + bytes.length === record.file.size, base64: btoa(binary) };
      },
      clear(tool) {
        for (const [id, record] of records) if (!tool || record.tool === tool) {
          urls.revokeObjectURL(record.metadata.downloadUrl);
          records.delete(id);
        }
      }
    };
  }

  // src/metadata.mjs
  var PUBLIC_ORIGIN = "https://delavnica.kocmut.com/";
  function structuredData(page) {
    return {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: page.id === "overview" ? "Delavnica" : page.title,
      url: PUBLIC_ORIGIN + page.path,
      description: page.description,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements: "Modern browser with JavaScript; Web Crypto for JWT signature verification",
      inLanguage: "sl",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }
    };
  }

  // src/ui/router.mjs
  var tools = window.ToolboxTools;
  var TOOL_ROUTES = tools.map(function(tool) {
    return tool.id;
  });
  var ROUTE_SEQUENCE = ["overview"].concat(TOOL_ROUTES);
  var ROUTES = new Set(ROUTE_SEQUENCE);
  var ROUTE_TITLES = Object.fromEntries(tools.map(function(tool) {
    return [tool.id, tool.pageTitle];
  }));
  ROUTE_TITLES.overview = tools.overview.pageTitle;
  var renderedRoute = "";
  var root = new URL(window.DelavnicaRoot);
  var fileMode = window.location.protocol === "file:";
  var pages = [tools.overview, ...tools];
  function currentRoute() {
    const hash = window.location.hash.slice(1).toLowerCase();
    if (ROUTES.has(hash)) return hash;
    const relative = window.location.pathname.slice(root.pathname.length).replace(/index\.html$/, "");
    return pages.find((page) => page.path === relative)?.id || "overview";
  }
  function routeUrl(route) {
    return fileMode ? new URL("index.html#" + route, root).href : new URL(pages.find((page) => page.id === route).path, root).href;
  }
  function navigate(route, { replace = false, resetScroll = true } = {}) {
    if (!ROUTES.has(route)) throw new Error("Unknown tool route.");
    const url = routeUrl(route);
    if (window.location.href !== url) window.history[replace ? "replaceState" : "pushState"](null, "", url);
    renderRoute();
    if (resetScroll) {
      document.documentElement.classList.add("is-route-scroll-resetting");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      requestAnimationFrame(() => document.documentElement.classList.remove("is-route-scroll-resetting"));
    }
  }
  function initToolNavigation() {
    document.documentElement.style.setProperty("--tool-route-count", String(ROUTE_SEQUENCE.length));
    document.documentElement.style.setProperty("--tool-count", String(tools.length));
    document.querySelectorAll("[data-route]").forEach((link) => {
      link.href = routeUrl(link.dataset.route);
    });
  }
  function renderRoute() {
    const route = currentRoute();
    let activeLink = null;
    document.querySelectorAll("[data-panel]").forEach(function(panel) {
      panel.hidden = panel.dataset.panel !== route;
    });
    byId("mobile-info-hint").hidden = route !== "overview";
    document.querySelectorAll("[data-route]").forEach(function(link) {
      if (link.dataset.route === route) {
        link.setAttribute("aria-current", "page");
        if (link.classList.contains("tool-nav-link")) activeLink = link;
      } else {
        link.removeAttribute("aria-current");
      }
    });
    document.title = ROUTE_TITLES[route];
    if (route === "pdf") {
      window.DelavnicaPdfLoader.load();
    }
    const sidebar = document.querySelector(".sidebar");
    if (activeLink && sidebar && sidebar.scrollWidth > sidebar.clientWidth) {
      sidebar.scrollLeft = activeLink.offsetLeft - (sidebar.clientWidth - activeLink.offsetWidth) / 2;
    }
    if (activeLink && sidebar && sidebar.scrollHeight > sidebar.clientHeight) {
      sidebar.scrollTop = activeLink.offsetTop - (sidebar.clientHeight - activeLink.offsetHeight) / 2;
    }
    const changed = renderedRoute !== route;
    renderedRoute = route;
    const metadata = pages.find((page) => page.id === route);
    document.querySelector('meta[name="description"]').content = metadata.description;
    document.querySelector('link[rel="canonical"]').href = "https://delavnica.kocmut.com/" + metadata.path;
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = metadata.description;
    document.querySelector('meta[property="og:url"]').content = "https://delavnica.kocmut.com/" + metadata.path;
    document.getElementById("app-structured-data").textContent = JSON.stringify(structuredData(metadata));
    if (changed) window.dispatchEvent(new CustomEvent("delavnica:routechange", { detail: { route } }));
  }
  function initRouter() {
    function fromLocation() {
      const alias = window.location.hash.slice(1).toLowerCase();
      if (!fileMode && ROUTES.has(alias)) {
        navigate(alias, { replace: true, resetScroll: false });
      } else if (currentRoute() !== renderedRoute) renderRoute();
    }
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-route]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute("download") || link.target && link.target !== "_self") return;
      event.preventDefault();
      navigate(link.dataset.route);
    });
    window.addEventListener("popstate", fromLocation);
    window.addEventListener("hashchange", fromLocation);
    window.addEventListener("resize", renderRoute);
    fromLocation();
  }

  // src/ui/services.mjs
  var files = createFileStore();
  var artifacts = createArtifactStore();
  function showArtifact(tool, metadata) {
    document.getElementById(tool + "-artifact")?.remove();
    if (!metadata) return;
    const link = document.createElement("a");
    link.id = tool + "-artifact";
    link.className = "text-link artifact-link";
    link.href = metadata.downloadUrl;
    link.download = metadata.filename;
    link.textContent = "PRENESI " + metadata.filename + " (" + metadata.size + " B)";
    document.getElementById(tool + "-status").after(link);
  }
  var api = createAdapter({
    core: window.ToolboxCore,
    files,
    artifacts,
    navigate,
    appVersion: "2d292fa7f0932e360da5d63a62b8dd0809b7fb6121a70481a3a5f9148e7cb81c",
    onInvalidate: (tool) => showArtifact(tool, null),
    pdf: async (args, check) => {
      if (!await window.DelavnicaPdfLoader.load()) throw new Error("PDF engines could not be loaded.");
      check();
      return window.DelavnicaPdfWorkspace.compose(args, check);
    }
  });
  function initOperations() {
    window.DelavnicaSession = { files, artifacts, api, showArtifact, localizedError };
    api.register("pdf", { error(error) {
      const status = document.getElementById("pdf-status");
      status.textContent = localizedError(error);
      status.classList.add("is-error");
    } });
    window.DelavnicaAgent = Object.freeze({ apiVersion: API_VERSION, appVersion: "2d292fa7f0932e360da5d63a62b8dd0809b7fb6121a70481a3a5f9148e7cb81c", execute: (name, input, { signal } = {}) => api.execute(name, input, { signal }) });
    const lifetime = new AbortController();
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) {
        lifetime.abort();
        api.dispose();
        window.DelavnicaPdfWorkspace?.dispose();
      }
    });
    const modelContext = document.modelContext;
    if (typeof modelContext?.registerTool !== "function") return;
    void Promise.allSettled(OPERATIONS.map(async (operation) => {
      await modelContext.registerTool({
        name: operation.name,
        description: operation.description,
        inputSchema: operation.inputSchema,
        annotations: { readOnlyHint: !!operation.readOnly, consequentialHint: false, untrustedContentHint: true },
        execute: async (input, { signal } = {}) => JSON.stringify(await api.execute(operation.name, input, { signal }))
      }, { signal: lifetime.signal });
    }));
  }

  // src/ui/keyboard.mjs
  function initKeyboardShortcuts() {
    document.addEventListener("keydown", function(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") {
        return;
      }
      const route = currentRoute();
      const action = {
        emso: function() {
          byId("emso-form").requestSubmit();
        },
        vat: function() {
          byId("vat-form").requestSubmit();
        },
        jwt: function() {
          byId("jwt-parse").click();
        },
        json: function() {
          byId("json-format").click();
        },
        qif: function() {
          byId("qif-form").requestSubmit();
        },
        pdf: function() {
          byId("pdf-download").click();
        },
        xml: function() {
          byId("xml-format").click();
        },
        "jwt-generator": function() {
          byId("jwt-generator-form").requestSubmit();
        },
        "image-resizer": function() {
          byId("image-resizer-form").requestSubmit();
        }
      }[route];
      if (action) {
        event.preventDefault();
        action();
      }
    });
  }

  // src/ui/mobile/info-panel.mjs
  function initMobileInfoRail() {
    const hint = byId("mobile-info-hint");
    const rail = byId("mobile-info-rail");
    const closeButton = byId("mobile-info-close");
    const surface = byId("main-content");
    const homeLink = document.querySelector(".mobile-home-link");
    const sidebar = document.querySelector(".sidebar");
    const overviewPanel = document.querySelector('[data-panel="overview"]');
    if (!hint || !rail || !closeButton || !surface || !homeLink || !sidebar || !overviewPanel) {
      return;
    }
    let isOpen = false;
    let gesture = null;
    let settleTimer = 0;
    let settleFrame = 0;
    function isMobileInfoViewport() {
      return window.innerWidth <= 640 && window.innerWidth <= window.innerHeight;
    }
    function syncInfoGeometry() {
      if (isMobileInfoViewport()) {
        document.body.style.setProperty(
          "--mobile-info-width",
          homeLink.getBoundingClientRect().width + "px"
        );
        document.body.style.setProperty(
          "--mobile-nav-height",
          sidebar.getBoundingClientRect().height + "px"
        );
      } else {
        document.body.style.removeProperty("--mobile-info-width");
        document.body.style.removeProperty("--mobile-nav-height");
      }
    }
    function matchingTouch(touches, identifier) {
      return Array.from(touches).find(function(touch) {
        return touch.identifier === identifier;
      });
    }
    function setOpen(nextOpen, focusTarget, forceAnimation) {
      const resolvedOpen = Boolean(
        nextOpen && isMobileInfoViewport() && currentRoute() === "overview"
      );
      const shouldAnimate = isMobileInfoViewport() && currentRoute() === "overview" && Boolean(forceAnimation || resolvedOpen !== isOpen);
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(settleFrame);
      gesture = null;
      if (shouldAnimate) {
        document.body.classList.add("is-mobile-info-settling");
      }
      isOpen = resolvedOpen;
      document.body.classList.toggle("is-mobile-info-open", isOpen);
      document.body.classList.remove("is-mobile-info-dragging");
      rail.setAttribute("aria-hidden", String(!isOpen));
      rail.inert = !isOpen;
      hint.setAttribute("aria-expanded", String(isOpen));
      if (shouldAnimate) {
        settleFrame = window.requestAnimationFrame(function() {
          rail.style.removeProperty("transform");
          overviewPanel.style.removeProperty("transform");
        });
        settleTimer = window.setTimeout(function() {
          document.body.classList.remove("is-mobile-info-settling");
        }, 260);
      } else {
        rail.style.removeProperty("transform");
        overviewPanel.style.removeProperty("transform");
        document.body.classList.remove("is-mobile-info-settling");
      }
      if (focusTarget) {
        (isOpen ? closeButton : surface).focus({ preventScroll: true });
      }
    }
    function resetGesture() {
      document.body.classList.remove("is-mobile-info-dragging");
      rail.style.removeProperty("transform");
      overviewPanel.style.removeProperty("transform");
      rail.setAttribute("aria-hidden", String(!isOpen));
      rail.inert = !isOpen;
      gesture = null;
    }
    function startGesture(event, fromRail) {
      if (!isMobileInfoViewport() || currentRoute() !== "overview" || event.touches.length !== 1 || surface.classList.contains("is-swipe-settling")) {
        return;
      }
      const touch = event.touches[0];
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(settleFrame);
      document.body.classList.remove("is-mobile-info-settling");
      if (fromRail || isOpen) {
        event.stopPropagation();
      }
      gesture = {
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        dragging: false,
        startedOpen: isOpen,
        width: Math.max(1, rail.getBoundingClientRect().width || surface.clientWidth / ROUTE_SEQUENCE.length)
      };
    }
    function moveGesture(event) {
      if (!gesture) {
        return;
      }
      const touch = matchingTouch(event.touches, gesture.identifier);
      if (!touch) {
        return;
      }
      const horizontalDistance = touch.clientX - gesture.startX;
      const verticalDistance = touch.clientY - gesture.startY;
      if (!gesture.dragging) {
        if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 8) {
          return;
        }
        if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance) * 1.08) {
          resetGesture();
          return;
        }
        if (!gesture.startedOpen && horizontalDistance < 0) {
          gesture = null;
          return;
        }
        gesture.dragging = true;
        document.body.classList.add("is-mobile-info-dragging");
        rail.setAttribute("aria-hidden", "false");
      }
      event.preventDefault();
      event.stopPropagation();
      const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
      gesture.velocity = (touch.clientX - gesture.lastX) / elapsed;
      gesture.lastX = touch.clientX;
      gesture.lastTime = event.timeStamp;
      const initial = gesture.startedOpen ? gesture.width : 0;
      const progress = Math.max(0, Math.min(gesture.width, initial + horizontalDistance));
      rail.style.transform = "translate3d(" + (progress - gesture.width) + "px, 0, 0)";
      overviewPanel.style.transform = "translate3d(" + progress + "px, 0, 0)";
    }
    function endGesture(event) {
      if (!gesture) {
        return;
      }
      const touch = matchingTouch(event.changedTouches, gesture.identifier);
      if (!touch) {
        return;
      }
      if (!gesture.dragging) {
        resetGesture();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const horizontalDistance = touch.clientX - gesture.startX;
      const threshold = Math.min(46, gesture.width * 0.5);
      const fastOpening = gesture.velocity > 0.35 && horizontalDistance > 18;
      const fastClosing = gesture.velocity < -0.35 && horizontalDistance < -18;
      const nextOpen = gesture.startedOpen ? !(horizontalDistance <= -threshold || fastClosing) : horizontalDistance >= threshold || fastOpening;
      gesture = null;
      setOpen(nextOpen, false, true);
    }
    hint.addEventListener("click", function() {
      setOpen(true, true);
    });
    closeButton.addEventListener("click", function() {
      setOpen(false, true);
    });
    rail.addEventListener("click", function(event) {
      if (event.target.closest("a")) {
        setOpen(false, false);
      }
    });
    [overviewPanel, hint].forEach(function(target) {
      target.addEventListener("touchstart", function(event) {
        startGesture(event, false);
      }, { passive: true });
    });
    rail.addEventListener("touchstart", function(event) {
      startGesture(event, true);
    }, { passive: true });
    [overviewPanel, rail, hint].forEach(function(target) {
      target.addEventListener("touchmove", moveGesture, { passive: false });
      target.addEventListener("touchend", endGesture, { passive: false });
      target.addEventListener("touchcancel", function() {
        if (gesture && gesture.dragging) {
          gesture = null;
          setOpen(isOpen, false, true);
        } else {
          resetGesture();
        }
      }, { passive: true });
    });
    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape" && isOpen) {
        setOpen(false, true);
      }
    });
    window.addEventListener("delavnica:routechange", function() {
      if (currentRoute() !== "overview" && (isOpen || gesture || document.body.classList.contains("is-mobile-info-settling"))) {
        setOpen(false, false);
      }
    });
    window.addEventListener("resize", function() {
      syncInfoGeometry();
      if (!isMobileInfoViewport()) {
        setOpen(false, false);
      }
    });
    window.addEventListener("pageshow", function(event) {
      if (event.persisted) {
        setOpen(false, false);
      }
    });
    const layoutObserver = new ResizeObserver(syncInfoGeometry);
    layoutObserver.observe(homeLink);
    layoutObserver.observe(sidebar);
    syncInfoGeometry();
    setOpen(false, false);
  }

  // src/ui/mobile/swipe.mjs
  function initSwipeNavigation() {
    const surface = byId("main-content");
    let gesture = null;
    let settleTimer = 0;
    let settleFrame = 0;
    function panelForRoute(route) {
      return surface.querySelector('[data-panel="' + route + '"]');
    }
    function matchingTouch(touches, identifier) {
      return Array.from(touches).find(function(touch) {
        return touch.identifier === identifier;
      });
    }
    function isSwipeViewport() {
      return window.innerWidth <= 860 || window.innerWidth > window.innerHeight && window.innerHeight <= 500;
    }
    function clearPanelState(panel) {
      if (!panel) {
        return;
      }
      panel.classList.remove("is-swipe-active", "is-swipe-target");
      panel.style.removeProperty("transform");
      panel.style.removeProperty("top");
      panel.removeAttribute("aria-hidden");
      panel.hidden = panel.dataset.panel !== currentRoute();
    }
    function scrollToTopInstantly() {
      const root2 = document.documentElement;
      root2.classList.add("is-route-scroll-resetting");
      void root2.offsetWidth;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.requestAnimationFrame(function() {
        window.requestAnimationFrame(function() {
          root2.classList.remove("is-route-scroll-resetting");
        });
      });
    }
    function resetGesture() {
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(settleFrame);
      if (gesture) {
        clearPanelState(gesture.activePanel);
        clearPanelState(gesture.targetPanel);
      }
      surface.classList.remove("is-swiping", "is-swipe-settling");
      gesture = null;
    }
    function finishGesture(activeGesture) {
      if (gesture !== activeGesture) {
        return;
      }
      const destination = activeGesture.commit && currentRoute() === activeGesture.route ? activeGesture.targetRoute : "";
      resetGesture();
      if (destination) {
        navigate(destination);
        scrollToTopInstantly();
      }
    }
    function prepareTarget(direction) {
      if (!gesture || gesture.direction === direction) {
        return;
      }
      if (gesture.targetPanel) {
        clearPanelState(gesture.targetPanel);
        gesture.targetPanel.hidden = true;
      }
      gesture.direction = direction;
      gesture.targetPanel = null;
      gesture.targetRoute = "";
      const routeIndex = ROUTE_SEQUENCE.indexOf(gesture.route);
      const targetRoute = ROUTE_SEQUENCE[routeIndex + direction];
      if (!targetRoute) {
        return;
      }
      const targetPanel = panelForRoute(targetRoute);
      if (!targetPanel) {
        return;
      }
      targetPanel.hidden = false;
      targetPanel.classList.add("is-swipe-target");
      targetPanel.setAttribute("aria-hidden", "true");
      targetPanel.style.top = gesture.scrollY + "px";
      targetPanel.style.transform = "translate3d(" + direction * gesture.width + "px, 0, 0)";
      gesture.targetPanel = targetPanel;
      gesture.targetRoute = targetRoute;
    }
    function settleGesture(commit) {
      if (!gesture || !gesture.dragging) {
        resetGesture();
        return;
      }
      const activeGesture = gesture;
      const shouldCommit = Boolean(commit && activeGesture.targetPanel && activeGesture.targetRoute);
      activeGesture.settling = true;
      activeGesture.commit = shouldCommit;
      surface.classList.remove("is-swiping");
      surface.classList.add("is-swipe-settling");
      void surface.offsetWidth;
      settleFrame = window.requestAnimationFrame(function() {
        if (gesture !== activeGesture) {
          return;
        }
        activeGesture.activePanel.style.transform = shouldCommit ? "translate3d(" + -activeGesture.direction * activeGesture.width + "px, 0, 0)" : "translate3d(0, 0, 0)";
        if (activeGesture.targetPanel) {
          activeGesture.targetPanel.style.transform = shouldCommit ? "translate3d(0, 0, 0)" : "translate3d(" + activeGesture.direction * activeGesture.width + "px, 0, 0)";
        }
      });
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      settleTimer = window.setTimeout(function() {
        finishGesture(activeGesture);
      }, reducedMotion ? 20 : 285);
    }
    surface.addEventListener("touchstart", function(event) {
      if (gesture && gesture.settling) {
        finishGesture(gesture);
      } else {
        resetGesture();
      }
      if (!isSwipeViewport() || event.touches.length !== 1) {
        return;
      }
      const route = currentRoute();
      const activePanel = panelForRoute(route);
      if (!activePanel) {
        return;
      }
      const touch = event.touches[0];
      gesture = {
        identifier: touch.identifier,
        route,
        activePanel,
        targetPanel: null,
        targetRoute: "",
        direction: 0,
        dragging: false,
        x: touch.clientX,
        y: touch.clientY,
        lastX: touch.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        scrollY: window.scrollY,
        width: Math.max(1, surface.clientWidth)
      };
    }, { passive: true });
    surface.addEventListener("touchmove", function(event) {
      if (!gesture || gesture.settling) {
        return;
      }
      const touch = matchingTouch(event.touches, gesture.identifier);
      if (!touch) {
        return;
      }
      const horizontalDistance = touch.clientX - gesture.x;
      const verticalDistance = touch.clientY - gesture.y;
      if (!gesture.dragging) {
        if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 9) {
          return;
        }
        if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance) * 1.08) {
          gesture = null;
          return;
        }
        gesture.dragging = true;
        gesture.activePanel.classList.add("is-swipe-active");
        surface.classList.add("is-swiping");
      }
      event.preventDefault();
      const direction = horizontalDistance < 0 ? 1 : -1;
      prepareTarget(direction);
      const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
      gesture.velocity = (touch.clientX - gesture.lastX) / elapsed;
      gesture.lastX = touch.clientX;
      gesture.lastTime = event.timeStamp;
      let translated = Math.max(-gesture.width, Math.min(gesture.width, horizontalDistance));
      if (!gesture.targetPanel) {
        translated *= 0.18;
      }
      gesture.activePanel.style.transform = "translate3d(" + translated + "px, 0, 0)";
      if (gesture.targetPanel) {
        gesture.targetPanel.style.transform = "translate3d(" + (translated + gesture.direction * gesture.width) + "px, 0, 0)";
      }
    }, { passive: false });
    surface.addEventListener("touchend", function(event) {
      if (!gesture || gesture.settling) {
        return;
      }
      const touch = matchingTouch(event.changedTouches, gesture.identifier);
      if (!touch) {
        return;
      }
      if (!gesture.dragging) {
        resetGesture();
        return;
      }
      event.preventDefault();
      const horizontalDistance = touch.clientX - gesture.x;
      const minimumDistance = Math.min(110, Math.max(58, gesture.width * 0.18));
      const fastSwipe = Math.abs(gesture.velocity) > 0.42 && Math.abs(horizontalDistance) > 28;
      settleGesture(
        Boolean(gesture.targetPanel) && (Math.abs(horizontalDistance) >= minimumDistance || fastSwipe)
      );
    }, { passive: false });
    surface.addEventListener("touchcancel", function() {
      if (gesture && gesture.settling) {
        return;
      }
      if (gesture && gesture.dragging) {
        settleGesture(false);
      } else {
        resetGesture();
      }
    }, { passive: true });
    window.addEventListener("delavnica:routechange", function() {
      if (gesture && gesture.route !== currentRoute()) {
        resetGesture();
      }
    });
    window.addEventListener("resize", function() {
      if (gesture && gesture.settling) {
        finishGesture(gesture);
      } else {
        resetGesture();
      }
    });
  }

  // src/ui/tools/emso.mjs
  function initEmsoTool() {
    const form = byId("emso-form");
    const dateInput = byId("emso-date");
    const clearDateButton = byId("emso-date-clear");
    const genderInput = byId("emso-gender");
    const ageInput = byId("emso-age");
    const countInput = byId("emso-count");
    const output = byId("emso-output");
    const outputCount = byId("emso-output-count");
    const status = byId("emso-status");
    const today = utcToday();
    dateInput.max = today.toISOString().slice(0, 10);
    capAtMaximum(countInput, 5e3, function() {
      setStatus(status, "Koli\u010Dina je omejena na najve\u010D 5.000 zapisov.", false);
    });
    function syncDateControls(announce) {
      const adultOnly = ageInput.value === "adult";
      if (adultOnly) {
        dateInput.value = "";
      }
      dateInput.disabled = adultOnly;
      clearDateButton.disabled = adultOnly || !dateInput.value;
      if (announce) {
        setStatus(
          status,
          adultOnly ? "Datum rojstva je izklopljen. Ob generiranju bodo starosti naklju\u010Dne in vedno 18+." : "Datum rojstva lahko izberete ali pustite prazen za naklju\u010Dno starost.",
          false
        );
      }
    }
    dateInput.addEventListener("input", function() {
      clearDateButton.disabled = !dateInput.value;
    });
    clearDateButton.addEventListener("click", function() {
      dateInput.value = "";
      syncDateControls(false);
      dateInput.focus();
      setStatus(status, "Datum rojstva je po\u010Di\u0161\u010Den; uporabljen bo naklju\u010Den datum.", false);
    });
    ageInput.addEventListener("change", function() {
      syncDateControls(true);
    });
    api.register("emso", {
      apply(args) {
        countInput.value = String(args.count);
        dateInput.value = args.date;
        genderInput.value = args.gender;
        ageInput.value = args.adultOnly ? "adult" : "any";
        syncDateControls(false);
      },
      progress() {
        setStatus(status, "Generiranje\u2026", false);
      },
      render(result, args) {
        output.value = result.identifiers.join("\n");
        outputCount.textContent = result.count + " ZAPISOV";
        setStatus(status, args.adultOnly ? "Generirane so naklju\u010Dne osebe, stare najmanj 18 let; vsi zapisi so kontrolno preverjeni." : "Generirano in kontrolno preverjeno v tem brskalniku.", false);
      },
      error(error) {
        setStatus(status, localizedError(error), true);
      },
      settled(cancelled) {
        if (cancelled) setStatus(status, "Opravilo je preklicano.", false);
      }
    });
    form.addEventListener("input", () => api.invalidate("emso"));
    form.addEventListener("change", () => api.invalidate("emso"));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void api.execute("generate_emso", { count: core.clampCount(countInput.value, 5e3), date: dateInput.value, gender: genderInput.value, adultOnly: ageInput.value === "adult" }, { source: "manual" });
    });
    syncDateControls(false);
    form.requestSubmit();
  }

  // src/ui/tools/vat.mjs
  function initVatTool() {
    const form = byId("vat-form");
    const countInput = byId("vat-count");
    const prefixInput = byId("vat-prefix");
    const output = byId("vat-output");
    const outputCount = byId("vat-output-count");
    const status = byId("vat-status");
    capAtMaximum(countInput, 5e3, function() {
      setStatus(status, "Koli\u010Dina je omejena na najve\u010D 5.000 zapisov.", false);
    });
    api.register("vat", {
      apply(args) {
        countInput.value = String(args.count);
        prefixInput.checked = args.prefix;
      },
      progress() {
        setStatus(status, "Generiranje\u2026", false);
      },
      render(result, args) {
        output.value = result.identifiers.join("\n");
        outputCount.textContent = result.count + " ZAPISOV";
        setStatus(status, "Generirano in lokalno preverjeno po modulu 11.", false);
      },
      error(error) {
        setStatus(status, localizedError(error), true);
      },
      settled(cancelled) {
        if (cancelled) setStatus(status, "Opravilo je preklicano.", false);
      }
    });
    form.addEventListener("input", () => api.invalidate("vat"));
    form.addEventListener("change", () => api.invalidate("vat"));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void api.execute("generate_si_tax_numbers", { count: core.clampCount(countInput.value, 5e3), prefix: prefixInput.checked }, { source: "manual" });
    });
    form.requestSubmit();
  }

  // src/ui/tools/jwt.mjs
  function readableClaimValue(claim, value) {
    if (["exp", "nbf", "iat"].includes(claim) && typeof value === "number") {
      try {
        return new Date(value * 1e3).toISOString() + " (" + value + ")";
      } catch (error) {
        return String(value);
      }
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  function renderClaimChecks(analysis) {
    const container = byId("jwt-claims");
    container.replaceChildren();
    const stateLabels = {
      absent: "MANJKA",
      invalid: "NEVELJAVNO",
      valid: "VELJAVNO",
      warning: "OPOZORILO",
      info: "PODATEK"
    };
    function claimMessage(check) {
      if (check.state === "absent") {
        return {
          exp: "\u010Cas poteka ni dolo\u010Den.",
          nbf: "\u010Cas za\u010Detka veljavnosti ni omejen.",
          iat: "\u010Cas izdaje ni dolo\u010Den."
        }[check.claim] || "Zahtevek ni podan.";
      }
      if (check.state === "info") {
        return "Zahtevek je prisoten.";
      }
      if (check.claim === "exp") {
        return check.state === "valid" ? "\u017Deton \u0161e ni potekel." : "\u017Deton je potekel ali ima neveljaven \u010Das poteka.";
      }
      if (check.claim === "nbf") {
        return check.state === "valid" ? "\u017Deton je \u017Ee veljaven." : "\u017Deton \u0161e ni za\u010Del veljati ali ima neveljaven \u010Das.";
      }
      if (check.claim === "iat") {
        return check.state === "warning" ? "\u010Cas izdaje je v prihodnosti; preverite uro sistema." : "\u010Cas izdaje je smiseln.";
      }
      return check.message;
    }
    analysis.checks.forEach(function(check) {
      const row = document.createElement("div");
      row.className = "claim-row";
      const name = document.createElement("strong");
      const details = document.createElement("span");
      name.textContent = check.claim.toUpperCase() + " / " + (stateLabels[check.state] || check.state.toUpperCase());
      details.textContent = check.value === void 0 ? claimMessage(check) : readableClaimValue(check.claim, check.value) + " \u2014 " + claimMessage(check);
      row.append(name, details);
      container.appendChild(row);
    });
  }
  function initJwtTool() {
    const input = byId("jwt-input");
    const parseButton = byId("jwt-parse");
    const clearButton = byId("jwt-clear");
    const results = byId("jwt-results");
    const headerOutput = byId("jwt-header-output");
    const payloadOutput = byId("jwt-payload-output");
    const size = byId("jwt-size");
    const status = byId("jwt-status");
    const structureState = byId("jwt-structure-state");
    const timeState = byId("jwt-time-state");
    const signatureState = byId("jwt-signature-state");
    const key = byId("jwt-key");
    const keyLabel = byId("jwt-key-label");
    const keyEncodingField = byId("jwt-key-encoding-field");
    const keyEncoding = byId("jwt-key-encoding");
    const verifyButton = byId("jwt-verify");
    const verifyHelp = byId("jwt-verify-help");
    let parseTimer = 0;
    let activeToken = "";
    function resetValidation() {
      activeToken = "";
      results.hidden = true;
      headerOutput.textContent = "";
      payloadOutput.textContent = "";
      setValidationState(structureState, "\u010CAKANJE", "neutral");
      setValidationState(timeState, "\u010CAKANJE", "neutral");
      setValidationState(signatureState, "NI PREVERJEN", "neutral");
      verifyButton.disabled = true;
    }
    function parseToken() {
      if (!input.value.trim()) {
        api.invalidate("jwt");
        resetValidation();
        setStatus(status, "Za za\u010Detek prilepite \u017Eeton.", false);
        return;
      }
      return api.execute("inspect_jwt", { token: input.value, key: key.value, keyEncoding: keyEncoding.value }, { source: "manual" });
    }
    function renderInspection(result) {
      const parsed = result.structure;
      const analysis = result.claims;
      const algorithm = core.JWT_ALGORITHMS[parsed.algorithm];
      activeToken = input.value.trim();
      headerOutput.textContent = JSON.stringify(parsed.header, null, 2);
      payloadOutput.textContent = JSON.stringify(parsed.payload, null, 2);
      renderClaimChecks(analysis);
      results.hidden = false;
      setValidationState(structureState, "VELJAVNO", "valid");
      setValidationState(timeState, analysis.valid ? "VELJAVNO" : "NEVELJAVNO", analysis.valid ? "valid" : "invalid");
      setValidationState(signatureState, "NI PREVERJEN", "neutral");
      if (algorithm) {
        const usesSecret = algorithm.family === "hmac";
        keyLabel.textContent = usesSecret ? "Skrivnost HMAC" : "Javni klju\u010D PEM (SPKI)";
        key.placeholder = usesSecret ? "Vnesite skupno skrivnost" : "-----BEGIN PUBLIC KEY-----";
        keyEncodingField.hidden = !usesSecret;
        verifyButton.disabled = false;
        verifyHelp.textContent = "Zaznan algoritem " + parsed.algorithm + ". " + (usesSecret ? "Vnesite skupno skrivnost, s katero je bil \u017Eeton podpisan." : "Prilepite ustrezni javni klju\u010D SPKI.");
      } else {
        keyLabel.textContent = "Klju\u010D za preverjanje";
        keyEncodingField.hidden = true;
        verifyButton.disabled = true;
        verifyHelp.textContent = parsed.algorithm.toLowerCase() === "none" ? "Nepodpisani \u017Eetoni se raz\u010Dlenijo, vendar se nikoli ne ozna\u010Dijo kot veljavno podpisani." : "Lokalni preverjevalnik tega algoritma ne podpira.";
      }
      setStatus(
        status,
        "\u017Deton " + parsed.algorithm + " je raz\u010Dlenjen. Zahtevki so preverjeni, podpis pa \u0161e ne.",
        !analysis.valid
      );
      if (result.signature.state !== "unchecked") {
        const verification = result.signature;
        setValidationState(signatureState, verification.state === "error" ? "NAPAKA" : verification.valid ? "VELJAVNO" : "NEVELJAVNO", verification.valid ? "valid" : "invalid");
        setStatus(status, verification.state === "error" ? localizedError(new Error(verification.message)) : verification.valid ? "Podpis je uspe\u0161no preverjen z " + verification.algorithm + "." : "Preverjanje podpisa ni uspelo. Klju\u010D ali \u017Eeton se ne ujema.", !verification.valid);
      }
    }
    api.register("jwt", {
      apply(args) {
        window.clearTimeout(parseTimer);
        input.value = args.token;
        key.value = args.key;
        keyEncoding.value = args.keyEncoding;
        size.textContent = core.formatBytes(core.utf8Size(args.token));
      },
      progress(args) {
        verifyButton.disabled = true;
        setValidationState(signatureState, args.verifySignature ? "PREVERJANJE" : "NI PREVERJEN", "neutral");
        setStatus(status, args.verifySignature ? "Preverjanje z brskalni\u0161kim vmesnikom Web Crypto\u2026" : "Raz\u010Dlenjevanje \u017Eetona\u2026", false);
      },
      render: renderInspection,
      error(error) {
        resetValidation();
        setValidationState(structureState, error.code === "INVALID_ARGUMENT" ? "NI PREVERJENO" : "NEVELJAVNO", error.code === "INVALID_ARGUMENT" ? "neutral" : "invalid");
        setValidationState(timeState, "NI PREVERJENO", "neutral");
        setStatus(status, localizedError(error), true);
      },
      settled(cancelled) {
        if (cancelled) {
          setValidationState(signatureState, "NI PREVERJEN", "neutral");
          setStatus(status, "Opravilo je preklicano.", false);
          verifyButton.disabled = !activeToken;
        }
      }
    });
    input.addEventListener("input", function() {
      api.invalidate("jwt");
      resetValidation();
      size.textContent = core.formatBytes(core.utf8Size(input.value));
      window.clearTimeout(parseTimer);
      parseTimer = window.setTimeout(parseToken, 180);
    });
    parseButton.addEventListener("click", parseToken);
    clearButton.addEventListener("click", function() {
      window.clearTimeout(parseTimer);
      api.invalidate("jwt");
      input.value = "";
      key.value = "";
      size.textContent = "0 B";
      resetValidation();
      setStatus(status, "Za za\u010Detek prilepite \u017Eeton.", false);
      input.focus();
    });
    for (const control of [key, keyEncoding]) control.addEventListener("input", () => {
      api.invalidate("jwt");
      setValidationState(signatureState, "NI PREVERJEN", "neutral");
    });
    verifyButton.addEventListener("click", function() {
      if (!input.value.trim()) return parseToken();
      if (!key.value) {
        setStatus(status, "Vnesite skrivnost ali javni klju\u010D za preverjanje.", true);
        key.focus();
        return;
      }
      void api.execute("inspect_jwt", { token: input.value, verifySignature: true, key: key.value, keyEncoding: keyEncoding.value }, { source: "manual" });
    });
  }

  // src/ui/tools/json.mjs
  var AUTO_FORMAT_LIMIT = 2 * 1024 * 1024;
  function initJsonTool() {
    const input = byId("json-input");
    const output = byId("json-output");
    const indentInput = byId("json-indent");
    const sortInput = byId("json-sort");
    const inputSize = byId("json-input-size");
    const outputSize = byId("json-output-size");
    const status = byId("json-status");
    const formatButton = byId("json-format");
    const minifyButton = byId("json-minify");
    const clearButton = byId("json-clear");
    let formatTimer = 0;
    function format(minify, automatic) {
      const source = input.value.trim();
      if (!source) {
        output.value = "";
        outputSize.textContent = "0 B";
        setStatus(status, "Prilepite JSON za oblikovanje.", false);
        return;
      }
      if (automatic && source.length > AUTO_FORMAT_LIMIT) {
        setStatus(status, "Zaznan je velik vnos. Ko ste pripravljeni, pritisnite OBLIKUJ.", false);
        return;
      }
      void api.execute("format_json", { text: input.value, indent: indentInput.value === "tab" ? "tab" : Number(indentInput.value), minify: Boolean(minify), sortKeys: sortInput.checked }, { source: "manual" });
    }
    api.register("json", {
      apply(args) {
        window.clearTimeout(formatTimer);
        input.value = args.text;
        indentInput.value = String(args.indent);
        sortInput.checked = args.sortKeys;
        inputSize.textContent = core.formatBytes(core.utf8Size(args.text));
      },
      progress() {
        setStatus(status, "Oblikovanje JSON\u2026", false);
      },
      render(result, args) {
        output.value = result.text;
        outputSize.textContent = core.formatBytes(core.utf8Size(result.text));
        setStatus(status, args.minify ? "JSON je veljaven in uspe\u0161no strnjen." : "JSON je veljaven in uspe\u0161no oblikovan.", false);
      },
      error(error) {
        output.value = "";
        outputSize.textContent = "0 B";
        setStatus(status, localizedError(error), true);
      },
      settled(cancelled) {
        if (cancelled) setStatus(status, "Opravilo je preklicano.", false);
      }
    });
    input.addEventListener("input", function() {
      api.invalidate("json");
      inputSize.textContent = core.formatBytes(core.utf8Size(input.value));
      window.clearTimeout(formatTimer);
      formatTimer = window.setTimeout(function() {
        format(false, true);
      }, 160);
    });
    formatButton.addEventListener("click", function() {
      format(false, false);
    });
    minifyButton.addEventListener("click", function() {
      format(true, false);
    });
    indentInput.addEventListener("change", function() {
      api.invalidate("json");
      format(false, true);
    });
    sortInput.addEventListener("change", function() {
      api.invalidate("json");
      format(false, true);
    });
    clearButton.addEventListener("click", function() {
      window.clearTimeout(formatTimer);
      api.invalidate("json");
      input.value = "";
      output.value = "";
      inputSize.textContent = "0 B";
      outputSize.textContent = "0 B";
      setStatus(status, "Prilepite JSON za oblikovanje.", false);
      input.focus();
    });
  }

  // src/ui/tools/qif.mjs
  var QIF_SETTINGS_STORAGE_KEY = "delavnica.qif.settings.v1";
  function initQifTool() {
    const form = byId("qif-form");
    const fileInput = byId("qif-file");
    const dropZone = byId("qif-drop-zone");
    const fileName = byId("qif-file-name");
    const csvEncoding = byId("qif-csv-encoding");
    const outputEncoding = byId("qif-output-encoding");
    const qifType = byId("qif-type");
    const inputDate = byId("qif-input-date");
    const outputDate = byId("qif-output-date");
    const appendCode = byId("qif-append-code");
    const stopOnErrors = byId("qif-stop-errors");
    const rememberSettings = byId("qif-remember-settings");
    const convertButton = byId("qif-convert");
    const downloadButton = byId("qif-download");
    const shareButton = byId("qif-share");
    const copyButton = byId("qif-copy");
    const clearButton = byId("qif-clear");
    const output = byId("qif-output");
    const outputCount = byId("qif-output-count");
    const outputNote = byId("qif-output-note");
    const status = byId("qif-status");
    const previewLimit = 8e4;
    let selectedFile = null;
    let selectedFileId = null;
    let selectedText = null;
    let artifactName = "";
    let convertedQif = "";
    const qifFileType = "application/x-qif";
    const qifPickerTypes = [{
      description: "Datoteka QIF",
      accept: { "application/x-qif": [".qif"] }
    }];
    const qifSharingAvailable = Boolean(
      shareButton && typeof window.File === "function" && fileOutput.canShare(new File([""], "delavnica.qif", { type: qifFileType }))
    );
    if (shareButton) {
      shareButton.hidden = !qifSharingAvailable;
    }
    function selectHasValue(select, value) {
      return Array.from(select.options).some(function(option) {
        return option.value === value;
      });
    }
    function restoreSettings() {
      try {
        const raw = window.localStorage.getItem(QIF_SETTINGS_STORAGE_KEY);
        if (!raw) {
          return false;
        }
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== "object") {
          return false;
        }
        if (selectHasValue(csvEncoding, saved.csvEncoding)) {
          csvEncoding.value = saved.csvEncoding;
        }
        if (selectHasValue(outputEncoding, saved.outputEncoding)) {
          outputEncoding.value = saved.outputEncoding;
        }
        if (selectHasValue(qifType, saved.qifType)) {
          qifType.value = saved.qifType;
        }
        if (typeof saved.inputDateFormat === "string" && saved.inputDateFormat.length <= 32) {
          inputDate.value = saved.inputDateFormat;
        }
        if (typeof saved.outputDateFormat === "string" && saved.outputDateFormat.length <= 32) {
          outputDate.value = saved.outputDateFormat;
        }
        appendCode.checked = saved.appendCode === true;
        stopOnErrors.checked = saved.stopOnError === true;
        rememberSettings.checked = true;
        return true;
      } catch (error) {
        return false;
      }
    }
    function persistSettings() {
      if (!rememberSettings.checked) {
        return true;
      }
      try {
        window.localStorage.setItem(QIF_SETTINGS_STORAGE_KEY, JSON.stringify({
          csvEncoding: csvEncoding.value,
          outputEncoding: outputEncoding.value,
          qifType: qifType.value,
          inputDateFormat: inputDate.value,
          outputDateFormat: outputDate.value,
          appendCode: appendCode.checked,
          stopOnError: stopOnErrors.checked
        }));
        return true;
      } catch (error) {
        return false;
      }
    }
    function removeStoredSettings() {
      try {
        window.localStorage.removeItem(QIF_SETTINGS_STORAGE_KEY);
      } catch (error) {
      }
    }
    function resetOutput() {
      artifactName = "";
      convertedQif = "";
      output.value = "";
      outputCount.textContent = "0 TRANSAKCIJ";
      outputNote.textContent = "Pretvorjena ni \u0161e nobena datoteka.";
      downloadButton.disabled = true;
      if (shareButton) {
        shareButton.disabled = true;
      }
      copyButton.disabled = true;
    }
    function displayTextSource(text) {
      byId("qif-source-text")?.remove();
      if (text === null) return;
      const details = document.createElement("details");
      details.id = "qif-source-text";
      const summary = document.createElement("summary");
      summary.textContent = "VHODNO BESEDILO CSV";
      const area = document.createElement("textarea");
      area.className = "code-input";
      area.readOnly = true;
      area.value = text;
      area.setAttribute("aria-label", "Vhodno besedilo CSV");
      details.append(summary, area);
      dropZone.after(details);
    }
    function selectFile(file) {
      if (!file) return;
      api.invalidate("qif");
      try {
        const id = files.add(file, "qif");
        if (selectedFileId && selectedFileId !== id) files.release(selectedFileId);
        selectedFile = file;
        selectedFileId = id;
        selectedText = null;
        displayTextSource(null);
        fileName.textContent = file.name + " \u2014 " + core.formatBytes(file.size);
        resetOutput();
        void convertSelectedFile();
      } catch (error) {
        setStatus(status, localizedError(error), true);
      }
    }
    function convertSelectedFile() {
      if (!selectedFileId && selectedText === null) {
        setStatus(status, "Najprej izberite izvoz CSV banke Sparkasse.", true);
        fileInput.focus();
        return;
      }
      const source = selectedFileId ? { fileId: selectedFileId } : { text: selectedText };
      return api.execute("convert_sparkasse_csv", {
        ...source,
        csvEncoding: csvEncoding.value,
        outputEncoding: outputEncoding.value,
        qifType: qifType.value,
        inputDateFormat: inputDate.value.trim(),
        outputDateFormat: outputDate.value.trim(),
        appendCode: appendCode.checked,
        stopOnError: stopOnErrors.checked
      }, { source: "manual" });
    }
    api.register("qif", {
      apply(args) {
        if (args.fileId) {
          const record = files.get(args.fileId, "qif");
          selectedFile = record.file;
          selectedFileId = record.id;
          selectedText = null;
          fileName.textContent = record.file.name + " \u2014 " + core.formatBytes(record.file.size);
        } else {
          files.clear("qif");
          selectedFile = null;
          selectedFileId = null;
          selectedText = args.text;
          fileInput.value = "";
          fileName.textContent = "Vhodno besedilo \u2014 " + core.formatBytes(core.utf8Size(args.text));
        }
        displayTextSource(selectedText);
        csvEncoding.value = args.csvEncoding;
        outputEncoding.value = args.outputEncoding;
        qifType.value = args.qifType;
        inputDate.value = args.inputDateFormat;
        outputDate.value = args.outputDateFormat;
        appendCode.checked = args.appendCode;
        stopOnErrors.checked = args.stopOnError;
      },
      progress() {
        convertButton.disabled = true;
        resetOutput();
        setStatus(status, "Branje in pretvarjanje podatkov\u2026", false);
      },
      render(result) {
        convertedQif = result.qif;
        artifactName = result.artifact.filename;
        const truncated = convertedQif.length > previewLimit;
        output.value = truncated ? convertedQif.slice(0, previewLimit) + "\n\u2026 PREDOGLED JE SKRAJ\u0160AN \u2026\n" : convertedQif;
        outputCount.textContent = result.count + " TRANSAKCIJ";
        outputNote.textContent = ["Vhodno kodiranje: " + result.inputEncoding + ".", result.warningCount ? "Presko\u010Dene napa\u010Dne vrstice: " + result.warningCount + "." : "Brez opozoril pri raz\u010Dlenjevanju.", truncated ? "Predogled je skraj\u0161an; prenos vsebuje celoten QIF." : "Predogled vsebuje celoten QIF.", ...result.warnings.map((message) => localizedError(new Error(message)))].join(" ");
        downloadButton.disabled = false;
        if (shareButton && qifSharingAvailable) shareButton.disabled = false;
        copyButton.disabled = false;
        setStatus(status, "Pretvorjenih transakcij: " + result.count + (result.warningCount ? ". Opozoril: " + result.warningCount + "." : "."), false);
        showArtifact("qif", result.artifact);
      },
      error(error) {
        resetOutput();
        setStatus(status, localizedError(error), true);
      },
      settled(cancelled) {
        convertButton.disabled = false;
        if (cancelled) setStatus(status, "Opravilo je preklicano.", false);
      }
    });
    function outputFileName() {
      if (artifactName) return artifactName;
      if (!selectedFile) {
        return "sparkasse.qif";
      }
      const withoutExtension = selectedFile.name.replace(/\.[^.]+$/, "");
      return (withoutExtension || "sparkasse") + ".qif";
    }
    function outputBlob() {
      const bytes = core.encodeTextBytes(convertedQif, outputEncoding.value);
      return new Blob([bytes], { type: qifFileType });
    }
    form.addEventListener("submit", function(event) {
      event.preventDefault();
      convertSelectedFile();
    });
    fileInput.addEventListener("change", function() {
      selectFile(fileInput.files && fileInput.files[0]);
    });
    ["dragenter", "dragover"].forEach(function(eventName) {
      dropZone.addEventListener(eventName, function(event) {
        event.preventDefault();
        dropZone.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach(function(eventName) {
      dropZone.addEventListener(eventName, function(event) {
        event.preventDefault();
        dropZone.classList.remove("is-dragging");
      });
    });
    dropZone.addEventListener("drop", function(event) {
      selectFile(event.dataTransfer && event.dataTransfer.files[0]);
    });
    [csvEncoding, outputEncoding, qifType, inputDate, outputDate, appendCode, stopOnErrors].forEach(function(control) {
      control.addEventListener("input", function() {
        api.invalidate("qif");
        if ((selectedFile || selectedText !== null) && convertedQif) {
          resetOutput();
          setStatus(status, "Mo\u017Enosti so spremenjene. Znova pretvorite izbrano datoteko.", false);
        }
      });
    });
    [csvEncoding, outputEncoding, qifType, inputDate, outputDate, appendCode, stopOnErrors].forEach(function(control) {
      control.addEventListener("input", function() {
        if (rememberSettings.checked && !persistSettings()) {
          rememberSettings.checked = false;
          setStatus(status, "Brskalnik ni dovolil lokalnega shranjevanja nastavitev.", true);
        }
      });
    });
    rememberSettings.addEventListener("change", function() {
      if (rememberSettings.checked) {
        if (persistSettings()) {
          setStatus(status, "Nastavitve so shranjene samo v tem brskalniku.", false);
        } else {
          rememberSettings.checked = false;
          setStatus(status, "Brskalnik ni dovolil lokalnega shranjevanja nastavitev.", true);
        }
      } else {
        removeStoredSettings();
        setStatus(status, "Shranjene nastavitve so odstranjene iz tega brskalnika.", false);
      }
    });
    downloadButton.addEventListener("click", async function() {
      if (!convertedQif) {
        return;
      }
      try {
        const name = outputFileName();
        const result = await fileOutput.writeOrDownload(outputBlob(), {
          fileName: name,
          types: qifPickerTypes
        });
        if (!result.cancelled) {
          showToast(result.method === "file-system" ? "DATOTEKA QIF JE SHRANJENA" : "DATOTEKA QIF JE PRIPRAVLJENA");
        }
      } catch (error) {
        setStatus(status, "Datoteke QIF ni bilo mogo\u010De shraniti. Poskusite znova.", true);
      }
    });
    shareButton?.addEventListener("click", async function() {
      if (!convertedQif || !qifSharingAvailable) {
        return;
      }
      try {
        const name = outputFileName();
        const file = new File([outputBlob()], name, { type: qifFileType });
        const result = await fileOutput.shareFile(file, { title: name });
        if (!result.cancelled) {
          showToast("DATOTEKA QIF JE DELJENA");
        }
      } catch (error) {
        setStatus(status, "Datoteke QIF ni bilo mogo\u010De deliti. Poskusite znova.", true);
      }
    });
    copyButton.addEventListener("click", async function() {
      try {
        await copyText(convertedQif);
        showToast("QIF JE KOPIRAN V ODLO\u017DI\u0160\u010CE");
      } catch (error) {
        showToast(localizedError(error).toUpperCase());
      }
    });
    clearButton.addEventListener("click", function() {
      api.invalidate("qif");
      files.clear("qif");
      selectedFileId = null;
      selectedText = null;
      displayTextSource(null);
      selectedFile = null;
      fileInput.value = "";
      fileName.textContent = "ali kliknite za izbiro";
      resetOutput();
      setStatus(status, "Za za\u010Detek izberite izvoz CSV banke Sparkasse.", false);
    });
    if (restoreSettings()) {
      setStatus(status, "Shranjene nastavitve so obnovljene iz tega brskalnika.", false);
    }
  }

  // src/ui/tools/xml.mjs
  function initXmlTool() {
    const input = byId("xml-input"), output = byId("xml-output"), indent = byId("xml-indent"), status = byId("xml-status");
    api.register("xml", {
      invalidate() {
        output.value = "";
      },
      apply(args) {
        input.value = args.text;
        indent.value = String(args.indent);
      },
      progress() {
        setStatus(status, "Oblikovanje XML\u2026", false);
      },
      render(result) {
        output.value = result.text;
        setStatus(status, "XML je veljaven in uspe\u0161no oblikovan.", false);
      },
      error(error) {
        output.value = "";
        setStatus(status, localizedError(error), true);
      },
      settled(cancelled) {
        if (cancelled) setStatus(status, "Opravilo je preklicano.", false);
      }
    });
    for (const control of [input, indent]) control.addEventListener("input", () => {
      api.invalidate("xml");
      setStatus(status, "Pritisnite OBLIKUJ za nov izpis.", false);
    });
    byId("xml-format").addEventListener("click", () => void api.execute("format_xml", { text: input.value, indent: indent.value === "tab" ? "tab" : Number(indent.value) }, { source: "manual" }));
    byId("xml-clear").addEventListener("click", () => {
      api.invalidate("xml");
      input.value = "";
      setStatus(status, "Prilepite XML za oblikovanje.", false);
      input.focus();
    });
  }

  // src/ui/tools/jwt-generator.mjs
  function initJwtGenerator() {
    const fields = Object.fromEntries(["algorithm", "secret", "secretEncoding", "issuer", "subject", "audience", "issuedAt", "notBefore", "expiresAt", "customClaims"].map((name) => [name, byId("jwt-generator-" + name)]));
    const output = byId("jwt-generator-output"), header = byId("jwt-generator-header"), payload = byId("jwt-generator-payload"), status = byId("jwt-generator-status");
    function secretHelp() {
      byId("jwt-generator-secret-help").textContent = `Najmanj ${HMAC[fields.algorithm.value].bytes} dekodiranih bajtov. Besedilo se kodira kot UTF-8.`;
    }
    function invalidate() {
      api.invalidate("jwt-generator");
      secretHelp();
      setStatus(status, "Pritisnite USTVARI JWT za nov \u017Eeton.", false);
    }
    api.register("jwt-generator", {
      invalidate() {
        output.value = "";
        header.textContent = "";
        payload.textContent = "";
      },
      apply(args) {
        for (const [name, field] of Object.entries(fields)) field.value = args[name];
        secretHelp();
      },
      progress() {
        setStatus(status, "Podpisovanje \u017Eetona z Web Crypto\u2026", false);
      },
      render(result) {
        output.value = result.token;
        header.textContent = JSON.stringify(result.header, null, 2);
        payload.textContent = JSON.stringify(result.payload, null, 2);
        setStatus(status, "JWT je ustvarjen in podpisan.", false);
      },
      error(error) {
        setStatus(status, localizedError(error), true);
      },
      settled(cancelled) {
        if (cancelled) setStatus(status, "Opravilo je preklicano.", false);
      }
    });
    for (const field of Object.values(fields)) field.addEventListener("input", invalidate);
    byId("jwt-generator-random").addEventListener("click", () => {
      invalidate();
      try {
        fields.secret.value = randomSecret(fields.algorithm.value);
        fields.secretEncoding.value = "base64";
      } catch (error) {
        setStatus(status, localizedError(error), true);
      }
    });
    byId("jwt-generator-now").addEventListener("click", () => {
      invalidate();
      fields.issuedAt.value = localDateTime();
    });
    byId("jwt-generator-hour").addEventListener("click", () => {
      invalidate();
      fields.expiresAt.value = localDateTime(new Date(Date.now() + 36e5));
    });
    byId("jwt-generator-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void api.execute("generate_jwt", Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value])), { source: "manual" });
    });
    byId("jwt-generator-clear").addEventListener("click", () => {
      api.invalidate("jwt-generator");
      byId("jwt-generator-form").reset();
      secretHelp();
      setStatus(status, "Vnesite skrivnost in \u017Eelene zahtevke.", false);
      fields.secret.focus();
    });
    secretHelp();
  }

  // src/ui/tools/image-resizer.mjs
  function initImageResizer() {
    const tool = "image-resizer", input = byId(tool + "-file"), list = byId(tool + "-list"), status = byId(tool + "-status"), downloads = byId(tool + "-downloads");
    const controls = Object.fromEntries(["mode", "maxWidth", "maxHeight", "enlarge", "percentage", "format"].map((name) => [name, byId(tool + "-" + name)]));
    const records = /* @__PURE__ */ new Map();
    let generation = 0, previews = Promise.resolve();
    function modeControls() {
      const fit = controls.mode.value === "fit";
      byId(tool + "-fit").hidden = !fit;
      byId(tool + "-percent").hidden = fit;
      controls.maxWidth.disabled = controls.maxHeight.disabled = controls.enlarge.disabled = !fit;
      controls.percentage.disabled = fit;
    }
    function resetResults() {
      downloads.replaceChildren();
      for (const record of records.values()) {
        record.download.replaceChildren();
        record.state.textContent = record.problem || (record.width ? "Pripravljeno." : "Branje slike\u2026");
      }
    }
    function release(record) {
      if (record.url) URL.revokeObjectURL(record.url);
      record.element.remove();
      files.release(record.id);
      records.delete(record.id);
    }
    function link(artifact) {
      const a = document.createElement("a");
      a.className = "text-link artifact-link";
      a.href = artifact.downloadUrl;
      a.download = artifact.filename;
      a.textContent = "PRENESI " + artifact.filename;
      return a;
    }
    function renderFile(result) {
      const record = records.get(result.fileId);
      if (!record) return;
      record.download.replaceChildren();
      record.state.textContent = result.success ? `${result.width} \xD7 ${result.height} px \xB7 Kon\u010Dano.` : localizedError(result.error);
      if (result.success) record.download.append(link(result.artifact));
    }
    function addFiles(selected) {
      api.invalidate(tool);
      const revision = generation, idle = api.whenIdle(tool);
      const problems = [];
      let rejected = 0;
      for (const file of selected) {
        if (records.size >= IMAGE_LIMITS.files) {
          rejected++;
          continue;
        }
        let id;
        try {
          id = files.add(file, tool);
        } catch (error) {
          problems.push(file.name + ": " + (error.code === "LIMIT_EXCEEDED" ? "Najve\u010D 64 MiB na datoteko in 128 MiB izbranih datotek v zavihku." : localizedError(error)));
          continue;
        }
        if (records.has(id)) continue;
        const element = document.createElement("article");
        element.className = "image-card";
        const img = document.createElement("img");
        img.alt = "";
        img.hidden = true;
        img.width = img.height = 128;
        const title = document.createElement("h2");
        title.textContent = file.name;
        const dimensions = document.createElement("p"), state = document.createElement("p"), download = document.createElement("div");
        state.textContent = "Branje slike\u2026";
        state.setAttribute("role", "status");
        const remove = document.createElement("button");
        remove.className = "button";
        remove.type = "button";
        remove.textContent = "ODSTRANI";
        remove.setAttribute("aria-label", "Odstrani " + file.name);
        const record = { id, element, img, dimensions, state, download };
        remove.addEventListener("click", () => {
          api.invalidate(tool);
          release(record);
          setStatus(status, "Slika je odstranjena.", false);
        });
        element.append(img, title, dimensions, state, download, remove);
        list.append(element);
        records.set(id, record);
        const check = () => {
          if (revision !== generation || records.get(id) !== record) throw Object.assign(new Error("Preklicano."), { code: "CANCELLED" });
        };
        previews = previews.then(async () => {
          await idle;
          try {
            check();
            const preview = await imagePreview(file, check);
            check();
            record.url = URL.createObjectURL(preview.blob);
            record.width = preview.width;
            img.src = record.url;
            img.hidden = false;
            dimensions.textContent = `${preview.width} \xD7 ${preview.height} px`;
            state.textContent = "Pripravljeno.";
            files.update(id, { width: preview.width, height: preview.height, sourceMimeType: preview.mimeType });
          } catch (error) {
            if (error.code !== "CANCELLED" && records.get(id) === record) {
              record.problem = localizedError(error);
              state.textContent = record.problem;
            }
          }
        });
      }
      if (rejected) problems.push(`Najve\u010D 50 slik. Izpu\u0161\u010Denih datotek: ${rejected}.`);
      setStatus(status, problems.length ? problems.join(" ") : "Slike so dodane. Nastavite mere in za\u010Dnite obdelavo.", !!problems.length);
      input.value = "";
    }
    api.register(tool, {
      invalidate: resetResults,
      async apply(args) {
        for (const [name, control] of Object.entries(controls)) {
          if (name === "enlarge") control.checked = args[name];
          else control.value = String(args[name]);
        }
        modeControls();
        await previews;
      },
      progress() {
        setStatus(status, "Zaporedna obdelava slik\u2026", false);
      },
      fileProgress(update) {
        if (update.result) renderFile(update.result);
        else if (records.has(update.fileId)) records.get(update.fileId).state.textContent = "Obdelava\u2026";
      },
      render(result) {
        for (const image of result.images) renderFile(image);
        downloads.replaceChildren();
        if (result.zipArtifact) downloads.append(link(result.zipArtifact));
        setStatus(status, `Uspe\u0161no obdelanih slik: ${result.count}/${result.images.length}.` + (result.warnings.length ? " " + result.warnings.join(" ") : ""), result.count !== result.images.length || !!result.warnings.length);
      },
      error(error) {
        resetResults();
        setStatus(status, localizedError(error), true);
      },
      settled(cancelled) {
        if (cancelled) {
          resetResults();
          setStatus(status, "Opravilo je preklicano.", false);
        }
      }
    });
    input.addEventListener("change", () => addFiles([...input.files]));
    const drop = byId(tool + "-drop");
    drop.addEventListener("dragover", (event) => {
      event.preventDefault();
      drop.classList.add("is-dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
    drop.addEventListener("drop", (event) => {
      event.preventDefault();
      drop.classList.remove("is-dragging");
      addFiles([...event.dataTransfer.files]);
    });
    for (const control of Object.values(controls)) control.addEventListener("input", () => {
      api.invalidate(tool);
      modeControls();
      setStatus(status, "Nastavitve so spremenjene. Ponovite obdelavo.", false);
    });
    byId(tool + "-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const args = { fileIds: [...records.keys()], mode: controls.mode.value, format: controls.format.value, maxWidth: Number(controls.maxWidth.value), maxHeight: Number(controls.maxHeight.value), percentage: Number(controls.percentage.value), enlarge: controls.enlarge.checked };
      void api.execute("resize_images", args, { source: "manual" });
    });
    function clear() {
      generation++;
      api.invalidate(tool);
      for (const record of records.values()) release(record);
      input.value = "";
    }
    byId(tool + "-clear").addEventListener("click", () => {
      clear();
      setStatus(status, "Izberite slike za obdelavo.", false);
      input.focus();
    });
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) clear();
    });
    modeControls();
  }

  // src/ui/bootstrap.mjs
  function init() {
    initOperations();
    initToolNavigation();
    initRouter();
    initCopyButtons();
    initEmsoTool();
    initVatTool();
    initJwtTool();
    initJsonTool();
    initQifTool();
    initXmlTool();
    initJwtGenerator();
    initImageResizer();
    initKeyboardShortcuts();
    initMobileInfoRail();
    initSwipeNavigation();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
