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
        }
    ];

    tools.overview = {
        id: "overview", path: "", title: "Delavnica",
        description: "Hitra in zasebna spletna delavnica za slovenske testne podatke, PDF-je, preverjanje JWT, formatiranje JSON in pretvorbo Sparkasse CSV."
    };
    const pageTitles = {
        overview: "EMŠO, davčne številke, JSON, JWT, CSV in PDF — Delavnica",
        emso: "EMŠO generator za testne podatke — Delavnica",
        vat: "Generator slovenskih davčnih številk — Delavnica",
        jwt: "JWT: razčlenitev, zahtevki in preverjanje podpisa — Delavnica",
        json: "Oblikovanje JSON brez izgube številskih zapisov — Delavnica",
        qif: "Pretvorba Sparkasse CSV v QIF — Delavnica",
        pdf: "Združevanje, vrstni red in vrtenje strani PDF — Delavnica"
    };
    [tools.overview].concat(tools).forEach(function (page) {
        page.pageTitle = pageTitles[page.id];
    });
    if (typeof module === "object" && module.exports) {
        module.exports = tools;
    }
    root.ToolboxTools = tools;
})(typeof globalThis !== "undefined" ? globalThis : this);
