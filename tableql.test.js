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
  { id: 4, name: "Tim Lee jr.", age: 35, city: "Hamburg", created: "2025-03-15", active: "true" },
];

test("age >= 30", () => {
  const out = filterIds(rows, "age >= 30", { datatypes });
  assert.deepEqual(out, [1, 3, 4]);
});

test("city == 'Berlin' AND age < 40", () => {
  const out = filterIds(rows, "city == 'Berlin' AND age < 40", { datatypes });
  assert.deepEqual(out, [1]);
});


const cases = [
  // Numeric comparisons
  { expr: "age >= 30", expected: [1, 3, 4], desc: "greater than or equal" },
  { expr: "age > 30", expected: [3, 4], desc: "greater than" },
  { expr: "age <= 30", expected: [1, 2], desc: "less than or equal" },
  { expr: "age < 30", expected: [2], desc: "less than" },
  { expr: "age = 22", expected: [2], desc: "numeric equality" },
  { expr: "age = 35", expected: [4], desc: "numeric equality for Tim" },
  { expr: "age != 30", expected: [2, 3, 4], desc: "numeric inequality" },

  // String comparisons
  { expr: "city == 'Berlin'", expected: [1, 3], desc: "string exact match (==)" },
  { expr: "city = 'Berlin'", expected: [1, 3], desc: "string exact match (=)" },
  { expr: "city:Berlin", expected: [1, 3], desc: "string substring match" },
  { expr: "city:Ber", expected: [1, 3], desc: "substring partial match" },
  { expr: "city != 'Berlin'", expected: [2, 4], desc: "string inequality" },
  { expr: "city:Hamburg", expected: [4], desc: "Hamburg match" },
  { expr: "name ~= '^A'", expected: [1], desc: "regex match - starts with A" },
  { expr: "name ~= 'a'", expected: [3], desc: "regex match - contains lowercase 'a'" },
  { expr: "name ~= '[Aa]'", expected: [1, 3], desc: "regex match - contains 'a' case insensitive" },

  // Regex on number fields
  { expr: "age ~= '^3'", expected: [1, 4], desc: "regex match - age starts with 3 (30, 35)" },
  { expr: "age ~= '0$'", expected: [1, 3], desc: "regex match - age ends with 0 (30, 40)" },
  { expr: "age ~= '^[234]'", expected: [1, 2, 3, 4], desc: "regex match - age starts with 2, 3, or 4 (22, 30, 35, 40)" },
  { expr: "age ~= '^22$'", expected: [2], desc: "regex match - exact age 22" },
  { expr: "age ~= '^[23]0$'", expected: [1], desc: "regex match - age 20 or 30" },

  // Regex on date fields
  { expr: "created ~= '^2025'", expected: [3, 4], desc: "regex match - dates starting with 2025" },
  { expr: "created ~= '2026'", expected: [1], desc: "regex match - dates containing 2026" },
  { expr: "created ~= '01$'", expected: [1, 3], desc: "regex match - dates ending with 01" },
  { expr: "created ~= '-01-'", expected: [1, 2], desc: "regex match - dates with -01- (January)" },
  { expr: "created ~= '-0[36]-'", expected: [3, 4], desc: "regex match - dates in March or June" },
  { expr: "created ~= '2024-.*-25'", expected: [2], desc: "regex match - specific date pattern" },

  // Free-text search - strings
  { expr: "Alice", expected: [1], desc: "free-text search" },
  { expr: "Berlin", expected: [1, 3], desc: "free-text finds Berlin in city" },
  { expr: "name:Alice", expected: [1], desc: "field-specific substring" },

  // Free-text search - booleans
  { expr: "true", expected: [1, 2, 4], desc: "free-text search for true matches boolean fields" },
  { expr: "false", expected: [3], desc: "free-text search for false matches boolean fields" },
  { expr: "active", expected: [1, 2, 4], desc: "boolean field name shorthand matches active=true" },

  // Free-text search - numbers
  { expr: "30", expected: [1], desc: "free-text search matches age 30" },
  { expr: "22", expected: [2], desc: "free-text search matches age 22 or id 2" },
  { expr: "40", expected: [3], desc: "free-text search matches age 40" },
  { expr: "35", expected: [4], desc: "free-text search matches age 35" },

  // Free-text search - dates
  { expr: "2025", expected: [3, 4], desc: "free-text search matches dates containing 2025" },
  { expr: "2024", expected: [2], desc: "free-text search matches dates containing 2024" },
  { expr: "2026", expected: [1], desc: "free-text search matches dates containing 2026" },
  { expr: "01-01", expected: [1], desc: "free-text search matches date pattern 01-01" },

  // Multi-word name tests
  { expr: "Tim", expected: [4], desc: "free-text search finds Tim" },
  { expr: "Lee", expected: [4], desc: "free-text search finds Lee" },
  { expr: "jr", expected: [4], desc: "free-text search finds jr" },
  { expr: "name:Tim", expected: [4], desc: "field search for Tim" },
  { expr: "name:Lee", expected: [4], desc: "field search for Lee" },
  { expr: "name:'Tim Lee'", expected: [4], desc: "quoted multi-word search" },
  { expr: "name:'Tim Lee jr.'", expected: [4], desc: "quoted exact match with punctuation" },
  { expr: "name ~= '^Tim'", expected: [4], desc: "regex match name starting with Tim" },
  { expr: "name ~= 'Lee'", expected: [4], desc: "regex match containing Lee" },
  { expr: "name ~= 'jr\\.'", expected: [4], desc: "regex match with escaped period" },

  // Boolean fields
  { expr: "active = true", expected: [1, 2, 4], desc: "boolean true" },
  { expr: "active = false", expected: [3], desc: "boolean false" },
  { expr: "active != true", expected: [3], desc: "boolean not true" },

  // Date comparisons
  { expr: "created >= 2025-01-01", expected: [1, 3, 4], desc: "date after 2025" },
  { expr: "created < 2025-01-01", expected: [2], desc: "date before 2025" },
  { expr: "created > 2024-12-31", expected: [1, 3, 4], desc: "date greater than" },
  { expr: "created >= 2025-03-15", expected: [1, 3, 4], desc: "date on or after Tim's created date" },

  // OR operator
  { expr: "city:Berlin OR city:Munich", expected: [1, 2, 3], desc: "OR with two conditions" },
  { expr: "city:Berlin OR city:Hamburg", expected: [1, 3, 4], desc: "OR including Hamburg" },
  { expr: "age < 25 OR age > 35", expected: [2, 3], desc: "OR with numeric ranges" },
  { expr: "age < 25 OR age >= 35", expected: [2, 3, 4], desc: "OR including age 35" },
  { expr: "name:Alice OR name:Bob", expected: [1, 2], desc: "OR with field searches" },
  { expr: "name:Alice OR name:Tim", expected: [1, 4], desc: "OR with Alice or Tim" },

  // AND operator (implicit)
  { expr: "city:Berlin age >= 30", expected: [1, 3], desc: "implicit AND" },
  { expr: "city:Berlin age < 40", expected: [1], desc: "AND narrows results" },
  { expr: "active = true age >= 30", expected: [1, 4], desc: "AND with boolean" },
  { expr: "city:Hamburg age = 35", expected: [4], desc: "AND finds Tim" },

  // Combined AND/OR
  { expr: "city:Berlin age >= 30 OR city:Munich", expected: [1, 2, 3], desc: "mixed AND/OR" },
  { expr: "age > 25 city:Berlin OR name:Bob", expected: [1, 2, 3], desc: "complex DNF query" },
  { expr: "name:Tim active = true OR city:Munich", expected: [2, 4], desc: "multi-word name in DNF" },

  // Empty query
  { expr: "", expected: [1, 2, 3, 4], desc: "empty query returns all" },
  { expr: "   ", expected: [1, 2, 3, 4], desc: "whitespace query returns all" },

  // Case insensitivity for strings
  { expr: "city:berlin", expected: [1, 3], desc: "case insensitive substring" },
  { expr: "name:alice", expected: [1], desc: "case insensitive name" },
  { expr: "BERLIN", expected: [1, 3], desc: "case insensitive free-text" },
  { expr: "name:tim", expected: [4], desc: "case insensitive Tim" },
  { expr: "name:LEE", expected: [4], desc: "case insensitive Lee" },
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
  assert.deepEqual(result, [1, 3, 4], "should infer types and work correctly");
});

