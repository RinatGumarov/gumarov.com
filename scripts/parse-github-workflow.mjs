/**
 * Parses the small GitHub Actions YAML subset used in this repository.
 * The workflows are indent-only mappings and sequences without aliases.
 */
export function parseGithubWorkflow(source) {
  const lines = source
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const [document, nextIndex] = parseBlock(lines, 0, 0);
  if (nextIndex !== lines.length) {
    throw new Error(`Unparsed workflow content from line ${nextIndex + 1}.`);
  }
  return document;
}

function parseBlock(lines, index, indent) {
  if (index >= lines.length) return [{}, index];

  const first = lines[index];
  if (leadingSpaces(first) !== indent) {
    throw new Error(`Expected indent ${indent} on line ${index + 1}.`);
  }

  if (first.trimStart().startsWith('- ')) {
    return parseSequence(lines, index, indent);
  }
  return parseMapping(lines, index, indent);
}

function parseMapping(lines, index, indent) {
  const object = {};
  while (index < lines.length) {
    const line = lines[index];
    const currentIndent = leadingSpaces(line);
    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      throw new Error(`Unexpected indent on line ${index + 1}.`);
    }
    if (line.trimStart().startsWith('- ')) break;

    const trimmed = line.trim();
    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      throw new Error(`Missing mapping separator on line ${index + 1}.`);
    }

    const key = trimmed.slice(0, separator);
    const remainder = trimmed.slice(separator + 1).trim();
    index += 1;

    if (remainder.length > 0) {
      object[key] = parseScalar(remainder);
      continue;
    }

    if (index >= lines.length || leadingSpaces(lines[index]) <= indent) {
      object[key] = null;
      continue;
    }

    const [value, nextIndex] = parseBlock(lines, index, indent + 2);
    object[key] = value;
    index = nextIndex;
  }
  return [object, index];
}

function parseSequence(lines, index, indent) {
  const items = [];
  while (index < lines.length) {
    const line = lines[index];
    const currentIndent = leadingSpaces(line);
    if (currentIndent < indent) break;
    if (currentIndent !== indent || !line.trimStart().startsWith('- ')) break;

    const remainder = line.trimStart().slice(2);
    index += 1;

    if (!remainder.includes(':')) {
      items.push(parseScalar(remainder));
      continue;
    }

    const fakeMappingLine = `${' '.repeat(indent + 2)}${remainder}`;
    const nestedLines = [fakeMappingLine, ...lines.slice(index)];
    const [value, nestedIndex] = parseMapping(nestedLines, 0, indent + 2);
    items.push(value);
    index += nestedIndex - 1;
  }
  return [items, index];
}

function parseScalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/u.test(value)) return Number(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function leadingSpaces(line) {
  return line.match(/^ */u)?.[0].length ?? 0;
}
