(function (root) {
    "use strict";

    // Display metadata only. Tool processing stays in the core/controller files.
    const tools = [
        {
            id: "emso", path: "emso/", title: "Generator EMŠO", name: "EMŠO", subtitle: "Generator",
            category: "IDENTITETA", symbol: "13#", cardTitle: ["EMŠO", "GENERATOR"],
            description: "Testni slovenski identifikatorji z veljavno kontrolo ter izbiro datuma in spola."
        },
        {
            id: "vat", path: "davcna-stevilka/", title: "Generator SI DDV", name: "SI DDV", subtitle: "Generator",
            category: "DAVKI", symbol: "SI", cardTitle: ["GENERATOR", "DAVČNIH ŠTEVILK"], inverted: true,
            description: "Izmišljene slovenske davčne številke, ki prestanejo kontrolo po modulu 11."
        },
        {
            id: "jwt", path: "jwt/", title: "Preverjanje JWT", name: "JWT", subtitle: "Preverjanje",
            category: "ŽETONI", symbol: "{·}", cardTitle: ["PREVERJANJE", "JWT"],
            description: "Razčlenite zahtevke, preverite časovno veljavnost in podpis z Web Crypto."
        },
        {
            id: "json", path: "json/", title: "Formatiranje JSON", name: "JSON", subtitle: "Formatiranje",
            category: "PODATKI", symbol: "{ }", cardTitle: ["FORMATIRANJE", "JSON"],
            description: "Prilepite strnjen JSON in takoj dobite čist, berljiv izpis."
        },
        {
            id: "qif", path: "sparkasse-csv-qif/", title: "Sparkasse CSV v QIF", name: "CSV/QIF", subtitle: "Pretvornik Sparkasse",
            category: "BANČNI PODATKI", symbol: "CSV", cardTitle: ["SPARKASSE", "CSV → QIF"],
            description: "Lokalno pretvorite izvoze transakcij Sparkasse v datoteke QIF za uvoz."
        },
        {
            id: "pdf", path: "pdf/", title: "Združevanje PDF-jev", name: "PDF", subtitle: "Združevanje",
            category: "DOKUMENTI", symbol: "PDF", cardTitle: ["ZDRUŽEVANJE", "PDF-JEV"], inverted: true,
            description: "Združite dokumente, uredite vrstni red strani, jih zavrtite ali izbrišite in prenesite nov PDF."
        },
        {
            id: "xml", path: "xml/", title: "Formatiranje XML", name: "XML", subtitle: "Formatiranje",
            category: "PODATKI", symbol: "</>", cardTitle: ["FORMATIRANJE", "XML"],
            description: "Oblikujte XML z ohranjenimi oznakami, komentarji in mešano vsebino."
        },
        {
            id: "jwt-generator", path: "jwt-generator/", title: "Generator JWT", name: "JWT+", subtitle: "Generator",
            category: "ŽETONI", symbol: "HS", cardTitle: ["GENERATOR", "JWT"],
            description: "Ustvarite žeton z zahtevki in podpisom HMAC prek Web Crypto."
        },
        {
            id: "image-resizer", path: "image-resizer/", title: "Sprememba velikosti slik", name: "SLIKE", subtitle: "Sprememba velikosti",
            category: "SLIKE", symbol: "↔", cardTitle: ["VELIKOST", "SLIK"], inverted: true,
            description: "Prilagodite več slik JPEG, PNG ali WebP ter jih prenesite posamezno ali kot ZIP."
        }
    ];

    tools.overview = {
        id: "overview", path: "", title: "Delavnica",
        description: "Zasebna spletna orodja za testne podatke, PDF, pregled in ustvarjanje JWT, oblikovanje JSON in XML, Sparkasse CSV ter velikost slik."
    };
    const pageTitles = {
        overview: "EMŠO, JSON, XML, JWT, CSV, PDF in slike — Delavnica",
        emso: "EMŠO generator za testne podatke — Delavnica",
        vat: "Generator slovenskih davčnih številk — Delavnica",
        jwt: "JWT: razčlenitev, zahtevki in preverjanje podpisa — Delavnica",
        json: "Oblikovanje JSON brez izgube številskih zapisov — Delavnica",
        qif: "Pretvorba Sparkasse CSV v QIF — Delavnica",
        pdf: "Združevanje, vrstni red in vrtenje strani PDF — Delavnica",
        xml: "Oblikovanje XML z ohranjeno vsebino — Delavnica",
        'jwt-generator': "Generator podpisanih JWT s HMAC — Delavnica",
        'image-resizer': "Sprememba velikosti slik in prenos ZIP — Delavnica"
    };
    [tools.overview].concat(tools).forEach(function (page) {
        page.pageTitle = pageTitles[page.id];
    });
    if (typeof module === "object" && module.exports) {
        module.exports = tools;
    }
    root.ToolboxTools = tools;
})(typeof globalThis !== "undefined" ? globalThis : this);
