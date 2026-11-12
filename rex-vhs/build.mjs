// Empaqueta src/ + three.js en un único index.html autocontenido
// (se abre con doble clic, sin servidor). Uso: npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const res = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync('src/template.html', 'utf8');
const [, head, body] = tpl.split(/<!--HEAD-->|<!--BODY-->/);
const bodyOut = body.replace('/*BUNDLE*/', () => js);

writeFileSync('index.html', `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>body{margin:0}[hidden]{display:none!important}</style>
${head.trim()}
</head>
<body>
${bodyOut.trim()}
</body>
</html>
`);
// Variante sin <html>/<head>/<body> (para publicar como página embebida).
const frag = process.argv.find((a) => a.startsWith('--fragment='));
if (frag) writeFileSync(frag.split('=')[1], head.trim() + '\n' + bodyOut.trim() + '\n');
console.log(`index.html: ${(js.length / 1024).toFixed(0)} KB de JS`);
