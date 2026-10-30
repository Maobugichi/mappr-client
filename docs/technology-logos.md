# Technology logos

## Provider and rendering

Mappr pins Simple Icons **16.36.0** in package.json and package-lock.json. Only the explicit named imports in src/lib/technology-logo.ts enter the client bundle; there is no wildcard catalog import, CDN URL construction, remote lookup, or per-logo fetch. TechnologyLogo renders the unmodified catalog path in its native 24-unit viewBox at 30px, in a 32px slot. The white monochrome marks contrast with Mappr's navy surface. They are decorative: the adjacent, unchanged technology name is the accessible label. There are no repeated SVG titles, controls, or animations.

## Resolution

The resolver examines only the generated technology choice, never its category or rationale. Case, Unicode width, punctuation, whitespace, and explicit aliases are normalized for matching; the displayed strings are never normalized or rewritten. Whole-token matching and conservative short aliases avoid unrelated names such as Context, Reactive, Bunny, or Next generation. Numeric versions may follow names directly.

For compound names, the first identified brand wins and the longest alias wins ties: Next.js on Vercel resolves to Next.js; Ruby on Rails resolves to Rails; React Query and GitHub Actions use their own marks. A known unsupported primary brand yields the neutral Phosphor Code icon rather than borrowing its hosting platform's logo. Unknown future names also yield that fallback synchronously. This is a curated, extensible catalog, not universal brand coverage.

## License and trademark review

Reviewed 2026-10-30. Simple Icons' project license is [CC0-1.0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md). That does **not** make every individual logo CC0 or grant trademark rights. Preserve the [Simple Icons disclaimer](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md), the pinned package's per-icon license metadata, and the source/guideline references below. Missing license metadata is not a grant of unrestricted use. The package remains the source of the paths and metadata; these notes do not replace the upstream licenses. Brand marks here identify technologies in generated documentation and are not Mappr's identity, an endorsement, or a claim of affiliation or deployment.

