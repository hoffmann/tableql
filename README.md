# TableQL Query Language Specification

## Overview
The query language provides a JQL-inspired, client-side filtering syntax for tabular data in javascript.

Evaluation model:
- Boolean expression
- Disjunctive Normal Form (DNF):  `OR` separates groups, `AND` is implicit within each group

## Example

Visit [hoffmann.github.io/tableql/](https://hoffmann.github.io/tableql/example.html) for an
interactive demo to query a html table with TableQL.

## Data Model
While the target data model is a html table, the core query engine works on a list of objects,
where the objects have field names and values that are typed.

Example:

```js
const datatypes = {id: "number", name: "string", age: "number", city: "string", created: "date", active: "boolean" }

const rows = [
  { id: 1, name: "Alice", age: 30, city: "Berlin", created: "2026-01-01", active: "true"},
  { id: 2, name: "Bob",   age: 22, city: "Munich", created: "2024-01-25", active: "true"},
  { id: 3, name: "Cara",  age: 40, city: "Berlin", created: "2025-06-01", active: "false" },
];
```

## Field Types

| Type      | Source                                            |
| --------- | ------------------------------------------------- |
| `number`  | `data-type="number"` or inferred                  |
| `date`    | `data-type="date"` or inferred via `Date.parse()` |
| `boolean` | `data-type="boolean"` or inferred                 |
| `string`  | default                                           |

The following normalization algorithm is used for the input data:

```js
function normalize(value, type) {
  switch (type) {
    case "number":
      return Number(value);

    case "boolean":
      return value.toLowerCase() === "true";

    case "date":
      return new Date(value).getTime(); // numeric comparison

    case "string":
    default:
      return String(value);
  }
}
```

## Value Normalization

| Type    | Normalization                          |
| ------- | -------------------------------------- |
| string  | lowercased                             |
| number  | `Number(value)`                        |
| date    | `Date` object                          |
| boolean | `true`, `false`, `yes`, `no`, `1`, `0` |
| empty   | `null` (non-string), `""` (string)     |

Missing or empty cells evaluate to null.

## Tokenization

Tokens are split on whitespace

Quoted strings ("...") are preserved as a single token

##  Logical Operators
`AND`	Conjunction (implicit inside groups)

`OR`	Disjunction (splits groups)

Precedence:
- Field expressions
- AND
- OR


## Comparison Operators

| Operator | Supported Types    | Semantics                                             |
| -------- | ------------------ | ----------------------------------------------------- |
| `:`      | all                | equality (string: substring match)                    |
| `=`      | all                | strict equality                                       |
| `!=`     | all                | inequality                                            |
| `>`      | number, date       | greater than                                          |
| `>=`     | number, date       | greater or equal                                      |
| `<`      | number, date       | less than                                             |
| `<=`     | number, date       | less or equal                                         |
| `~=`     | string, number, date | matches regex against string representation of field |

### Operator Behavior

**String operators:**
- `:` → substring match
- `=` → exact match

**Regex operator (`~=`):**
- For `string` fields: matches against the string value
- For `number` fields: converts number to string (e.g., `30`) and matches
- For `date` fields: converts date to string representation (e.g., `2025-01-15`) and matches

## Field Expressions
### Basic Comparisons
```
field:Value
field=Value
field!=Value
field>=10
```

**Examples:**
```
priority>=3
status:open
created<2025-01-01
```

### Regex Matching
Use the `~=` operator to match against regular expressions:

**String fields:**
```
name ~= '^A'        # Names starting with A
email ~= '@gmail\.com$'   # Gmail addresses
```

**Number fields:**
```
age ~= '^3'         # Ages starting with 3 (30-39)
age ~= '0$'         # Ages ending with 0 (10, 20, 30, etc.)
price ~= '^[1-5]'   # Prices starting with 1-5
```

**Date fields:**
```
created ~= '^2025'       # Dates in 2025
created ~= '-01-'        # Dates in January
created ~= '2024-.*-15'  # Dates on the 15th of any month in 2024
```

### Boolean Shorthand
If a boolean field name is used as a search term (without an operator), it matches rows where that field is `true`.

Examples:

```
active
```
Returns all rows where the `active` field is `true`.

```
blocked
```
Returns all rows where the `blocked` field is `true`.

This works through the free-text search mechanism and is case-insensitive.


## Empty / Not Empty Checks
### Syntax
```
field is empty
field is not empty
```

### Semantics
A field is considered empty if: Value is null, or Type is string and value is empty or whitespace-only

Applies to all field types. Examples:
```
blocked is empty
title is not empty
```


## Free-Text Search
### Syntax
It's just a term. If it's enclosed with `"`, it will be parsed as one string.
```
term
"term with whitespace"
```

### Semantics
Matches against **all fields** (not just strings) using type-specific matching:

| Field Type | Matching Behavior                                                    |
| ---------- | -------------------------------------------------------------------- |
| `string`   | Case-insensitive substring match                                     |
| `boolean`  | If search term matches a boolean field name, matches where that field is true.<br>If search term is "true"/"false", matches any boolean field with that value. |
| `number`   | Converts number to string and performs substring match               |
| `date`     | Converts date to string representation and performs substring match  |

### Examples

**String fields:**
```
login
```
Matches any row where a string field contains "login".

**Boolean fields:**

*Boolean field name shorthand:*
```
active
```
Matches any row where the boolean field `active` is `true`. This is case-insensitive.

*Boolean literal values:*
```
true
```
Matches any row where any boolean field is `true`.

```
false
```
Matches any row where any boolean field is `false`.

**Number fields:**
```
30
```
Matches any row where a number field contains "30" (e.g., `30`, `130`, `300`).

**Date fields:**
```
2025
```
Matches any row where a date field contains "2025" (e.g., `2025-01-15`, `2025-06-01`).

```
01-01
```
Matches any row where a date field contains "01-01" (e.g., `2024-01-01`, `2026-01-01`).

## Grouping and Evaluation
### AND Semantics

All conditions in a group must match:

```
status:open priority>=2
```

is equivalent to:

```
status:open AND priority>=2
```

### OR Semantics

OR splits the query into multiple groups:

```
status:open OR priority>=5
```

Evaluation logic:

```
(group1 matches) OR (group2 matches)
```

## Ordering Results

### Syntax

Results can be ordered using the `ORDER BY` clause at the end of the query:

```
[filter expression] ORDER BY fieldname [ASC|DESC]
```

- `fieldname`: The field to sort by
- `ASC`: Ascending order (default if omitted)
- `DESC`: Descending order

### Semantics

- Ordering is applied **after** filtering
- Sort order depends on the field's data type:
  - **number**: Numeric comparison
  - **date**: Chronological comparison (timestamp)
  - **string**: Lexicographic comparison (case-insensitive)
  - **boolean**: false < true
- If no direction is specified, `ASC` is used by default

### Examples

#### Basic Ordering

```
ORDER BY age ASC
```
Returns all rows ordered by age, youngest to oldest.

```
ORDER BY age DESC
```
Returns all rows ordered by age, oldest to youngest.

```
ORDER BY name
```
Returns all rows ordered by name alphabetically (ascending is default).

#### Ordering with Filters

```
age >= 30 ORDER BY age ASC
```
Returns only rows where age is 30 or more, ordered youngest to oldest.

```
city:Berlin ORDER BY age DESC
```
Returns Berlin residents ordered by age, oldest to youngest.

```
active = true ORDER BY name ASC
```
Returns active users ordered alphabetically by name.

#### Complex Queries with Ordering

```
age < 25 OR age > 35 ORDER BY age ASC
```
Returns rows where age is less than 25 or greater than 35, ordered by age.

```
city:Berlin age >= 30 OR city:Munich ORDER BY created DESC
```
Returns Berlin residents 30+ or Munich residents, ordered by creation date (newest first).

### Ordering by Different Types

**Numbers**:
```
ORDER BY age ASC          → 22, 30, 35, 40
ORDER BY age DESC         → 40, 35, 30, 22
```

**Strings**:
```
ORDER BY name ASC         → Alice, Bob, Cara, Tim Lee jr.
ORDER BY city DESC        → Munich, Hamburg, Berlin
```

**Dates**:
```
ORDER BY created ASC      → 2024-01-25, 2025-03-15, 2025-06-01, 2026-01-01
ORDER BY created DESC     → 2026-01-01, 2025-06-01, 2025-03-15, 2024-01-25
```

**Booleans**:
```
ORDER BY active ASC       → false entries first, then true entries
ORDER BY active DESC      → true entries first, then false entries
```

## HTML Table Integration

The `initTableQL()` function provides a simple way to add TableQL filtering to HTML tables.

### Basic Usage

```javascript
import { initTableQL } from './tableql.js';

// Initialize with search container and table selectors
initTableQL('#search', '#mytable');
```

This will:
- Create a search input box in the `#search` container
- Parse the table structure and infer field types from `data-type` attributes
- Enable filter-as-you-type functionality
- Show/hide and reorder table rows based on the query

### Options

#### Debug Mode

Enable debug mode to see the parsed query structure:

```javascript
initTableQL('#search', '#mytable', { debug: true });
```

#### URL Query Parameter Syncing

Enable URL query parameter syncing to make queries shareable via URL:

```javascript
initTableQL('#search', '#mytable', { storeQueryString: 'q' });
```

When enabled:
- The query is automatically saved to the URL query parameter (e.g., `example.html?q=city:Berlin`)
- Users can share URLs with specific queries
- The page loads with the query from the URL and applies the filter immediately
- Browser back/forward navigation works correctly
- The URL is updated as the user types

**Example URLs:**
```
example.html?q=age%20%3E%3D%2030
example.html?q=city:Berlin%20OR%20city:Munich
example.html?q=active%20ORDER%20BY%20name%20ASC
```

#### Custom Placeholder

Customize the search input placeholder text:

```javascript
initTableQL('#search', '#mytable', {
  placeholder: 'Filter products... (e.g., price >= 100, category:electronics)'
});
```

If not specified, the default placeholder is: `'Search... (e.g., age >= 30, city:Berlin)'`

#### Complete Example

```javascript
initTableQL('#search', '#mytable', {
  debug: true,                 // Show parsed query
  storeQueryString: 'q',       // Enable URL syncing
  placeholder: 'Filter data...' // Custom placeholder text
});
```

### Table Structure

Make sure your HTML table has `data-type` attributes on header cells to specify field types:

```html
<table id="mytable">
  <thead>
    <tr>
      <th data-type="number">id</th>
      <th data-type="string">name</th>
      <th data-type="number">age</th>
      <th data-type="date">created</th>
      <th data-type="boolean">active</th>
    </tr>
  </thead>
  <tbody>
    <!-- ... table rows ... -->
  </tbody>
</table>
```

If no `data-type` attribute is present, the field will default to `string`.

## Parsed Query Representation (DNF)

The query parser produces an intermediate representation in Disjunctive Normal Form (DNF), represented as JSON.

### Structure

```typescript
type ParsedQuery = {
  orGroups: OrGroup[];
  orderBy: OrderBy | null;
};

type OrGroup = Condition[];

type OrderBy = {
  field: string;
  direction: "ASC" | "DESC";
};

type Condition =
  | ComparisonCondition
  | FreeTextCondition
  | IsEmptyCondition
  | IsNotEmptyCondition;
```

### Condition Types

#### 1. Comparison Condition
Used for field comparisons with operators.

```json
{
  "type": "comparison",
  "field": "fieldName",
  "operator": ">=",
  "value": "30"
}
```

**Operators**: `=`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `:`, `~=`

#### 2. Free-Text Condition
Used for unqualified search terms that match against all string fields.

```json
{
  "type": "freeText",
  "value": "searchTerm"
}
```

#### 3. Empty Check Condition
Used for `field is empty` checks.

```json
{
  "type": "isEmpty",
  "field": "fieldName"
}
```

#### 4. Not Empty Check Condition
Used for `field is not empty` checks.

```json
{
  "type": "isNotEmpty",
  "field": "fieldName"
}
```

### Examples

#### Simple Query
**Input**: `age >= 30`

**Parsed**:
```json
{
  "orGroups": [
    [
      {
        "type": "comparison",
        "field": "age",
        "operator": ">=",
        "value": "30"
      }
    ]
  ],
  "orderBy": null
}
```

#### AND Query (Implicit)
**Input**: `city:Berlin age >= 30`

**Parsed**:
```json
{
  "orGroups": [
    [
      {
        "type": "comparison",
        "field": "city",
        "operator": ":",
        "value": "Berlin"
      },
      {
        "type": "comparison",
        "field": "age",
        "operator": ">=",
        "value": "30"
      }
    ]
  ],
  "orderBy": null
}
```

#### OR Query
**Input**: `age < 25 OR age > 35`

**Parsed**:
```json
{
  "orGroups": [
    [
      {
        "type": "comparison",
        "field": "age",
        "operator": "<",
        "value": "25"
      }
    ],
    [
      {
        "type": "comparison",
        "field": "age",
        "operator": ">",
        "value": "35"
      }
    ]
  ],
  "orderBy": null
}
```

#### Complex DNF Query
**Input**: `city:Berlin age >= 30 OR name:Alice`

**Parsed**:
```json
{
  "orGroups": [
    [
      {
        "type": "comparison",
        "field": "city",
        "operator": ":",
        "value": "Berlin"
      },
      {
        "type": "comparison",
        "field": "age",
        "operator": ">=",
        "value": "30"
      }
    ],
    [
      {
        "type": "comparison",
        "field": "name",
        "operator": ":",
        "value": "Alice"
      }
    ]
  ],
  "orderBy": null
}
```

**Evaluation**: `(city:Berlin AND age >= 30) OR (name:Alice)`

#### Free-Text Search
**Input**: `Berlin`

**Parsed**:
```json
{
  "orGroups": [
    [
      {
        "type": "freeText",
        "value": "Berlin"
      }
    ]
  ],
  "orderBy": null
}
```

#### Empty Check
**Input**: `notes is empty`

**Parsed**:
```json
{
  "orGroups": [
    [
      {
        "type": "isEmpty",
        "field": "notes"
      }
    ]
  ],
  "orderBy": null
}
```

#### Mixed Query with Empty Check
**Input**: `active = true notes is not empty`

**Parsed**:
```json
{
  "orGroups": [
    [
      {
        "type": "comparison",
        "field": "active",
        "operator": "=",
        "value": "true"
      },
      {
        "type": "isNotEmpty",
        "field": "notes"
      }
    ]
  ],
  "orderBy": null
}
```

#### Query with ORDER BY
**Input**: `age >= 30 ORDER BY age DESC`

**Parsed**:
```json
{
  "orGroups": [
    [
      {
        "type": "comparison",
        "field": "age",
        "operator": ">=",
        "value": "30"
      }
    ]
  ],
  "orderBy": {
    "field": "age",
    "direction": "DESC"
  }
}
```

#### ORDER BY without Filter
**Input**: `ORDER BY name ASC`

**Parsed**:
```json
{
  "orGroups": [],
  "orderBy": {
    "field": "name",
    "direction": "ASC"
  }
}
```

### Evaluation Algorithm

1. For each OR group in the parsed query:
   - Evaluate all conditions in the group (AND semantics)
   - If all conditions in the group are true, the row matches
2. If any OR group matches, include the row in the results
3. If the parsed query is empty (no groups), all rows match
4. If an `orderBy` clause is present, sort the filtered results by the specified field and direction