test("type inference with date fields", () => {
  const result = filterIds(rows, "created >= 2025-01-01");
  assert.deepEqual(result, [1, 3, 4], "should infer date type and compare correctly");
});

test("type inference with boolean fields", () => {
  const result = filterIds(rows, "active = true");
  assert.deepEqual(result, [1, 2, 4], "should infer boolean type");
});

// ORDER BY tests
test("ORDER BY age ASC", () => {
  const result = filterIds(rows, "ORDER BY age ASC", { datatypes });
  assert.deepEqual(result, [2, 1, 4, 3], "should order by age ascending");
});

test("ORDER BY age DESC", () => {
  const result = filterIds(rows, "ORDER BY age DESC", { datatypes });
  assert.deepEqual(result, [3, 4, 1, 2], "should order by age descending");
});

test("ORDER BY age (default ASC)", () => {
  const result = filterIds(rows, "ORDER BY age", { datatypes });
  assert.deepEqual(result, [2, 1, 4, 3], "should default to ascending order");
});

test("ORDER BY name ASC", () => {
  const result = filterIds(rows, "ORDER BY name ASC", { datatypes });
  assert.deepEqual(result, [1, 2, 3, 4], "should order by name ascending (Alice, Bob, Cara, Tim Lee jr.)");
});

test("ORDER BY name DESC", () => {
  const result = filterIds(rows, "ORDER BY name DESC", { datatypes });
  assert.deepEqual(result, [4, 3, 2, 1], "should order by name descending");
});

