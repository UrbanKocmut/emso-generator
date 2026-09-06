"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const core = require("../assets/js/toolbox-core.js");

test("VAT checksum has explicit normal, zero, and excluded-body results", () => {
    // Weights 8..2. Independent implementation:
    // https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/si/ddv.py
    // 1501255: sum 81, remainder 4 => 7.
    // 1000002: sum 12, remainder 1 => candidate 10 => 0.
    // 1000010: sum 11, remainder 0 => candidate 11 => excluded.
    assert.equal(core.calculateVatCheckDigit("1501255"), 7);
    assert.equal(core.calculateVatCheckDigit("1000002"), 0);
    assert.equal(core.calculateVatCheckDigit("1000010"), null);
    assert.equal(core.validateSlovenianVat("SI15012557").valid, true);
    assert.equal(core.validateSlovenianVat("si 1000-0020").valid, true);
    assert.equal(core.validateSlovenianVat("10000021").valid, false);
    for (let digit = 0; digit <= 9; digit += 1) {
        assert.equal(core.validateSlovenianVat("1000010" + digit).valid, false);
    }
});

test("VAT generator emits zero checksums and skips excluded bodies", () => {
    const digits = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2];
    let calls = 0;
    const result = core.generateSlovenianVat((maximum) => {
        assert.ok(calls < digits.length, "generator should finish after the second body");
        const value = digits[calls++];
        assert.ok(value < maximum);
        return value;
    });
    assert.equal(result, "10000020");
    assert.equal(calls, 14);
    const excludedBody = [0, 0, 0, 0, 0, 1, 0];
    let index = 0;
    assert.throws(() => core.generateSlovenianVat(() => excludedBody[index++ % 7]), /Unable to generate/);
    assert.equal(index, 128 * 7);
});

test("EMŠO retains its different modulo 11 edge cases", () => {
    // Article 4: https://www.uradni-list.si/glasilo-uradni-list-rs/vsebina/1999-01-0345/
    assert.equal(core.calculateEmsoCheckDigit("000000000006"), null); // sum 12
    assert.equal(core.calculateEmsoCheckDigit("000000000014"), 0); // sum 11
    assert.equal(core.calculateEmsoCheckDigit("010100650000"), 6); // published sum 192
});

test("JSON formatting preserves numeric text in every formatting mode", () => {
    const numbers = ["9007199254740993", "-9007199254740993", "9007199254740991",
        "1.234567890123456789", "1e400", "1e-400", "-0", "1.00", "1E+03"];
    for (const number of numbers) {
        const input = '{"id":' + number + '}';
        assert.equal(core.formatJson(input), '{\n  "id": ' + number + '\n}');
        assert.equal(core.formatJson(input, { indent: "\t", sortKeys: true }), '{\n\t"id": ' + number + '\n}');
        assert.equal(core.formatJson(input, { minify: true }), input);
        assert.equal(core.formatJson(number), number);
    }
});

test("JSON retains duplicate and special keys, string escapes, and array order", () => {
    const input = String.raw`{"z":[9007199254740993,{"b":{},"a":[]}],"a":"quote: \" and \\ and \u0061", "__proto__":1,"a":2}`;
    assert.equal(core.formatJson(input, { minify: true, sortKeys: true }),
        String.raw`{"__proto__":1,"a":"quote: \" and \\ and \u0061","a":2,"z":[9007199254740993,{"a":[],"b":{}}]}`);
    assert.equal(core.formatJson('{"2":2,"10":10}', { minify: true, sortKeys: true }), '{"10":10,"2":2}');
    assert.equal(core.formatJson('[true,false,null,{},[]]', { minify: true }), '[true,false,null,{},[]]');
    assert.equal(core.formatJson(String.raw`{"\u0062":1,"a":2}`, { minify: true, sortKeys: true }), String.raw`{"a":2,"\u0062":1}`);
});

test("JSON rejects malformed input instead of emitting partial output", () => {
    for (const input of ["", "{broken}", "[1,]", "01", "NaN", "Infinity", "1 2", '{"a":}', '"bad\nstring"']) {
        assert.throws(() => core.formatJson(input), SyntaxError);
    }
});
