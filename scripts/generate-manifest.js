/**
 * generate-manifest.js — Anchored Codebase Manifest Generator
 *
 * Scans the repository and produces:
 *   architecture/manifest.json  (machine-readable)
 *   architecture/MANIFEST.md    (human-readable)
 *
 * Run: node scripts/generate-manifest.js
 * Auto-run: via .git/hooks/post-commit
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARCH = path.join(ROOT, "architecture");
const OUT_JSON = path.join(ARCH, "manifest.json");
const OUT_MD = path.join(ARCH, "MANIFEST.md");

/* ──────────────────────── helpers ──────────────────────── */

function read(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function find(pattern) {
  const { execSync } = require("child_process");
  try {
    const out = execSync(`dir /s /b "${pattern}" 2>nul`, { cwd: ROOT, encoding: "utf-8" });
    return out.split("\r\n").filter(Boolean).map((f) => path.relative(ROOT, f.trim()));
  } catch {
    return [];
  }
}

function globDir(relDir) {
  const abs = path.join(ROOT, relDir);
  try {
    return fs.readdirSync(abs, { withFileTypes: true }).map((d) => d.name);
  } catch {
    return [];
  }
}

/* ──────────────────────── scanners ──────────────────────── */

function scanTools() {
  const toolsContent = read("lib/tools.ts");
  if (!toolsContent) return { categories: [], tools: [], tsInterfaces: {} };

  const lines = toolsContent.split("\n");
  const categories = [];
  const tools = [];

  // ── Parse categories ─────────────────────────────────
  // Block: export const toolCategories ... = { ... };
  let catStart = -1, catEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (catStart < 0 && lines[i].includes("Record<CategoryId, ToolCategory>")) { catStart = i; break; }
  }
  if (catStart >= 0) {
    for (let i = catStart + 1; i < lines.length; i++) {
      if (lines[i].trim() === "};") { catEnd = i; break; }
    }
    const catBlock = lines.slice(catStart + 1, catEnd).join("\n");
    // Each entry: `"key": { ... },`
    const entryRegex = /"([^"]+)":\s*\{([\s\S]*?)},/g;
    let m;
    while ((m = entryRegex.exec(catBlock)) !== null) {
      const body = m[2];
      const labelM = body.match(/label:\s*"([^"]+)"/);
      const colorM = body.match(/color:\s*"([^"]+)"/);
      const routeM = body.match(/route:\s*"([^"]+)"/);
      categories.push({
        id: m[1],
        label: labelM ? labelM[1] : "",
        color: colorM ? colorM[1] : "",
        route: routeM ? routeM[1] : "",
      });
    }
  }

  // ── Parse tools ──────────────────────────────────────
  // Block: export const tools: Tool[] = [ ... ];
  let toolStart = -1, toolEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (toolStart < 0 && lines[i].trim().startsWith("export const tools:")) { toolStart = i; break; }
  }
  if (toolStart >= 0) {
    for (let i = toolStart + 1; i < lines.length; i++) {
      if (lines[i].trim() === "];") { toolEnd = i; break; }
    }
    const toolBlock = lines.slice(toolStart + 1, toolEnd).join("\n");
    // Each entry: `{ ... },`
    const entryRegex = /\{([\s\S]*?)},/g;
    let m;
    while ((m = entryRegex.exec(toolBlock)) !== null) {
      const body = m[1];
      const nameM = body.match(/name:\s*"([^"]+)"/);
      const slugM = body.match(/slug:\s*"([^"]+)"/);
      const catM = body.match(/categoryId:\s*"([^"]+)"/);
      const descM = body.match(/description:\s*"([^"]+)"/);
      const extM = body.match(/isExternal:\s*true/);
      if (nameM && slugM) {
        tools.push({
          name: nameM[1],
          slug: slugM[1],
          categoryId: catM ? catM[1] : "",
          description: descM ? descM[1] : "",
          isExternal: !!extM,
        });
      }
    }
  }

  // Extract interfaces
  const ifaces = {};
  const ifaceRegex = /export (?:interface|type) (\w+)([\s\S]*?)(?=\nexport |\n\n)/g;
  let m2;
  while ((m2 = ifaceRegex.exec(toolsContent)) !== null) {
    ifaces[m2[1]] = m2[2].trim();
  }

  return { categories, tools, tsInterfaces: ifaces };
}