test("ORDER BY city ASC", () => {
  const result = filterIds(rows, "ORDER BY city ASC", { datatypes });
  assert.deepEqual(result, [1, 3, 4, 2], "should order by city ascending (Berlin, Berlin, Hamburg, Munich)");
});

test("ORDER BY created ASC", () => {
  const result = filterIds(rows, "ORDER BY created ASC", { datatypes });
  assert.deepEqual(result, [2, 4, 3, 1], "should order by date ascending");
});

test("ORDER BY created DESC", () => {
  const result = filterIds(rows, "ORDER BY created DESC", { datatypes });
  assert.deepEqual(result, [1, 3, 4, 2], "should order by date descending");
});

test("Filter with ORDER BY - age >= 30 ORDER BY age ASC", () => {
  const result = filterIds(rows, "age >= 30 ORDER BY age ASC", { datatypes });
  assert.deepEqual(result, [1, 4, 3], "should filter then order");
});

test("Filter with ORDER BY - age >= 30 ORDER BY age DESC", () => {
  const result = filterIds(rows, "age >= 30 ORDER BY age DESC", { datatypes });
  assert.deepEqual(result, [3, 4, 1], "should filter then order descending");
});

test("Filter with ORDER BY - city:Berlin ORDER BY age ASC", () => {
  const result = filterIds(rows, "city:Berlin ORDER BY age ASC", { datatypes });
  assert.deepEqual(result, [1, 3], "should filter by city then order by age");
});

test("Filter with ORDER BY - city:Berlin ORDER BY age DESC", () => {
  const result = filterIds(rows, "city:Berlin ORDER BY age DESC", { datatypes });
  assert.deepEqual(result, [3, 1], "should filter by city then order by age descending");
});

test("OR query with ORDER BY", () => {
  const result = filterIds(rows, "age < 25 OR age > 35 ORDER BY age ASC", { datatypes });
  assert.deepEqual(result, [2, 3], "should handle OR with ORDER BY");
});

test("Complex query with ORDER BY", () => {
  const result = filterIds(rows, "active = true ORDER BY age DESC", { datatypes });
  assert.deepEqual(result, [4, 1, 2], "should filter active=true and order by age desc");
});

test("ORDER BY with name field", () => {
  const result = filterIds(rows, "active = true ORDER BY name ASC", { datatypes });
  assert.deepEqual(result, [1, 2, 4], "should order active users by name");
});

// Boolean field shorthand tests
test("Boolean field shorthand - active", () => {
  const result = filterIds(rows, "active", { datatypes });
  assert.deepEqual(result, [1, 2, 4], "typing 'active' should return all rows where active=true");
});

test("Boolean field shorthand - case insensitive", () => {
  const result = filterIds(rows, "ACTIVE", { datatypes });
  assert.deepEqual(result, [1, 2, 4], "typing 'ACTIVE' should be case insensitive");
});

test("Boolean field shorthand with other conditions", () => {
  const result = filterIds(rows, "active age >= 30", { datatypes });
  assert.deepEqual(result, [1, 4], "should combine boolean shorthand with other conditions");
});
