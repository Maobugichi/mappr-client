import {
  siAngular, siAnthropic, siApollographql, siApachekafka, siAstro, siAuth0,
  siBootstrap, siBun, siClaude, siClerk, siCloudflare, siCloudflareworkers, siDatadog, siDeno, siDjango,
  siDocker, siDotnet, siDrizzle, siElasticsearch, siExpress, siFastapi,
  siFastify, siFirebase, siFlask, siGit, siGithub, siGithubactions, siGitlab,
  siGo, siGooglecloud, siGrafana, siGraphql, siHono, siHuggingface,
  siJavascript, siKubernetes, siLangchain, siLaravel, siMailgun, siMariadb,
  siMongodb, siMongoose, siMysql, siN8n, siNestjs, siNetlify, siNextdotjs,
  siNginx, siNodedotjs, siNuxt, siOllama, siOpensearch, siPhp, siPostgresql,
  siPrisma, siPrometheus, siPython, siRabbitmq, siReact, siReactquery, siReactrouter,
  siRedis, siResend, siRuby, siRubyonrails, siRust, siSentry, siSocketdotio,
  siSolid, siSqlite, siStripe, siSupabase, siSvelte, siTailwindcss,
  siTypescript, siVercel, type SimpleIcon,
} from 'simple-icons';

type TechnologyBrand = { icon: SimpleIcon; aliases: readonly string[] };

// Explicit named imports keep the client bundle limited to this vetted catalog.
// Every path and its source/license/guidelines come from pinned Simple Icons.
// See docs/technology-logos.md before extending the catalog.
export const TECHNOLOGY_LOGOS: readonly TechnologyBrand[] = [
  { icon: siNextdotjs, aliases: ['nextjs', 'next js', 'next'] },
  { icon: siReact, aliases: ['reactjs', 'react js', 'react native', 'reactnative', 'react dom'] },
  { icon: siReactquery, aliases: ['reactquery'] },
  { icon: siReactrouter, aliases: ['reactrouter'] },
  { icon: siAngular, aliases: [] },
  { icon: siSvelte, aliases: ['sveltejs', 'svelte js'] },
  { icon: siAstro, aliases: ['astrojs', 'astro js'] },
  { icon: siNuxt, aliases: ['nuxtjs', 'nuxt js', 'nuxt.js'] },
  { icon: siSolid, aliases: ['solidjs', 'solid js'] },
  { icon: siNodedotjs, aliases: ['nodejs', 'node js', 'node'] },
  { icon: siExpress, aliases: ['expressjs', 'express js', 'express.js'] },
  { icon: siNestjs, aliases: ['nest js', 'nest.js'] },
  { icon: siFastify, aliases: ['fastifyjs'] },
  { icon: siHono, aliases: ['honojs', 'hono js'] },
  { icon: siDeno, aliases: [] },
  { icon: siBun, aliases: ['bunjs', 'bun js'] },
  { icon: siTypescript, aliases: ['type script', 'ts'] },
  { icon: siJavascript, aliases: ['java script', 'js', 'ecmascript'] },
  { icon: siPython, aliases: ['python3', 'python 3'] },
  { icon: siDjango, aliases: [] },
  { icon: siFastapi, aliases: ['fast api'] },
  { icon: siFlask, aliases: [] },
  { icon: siGo, aliases: ['golang', 'go lang'] },
  { icon: siRust, aliases: ['rustlang', 'rust lang'] },
  { icon: siPhp, aliases: [] },
  { icon: siLaravel, aliases: [] },
  { icon: siRuby, aliases: [] },
  { icon: siRubyonrails, aliases: ['rails', 'rubyonrails', 'ruby on rails'] },
  { icon: siDotnet, aliases: ['dotnet', 'dot net', 'asp.net', 'aspnet', 'asp net core'] },
  { icon: siPostgresql, aliases: ['postgres', 'postgre sql', 'postgressql'] },
  { icon: siMysql, aliases: ['my sql'] },
  { icon: siSqlite, aliases: ['sqlite3', 'sqlite 3', 'sql lite'] },
  { icon: siMariadb, aliases: ['maria db'] },
  { icon: siMongodb, aliases: ['mongo', 'mongo db', 'mongodb atlas'] },
  { icon: siMongoose, aliases: ['mongoosejs', 'mongoose js'] },
  { icon: siRedis, aliases: [] },
  { icon: siSupabase, aliases: ['supa base'] },
  { icon: siFirebase, aliases: ['google firebase'] },
  { icon: siPrisma, aliases: ['prisma orm'] },
  { icon: siDrizzle, aliases: ['drizzle orm'] },
  { icon: siTailwindcss, aliases: ['tailwind', 'tailwind css', 'tailwindcss'] },
  { icon: siBootstrap, aliases: ['bootstrap css'] },
  { icon: siDocker, aliases: [] },
  { icon: siKubernetes, aliases: ['k8s'] },
  { icon: siNginx, aliases: ['nginx server'] },
  { icon: siVercel, aliases: [] },
  { icon: siNetlify, aliases: [] },
  { icon: siCloudflare, aliases: ['cloud flare'] },
  { icon: siCloudflareworkers, aliases: ['cloudflare workers', 'cloud flare workers'] },
  { icon: siGooglecloud, aliases: ['gcp', 'google cloud platform'] },
  { icon: siStripe, aliases: [] },
  { icon: siAuth0, aliases: ['auth 0', 'auth zero'] },
  { icon: siClerk, aliases: ['clerk auth'] },
  { icon: siGraphql, aliases: ['graph ql'] },
  { icon: siApollographql, aliases: ['apollo', 'apollo server', 'apollo client'] },
  { icon: siRabbitmq, aliases: ['rabbit mq'] },
  { icon: siApachekafka, aliases: ['kafka'] },
  { icon: siElasticsearch, aliases: ['elastic search'] },
  { icon: siOpensearch, aliases: ['open search'] },
  { icon: siSocketdotio, aliases: ['socketio', 'socket io'] },
  { icon: siGit, aliases: [] },
  { icon: siGithub, aliases: ['git hub'] },
  { icon: siGithubactions, aliases: ['github actions', 'git hub actions'] },
  { icon: siGitlab, aliases: ['git lab'] },
  { icon: siAnthropic, aliases: [] },
  { icon: siClaude, aliases: ['anthropic claude', 'claude ai'] },
  { icon: siOllama, aliases: [] },
  { icon: siHuggingface, aliases: ['huggingface'] },
  { icon: siLangchain, aliases: ['lang chain'] },
  { icon: siN8n, aliases: [] },
  { icon: siResend, aliases: [] },
  { icon: siMailgun, aliases: ['mail gun'] },
  { icon: siSentry, aliases: [] },
  { icon: siDatadog, aliases: ['data dog'] },
  { icon: siPrometheus, aliases: [] },
  { icon: siGrafana, aliases: [] },
];

