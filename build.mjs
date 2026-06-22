#!/usr/bin/env node
// =============================================================================
//  build.mjs — gera o dist/ a partir dos fontes.
//
//  Para cada userscript em scripts/*.user.js (+ o xenforo, montado do seu
//  parts/), faz duas coisas:
//    1) dist/NOME.user.js  → cópia do fonte com @updateURL/@downloadURL
//       injetados (auto-update por script, instalável avulso).
//    2) dist/pack.user.js  → TODOS num arquivo só. Cada script vira um módulo
//       isolado num IIFE, guardado por hostname (e por top-frame se o original
//       tinha @noframes). Um clique nesse arquivo instala tudo de uma vez.
//
//  >>> Quando souber o usuário do GitHub, troque GH.user abaixo e rode de novo:
//        node build.mjs
//
//  Uso:  node build.mjs
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- CONFIG ---------------------------------------------------------------
const GH = {
  user: "claudiogepeto",   // handle da conta
  repo: "userscripts",
  branch: "main",
};
// versão do pack — INDEPENDENTE dos scripts. Suba este número a cada release
// pro Violentmonkey detectar atualização do "Instalar tudo".
const PACK_VERSION = "1.0.0";
const RAW = `https://raw.githubusercontent.com/${GH.user}/${GH.repo}/${GH.branch}/dist`;

// ordem dos módulos no pack (cosmética; cada um é isolado de qualquer forma)
const STANDALONE = [
  "filester", "gofile", "turbo", "bunkr", "pixeldrain",
  "twitter", "instagram", "reddit", "rule34", "ehentai",
];

// ---- helpers --------------------------------------------------------------
const HEADER_RE = /\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/;

function parse(src) {
  const m = src.match(HEADER_RE);
  if (!m) throw new Error("sem bloco ==UserScript==");
  const header = m[0];
  const body = src.slice(m.index + header.length).replace(/^\s*\n/, "");
  const meta = {}; // key -> array of values
  for (const line of header.split("\n")) {
    const mm = line.match(/^\/\/\s*@(\S+)(?:\s+(.*?))?\s*$/);
    if (!mm) continue;
    (meta[mm[1]] ||= []).push(mm[2] ?? "");   // diretivas sem valor (@noframes) → ""
  }
  return { header, body, meta };
}

const first = (meta, k, def = "") => (meta[k]?.[0] ?? def);

