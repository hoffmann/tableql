import test from "node:test";
import assert from "node:assert/strict";
import { filterIds } from "./tableql.js";

const datatypes = {
  id: "number",
  name: "string",
  age: "number",
  city: "string",
  created: "date",
  active: "boolean"
}

const rows = [
  { id: 1, name: "Alice", age: 30, city: "Berlin", created: "2026-01-01", active: "true" },
  { id: 2, name: "Bob", age: 22, city: "Munich", created: "2024-01-25", active: "true" },
  { id: 3, name: "Cara", age: 40, city: "Berlin", created: "2025-06-01", active: "false" },
];

test("age >= 30", () => {
  const out = filterIds(rows, "age >= 30", { datatypes });
  assert.deepEqual(out, [1, 3]);
});

test("city == 'Berlin' AND age < 40", () => {
  const out = filterIds(rows, "city == 'Berlin' AND age < 40", { datatypes });
  assert.deepEqual(out, [1]);
});


const cases = [
  // Numeric comparisons
  { expr: "age >= 30", expected: [1, 3], desc: "greater than or equal" },
  { expr: "age > 30", expected: [3], desc: "greater than" },
  { expr: "age <= 30", expected: [1, 2], desc: "less than or equal" },
  { expr: "age < 30", expected: [2], desc: "less than" },
  { expr: "age = 22", expected: [2], desc: "numeric equality" },
  { expr: "age != 30", expected: [2, 3], desc: "numeric inequality" },

  // String comparisons
  { expr: "city == 'Berlin'", expected: [1, 3], desc: "string exact match (==)" },
  { expr: "city = 'Berlin'", expected: [1, 3], desc: "string exact match (=)" },
  { expr: "city:Berlin", expected: [1, 3], desc: "string substring match" },
  { expr: "city:Ber", expected: [1, 3], desc: "substring partial match" },
  { expr: "city != 'Berlin'", expected: [2], desc: "string inequality" },
  { expr: "name ~= '^A'", expected: [1], desc: "regex match - starts with A" },
  { expr: "name ~= 'a'", expected: [3], desc: "regex match - contains lowercase 'a'" },
  { expr: "name ~= '[Aa]'", expected: [1, 3], desc: "regex match - contains 'a' case insensitive" },

  // Free-text search
  { expr: "Alice", expected: [1], desc: "free-text search" },
  { expr: "Berlin", expected: [1, 3], desc: "free-text finds Berlin in city" },
  { expr: "name:Alice", expected: [1], desc: "field-specific substring" },

  // Boolean fields
  { expr: "active = true", expected: [1, 2], desc: "boolean true" },
  { expr: "active = false", expected: [3], desc: "boolean false" },
  { expr: "active != true", expected: [3], desc: "boolean not true" },

  // Date comparisons
  { expr: "created >= 2025-01-01", expected: [1, 3], desc: "date after 2025" },
  { expr: "created < 2025-01-01", expected: [2], desc: "date before 2025" },
  { expr: "created > 2024-12-31", expected: [1, 3], desc: "date greater than" },

  // OR operator
  { expr: "city:Berlin OR city:Munich", expected: [1, 2, 3], desc: "OR with two conditions" },
  { expr: "age < 25 OR age > 35", expected: [2, 3], desc: "OR with numeric ranges" },
  { expr: "name:Alice OR name:Bob", expected: [1, 2], desc: "OR with field searches" },

  // AND operator (implicit)
  { expr: "city:Berlin age >= 30", expected: [1, 3], desc: "implicit AND" },
  { expr: "city:Berlin age < 40", expected: [1], desc: "AND narrows results" },
  { expr: "active = true age >= 30", expected: [1], desc: "AND with boolean" },

  // Combined AND/OR
  { expr: "city:Berlin age >= 30 OR city:Munich", expected: [1, 2, 3], desc: "mixed AND/OR" },
  { expr: "age > 25 city:Berlin OR name:Bob", expected: [1, 2, 3], desc: "complex DNF query" },

  // Empty query
  { expr: "", expected: [1, 2, 3], desc: "empty query returns all" },
  { expr: "   ", expected: [1, 2, 3], desc: "whitespace query returns all" },

  // Case insensitivity for strings
  { expr: "city:berlin", expected: [1, 3], desc: "case insensitive substring" },
  { expr: "name:alice", expected: [1], desc: "case insensitive name" },
  { expr: "BERLIN", expected: [1, 3], desc: "case insensitive free-text" },
];

for (const { expr, expected, desc } of cases) {
  test(`${expr} (${desc})`, () => {
    assert.deepEqual(filterIds(rows, expr, { datatypes }), expected);
  });
}

// Test with extended data for empty checks
test("is empty / is not empty checks", () => {
  const extendedRows = [
    { id: 1, name: "Alice", age: 30, city: "Berlin", note: "" },
    { id: 2, name: "", age: 22, city: "Munich", note: "Has note" },
    { id: 3, name: "Cara", age: null, city: "Berlin", note: null },
  ];

  const extendedTypes = {
    id: "number",
    name: "string",
    age: "number",
    city: "string",
    note: "string"
  };

  // Empty checks
  assert.deepEqual(
    filterIds(extendedRows, "note is empty", { datatypes: extendedTypes }),
    [1, 3],
    "note is empty should match empty string and null"
  );

  assert.deepEqual(
    filterIds(extendedRows, "name is empty", { datatypes: extendedTypes }),
    [2],
    "name is empty should match empty string"
  );

  assert.deepEqual(
    filterIds(extendedRows, "age is empty", { datatypes: extendedTypes }),
    [3],
    "age is empty should match null for number field"
  );

  // Not empty checks
  assert.deepEqual(
    filterIds(extendedRows, "note is not empty", { datatypes: extendedTypes }),
    [2],
    "note is not empty should match non-empty values"
  );

  assert.deepEqual(
    filterIds(extendedRows, "name is not empty", { datatypes: extendedTypes }),
    [1, 3],
    "name is not empty should match non-empty strings"
  );

  assert.deepEqual(
    filterIds(extendedRows, "age is not empty", { datatypes: extendedTypes }),
    [1, 2],
    "age is not empty should match non-null numbers"
  );
});

// Test type inference without explicit datatypes
test("type inference without datatypes parameter", () => {
  const result = filterIds(rows, "age >= 30");
  assert.deepEqual(result, [1, 3], "should infer types and work correctly");
});

test("type inference with date fields", () => {
  const result = filterIds(rows, "created >= 2025-01-01");
  assert.deepEqual(result, [1, 3], "should infer date type and compare correctly");
});

test("type inference with boolean fields", () => {
  const result = filterIds(rows, "active = true");
  assert.deepEqual(result, [1, 2], "should infer boolean type");
});