// Do not borrow a secondary platform's logo when an explicitly identified
// primary brand is unavailable or has a known noncommercial icon license.
const FALLBACK_BRANDS = [
  'vue', 'vue.js', 'vuejs', 'vue js', 'sass', 'scss',
  'angularjs', 'angular js', 'sveltekit', 'svelte kit', 'django rest framework', 'drf',
  'openai', 'open ai', 'chatgpt', 'chat gpt', 'gpt',
  'aws', 'amazon web services', 'amazon dynamodb', 'dynamodb', 'amazon s3', 's3',
  'microsoft azure', 'azure', 'microsoft sql server', 'mssql', 'sendgrid', 'send grid',
];

function normalize(name: string): string {
  return name.normalize('NFKC').toLowerCase()
    .replace(/\.net(?=\b|\d)/g, ' dotnet ')
    .replace(/[+|/&,]/g, ' plus ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const SHORT_ALIASES = new Set(['next', 'node', 'go', 'bun', 'solid', 'express', 'rails', 'mongo', 'ts', 'js', 'drf', 'gcp']);
const matchers = [
  ...TECHNOLOGY_LOGOS.flatMap(({ icon, aliases }) => [...new Set([icon.title, ...aliases].map(normalize))]
    .map((alias) => ({ icon, alias }))),
  ...[...new Set(FALLBACK_BRANDS.map(normalize))].map((alias) => ({ icon: null, alias })),
].map((entry) => ({
  ...entry,
  // Whole tokens prevent matches inside unrelated product names; a numeric
  // version may directly follow a brand (React19, Node.js22).
  pattern: new RegExp('(^| )' + entry.alias + '(?=$| |v?\\d+(?=$| ))', 'u'),
}));

/** Resolve one locally verified brand from a generated choice, never its rationale/category. */
export function resolveTechnologyLogo(name: string): SimpleIcon | null {
  const normalized = normalize(name);
  let best: { icon: SimpleIcon | null; start: number; length: number } | null = null;
  for (const { icon, alias, pattern } of matchers) {
    const match = pattern.exec(normalized);
    if (!match) continue;
    const start = match.index + match[1].length;
    const rest = normalized.slice(start + alias.length).trim();
    if (/^(?:like|compatible)(?: |$)/.test(rest)) continue;
    if (SHORT_ALIASES.has(alias)) {
      if (start !== 0 || (rest && !/^(?:v?\d|lts\b|plus\b|on\b|with\b|via\b|using\b|js\b|runtime\b|framework\b|api\b|server\b|backend\b|frontend\b|language\b)/.test(rest))) continue;
    }
    if (/(?:^| )(?:not|without|excluding)$/.test(normalized.slice(0, start).trim())) continue;
    // First named brand wins; the most specific alias wins ties (Rails over
    // Ruby, GitHub Actions over GitHub). Hosting never displaces Next.js.
    if (!best || start < best.start || (start === best.start && alias.length > best.length)) {
      best = { icon, start, length: alias.length };
    }
  }
  return best?.icon ?? null;
}
