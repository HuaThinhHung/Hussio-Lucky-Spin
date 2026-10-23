import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const root=process.cwd();
const logo=(await readFile('public/brand/hussio-logo.png')).toString('base64');
const result=await build({entryPoints:['apps-script/client.tsx'],bundle:true,write:false,minify:true,
  format:'iife',target:'es2020',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
  plugins:[{name:'inline-logo',setup(b){b.onResolve({filter:/^next\/image$/},()=>({path:'image',namespace:'inline'}));
    b.onLoad({filter:/.*/,namespace:'inline'},()=>({loader:'jsx',resolveDir:root,contents:`import React from 'react';export default function Image({priority,...props}){return <img {...props} src="data:image/png;base64,${logo}" />}`}));}}]});
const compiled=await compile(await readFile('src/app/globals.css','utf8'),{base:path.join(root,'src/app'),onDependency(){}});
const scanner=new Scanner({sources:[{base:root,pattern:'src/**/*.{ts,tsx}',negated:false}]});
let css=compiled.build(scanner.scan())+'\n'+await readFile('src/app/portfolio.css','utf8');
for(const weight of [400,500,600,700,800]){
  const font=(await readFile(`public/fonts/hanken-${weight}.ttf`)).toString('base64');
  css=css.replaceAll(`/fonts/hanken-${weight}.ttf`,`data:font/ttf;base64,${font}`);
}
for(let i=0;i<3;i++) {
  const photo=(await readFile(`public/brand/moodboard/look-${i}.webp`)).toString('base64');
  css=css.replaceAll(`/brand/moodboard/look-${i}.webp`,`data:image/webp;base64,${photo}`);
}
const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const html=`<!doctype html><html lang="vi"><head><base target="_top"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HUSSIO — Black Friday</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await writeFile('apps-script/Index.html',html);
console.log(`Built apps-script/Index.html (${Math.round(Buffer.byteLength(html)/1024)} KB); no external assets or server required.`);
