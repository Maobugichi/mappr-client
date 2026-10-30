/** Interpret generated values for previews without mutating the original tokens. */
export type DesignToken = { token: string; value: string };
export type TypographyDeclaration = readonly [property: string, value: string];

export function resolveDesignTokenValue(value: string, tokens: readonly DesignToken[], seen: readonly string[] = []): string | null {
  if (seen.length > 16) return null;
  let unresolved = false;
  const resolved = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_match, reference: string, fallback?: string) => {
    const name = reference.slice(2);
    const matches = tokens.filter((token) => token.token.replace(/^--/, '') === name);
    const replacement = matches.length === 1 && !seen.includes(name)
      ? resolveDesignTokenValue(matches[0].value, tokens, [...seen, name])
      : null;
    if (replacement !== null) return replacement;
    if (fallback !== undefined) return fallback.trim();
    unresolved = true;
    return '';
  });
  // Unresolved references must never fall through to Mappr's own CSS variables.
  return unresolved || /var\s*\(/i.test(resolved) ? null : resolved.trim();
}

const TYPOGRAPHY_PROPERTIES: Record<string, string> = {
  font: 'font',
  fontfamily: 'font-family', family: 'font-family',
  fontsize: 'font-size', size: 'font-size',
  fontweight: 'font-weight', weight: 'font-weight',
  lineheight: 'line-height', leading: 'line-height',
  letterspacing: 'letter-spacing', tracking: 'letter-spacing',
  fontstyle: 'font-style',
};

export function typographyDeclarations(token: string, value: string): TypographyDeclaration[] {
  const declarations: TypographyDeclaration[] = [];
  const add = (key: string, setting: unknown) => {
    const property = TYPOGRAPHY_PROPERTIES[key.replace(/[-_\s]/g, '').toLowerCase()];
    if (!property || (typeof setting !== 'string' && typeof setting !== 'number')) return;
    // Numeric sizes in structured data follow CSS pixel semantics; line height
    // and weight remain unitless. The displayed/copied source is never changed.
    const normalized = typeof setting === 'number' && ['font-size', 'letter-spacing'].includes(property)
      ? setting + 'px' : String(setting);
    declarations.push([property, normalized]);
  };
  try {
    const structured: unknown = JSON.parse(value);
    if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
      for (const [key, setting] of Object.entries(structured)) add(key, setting);
      if (declarations.length) return declarations;
    }
  } catch { /* Most generated values are ordinary CSS strings. */ }
  for (const part of value.split(';')) {
    const declaration = part.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
    if (declaration) add(declaration[1], declaration[2]);
  }
  if (declarations.length) return declarations;

  const identity = token.toLowerCase().replace(/[-_\s]/g, '');
  for (const [key, property] of Object.entries(TYPOGRAPHY_PROPERTIES)) {
    if (key !== 'font' && identity.includes(key)) {
      return [[property, value]];
    }
  }
  // A size/line-height pair does not need a made-up font family to render.
  const pair = value.match(/^(?:(normal|bold|[1-9]00)\s+)?(\d*\.?\d+(?:px|rem|em|pt|%|vw|vh))\s*\/\s*(\d*\.?\d+(?:px|rem|em|pt|%|vw|vh)?)$/i);
  if (pair) {
    if (pair[1]) declarations.push(['font-weight', pair[1]]);
    return [...declarations, ['font-size', pair[2]], ['line-height', pair[3]]];
  }
  // Try these in order in the browser, applying only the first supported form.
  return [['font', value], ['font-size', value], ['font-family', value]];
}

export function colorIllustration(token: string): 'text' | 'border' | 'surface' {
  const words = token.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/);
  if (words.some((word) => ['text', 'foreground', 'fg'].includes(word))) return 'text';
  if (words.some((word) => ['border', 'outline'].includes(word))) return 'border';
  return 'surface';
}
