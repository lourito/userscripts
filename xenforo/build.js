#!/usr/bin/env node
/* eslint-disable */
// =============================================================================
//  build.js — monta o userscript ÚNICO (pro Tampermonkey) a partir de parts/.
//
//  Concatena parts/NN-*.js em ORDEM (prefixo numérico) com '\n' entre eles e
//  escreve o monólito em ./script.js (aqui na pasta xenforo). É só concatenação:
//  o que está nos parts É o que sai — mesma ordem, mesmo escopo do IIFE.
//
//  Por que '\n' entre parts reconstrói o original: cada part = um slice contíguo
//  de linhas salvo como linhas.join('\n') (sem '\n' no fim). Juntar os parts com
//  '\n' reinsere exatamente a quebra que existia na fronteira → idêntico.
//
//  Uso:  node userscripts/xenforo/build.js
//  Depois: cole o userscripts/xenforo/script.js gerado no Tampermonkey.
// =============================================================================
const fs = require('fs');
const path = require('path');

const PARTS = path.join(__dirname, 'parts');
const OUT = path.join(__dirname, 'script.js');   // saída DENTRO da pasta xenforo (não na raiz)

const files = fs.readdirSync(PARTS)
    .filter(f => /^\d+-.*\.js$/.test(f))
    .sort();   // prefixo 2 dígitos (01..22) → ordem lexical == numérica

if (!files.length) { console.error('ERRO: nenhum part em ' + PARTS + ' (rodou o build-once.js?)'); process.exit(1); }

const out = files.map(f => fs.readFileSync(path.join(PARTS, f), 'utf8')).join('\n');
fs.writeFileSync(OUT, out);

// sanidade rápida: contagem de chaves do template CSS (o gotcha clássico do backtick)
// Suporta tanto o formato monolítico (style.textContent = `...`) quanto o formato
// modular (const CSS_* = `...` em 05-styles.js).
{
    let css = '';
    const monoIdx = out.indexOf('style.textContent = `');
    if (monoIdx !== -1) {
        // formato original: um único template literal atribuído diretamente
        const open = out.indexOf('`', monoIdx), close = out.indexOf('`', open + 1);
        css = out.slice(open + 1, close);
    } else {
        // formato modular: coleta o conteúdo de todos os `const CSS_…` do 05-styles.js
        const stylesPath = path.join(PARTS, '05-styles.js');
        if (fs.existsSync(stylesPath)) {
            const stylesSrc = fs.readFileSync(stylesPath, 'utf8');
            let i = 0, inT = false;
            for (; i < stylesSrc.length; i++) {
                if (stylesSrc[i] === '`') { inT = !inT; continue; }
                if (inT) css += stylesSrc[i];
            }
        }
    }
    if (css) {
        const o = (css.match(/{/g) || []).length, c = (css.match(/}/g) || []).length;
        console.log('CSS chaves: { ' + o + ' / } ' + c + (o === c ? '  OK' : '  ⚠️ DESBALANCEADO'));
    }
}
console.log('build OK — ' + files.length + ' parts → ' + path.relative(process.cwd(), OUT) + ' (' + out.split('\n').length + ' linhas)');
console.log('parts: ' + files.join('  '));
console.log('Valide:  node --check ' + path.relative(process.cwd(), OUT) + '   ·   depois cole esse arquivo no Tampermonkey.');