// extrai os hostnames "base" de @match (sem scheme, sem path, sem '*.')
function hostsFrom(meta) {
  const out = new Set();
  for (const pat of meta.match || []) {
    const mm = pat.match(/^(?:\*|https?):\/\/([^/]+)\//);
    if (!mm) continue;
    out.add(mm[1].replace(/^\*\./, ""));
  }
  return [...out];
}

// injeta @updateURL/@downloadURL logo após a linha @version
function withUpdate(header, fileName) {
  const url = `${RAW}/${fileName}`;
  const lines = header.split("\n").filter(l => !/@(updateURL|downloadURL)\b/.test(l));
  const out = [];
  for (const l of lines) {
    out.push(l);
    if (/^\/\/\s*@version\b/.test(l)) {
      out.push(`// @updateURL    ${url}`);
      out.push(`// @downloadURL  ${url}`);
    }
  }
  return out.join("\n");
}

// ---- carrega os fontes ----------------------------------------------------
// 1) monta o xenforo a partir do parts/ (mantém seu build próprio)
try {
  execFileSync("node", [path.join(__dirname, "xenforo", "build.js")], { stdio: "inherit" });
} catch { console.warn("! xenforo/build.js falhou ou ausente — usando script.js existente"); }

const entries = [];
for (const name of STANDALONE) {
  const p = path.join(__dirname, "scripts", `${name}.user.js`);
  entries.push({ name, src: fs.readFileSync(p, "utf8") });
}
entries.push({ name: "xenforo", src: fs.readFileSync(path.join(__dirname, "xenforo", "script.js"), "utf8") });

// ---- 1) dist/NOME.user.js (com auto-update) -------------------------------
const distDir = path.join(__dirname, "dist");
fs.mkdirSync(distDir, { recursive: true });

const parsed = [];
for (const e of entries) {
  const pp = parse(e.src);
  parsed.push({ ...e, ...pp });
  const file = `${e.name}.user.js`;
  fs.writeFileSync(path.join(distDir, file), withUpdate(pp.header, file) + "\n" + pp.body);
}

// ---- 2) dist/pack.user.js (tudo num arquivo) ------------------------------
const union = (k) => {
  const s = new Set();
  for (const p of parsed) for (const v of (p.meta[k] || [])) s.add(v);
  return [...s];
};

const packVersion = PACK_VERSION;
const allMatch = union("match");
const allGrant = union("grant");
const allConnect = union("connect");
const allRequire = union("require");

const packUrl = `${RAW}/pack.user.js`;
const headerLines = [
  "// ==UserScript==",
  "// @name         Userscripts — pack (todos num arquivo só)",
  "// @namespace    claudiogepeto-userscripts",
  `// @version      ${packVersion}`,
  "// @description  Instala todos os userscripts de uma vez. Cada site roda seu módulo (isolado, guardado por hostname). Edite/atualize os fontes em scripts/ e rode build.mjs.",
  "// @author       claudiogepeto",
  `// @updateURL    ${packUrl}`,
  `// @downloadURL  ${packUrl}`,
  ...allMatch.map(m => `// @match        ${m}`),
  ...allConnect.map(c => `// @connect      ${c}`),
  ...allRequire.map(r => `// @require      ${r}`),
  ...allGrant.map(g => `// @grant        ${g}`),
  "// @run-at       document-start",
  "// ==/UserScript==",
].join("\n");

const modules = parsed.map(p => {
  const hosts = hostsFrom(p.meta);
  const noframes = "noframes" in p.meta;
  const guard = [`hostIn(${JSON.stringify(hosts)})`, noframes ? "window.top === window.self" : null]
    .filter(Boolean).join(" && ");
  const ver = first(p.meta, "version");
  return `
/* ===================== ${p.name} (v${ver}) ===================== */
;(function () {
  if (!(${guard})) return;
  try {
${p.body.split("\n").map(l => "    " + l).join("\n")}
  } catch (e) { console.error("[pack:${p.name}]", e); }
})();`;
}).join("\n");

const pack = `${headerLines}

/* ==========================================================================
 * GERADO por build.mjs — NÃO edite à mão. Edite scripts/ ou xenforo/parts/.
 * Cada módulo abaixo é um IIFE isolado, guardado por hostname.
 * ========================================================================== */
(function () {
  "use strict";
  var host = location.hostname;
  function hostIn(list) {
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (host === h || host.endsWith("." + h)) return true;
    }
    return false;
  }
${modules}
})();
`;

fs.writeFileSync(path.join(distDir, "pack.user.js"), pack);

// ---- terceiros: third-party/*.user.js (bundle no zip + tabela no README) ---
// São scripts de OUTROS autores que eu recomendo. Vão no zip pra "instalar tudo"
// trazer eles também; cada um mantém seu @updateURL → continua atualizando pelo
// autor (Greasy/Sleazy Fork etc.). Pra remover um: apague o arquivo aqui.
const tpDir = path.join(__dirname, "third-party");
const thirdParty = (fs.existsSync(tpDir) ? fs.readdirSync(tpDir) : [])
  .filter(f => f.endsWith(".user.js")).sort()
  .map(f => {
    const src = fs.readFileSync(path.join(tpDir, f), "utf8");
    const { meta } = parse(src);
    return {
      base: f.replace(/\.user\.js$/, ""), src,
      name: first(meta, "name") || f.replace(/\.user\.js$/, ""),
      desc: first(meta, "description"),
      url: first(meta, "downloadURL") || first(meta, "updateURL") || "",
    };
  });

// ---- 2b) dist/userscripts.zip (backup importável → instala TODOS separados)
// Formato de backup compartilhado por Violentmonkey/Tampermonkey: por script, o
// trio nome.user.js + nome.options.json + nome.storage.json (flat no zip).
// Importar pelo painel instala cada um como entrada SEPARADA (auto-update próprio).
const stage = path.join(distDir, ".bundle");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
const stageScript = (base, body) => {
  fs.writeFileSync(path.join(stage, `${base}.user.js`), body);
  fs.writeFileSync(path.join(stage, `${base}.options.json`), "{}");
  fs.writeFileSync(path.join(stage, `${base}.storage.json`), "{}");
};
for (const p of parsed) stageScript(p.name, fs.readFileSync(path.join(distDir, `${p.name}.user.js`), "utf8"));
for (const tp of thirdParty) stageScript(tp.base, tp.src);   // recomendados (mantêm o @updateURL do autor)
const zipPath = path.join(distDir, "userscripts.zip");
fs.rmSync(zipPath, { force: true });
execFileSync("zip", ["-j", "-q", zipPath, ...fs.readdirSync(stage).map(f => path.join(stage, f))]);
fs.rmSync(stage, { recursive: true, force: true });

// ---- 3) página de instalação (README.md) ----------------------------------
const ZIP_URL = `https://github.com/${GH.user}/${GH.repo}/releases/latest/download/userscripts.zip`;
// dados de cada script p/ as tabelas
const cards = parsed
  .filter(p => p.name !== "xenforo")
  .map(p => ({ id: p.name, title: first(p.meta, "name"), desc: first(p.meta, "description") }));
const xen = parsed.find(p => p.name === "xenforo");
if (xen) cards.push({ id: "xenforo", title: first(xen.meta, "name"), desc: first(xen.meta, "description") });

const trunc = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

// --- README.md ---
const mineRows = cards.map(c => `| **${c.id}** | ${trunc(c.title, 70).replace(/\|/g, "\\|")} | [Instalar](${RAW}/${c.id}.user.js) |`).join("\n");
const thirdRows = thirdParty.map(s => `| ${String(s.name).replace(/\|/g, "\\|")} | ${trunc(s.desc, 70).replace(/\|/g, "\\|")} | [Instalar](${s.url}) |`).join("\n");
const readme = `# Userscripts

Tema escuro, players grandes e galerias pra vários sites (Bunkr, Pixeldrain, Filester, GoFile, Turbo, X/Twitter, Instagram, Reddit, Rule34, E-Hentai, fóruns XenForo).

## Instalar

Primeiro instale o **[Violentmonkey](https://violentmonkey.github.io/)** (ou Tampermonkey).

### Opção 1 — todos de uma vez, como scripts separados (recomendado)

Baixe **[userscripts.zip](${ZIP_URL})** e importe no painel. Instala **tudo** — os meus + os recomendados de terceiros — cada um como entrada **separada** (liga/desliga/atualiza sozinho; os de terceiros atualizam pelo autor):

- **Violentmonkey:** ⚙ Settings → *Import from file* → escolha o \`.zip\`.
- **Tampermonkey:** *Utilities* → *Import from URL* → cole \`${ZIP_URL}\` (ou *Import from file*).

### Opção 2 — só os meus, num arquivo só (1 clique)

**[⬇ Instalar pack](${RAW}/pack.user.js)** — um único userscript com os meus módulos dentro. Prático, mas monolítico (1 entrada só) e **não inclui os recomendados**.

### Avulsos

Quer só alguns? Tabela abaixo, um por um.

## Meus scripts (avulsos)

| Script | O que faz | |
|---|---|---|
${mineRows}
${thirdParty.length ? `
## Também recomendo (de terceiros)

Já vêm no \`userscripts.zip\` acima. Pra instalar avulso, o link vai pro original — atualizam pelo autor.

| Script | O que faz | |
|---|---|---|
${thirdRows}
` : ""}
## Desenvolvimento

