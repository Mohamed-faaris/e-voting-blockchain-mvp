import assert from "node:assert/strict";
import test from "node:test";
import { toPostgresTimestamp } from "./postgres-date.js";

test("converts Date instances to UTC ISO strings", () => {
  assert.equal(
    toPostgresTimestamp(new Date("2026-11-04T00:30:00.000Z")),
    "2026-11-04T00:30:00.000Z"
  );
});

test("normalizes timestamp strings without changing the instant", () => {
  assert.equal(
    toPostgresTimestamp("2026-11-04T06:00:00+05:30"),
    "2026-11-04T00:30:00.000Z"
  );
});

test("rejects invalid timestamps before sending a database query", () => {
  assert.throws(() => toPostgresTimestamp("not-a-date"), RangeError);
});
