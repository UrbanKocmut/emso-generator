(() => {
  // src/ui/shared.mjs
  var core = window.ToolboxCore;
  var fileOutput = window.DelavnicaFileOutput;
  var toastTimer = 0;
  function byId(id) {
    return document.getElementById(id);
  }
  function localizedError(error) {
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
  var API_VERSION = "1.0.0";
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
      name: "list_selected_files",
      description: "List metadata and session-local file IDs from native CSV/PDF selection. No file contents, local paths, remote fetching or file-picker access.",
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
    }
    async function process(name, args, check) {
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
          controller?.apply?.(args, source);
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
    appVersion: "caeeb3e000a6d0f26d32177c0e35523232a2b95c9e91f796df225c44937dec24",
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
    window.DelavnicaAgent = Object.freeze({ apiVersion: API_VERSION, appVersion: "caeeb3e000a6d0f26d32177c0e35523232a2b95c9e91f796df225c44937dec24", execute: (name, input, { signal } = {}) => api.execute(name, input, { signal }) });
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