function scanComponents() {
  const tree = {};
  const dirs = ["components/tools", "components/ui", "components/layout", "components/workspace", "components/a11y", "components/home"];
  for (const d of dirs) {
    const files = globDir(d).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
    tree[d] = files;
  }
  return tree;
}

function scanCSS() {
  const css = read("app/globals.css");
  if (!css) return {};

  const tokens = {};
  // :root and .dark variables
  const varRegex = /--([\w-]+):\s*([^;]+);/g;
  let v;
  while ((v = varRegex.exec(css)) !== null) {
    tokens[v[1]] = v[2].trim();
  }

  // clamp() values
  const clamps = [];
  const clampRegex = /clamp\(([^)]+)\)/g;
  let c;
  while ((c = clampRegex.exec(css)) !== null) {
    clamps.push(c[1]);
  }

  // @layer component classes
  const layers = [];
  const layerRegex = /\.toolsy-[\w-]+/g;
  let l;
  const layerSet = new Set();
  while ((l = layerRegex.exec(css)) !== null) {
    layerSet.add(l[0]);
  }

  return {
    tokens: Object.keys(tokens).length,
    tokenList: tokens,
    clampExpressions: clamps,
    utilityClasses: [...layerSet].sort(),
    keyframes: (css.match(/@keyframes\s+\w+/g) || []).map((k) => k.replace("@keyframes ", "")),
    hasWorkspaceSystem: css.includes(".workspace-shell"),
    hasGlassSystem: css.includes(".toolsy-glass"),
    hasBackdropFallback: css.includes("@supports not (backdrop-filter"),
    prefersReducedMotion: css.includes("prefers-reduced-motion: reduce"),
    responsiveBreakpoints: css.match(/@media\s*\([^)]+\)/g) || [],
  };
}

function scanHooks() {
  return globDir("hooks").filter((f) => f.endsWith(".ts"));
}

function scanLib() {
  return globDir("lib").filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
}

function scanToolPages() {
  const pages = find("app/tools/**/page.tsx").map((p) => ({
    route: "/" + p.replace(/\\/g, "/").replace(/\.tsx?$/, "").replace(/\/page$/, "").replace(/\[category\]/g, ":category").replace(/\[slug\]/g, ":slug"),
    file: p,
  }));
  const clientPages = find("app/tools/**/client-page.tsx").map((p) => ({
    file: p,
  }));
  return { pages, clientPages };
}

function scanConfig() {
  const pkg = JSON.parse(read("package.json") || "{}");
  const tc = read("tailwind.config.ts");
  const safelist = tc ? (tc.match(/(?<=safelist:\s*\[)[\s\S]*?(?=\])/) || [])[0] : "";
  return {
    scripts: pkg.scripts || {},
    dependencies: Object.keys(pkg.dependencies || {}),
    devDependencies: Object.keys(pkg.devDependencies || {}),
    tailwindSafelist: safelist ? safelist.replace(/\s+/g, " ").trim() : "",
    nextConfig: {
      distDir: ".next-build",
      eslint: { ignoreDuringBuilds: false },
    },
  };
}

/* ──────────────────────── build ──────────────────────── */

const tools = scanTools();
const components = scanComponents();
const css = scanCSS();
const hooks = scanHooks();
const lib = scanLib();
const toolPages = scanToolPages();
const config = scanConfig();

const manifest = {
  generatedAt: new Date().toISOString(),
  version: "1.0.0",
  projectName: "Toolsy (Mi)",
  platform: {
    framework: "Next.js 14.2.35",
    react: "React 18",
    typescript: "TypeScript 5",
    tailwind: "Tailwind CSS 3.4",
    animation: "Framer Motion 12",
    icons: "Lucide React",
    testing: "Vitest 4 + jsdom",
    build: "typecheck → lint → next build (dist: .next-build)",
  },
  architecture: {
    toolsCategories: tools.categories,
    toolsCount: tools.tools.length,
    tools: tools.tools,
    tsInterfaces: tools.tsInterfaces,
    componentTree: components,
    hooks: hooks,
    libModules: lib,
    routes: toolPages.pages,
    clientPages: toolPages.clientPages,
  },
  designSystem: {
    cssVariableTokens: css.tokens,
    clampExpressions: css.clampExpressions,
    utilityClasses: css.utilityClasses,
    keyframes: css.keyframes,
    responsiveBreakpoints: css.responsiveBreakpoints,
    hasWorkspaceSystem: css.hasWorkspaceSystem,
    hasGlassSystem: css.hasGlassSystem,
    hasBackdropFallback: css.hasBackdropFallback,
    prefersReducedMotion: css.prefersReducedMotion,
  },
  config: config,
};