- Fontes: \`scripts/*.user.js\` e \`xenforo/parts/\` (build próprio do xenforo). **Edite só os fontes** — \`dist/\` e este README são gerados.
- **CI:** ao dar push num fonte, a Action \`.github/workflows/build.yml\` roda \`node build.mjs\`, commita \`dist/\` + README e publica o \`userscripts.zip\` no release \`pack\`. Não precisa buildar na mão.
- \`node build.mjs\` (local) regenera \`dist/\` (avulsos + \`pack.user.js\` + \`userscripts.zip\`) e o README.
- Auto-update: cada \`dist/*.user.js\` aponta o \`@updateURL\` pra si mesmo; suba o \`@version\` no fonte e dê push.
- Trocar a conta/repo do GitHub: edite \`GH\` no topo do \`build.mjs\`.
`;
fs.writeFileSync(path.join(__dirname, "README.md"), readme);

// ---- resumo ---------------------------------------------------------------
console.log("\nOK — dist/ gerado:");
for (const p of parsed) console.log(`  ${p.name}.user.js`);
console.log(`  pack.user.js  (${allMatch.length} @match, ${allGrant.length} @grant, ${allRequire.length} @require)`);
if (GH.user === "SEU_USUARIO") console.log("\n!! Lembrete: troque GH.user no build.mjs pelo handle real e rode de novo.");
