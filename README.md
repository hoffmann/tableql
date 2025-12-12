# TableQL Query Language Specification

## Overview
The query language provides a JQL-inspired, client-side filtering syntax for tabular data in javascript.

Evaluation model:
- Boolean expression
- Disjunctive Normal Form (DNF):  `OR` separates groups, `AND` is implicit within each group

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

| Operator | Supported Types | Semantics                          |
| -------- | --------------- | ---------------------------------- |
| `:`      | all             | equality (string: substring match) |
| `=`      | all             | strict equality                    |
| `!=`     | all             | inequality                         |
| `>`      | number, date    | greater than                       |
| `>=`     | number, date    | greater or equal                   |
| `<`      | number, date    | less than                          |
| `<=`     | number, date    | less or equal                      |
| `~=`     | string          | matches regex operator             |

String-specific behavior

`:` → substring match

`=` → exact match

## Field Expressions
### Basic Comparisons
```
field:Value
field=Value
field!=Value
field>=10

Examples
```
priority>=3
status:open
created<2025-01-01
```

### Boolean Shorthand
If a boolean field is referenced without an operator, it is treated as: `field == true`

Example:

`blocked` Equivalent to: `blocked:true`


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
ist's just a term, if it's enquoted with " it will be parsed as one string
```
term
"term with whitespace"
```

### Semantics
Matches against all string fields in a Case-insensitive Substring match


Example:
```
login
```

Matches any row where a string column contains "login".

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

## Parsed Query Representation (DNF)

The query parser produces an intermediate representation in Disjunctive Normal Form (DNF), represented as JSON.

### Structure

```typescript
type ParsedQuery = OrGroup[];
type OrGroup = Condition[];

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
[
  [
    {
      "type": "comparison",
      "field": "age",
      "operator": ">=",
      "value": "30"
    }
  ]
]
```

#### AND Query (Implicit)
**Input**: `city:Berlin age >= 30`

**Parsed**:
```json
[
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
]
```

#### OR Query
**Input**: `age < 25 OR age > 35`

**Parsed**:
```json
[
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
]
```

#### Complex DNF Query
**Input**: `city:Berlin age >= 30 OR name:Alice`

**Parsed**:
```json
[
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
]
```

**Evaluation**: `(city:Berlin AND age >= 30) OR (name:Alice)`

#### Free-Text Search
**Input**: `Berlin`

**Parsed**:
```json
[
  [
    {
      "type": "freeText",
      "value": "Berlin"
    }
  ]
]
```

#### Empty Check
**Input**: `notes is empty`

**Parsed**:
```json
[
  [
    {
      "type": "isEmpty",
      "field": "notes"
    }
  ]
]
```

#### Mixed Query with Empty Check
**Input**: `active = true notes is not empty`

**Parsed**:
```json
[
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
]
```

### Evaluation Algorithm

1. For each OR group in the parsed query:
   - Evaluate all conditions in the group (AND semantics)
   - If all conditions in the group are true, the row matches
2. If any OR group matches, include the row in the results
3. If the parsed query is empty (no groups), all rows match
