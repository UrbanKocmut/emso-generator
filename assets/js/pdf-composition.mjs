import { PDFDocument, degrees } from "../vendor/pdf-lib/pdf-lib.esm.min.js";
import { normalizeRotation } from "./pdf-merger-core.mjs";
const pdfFileType = "application/pdf";

export async function composePdfFile(documents, pages, name) {
    const output = await PDFDocument.create();
    const copiedPages = new Map();
    const documentIds = Array.from(new Set(pages.map(function (page) {
        return page.documentId;
    })));

    for (const documentId of documentIds) {
        const record = documents.get(documentId);
        if (!record) {
            throw new Error("Missing source document.");
        }
        const source = await PDFDocument.load(record.bytes, { updateMetadata: false });
        const sourceItems = pages.filter(function (page) {
            return page.documentId === documentId;
        });
        const copies = await output.copyPages(source, sourceItems.map(function (page) {
            return page.sourceIndex;
        }));

        sourceItems.forEach(function (item, index) {
            const copy = copies[index];
            copy.setRotation(degrees(normalizeRotation(copy.getRotation().angle + item.rotation)));
            copiedPages.set(item.id, copy);
        });
    }

    pages.forEach(function (page) {
        output.addPage(copiedPages.get(page.id));
    });

    output.setTitle(name.replace(/\.pdf$/i, ""));
    output.setCreator("Delavnica");
    output.setProducer("Delavnica / pdf-lib");
    output.setCreationDate(new Date());

    const bytes = await output.save({
        addDefaultPage: false,
        objectsPerTick: 25,
        useObjectStreams: true
    });
    return new File([bytes], name, { type: pdfFileType });
}
