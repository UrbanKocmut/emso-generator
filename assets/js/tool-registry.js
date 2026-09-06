(function (root) {
    "use strict";

    // Display metadata only. Tool processing stays in the core/controller files.
    const tools = [
        {
            id: "emso", title: "Generator EMŠO", name: "EMŠO", subtitle: "Generator",
            category: "IDENTITETA", symbol: "13#", cardTitle: ["EMŠO", "GENERATOR"],
            description: "Testni slovenski identifikatorji z veljavno kontrolo ter izbiro datuma in spola."
        },
        {
            id: "vat", title: "Generator SI DDV", name: "SI DDV", subtitle: "Generator",
            category: "DAVKI", symbol: "SI", cardTitle: ["GENERATOR", "DAVČNIH ŠTEVILK"], inverted: true,
            description: "Izmišljene slovenske davčne številke, ki prestanejo kontrolo po modulu 11."
        },
        {
            id: "jwt", title: "Preverjanje JWT", name: "JWT", subtitle: "Preverjanje",
            category: "ŽETONI", symbol: "{·}", cardTitle: ["PREVERJANJE", "JWT"],
            description: "Razčlenite zahtevke, preverite časovno veljavnost in podpis z Web Crypto."
        },
        {
            id: "json", title: "Formatiranje JSON", name: "JSON", subtitle: "Formatiranje",
            category: "PODATKI", symbol: "{ }", cardTitle: ["FORMATIRANJE", "JSON"],
            description: "Prilepite strnjen JSON in takoj dobite čist, berljiv izpis."
        },
        {
            id: "qif", title: "Sparkasse CSV v QIF", name: "CSV/QIF", subtitle: "Pretvornik Sparkasse",
            category: "BANČNI PODATKI", symbol: "CSV", cardTitle: ["SPARKASSE", "CSV → QIF"],
            description: "Lokalno pretvorite izvoze transakcij Sparkasse v datoteke QIF za uvoz."
        },
        {
            id: "pdf", title: "Združevanje PDF-jev", name: "PDF", subtitle: "Združevanje",
            category: "DOKUMENTI", symbol: "PDF", cardTitle: ["ZDRUŽEVANJE", "PDF-JEV"], inverted: true,
            description: "Združite dokumente, uredite vrstni red strani, jih zavrtite ali izbrišite in prenesite nov PDF."
        }
    ];

    if (typeof module === "object" && module.exports) {
        module.exports = tools;
    }
    root.ToolboxTools = tools;
})(typeof globalThis !== "undefined" ? globalThis : this);
