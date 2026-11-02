import type { EnvVar } from './api';

const SENSITIVE_NAME = /(?:^|_)(?:secret|token|password|passwd|pwd|credential|credentials|key|pin|otp)(?:_|$)/i;
const TOKEN = /(?:-----BEGIN [^-\r\n]*PRIVATE KEY-----|\b(?:sk|rk)_(?:live|test)_[a-z0-9]{8,}|\bsk-[a-z0-9_-]{16,}|\bgh[pousr]_[a-z0-9]{16,}|\bgithub_pat_[a-z0-9_]{16,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\beyJ[a-z0-9_-]{5,}\.[a-z0-9_-]{5,}\.[a-z0-9_-]{5,})/i;

function decoded(value: string): string {
  let result = value;
  for (let count = 0; count < 2; count++) {
    try {
      const next = decodeURIComponent(result);
      if (next === result) break;
      result = next;
    } catch { break; }
  }
  return result;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  return trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) ? trimmed.slice(1, -1) : trimmed;
}

function isPlaceholder(value: string): boolean {
  return /^(?:YOUR_[A-Z0-9_]+|GENERATE_[A-Z0-9_]+|\$\{[A-Z_][A-Z0-9_]*\}|<(?:[A-Z][A-Z0-9_ -]*|your[-_ a-z]+|password|username|secret|token|api[_-]?key|value|host|port)>|your[-_][a-z_-]+|replace[-_]with[-_][a-z_-]+|replace[-_]?me|change[-_]?me|example(?:[-_][a-z_-]+)?|placeholder|x{3,}|\.{3})$/.test(value);
}

function opaque(value: string): boolean {
  return /^[a-z0-9_+/=-]{32,}$/i.test(value) || /^[a-f0-9]{24,}$/i.test(value);
}

function containsCredentials(value: string): boolean {
  const text = decoded(value);
  if (TOKEN.test(text) || /^\s*(?:Bearer|Basic)\s+\S+\s*$/i.test(text)) return true;
  for (const match of text.matchAll(/\b(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)\s*[=:]\s*["']?([^\s&;"']+)/gi)) {
    if (!isPlaceholder(match[2])) return true;
  }
  for (const candidate of text.matchAll(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"']+/gi)) {
    try {
      const url = new URL(candidate[0]);
      if (url.username || url.password) return true;
      if (url.pathname.split('/').some((part) => TOKEN.test(decoded(part)) || opaque(decoded(part)))) return true;
      for (const [key, entry] of url.searchParams) {
        if ((SENSITIVE_NAME.test(key) && entry && !isPlaceholder(entry)) || TOKEN.test(entry) || opaque(entry)) return true;
      }
      if (opaque(url.hash.slice(1))) return true;
    } catch { /* Non-URL text still receives the token/name checks. */ }
  }
  return false;
}

function hiddenExample(name: string, secret: boolean, value: string): boolean {
  const example = unquote(value);
  if (!example) return false;
  if (containsCredentials(example)) return true;
  if (isPlaceholder(example)) return false;
  return secret || SENSITIVE_NAME.test(name) || opaque(example);
}

export function envExamplePolicy(variable: Pick<EnvVar, 'name' | 'secret' | 'placeholder'>): { hidden: boolean; canCopy: boolean } {
  const value = unquote(variable.placeholder);
  const hidden = hiddenExample(variable.name, variable.secret, variable.placeholder);
  if (hidden || !value || variable.secret || SENSITIVE_NAME.test(variable.name)) return { hidden, canCopy: false };
  if (isPlaceholder(value) || /^(?:true|false|\d+(?:\.\d+)?|development|production|staging|test|debug|info|warn|error|trace|silent|localhost)$/.test(value)) {
    return { hidden: false, canCopy: true };
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const exampleHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
      || /^(?:[^.]+\.)*(?:example\.(?:com|org|net))$/.test(host) || host.endsWith('.test');
    return { hidden: false, canCopy: exampleHost && !url.username && !url.password && !url.search && !url.hash };
  } catch {
    return { hidden: false, canCopy: false };
  }
}

export class UnsafeEnvExampleError extends Error {
  constructor(message = 'The template contains a sensitive-looking example. Regenerate the variables before exporting.') {
    super(message);
    this.name = 'UnsafeEnvExampleError';
  }
}

// Validate without rewriting the server's template, comments, grouping or EOLs.
// Quoted values may span lines; never check their continuation lines as keys.
export function assertSafeEnvTemplate(template: string, variables: readonly EnvVar[]): void {
  if (containsCredentials(template)) throw new UnsafeEnvExampleError();
  const lines = template.split(/\r\n|\n|\r/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#')) continue;
    const assignment = /^(?:export\s+)?([a-z_][a-z0-9_]*)\s*=\s*(.*)$/i.exec(line);
    if (!assignment) throw new UnsafeEnvExampleError('The template format could not be checked safely. Regenerate the variables before exporting.');
    const [, name, initial] = assignment;
    let value = initial;
    const quote = initial[0];
    if (quote === '"' || quote === "'") {
      value = '';
      let segment = initial.slice(1);
      let closed = false;
      while (!closed) {
        for (let cursor = 0; cursor < segment.length; cursor++) {
          if (segment[cursor] === '\\' && cursor + 1 < segment.length) {
            value += segment[cursor] + segment[++cursor];
          } else if (segment[cursor] === quote) {
            const suffix = segment.slice(cursor + 1).trim();
            if (suffix && !suffix.startsWith('#')) throw new UnsafeEnvExampleError('The template format could not be checked safely. Regenerate the variables before exporting.');
            closed = true;
            break;
          } else value += segment[cursor];
        }
        if (!closed) {
          if (++index >= lines.length) throw new UnsafeEnvExampleError('The template format could not be checked safely. Regenerate the variables before exporting.');
          value += '\n';
          segment = lines[index];
        }
      }
    } else value = initial.split('#', 1)[0].trim();
    const secret = variables.some((variable) => variable.name === name && variable.secret);
    if (hiddenExample(name, secret, value)) throw new UnsafeEnvExampleError();
  }
}
