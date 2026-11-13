// Run: node --test src/lib/auth/phone.test.ts   (Node >= 22.6 strips TS types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIndianMobile, maskPhone } from "./phone.ts";

test("the five authorized Super Admin numbers normalize to E.164", () => {
  assert.equal(normalizeIndianMobile("7994821555"), "+917994821555");
  assert.equal(normalizeIndianMobile("7034021555"), "+917034021555");
  assert.equal(normalizeIndianMobile("9567789888"), "+919567789888");
  assert.equal(normalizeIndianMobile("9605725337"), "+919605725337");
  assert.equal(normalizeIndianMobile("9539938305"), "+919539938305");
});

test("equivalent representations collapse to one identity", () => {
  for (const v of ["9876543210", "+919876543210", "+91 98765 43210", "919876543210", "09876543210", "(+91) 98765-43210", " 98765.43210 "]) {
    assert.equal(normalizeIndianMobile(v), "+919876543210", v);
  }
});

test("malformed or non-Indian input is rejected, not blindly prefixed", () => {
  for (const v of ["", "12345", "5876543210", "98765432101", "+1 202 555 0143", "+4498765432100", "abc9876543210", "admin", "9876-543-21", "+91 58765 43210", "0091 98765 43210", null, undefined, 9876543210]) {
    assert.equal(normalizeIndianMobile(v as any), null, String(v));
  }
});

test("maskPhone hides the middle digits", () => {
  assert.equal(maskPhone("+919876543210"), "+91 98765 ***10");
});