/* ──────────────────────── write JSON ──────────────────────── */

fs.mkdirSync(ARCH, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2), "utf-8");
console.log(`✓ Written ${OUT_JSON}`);

/* ──────────────────────── write Markdown ──────────────────────── */

const md = [
  "# Manifest — Toolsy (Mi)\n",
  `_Generated: ${new Date().toISOString()}_\n`,
  "---\n",
  "## Platform\n",
  `| Property | Value |`,
  `|---|---|`,
  ...Object.entries(manifest.platform).map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "---\n",
  "## Tool Categories\n",
  `| ID | Label | Color | Route |`,
  `|---|---|---|---|`,
  ...manifest.architecture.toolsCategories.map((c) => `| ${c.id} | ${c.label} | ${c.color} | \`${c.route}\` |`),
  "",
  `**Total Tools: ${manifest.architecture.toolsCount}**\n`,
  "",
  "### Tools by Category\n",
  ...(() => {
    const lines = [];
    for (const cat of manifest.architecture.toolsCategories) {
      const catTools = manifest.architecture.tools.filter((t) => t.categoryId === cat.id);
      if (catTools.length === 0) continue;
      lines.push(`#### ${cat.label} (${catTools.length})`);
      lines.push(`| Name | Slug | Description |`);
      lines.push(`|---|---|---|`);
      for (const t of catTools) {
        lines.push(`| ${t.isExternal ? "🔗 " : ""}${t.name} | \`${t.slug}\` | ${t.description} |`);
      }
      lines.push("");
    }
    return lines;
  })(),
  "---\n",
  "## Design System\n",
  `CSS Variable Tokens: **${css.tokens}**  \n`,
  `clamp() Expressions: **${css.clampExpressions.length}**  \n`,
  `Utility Classes: ${css.utilityClasses.length}  \n`,
  `Keyframes: ${css.keyframes.join(", ")}\n`,
  "",
  "### Spacing Scale (clamp)\n",
  "| Token | Value |",
  "|---|---|",
  ...(() => {
    const spacingTokens = ["space-page-x", "space-page-y", "space-section", "space-card", "radius-card", "home-footer-block"];
    return spacingTokens
      .filter((t) => css.tokenList[t])
      .map((t) => `| \`--${t}\` | ${css.tokenList[t]} |`);
  })(),
  "",
  "### Component Tokens\n",
  "| Token | Value (Dark) |",
  "|---|---|",
  ...(() => {
    const compTokens = ["card-bg", "card-shadow", "card-hover-bg", "card-hover-shadow", "input-bg", "input-focus-bg", "glass-bg", "glass-border", "glass-blur"];
    return compTokens
      .filter((t) => css.tokenList[t])
      .map((t) => `| \`--${t}\` | \`${css.tokenList[t]}\` |`);
  })(),
  "",
  "---\n",
  "## Component Tree\n",
  ...Object.entries(manifest.architecture.componentTree).flatMap(([dir, files]) => [
    `### \`${dir}/\``,
    ...files.map((f) => `- \`${f}\``),
    "",
  ]),
  "---\n",
  "## Hooks\n",
  ...manifest.architecture.hooks.map((h) => `- \`hooks/${h}\``),
  "",
  "---\n",
  "## Library Modules\n",
  ...manifest.architecture.libModules.map((l) => `- \`lib/${l}\``),
  "",
  "---\n",
  "## Routes\n",
  ...manifest.architecture.routes.map((r) => `- \`${r.route}\` ← ${r.file}`),
  "",
  "---\n",
  "## Config\n",
  `- Build: \`${config.scripts.build || "N/A"}\``,
  `- Lint: \`${config.scripts.lint || "N/A"}\``,
  `- Test: \`${config.scripts.test || "N/A"}\``,
  `- Dependencies: ${config.dependencies.length}`,
  `- Dev Dependencies: ${config.devDependencies.length}`,
  "",
  "---\n",
  "*This manifest is auto-generated by \`scripts/generate-manifest.js\`.*\n",
  "*To regenerate: \`node scripts/generate-manifest.js\`*\n",
].join("\n");

fs.writeFileSync(OUT_MD, md, "utf-8");
console.log(`✓ Written ${OUT_MD}`);
