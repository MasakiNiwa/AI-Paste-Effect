#!/usr/bin/env node
/** node scripts/gen-asset-preview.mjs atmosphere: regenerate a review sheet. */
import {readFileSync,writeFileSync} from 'node:fs';
const pack=process.argv[2]??'atmosphere';
if(!/^[a-z0-9-]+$/.test(pack))throw Error('Invalid pack name');
const root=new URL(`../src/assets/${pack}/`,import.meta.url);
const {assets}=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
const cols=6,rows=Math.ceil(assets.length/cols);let body='';
assets.forEach((a,i)=>{
 const svg=readFileSync(new URL('svg/'+a.file,root),'utf8').replaceAll('__C1__',a.colors[0]).replaceAll('__C2__',a.colors[1]);
 const box=/viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number);const w=box[2],h=box[3];
 const dark=a.id.startsWith('light/')||a.id.includes('white');
 const content=svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'));
 // Namespace IDs so gradients from one tile never leak into another tile.
 const unique=content.replace(/id="([^"]+)"/g,`id="tile${i}-$1"`).replace(/url\(#([^)]+)\)/g,`url(#tile${i}-$1)`);
 body+=`<g transform="translate(${i%cols*220} ${Math.floor(i/cols)*240})"><rect width="210" height="210" fill="${dark?'#344458':'#f3f1ec'}"/><svg x="5" y="5" width="200" height="200" viewBox="0 0 ${w} ${h}">${unique}</svg><text x="6" y="228" font-family="sans-serif" font-size="12" fill="#222">${a.id}</text></g>`;
});
writeFileSync(new URL(`../docs/${pack}-assets-preview.svg`,import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="${rows*240}" viewBox="0 0 1320 ${rows*240}"><rect width="1320" height="${rows*240}" fill="white"/>${body}</svg>\n`);
