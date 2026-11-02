import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodeIcon } from '@phosphor-icons/react/dist/csr/Code';
import { TECHNOLOGY_LOGOS, resolveTechnologyLogo } from './technology-logo.ts';

test('every supported brand and alias resolves to its exact catalog mark', () => {
  for (const { icon, aliases } of TECHNOLOGY_LOGOS) {
    assert.ok(icon.path.length > 0, icon.title);
    assert.ok(icon.source.startsWith('https://'), icon.title);
    assert.ok(!icon.license?.type.includes('-NC-'), icon.title);
    for (const name of [icon.title, ...aliases]) {
      assert.equal(resolveTechnologyLogo(name)?.slug, icon.slug, name);
    }
  }
});

test('normalizes spelling, punctuation, Unicode, whitespace, and version labels', () => {
  for (const [name, slug] of [
    ['NEXT.JS 15', 'nextdotjs'], ['Next_js', 'nextdotjs'], [' next js  ', 'nextdotjs'],
    ['Node.js22', 'nodedotjs'], ['node-js (LTS)', 'nodedotjs'], ['React19', 'react'],
    ['ｒｅａｃｔ', 'react'], ['Postgre SQL', 'postgresql'], ['Postgres', 'postgresql'],
    ['Mongo DB', 'mongodb'], ['TailwindCSS', 'tailwindcss'], ['Type Script', 'typescript'],
    ['Go 1.23', 'go'], ['golang', 'go'], ['K8S', 'kubernetes'], ['.NET 8', 'dotnet'],
    ['ASP.NET Core', 'dotnet'], ['@nestjs/core', 'nestjs'],
  ]) assert.equal(resolveTechnologyLogo(name)?.slug, slug, name);
});

test('selects one primary mark, preferring a specific product over its parent', () => {
  for (const [name, slug] of [
    ['Next.js on Vercel', 'nextdotjs'], ['Vercel hosting Next.js', 'vercel'],
    ['Node.js + Express + PostgreSQL', 'nodedotjs'], ['Express+Postgres', 'express'],
    ['FastAPI (Python)', 'fastapi'], ['React Query / React', 'reactquery'],
    ['React Router (React)', 'reactrouter'], ['Ruby on Rails 8', 'rubyonrails'],
    ['GitHub Actions / GitHub', 'githubactions'], ['Cloudflare Workers', 'cloudflareworkers'],
    ['Anthropic Claude', 'claude'], ['React Native with Expo', 'react'],
    ['Nuxt.js on Netlify', 'nuxt'],
  ]) assert.equal(resolveTechnologyLogo(name)?.slug, slug, name);
});

test('unknown, ambiguous, restricted, and unavailable brands use the neutral fallback', () => {
  for (const name of [
    '', '  ', 'Custom service', 'Context API', 'Reactive helper', 'Bunny CDN',
    'GitHubish', 'PostgreSQLish', 'Next generation framework', 'Ready to go',
    'Custom service without Node.js', 'React-like toolkit', 'Postgres-compatible storage',
    'Vue.js', 'Sass', 'AngularJS', 'SvelteKit', 'Django REST Framework',
    'Vue.js on Vercel', 'OpenAI via LangChain', 'AWS Lambda', 'Azure', 'SendGrid',
  ]) assert.equal(resolveTechnologyLogo(name), null, name);
});

test('inventory preserves every source entry and renders exactly one decorative local mark per row', () => {
  const require = createRequire(import.meta.url);
  const loadComponent = (filename, overrides = {}) => {
    const code = ts.transpileModule(readFileSync(new URL('../components/' + filename, import.meta.url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const componentModule = { exports: {} };
    runInNewContext(code, {
      module: componentModule, exports: componentModule.exports,
      require: (name) => {
        if (name in overrides) return overrides[name];
        if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
        return require(name);
      },
    });
    return componentModule.exports;
  };
  const logo = loadComponent('TechnologyLogo.tsx', {
    '@/lib/technology-logo': { resolveTechnologyLogo },
    '@phosphor-icons/react': { CodeIcon },
  });
  const { TechStackView } = loadComponent('TechStackView.tsx', { './TechnologyLogo': logo });
  const fixture = Object.freeze([
    { choice: 'Next.js on Vercel', category: 'Frontend', rationale: 'Keep every line.\nPreserve the complete generated rationale.' },
    { choice: 'Unknown <custom> & tool', category: 'Next.js', rationale: 'Do not infer a brand from a category or description mentioning React.' },
    { choice: 'Postgres', category: 'Database', rationale: 'The first supplied database entry.' },
    { choice: 'Postgres', category: 'Database', rationale: 'The second independently supplied entry remains intact.' },
    { choice: 'Vue.js', category: 'UI', rationale: 'Keep the entry even when its mark uses a fallback.' },
  ].map((entry) => Object.freeze(entry)));
  const before = JSON.stringify(fixture);
  const html = renderToStaticMarkup(React.createElement(TechStackView, { techStack: fixture }));
  const rows = Array.from(html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g), (match) => match[1]);
  const escaped = (text) => renderToStaticMarkup(React.createElement('span', null, text)).replace(/^<span>|<\/span>$/g, '');
  assert.equal(rows.length, fixture.length);
  rows.forEach((row, index) => {
    assert.equal((row.match(/<h3\b/g) ?? []).length, 1);
    assert.equal((row.match(/<svg\b/g) ?? []).length, 1);
    assert.equal((row.match(/data-technology-logo=/g) ?? []).length, 1);
    assert.ok(row.includes('aria-hidden="true"'));
    assert.ok(row.includes('width="30"') && row.includes('height="30"'));
    for (const value of Object.values(fixture[index])) assert.ok(row.includes(escaped(value)), value);
  });
  assert.ok(rows[0].includes('data-technology-logo="nextdotjs"'));
  assert.ok(rows[1].includes('data-technology-logo="generic"'));
  assert.ok(rows[4].includes('data-technology-logo="generic"'));
  assert.ok(!/<(?:button|select|aside|details|summary|img|image|title)\b/.test(html));
  assert.ok(!/\b(?:src|href)=/.test(html));
  assert.equal(JSON.stringify(fixture), before);
  assert.ok(renderToStaticMarkup(React.createElement(TechStackView, { techStack: [] })).includes('No technologies have been specified'));
});
