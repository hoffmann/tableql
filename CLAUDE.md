# Coding Agent Instructions

## Project Overview
This project implements a **JavaScript module** that provides **JQL-like query capabilities** for filtering tabular data (HTML tables and JSON row data).

- **Specification:** `README.md`
- **Implementation:** `tableql.js`
- **Tests:** `tableql.test.js`
- **Example usage / demo:** `example.html`

The codebase is intentionally lightweight:
- Single JavaScript module
- No runtime dependencies
- Node-based testing (no browser required)

---

## Development Rules (MANDATORY)

### 1. Test-First Development
For **every change or new feature**:

1. **Add or update test cases** in `tableql.test.js`
2. Ensure tests fail before implementation
3. Implement the feature in `tableql.js`
4. Ensure **all tests pass** using:
   ```bash
   node --test
   ```

No feature is considered complete without tests.

# Specification Synchronization

Any functional change must be reflected in documentation:

Uhpdate README.md to reflect:
- Syntax changes
- New operators
- Behavioral changes
- Edge cases or limitations

Update example.html with a working example of the new or changed behavior
Documentation, examples, and implementation must always remain consistent.

# Code Quality & Style

- Use plain modern JavaScript (ES2020+)
- No external libraries
- Prefer pure functions and deterministic behavior
- Avoid hidden type coercion
- Fail explicitly or return predictable results for invalid queries
- Keep the public API minimal and stable

# Determinism & Predictability

- Query evaluation must be deterministic
- Explicit data-type hints must always override inferred types
- Inference rules must be documented and tested
- Operator precedence must be explicit and tested

# Backward Compatibility

Do not break existing query syntax or behavior unless explicitly documented
If behavior changes:
- Add regression tests
- Document breaking changes clearly in README.md

# Scope Discipline

- Do not add features outside the defined JQL scope
- Avoid browser-only APIs in core logic
- Keep DOM handling (if any) separate from query evaluation logic

# Testing Guidelines

Tests in tableql.test.js should be readable and data-driven where possible and
cover:

- Type inference (number, string, date, boolean)
- Operator behavior
- Edge cases (null, empty, invalid values)
- Error handling
- Assert exact outputs (no fuzzy matching)

# Iteration Checklist

Before completing an iteration, verify:
- [ ] Tests added or updated
- [ ] All tests pass (node --test)
- [ ] README.md updated
- [ ] example.html updated
- [ ] No unnecessary dependencies added
- [ ] Code remains readable and minimal

# Guiding Principle

Correctness, clarity, and testability are more important than performance or feature breadth.