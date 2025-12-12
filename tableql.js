// Tokenizer: splits query string into tokens, preserving quoted strings
function tokenize(expr) {
  const tokens = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      tokens.push(current);
      current = "";
      quoteChar = null;
    } else if (inQuotes) {
      current += char;
    } else if (char === ' ' || char === '\t' || char === '\n') {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

// Infer type from value
function inferType(value) {
  if (value === null || value === undefined || value === "") {
    return "string";
  }

  const str = String(value).toLowerCase();

  // Check boolean
  if (str === "true" || str === "false") {
    return "boolean";
  }

  // Check number
  if (!isNaN(value) && !isNaN(parseFloat(value))) {
    return "number";
  }

  // Check date
  const dateVal = Date.parse(value);
  if (!isNaN(dateVal) && /\d{4}-\d{2}-\d{2}/.test(value)) {
    return "date";
  }

  return "string";
}

// Infer types from rows
function inferTypes(rows) {
  if (!rows || rows.length === 0) {
    return {};
  }

  const types = {};
  const fields = Object.keys(rows[0]);

  for (const field of fields) {
    // Sample first non-empty value
    for (const row of rows) {
      const value = row[field];
      if (value !== null && value !== undefined && value !== "") {
        types[field] = inferType(value);
        break;
      }
    }

    if (!types[field]) {
      types[field] = "string";
    }
  }

  return types;
}

// Normalize value based on type
function normalize(value, type) {
  if (value === null || value === undefined || value === "") {
    return type === "string" ? "" : null;
  }

  switch (type) {
    case "number":
      return Number(value);

    case "boolean":
      return String(value).toLowerCase() === "true";

    case "date":
      return new Date(value).getTime();

    case "string":
    default:
      return String(value).toLowerCase();
  }
}

// Parse tokens into AST structure (DNF) and extract ORDER BY
function parse(tokens) {
  // Check for ORDER BY clause and split tokens
  let orderBy = null;
  let filterTokens = tokens;

  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].toUpperCase() === "ORDER" && tokens[i + 1].toUpperCase() === "BY") {
      // Found ORDER BY, extract it
      filterTokens = tokens.slice(0, i);

      if (i + 2 < tokens.length) {
        const field = tokens[i + 2];
        let direction = "ASC"; // default

        if (i + 3 < tokens.length) {
          const dir = tokens[i + 3].toUpperCase();
          if (dir === "ASC" || dir === "DESC") {
            direction = dir;
          }
        }

        orderBy = { field, direction };
      }
      break;
    }
  }

  const orGroups = [];
  let currentGroup = [];

  let i = 0;
  while (i < filterTokens.length) {
    const token = filterTokens[i];

    if (token.toUpperCase() === "OR") {
      if (currentGroup.length > 0) {
        orGroups.push(currentGroup);
        currentGroup = [];
      }
      i++;
      continue;
    }

    if (token.toUpperCase() === "AND") {
      i++;
      continue;
    }

    // Check for "is empty" or "is not empty"
    if (i + 2 < filterTokens.length && filterTokens[i + 1].toLowerCase() === "is") {
      if (filterTokens[i + 2].toLowerCase() === "empty") {
        currentGroup.push({ type: "isEmpty", field: token });
        i += 3;
        continue;
      } else if (i + 3 < filterTokens.length &&
                 filterTokens[i + 2].toLowerCase() === "not" &&
                 filterTokens[i + 3].toLowerCase() === "empty") {
        currentGroup.push({ type: "isNotEmpty", field: token });
        i += 4;
        continue;
      }
    }

    // Check for field operator value pattern
    // Order operators by length (longest first) to match correctly
    const operators = ["~=", "!=", ">=", "<=", "==", "=", ":", ">", "<"];
    let matched = false;

    for (const op of operators) {
      if (token.includes(op)) {
        const parts = token.split(op);
        if (parts.length === 2) {
          currentGroup.push({
            type: "comparison",
            field: parts[0],
            operator: op,
            value: parts[1]
          });
          matched = true;
          break;
        }
      } else if (i + 1 < filterTokens.length) {
        const nextToken = filterTokens[i + 1];

        // Check if the next token is exactly the operator
        if (nextToken === op && i + 2 < filterTokens.length) {
          currentGroup.push({
            type: "comparison",
            field: token,
            operator: op,
            value: filterTokens[i + 2]
          });
          i += 2; // Will be incremented by 1 at the end, total +3
          matched = true;
          break;
        } else if (nextToken.startsWith(op) && nextToken !== op) {
          // Operator is combined with value (e.g., ">=30")
          currentGroup.push({
            type: "comparison",
            field: token,
            operator: op,
            value: nextToken.substring(op.length)
          });
          i += 1; // Will be incremented by 1 at the end, total +2
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      i++;
      continue;
    }

    // Check if it's a field name without operator (boolean shorthand or free-text)
    // We'll treat it as free-text search for now
    currentGroup.push({
      type: "freeText",
      value: token
    });

    i++;
  }

  if (currentGroup.length > 0) {
    orGroups.push(currentGroup);
  }

  return { orGroups, orderBy };
}

// Evaluate a single condition against a row
function evaluateCondition(condition, row, types) {
  if (condition.type === "isEmpty") {
    const value = row[condition.field];
    const type = types[condition.field] || "string";

    if (value === null || value === undefined) {
      return true;
    }

    if (type === "string") {
      return String(value).trim() === "";
    }

    return false;
  }

  if (condition.type === "isNotEmpty") {
    const value = row[condition.field];
    const type = types[condition.field] || "string";

    if (value === null || value === undefined) {
      return false;
    }

    if (type === "string") {
      return String(value).trim() !== "";
    }

    return true;
  }

  if (condition.type === "freeText") {
    const searchTerm = condition.value.toLowerCase();

    // Boolean field shorthand: if search term matches a boolean field name, check if it's true
    for (const [field, type] of Object.entries(types)) {
      if (type === "boolean" && field.toLowerCase() === searchTerm) {
        const value = row[field];
        if (value === null || value === undefined) {
          return false;
        }
        const normalizedValue = String(value).toLowerCase() === "true";
        return normalizedValue;
      }
    }

    // Search in all fields
    for (const [field, type] of Object.entries(types)) {
      const value = row[field];
      if (value === null || value === undefined) {
        continue;
      }

      if (type === "string") {
        // String: case-insensitive substring match
        if (String(value).toLowerCase().includes(searchTerm)) {
          return true;
        }
      } else if (type === "boolean") {
        // Boolean: match if searchTerm is "true" and field is true, or "false" and field is false
        const normalizedValue = String(value).toLowerCase() === "true";
        if ((searchTerm === "true" && normalizedValue) || (searchTerm === "false" && !normalizedValue)) {
          return true;
        }
      } else if (type === "number") {
        // Number: convert to string and do substring match
        if (String(value).includes(searchTerm)) {
          return true;
        }
      } else if (type === "date") {
        // Date: convert to string representation and do substring match
        const dateStr = String(value).toLowerCase();
        if (dateStr.includes(searchTerm)) {
          return true;
        }
      }
    }

    return false;
  }

  if (condition.type === "comparison") {
    const { field, operator, value: condValue } = condition;
    const rowValue = row[field];
    const type = types[field] || "string";

    const normalizedRowValue = normalize(rowValue, type);
    let normalizedCondValue = normalize(condValue, type);

    // Handle string comparison operators
    if (operator === ":") {
      if (type === "string") {
        // Substring match
        return normalizedRowValue.includes(normalizedCondValue);
      } else {
        // For non-strings, treat as equality
        return normalizedRowValue === normalizedCondValue;
      }
    }

    if (operator === "=" || operator === "==") {
      return normalizedRowValue === normalizedCondValue;
    }

    if (operator === "!=") {
      return normalizedRowValue !== normalizedCondValue;
    }

    if (operator === ">") {
      return normalizedRowValue > normalizedCondValue;
    }

    if (operator === ">=") {
      return normalizedRowValue >= normalizedCondValue;
    }

    if (operator === "<") {
      return normalizedRowValue < normalizedCondValue;
    }

    if (operator === "<=") {
      return normalizedRowValue <= normalizedCondValue;
    }

    if (operator === "~=") {
      if (type === "string" || type === "number" || type === "date") {
        try {
          const regex = new RegExp(condValue);
          return regex.test(String(rowValue));
        } catch (e) {
          return false;
        }
      }
      return false;
    }
  }

  return false;
}

// Evaluate a group (AND of conditions)
function evaluateGroup(group, row, types) {
  for (const condition of group) {
    if (!evaluateCondition(condition, row, types)) {
      return false;
    }
  }
  return true;
}

// Evaluate query (OR of groups)
function evaluateQuery(orGroups, row, types) {
  if (orGroups.length === 0) {
    return true;
  }

  for (const group of orGroups) {
    if (evaluateGroup(group, row, types)) {
      return true;
    }
  }

  return false;
}

export function filterIds(rows, expr, { idKey = "id", datatypes = null } = {}) {
  if (!expr || expr.trim() === "") {
    return rows.map(r => r[idKey]);
  }

  const types = datatypes || inferTypes(rows);
  const tokens = tokenize(expr);
  const { orGroups, orderBy } = parse(tokens);

  let filteredRows = rows.filter(row => evaluateQuery(orGroups, row, types));

  // Apply ordering if specified
  if (orderBy) {
    const { field, direction } = orderBy;
    const fieldType = types[field] || "string";

    filteredRows = filteredRows.sort((a, b) => {
      const aVal = normalize(a[field], fieldType);
      const bVal = normalize(b[field], fieldType);

      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;

      return direction === "DESC" ? -comparison : comparison;
    });
  }

  return filteredRows.map(row => row[idKey]);
}

export function parseTable(tableLike) {
  const table = typeof tableLike === 'string'
    ? document.querySelector(tableLike)
    : tableLike;

  if (!table) return [];

  const headers = [];
  const headerCells = table.querySelectorAll('thead th');

  headerCells.forEach(th => {
    headers.push(th.textContent.trim());
  });

  const rows = [];
  const bodyRows = table.querySelectorAll('tbody tr');

  bodyRows.forEach((tr, rowIndex) => {
    const row = {};
    const cells = tr.querySelectorAll('td');

    cells.forEach((td, colIndex) => {
      if (colIndex < headers.length) {
        row[headers[colIndex]] = td.textContent.trim();
      }
    });

    rows.push(row);
  });

  return rows;
}

export function deferTypes(tableLike){
  const table = typeof tableLike === 'string'
    ? document.querySelector(tableLike)
    : tableLike;

  if (!table) return {};

  const types = {};
  const headerCells = table.querySelectorAll('thead th');

  headerCells.forEach(th => {
    const fieldName = th.textContent.trim();
    const dataType = th.getAttribute('data-type');

    if (dataType) {
      types[fieldName] = dataType;
    } else {
      types[fieldName] = 'string';
    }
  });

  return types;
}

export function initTableQL(searchSelector, tableSelector, { debug = false } = {}) {
  const searchContainer = document.querySelector(searchSelector);
  const table = document.querySelector(tableSelector);

  if (!searchContainer || !table) {
    console.error('Search container or table not found');
    return;
  }

  // Parse table data and types
  const rows = parseTable(table);
  const datatypes = deferTypes(table);
  const tableRows = table.querySelectorAll('tbody tr');

  // Create search input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tableql-search';
  input.placeholder = 'Search... (e.g., age >= 30, city:Berlin)';
  searchContainer.appendChild(input);

  // Create debug output container if needed
  let debugContainer;
  if (debug) {
    debugContainer = document.createElement('div');
    debugContainer.className = 'tableql-debug';
    searchContainer.appendChild(debugContainer);
  }

  // Filter function
  function applyFilter() {
    const query = input.value.trim();

    if (debug && debugContainer) {
      if (query) {
        try {
          const tokens = tokenize(query);
          const parsed = parse(tokens);
          debugContainer.innerHTML = `
            <div class="debug-section">
              <strong>Tokens:</strong> ${JSON.stringify(tokens)}
            </div>
            <div class="debug-section">
              <strong>Parsed Query (DNF):</strong>
              <pre>${JSON.stringify(parsed, null, 2)}</pre>
            </div>
          `;
        } catch (e) {
          debugContainer.innerHTML = `<div class="debug-error">Parse error: ${e.message}</div>`;
        }
      } else {
        debugContainer.innerHTML = '';
      }
    }

    if (!query) {
      // Show all rows in original order
      tableRows.forEach(row => row.style.display = '');
      // Reset to original order
      const tbody = table.querySelector('tbody');
      rows.forEach((_, index) => {
        tbody.appendChild(tableRows[index]);
      });
      return;
    }

    try {
      const matchingIds = filterIds(rows, query, { datatypes });
      const matchingIdSet = new Set(matchingIds.map(id => String(id)));

      // Create a map from id to table row element
      const idToRowElement = new Map();
      tableRows.forEach((row, index) => {
        const rowId = String(rows[index].id);
        idToRowElement.set(rowId, row);
      });

      // Hide all rows first
      tableRows.forEach(row => row.style.display = 'none');

      // Show and reorder matching rows according to the sorted matchingIds
      const tbody = table.querySelector('tbody');
      matchingIds.forEach(id => {
        const rowElement = idToRowElement.get(String(id));
        if (rowElement) {
          rowElement.style.display = '';
          tbody.appendChild(rowElement); // Move to end, creating the sorted order
        }
      });
    } catch (e) {
      console.error('Filter error:', e);
    }
  }

  // Add event listener for filter-as-you-type
  input.addEventListener('input', applyFilter);

  return {
    input,
    clear: () => {
      input.value = '';
      applyFilter();
    }
  };
}
