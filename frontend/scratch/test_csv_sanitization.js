const assert = require("assert");

// Extract the sanitizeCsvCell and csvRow methods from GstReportingService
function sanitizeCsvCell(value) {
  if (!value || typeof value !== "string") return value || "";
  let safe = value.replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = "'" + safe;
  }
  return safe;
}

function csvRow(values) {
  return values.map(v => `"${sanitizeCsvCell(v)}"`).join(",");
}

console.log("=== CSV Formula Injection Sanitization Tests ===");

// Test 1: Formula triggers
assert.strictEqual(sanitizeCsvCell("=1+1"), "'=1+1");
assert.strictEqual(sanitizeCsvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
assert.strictEqual(sanitizeCsvCell("-5*5"), "'-5*5");
assert.strictEqual(sanitizeCsvCell("@SUM(A1:A10)"), "'@SUM(A1:A10)");
assert.strictEqual(sanitizeCsvCell("\t=1+1"), "'\t=1+1");
assert.strictEqual(sanitizeCsvCell("\r=1+1"), "'\r=1+1");
console.log("✅ Test 1 passed: All formula triggers prefixed with '");

// Test 2: Double quotes escaping
assert.strictEqual(sanitizeCsvCell('Hello "World"'), 'Hello ""World""');
assert.strictEqual(csvRow(['Hello "World"', '=SUM(B1:B5)']), '"Hello ""World""","\'=SUM(B1:B5)"');
console.log("✅ Test 2 passed: Embedded quotes doubled per RFC 4180");

// Test 3: Normal cells untouched
assert.strictEqual(sanitizeCsvCell("INV/2026/001"), "INV/2026/001");
assert.strictEqual(sanitizeCsvCell("CakeToHome Bangalore"), "CakeToHome Bangalore");
assert.strictEqual(sanitizeCsvCell("1250.00"), "1250.00");
console.log("✅ Test 3 passed: Normal strings and numbers preserved intact");

console.log("\nAll CSV sanitization tests passed successfully!");