Specific guidelines checked include [Next.js and Vercel](https://vercel.com/geist/brands), [Node.js](https://nodejs.org/en/about/branding) and the [OpenJS trademark policy](https://trademark-policy.openjsf.org/), [TypeScript](https://www.typescriptlang.org/branding/), [Tailwind CSS](https://tailwindcss.com/brand), [PostgreSQL](https://www.postgresql.org/about/policies/trademarks/), [Python](https://www.python.org/community/logos/), [Firebase](https://firebase.google.com/brand-guidelines), and [Docker](https://www.docker.com/company/newsroom/media-resources/). The reviewed Next.js/Vercel, Node.js, TypeScript, Firebase, and Docker assets include white or single-color variants. Paths are not distorted, cropped, combined, or animated. Keep use referential and recheck the applicable guidelines before adding a brand, changing its presentation, or updating the dependency.

### Deliberate fallbacks

- Vue.js artwork is CC-BY-NC-SA-4.0 with additional permitted-use conditions. [Vue's terms](https://github.com/vuejs/art/blob/a1c78b74569b70a25300925b4eacfefcc143b8f6/README.md) do not give a blanket grant for unrelated commercial product use; the current catalog uses the neutral icon.
- Sass artwork is CC-BY-NC-SA-3.0. [Sass guidelines](https://sass-lang.com/styleguide/brand/) also specify its permitted color variants. Sass/SCSS currently use the neutral icon.
- OpenAI, AWS, Azure, SendGrid, AngularJS, SvelteKit, and Django REST Framework do not have their own verified marks in this pinned catalog. Do not substitute another vendor's mark or invent an asset URL. Their names and descriptions remain intact.

## Catalog attribution and source references

Each mark below is attributed to the named upstream project/brand and its linked source. Individual listed licenses continue to apply to that mark, including attribution/share-alike conditions where provided. Rendering uses the unmodified path in monochrome; any applicable asset-license conditions remain attached to the asset and are not replaced by Mappr's application license. Phosphor's existing Code fallback remains covered by its installed MIT license.

| Mark | Catalog slug | Individual license recorded by Simple Icons | Source | Brand guidelines |
| --- | --- | --- | --- | --- |
| Next.js | nextdotjs | Not supplied; review source/brand terms | [Source](https://vercel.com/design/brands#next-js) | [Guidelines](https://vercel.com/design/brands#next-js) |
| React | react | Not supplied; review source/brand terms | [Source](https://github.com/facebook/create-react-app/blob/282c03f9525fdf8061ffa1ec50dce89296d916bd/test/fixtures/relative-paths/src/logo.svg) | Not supplied; review source |
| React Query | reactquery | Not supplied; review source/brand terms | [Source](https://github.com/tannerlinsley/react-query/blob/9b5d18cd47a4c1454d6c8dd0f38280641c1dd5dd/docs/src/images/emblem-light.svg) | Not supplied; review source |
| React Router | reactrouter | Not supplied; review source/brand terms | [Source](https://github.com/ReactTraining/react-router/blob/c94bcd8cef0c811f80b02777ec26fee3618f8e86/website/static/safari-pinned-tab.svg) | Not supplied; review source |
| Angular | angular | [CC-BY-4.0](https://spdx.org/licenses/CC-BY-4.0) | [Source](https://angular.dev/press-kit) | [Guidelines](https://angular.dev/press-kit) |
| Svelte | svelte | Not supplied; review source/brand terms | [Source](https://github.com/sveltejs/branding/blob/c4dfca6743572087a6aef0e109ffe3d95596e86a/svelte-logo.svg) | Not supplied; review source |
| Astro | astro | Not supplied; review source/brand terms | [Source](https://astro.build/press) | Not supplied; review source |
| Nuxt | nuxt | Not supplied; review source/brand terms | [Source](https://nuxt.com/design-kit) | [Guidelines](https://nuxt.com/design-kit) |
| Solid | solid | Not supplied; review source/brand terms | [Source](https://www.solidjs.com/media) | Not supplied; review source |
| Node.js | nodedotjs | Not supplied; review source/brand terms | [Source](https://nodejs.org/en/about/branding) | [Guidelines](https://nodejs.org/en/about/branding) |
| Express | express | Not supplied; review source/brand terms | [Source](https://github.com/openjs-foundation/artwork/blob/3816245ebbf4707bdafde748350ac8476b6b5b62/projects/express/express-icon-black.svg) | Not supplied; review source |
| NestJS | nestjs | Not supplied; review source/brand terms | [Source](https://nestjs.com) | Not supplied; review source |
| Fastify | fastify | Not supplied; review source/brand terms | [Source](https://github.com/fastify/graphics/blob/91e8a3d4754807de3b69440f66c72a737a5fde94/fastify-1000px-square-02.svg) | Not supplied; review source |
| Hono | hono | Not supplied; review source/brand terms | [Source](https://github.com/honojs/hono/blob/76dbc74407329c46870af6aa4fab0c04036d8ae2/docs/images/hono-logo.svg) | Not supplied; review source |
| Deno | deno | [MIT](https://spdx.org/licenses/MIT) | [Source](https://github.com/denoland/docs/blob/5dee713844c7447f80acd4093caa9d350d80bf36/static/img/logo.svg) | [Guidelines](https://deno.com/brand) |
| Bun | bun | Not supplied; review source/brand terms | [Source](https://bun.sh/press-kit) | Not supplied; review source |
| TypeScript | typescript | Not supplied; review source/brand terms | [Source](https://www.typescriptlang.org/branding) | [Guidelines](https://www.typescriptlang.org/branding) |
| JavaScript | javascript | [MIT](https://spdx.org/licenses/MIT) | [Source](https://github.com/voodootikigod/logo.js/blob/1544bdeed6d618a6cfe4f0650d04ab8d9cfa76d9/js.svg) | Not supplied; review source |
| Python | python | Not supplied; review source/brand terms | [Source](https://www.python.org/community/logos/) | [Guidelines](https://www.python.org/community/logos/) |
| Django | django | Not supplied; review source/brand terms | [Source](https://www.djangoproject.com/community/logos/) | Not supplied; review source |
| FastAPI | fastapi | Not supplied; review source/brand terms | [Source](https://github.com/tiangolo/fastapi/blob/ffb4f77a11f83132b521ba0aac6c95792c19e797/docs/en/docs/img/icon-white.svg) | Not supplied; review source |
| Flask | flask | Not supplied; review source/brand terms | [Source](https://github.com/pallets/flask/blob/85c5d93cbd049c4bd0679c36fd1ddcae8c37b642/docs/_static/flask-icon.svg) | Not supplied; review source |
| Go | go | Not supplied; review source/brand terms | [Source](https://blog.golang.org/go-brand) | [Guidelines](https://blog.golang.org/go-brand) |
| Rust | rust | [CC-BY-SA-4.0](https://spdx.org/licenses/CC-BY-SA-4.0) | [Source](https://www.rust-lang.org) | [Guidelines](https://www.rust-lang.org/policies/media-guide) |
| PHP | php | [CC-BY-SA-4.0](https://spdx.org/licenses/CC-BY-SA-4.0) | [Source](https://php.net/download-logos.php) | Not supplied; review source |
| Laravel | laravel | Not supplied; review source/brand terms | [Source](https://github.com/laravel/art/tree/5a8325b064634b900f25dbb6f1cafd888b2d2211) | Not supplied; review source |
| Ruby | ruby | [CC-BY-SA-2.5](https://spdx.org/licenses/CC-BY-SA-2.5) | [Source](https://www.ruby-lang.org/en/about/logo/) | Not supplied; review source |
| Ruby on Rails | rubyonrails | Not supplied; review source/brand terms | [Source](https://github.com/simple-icons/simple-icons/issues/9619#issuecomment-1735150580) | [Guidelines](https://rubyonrails.org/trademarks/) |
| .NET | dotnet | [CC0-1.0](https://spdx.org/licenses/CC0-1.0) | [Source](https://github.com/dotnet/brand/blob/c7d0f51b8ec59531332d05fb27a5b758a7a3d689/logo/dotnet-logo.svg) | [Guidelines](https://github.com/dotnet/brand/blob/c7d0f51b8ec59531332d05fb27a5b758a7a3d689/dotnet-styleGuide-2024.pdf) |
| PostgreSQL | postgresql | Not supplied; review source/brand terms | [Source](https://wiki.postgresql.org/wiki/Logo) | [Guidelines](https://www.postgresql.org/about/policies/trademarks/) |
| MySQL | mysql | Not supplied; review source/brand terms | [Source](https://www.mysql.com/about/legal/logos.html) | [Guidelines](https://www.mysql.com/about/legal/logos.html) |
| SQLite | sqlite | Not supplied; review source/brand terms | [Source](https://github.com/sqlite/sqlite/blob/43e862723ec680542ca6f608f9963c0993dd7324/art/sqlite370.eps) | Not supplied; review source |
| MariaDB | mariadb | Not supplied; review source/brand terms | [Source](https://mariadb.com/about-us/logos/) | [Guidelines](https://mariadb.com/about-us/logos/) |
| MongoDB | mongodb | Not supplied; review source/brand terms | [Source](https://www.mongodb.com/pressroom) | Not supplied; review source |
| Mongoose | mongoose | Not supplied; review source/brand terms | [Source](https://github.com/Automattic/mongoose/blob/7971a4dbd55888f0b005e65b06024109af8352f7/docs/images/mongoose.svg) | Not supplied; review source |
| Redis | redis | Not supplied; review source/brand terms | [Source](https://redis.io/brand-guidelines) | [Guidelines](https://redis.io/brand-guidelines) |
| Supabase | supabase | Not supplied; review source/brand terms | [Source](https://github.com/supabase/supabase/blob/4031a7549f5d46da7bc79c01d56be4177dc7c114/packages/common/assets/images/supabase-logo-wordmark--light.svg) | Not supplied; review source |
| Firebase | firebase | Not supplied; review source/brand terms | [Source](https://firebase.google.com/brand-guidelines) | [Guidelines](https://firebase.google.com/brand-guidelines) |
| Prisma | prisma | Not supplied; review source/brand terms | [Source](https://github.com/prisma/presskit/tree/4bcb64181f266723439d955d60afa1c55fefa715) | Not supplied; review source |
| Drizzle | drizzle | Not supplied; review source/brand terms | [Source](https://orm.drizzle.team) | Not supplied; review source |
| Tailwind CSS | tailwindcss | Not supplied; review source/brand terms | [Source](https://tailwindcss.com/brand) | [Guidelines](https://tailwindcss.com/brand) |
| Bootstrap | bootstrap | [MIT](https://spdx.org/licenses/MIT) | [Source](https://getbootstrap.com/docs/5.3/about/brand) | [Guidelines](https://getbootstrap.com/docs/5.3/about/brand) |
| Docker | docker | Not supplied; review source/brand terms | [Source](https://www.docker.com/company/newsroom/media-resources) | Not supplied; review source |
| Kubernetes | kubernetes | Not supplied; review source/brand terms | [Source](https://github.com/kubernetes/kubernetes/tree/cac53883f4714452f3084a22e4be20d042a9df33/logo) | Not supplied; review source |
| NGINX | nginx | Not supplied; review source/brand terms | [Source](https://www.nginx.com/press/) | [Guidelines](https://www.nginx.com/press/) |
| Vercel | vercel | Not supplied; review source/brand terms | [Source](https://vercel.com/geist/brands) | [Guidelines](https://vercel.com/geist/brands) |
| Netlify | netlify | Not supplied; review source/brand terms | [Source](https://www.netlify.com/press/) | [Guidelines](https://www.netlify.com/press/) |
| Cloudflare | cloudflare | Not supplied; review source/brand terms | [Source](https://www.cloudflare.com/logo/) | [Guidelines](https://www.cloudflare.com/trademark/) |
| Cloudflare Workers | cloudflareworkers | Not supplied; review source/brand terms | [Source](https://www.cloudflare.com/developer-platform/products/) | [Guidelines](https://www.cloudflare.com/trademark/) |
| Google Cloud | googlecloud | Not supplied; review source/brand terms | [Source](https://cloud.google.com) | Not supplied; review source |
| Stripe | stripe | Not supplied; review source/brand terms | [Source](https://stripe.com/newsroom/information) | Not supplied; review source |
| Auth0 | auth0 | Not supplied; review source/brand terms | [Source](https://auth0.com) | Not supplied; review source |
| Clerk | clerk | Not supplied; review source/brand terms | [Source](https://clerk.com) | Not supplied; review source |
| GraphQL | graphql | Not supplied; review source/brand terms | [Source](https://graphql.org/brand) | [Guidelines](https://graphql.org/brand) |
| Apollo GraphQL | apollographql | Not supplied; review source/brand terms | [Source](https://www.apollographql.com) | Not supplied; review source |
| RabbitMQ | rabbitmq | Not supplied; review source/brand terms | [Source](https://www.rabbitmq.com) | [Guidelines](https://www.rabbitmq.com/trademark-guidelines.html) |
| Apache Kafka | apachekafka | [Apache-2.0](https://spdx.org/licenses/Apache-2.0) | [Source](https://apache.org/logos) | [Guidelines](https://www.apache.org/foundation/marks) |
| Elasticsearch | elasticsearch | Not supplied; review source/brand terms | [Source](https://www.elastic.co/brand) | Not supplied; review source |
| OpenSearch | opensearch | Not supplied; review source/brand terms | [Source](https://opensearch.org/trademark-brand-policy.html) | [Guidelines](https://opensearch.org/trademark-brand-policy.html) |
| Socket.io | socketdotio | Not supplied; review source/brand terms | [Source](https://socket.io) | Not supplied; review source |
| Git | git | [CC-BY-3.0](https://spdx.org/licenses/CC-BY-3.0) | [Source](https://git-scm.com/community/logos) | Not supplied; review source |
| GitHub | github | Not supplied; review source/brand terms | [Source](https://github.com/logos) | [Guidelines](https://github.com/logos) |
| GitHub Actions | githubactions | Not supplied; review source/brand terms | [Source](https://github.com/features/actions) | Not supplied; review source |
| GitLab | gitlab | Not supplied; review source/brand terms | [Source](https://about.gitlab.com/press/press-kit/) | [Guidelines](https://about.gitlab.com/handbook/marketing/corporate-marketing/brand-activation/trademark-guidelines/) |
| Anthropic | anthropic | Not supplied; review source/brand terms | [Source](https://www.anthropic.com) | Not supplied; review source |
| Claude | claude | Not supplied; review source/brand terms | [Source](https://claude.ai) | Not supplied; review source |
| Ollama | ollama | Not supplied; review source/brand terms | [Source](https://github.com/ollama/ollama/issues/2152#issuecomment-1905286922) | Not supplied; review source |
| Hugging Face | huggingface | Not supplied; review source/brand terms | [Source](https://huggingface.co/brand) | [Guidelines](https://huggingface.co/brand) |
| LangChain | langchain | Not supplied; review source/brand terms | [Source](https://www.langchain.com/langchain) | Not supplied; review source |
| n8n | n8n | Not supplied; review source/brand terms | [Source](https://n8n.io/press) | Not supplied; review source |
| Resend | resend | Not supplied; review source/brand terms | [Source](https://resend.com/brand) | [Guidelines](https://resend.com/brand) |
| Mailgun | mailgun | Not supplied; review source/brand terms | [Source](https://mailgun.com) | Not supplied; review source |
| Sentry | sentry | Not supplied; review source/brand terms | [Source](https://sentry.io/branding/) | Not supplied; review source |
| Datadog | datadog | Not supplied; review source/brand terms | [Source](https://www.datadoghq.com/about/resources) | [Guidelines](https://www.datadoghq.com/about/resources/) |
| Prometheus | prometheus | Not supplied; review source/brand terms | [Source](https://prometheus.io) | Not supplied; review source |
| Grafana | grafana | Not supplied; review source/brand terms | [Source](https://grafana.com) | Not supplied; review source |
