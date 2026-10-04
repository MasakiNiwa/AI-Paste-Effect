#!/usr/bin/env node
/** Rebuild only manga-delicate. Existing packs are never overwritten. */
import { mkdirSync, writeFileSync } from 'node:fs';
const out = new URL('../src/assets/manga-delicate/', import.meta.url);
mkdirSync(new URL('svg/', out), { recursive: true });
const C = '__C1__', A = '__C2__';
const path = (d, w = 2.6, color = C, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const dot = (x,y,r=2,color=C) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const heart = (x,y,s) => `<g transform="translate(${x} ${y}) scale(${s})">${path('M0 10C-32 -10 -26 -35 -9 -27C-3 -25 0 -20 0 -17C4 -31 25 -33 28 -18C33 -4 12 8 0 20',2.5/s)}</g>`;
const star = (x,y,s) => `<g transform="translate(${x} ${y}) scale(${s})">${path('M0 -25Q3 -3 20 0Q3 3 0 25Q-3 3 -20 0Q-3 -3 0 -25',2.2/s)}</g>`;
const drop = (x,y,s) => `<g transform="translate(${x} ${y}) scale(${s})">${path('M0 -50C-9 -29 -27 -8 -25 13C-23 42 22 43 25 13C27 -8 9 -29 0 -50Z',2.5/s)}${path('M-14 16Q-13 27 -6 29',1.6/s,A)}</g>`;
const assets = [];
function add(id, label, size, draw, colors=['#454657','#ffffff'], tags=[]) { assets.push({id,file:id.replace('/','-')+'.svg',label,tags:[id.split('/')[0],'delicate',...tags],colors,size,license:'MIT',author:'AI Paste Effect',draw}); }
// Twelve compatible variants: same meanings, lighter linework and open silhouettes.
add('shock/lines3','細い驚き線3本。頭上の余白に小さく。強い衝撃より軽い気付き向け',.14,path('M55 141Q41 108 32 76',3)+path('M99 127Q97 85 101 52',3.5)+path('M139 140Q151 107 172 83',2.7));
add('shock/exclaim','細く揺れる「!!」。頭の横へ小さく。静かな場面では1点だけ',.12,path('M76 47Q73 77 68 116',3.2)+path('M124 39Q119 71 115 108',2.8)+dot(67,140,3)+dot(114,132,2.8));
add('shock/crack','細い折れた稲妻。頭の横の余白へ。ガーンの控えめなアクセント',.18,path('M121 24L85 84L114 78L74 171',3.1),['#767592','#ffffff']);
add('comedy/sweatBig','細線の小さな汗。頭の横の余白に。肌へ直接重ねない',.14,drop(100,104,1.1),['#66889a','#b9d9e4']);
add('comedy/sweatTrio','疎らな汗3つ。頭の斜め横へ。小さいまま使う',.16,drop(61,108,.48)+drop(112,73,.57)+drop(147,137,.35),['#66889a','#b9d9e4']);
add('comedy/angerBig','細い怒りマーク。頭の斜め上の余白に。控えめなムッとした気持ち',.13,[0,90,180,270].map(r=>`<g transform="rotate(${r} 100 100)">${path('M113 53Q114 82 145 86',3)}</g>`).join(''),['#b66068','#ffffff']);
add('comedy/questionBig','細い疑問符。頭の横に小さく。穏やかな困惑',.14,path('M69 70C68 35 130 34 130 68C132 88 101 89 98 113L97 124',3)+dot(96,148,3));
add('comedy/steam','輪郭だけの小さな湯気。頭上の余白へ。照れ・軽い怒り',.19,path('M49 111C25 108 28 75 48 78C39 57 68 47 77 67C89 46 121 53 118 77C145 59 164 83 151 101C173 116 147 136 132 125',2.4)+path('M69 147Q78 137 75 129',1.9)+path('M115 152Q107 142 113 133',1.9));
add('love/heartsTrio','輪郭だけの控えめなハート3つ。背景の余白に。顔を囲みすぎない',.21,heart(64,112,.85)+heart(128,70,.62)+heart(146,143,.4),['#b77589','#ffffff']);
add('love/heartPound','細線のハートと短い鼓動線。胸の横の余白へ。肌に重ねない',.18,heart(100,108,1.25)+path('M42 71L32 59M62 49L57 33M143 64L155 51',2.2),['#b77589','#ffffff']);
add('joy/sparkleStars','疎らで細いきらめき。光のある背景の余白に。少数で使う',.24,star(61,71,.85)+star(133,109,.58)+star(86,151,.31)+dot(156,52,1.6),['#c0a169','#ffffff']);
add('motion/whoosh','細く抜ける動きの弧。人物の横や手足の周辺の余白へ',.28,path('M29 75Q88 34 165 66',2.5)+path('M39 102Q101 73 172 89',1.8)+path('M70 131Q126 114 162 115',1.2));
// Twelve new meanings; decorative abstractions, no character or prop additions.
add('calm/sigh','ため息の柔らかな曲線。口の横の余白へ小さく。口・顔には重ねない',.17,path('M47 149C94 143 72 112 104 105C151 95 143 64 126 51',2.4)+path('M60 161Q91 157 99 143',1.3,A),['#85919c','#bbc5cc']);
add('calm/hesitationDots','段違いの小さな点3つ。頭の横の余白へ。ためらい・言葉が出ない場面',.11,dot(53,108,3)+dot(98,96,2.8)+dot(144,111,2.3));
add('calm/brokenHalo','途切れた柔らかな輪。顔の周囲の背景へ。輪の中心は空け、顔保護を維持',.45,path('M42 77C54 26 142 26 165 74',1.9)+path('M173 102Q174 129 151 150',1.5)+path('M121 167Q69 181 39 136',2.1),['#b5a0ae','#ffffff']);
add('calm/fallingLines','力なく下がる短い線3本。頭の横へ小さく。しょんぼり・落胆',.16,path('M62 58Q51 91 57 128',2.3)+path('M102 69Q91 114 99 149',2)+path('M139 89Q132 119 141 137',1.5),['#7d8199','#ffffff']);
add('motion/tremblePair','震えを示す左右の波線。人物や手の周辺へ。線を肌に重ねない',.3,path('M38 63Q24 74 37 86T35 111T34 139',2.3)+path('M164 61Q177 74 165 88T165 114T166 143',2.1));
add('motion/breezeArc','穏やかな風の流れ。空や水面の余白に横向きで。人物の輪郭には重ねない',.45,path('M22 109C53 89 83 124 113 100S159 86 180 98',1.7)+path('M43 132Q82 142 111 121',1.1,A),['#98b8c8','#d9e7ed']);
add('texture/dryBrush','乾いた筆の細いかすれ。背景の余白に薄く、multiply推奨。顔と肌は保護',.5,Array.from({length:13},(_,i)=>path(`M${28+(i%3)*9} ${67+i*5}Q100 ${53+i*6} ${161-(i%4)*7} ${76+i*4}`,i%3===0?2.2:.9,C,`opacity="${.18+(i%4)*.1}"`)).join(''),['#8797a6','#ffffff']);
add('texture/whiteScuff','白い細かなかすれ。暗い背景や画面端へ低いopacityで。顔と肌は保護',.45,Array.from({length:17},(_,i)=>path(`M${27+(i*17)%73} ${43+i*7}l${29+(i*13)%65} ${-5+(i%5)*2}`,i%4===0?2:1,C,`opacity="${.25+(i%3)*.15}"`)).join(''),['#ffffff','#ffffff']);
add('texture/inkFlecks','大小の疎らなインク飛沫。画面端や余白へ低いopacityで。顔と肌は保護',.33,[[43,109,3],[76,60,1.4],[112,117,4.3],[142,86,2],[69,145,2.3],[153,147,1.3],[126,41,1],[36,59,1.5],[94,89,1]].map(v=>dot(...v)).join(''),['#69788b','#ffffff']);
add('texture/sparseDots','疎らな点描。背景の局所的な質感用。低いopacity、顔・髪・肌は保護',.5,Array.from({length:34},(_,i)=>dot(23+(i*47)%154,27+(i*61)%146,.65+(i%4)*.35)).join(''),['#8190a5','#ffffff']);
add('frame/petalCorner','抽象的な花びらの縁飾り。画面の角に。顔を囲まず、静かな恋・余韻に',.4,path('M31 161Q37 107 85 69M43 128Q20 100 31 75Q64 88 43 128ZM65 91Q59 58 84 42Q104 69 65 91ZM88 66Q104 36 142 42Q137 74 88 66Z',1.7)+path('M50 152Q74 115 116 104M77 122Q97 136 120 122',1.2,A),['#bb91a3','#d8bdc9']);
add('light/glimmerTrail','細いきらめきの軌跡。光源側の背景の余白へ。screen推奨、顔には重ねない',.4,star(55,140,.33)+star(104,94,.55)+star(148,51,.26)+dot(79,117,1.4)+dot(128,72,1.1),['#fff0ce','#ffffff']);
for (const a of assets) {
  writeFileSync(new URL('svg/'+a.file,out),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n<!-- Original vector artwork; MIT; rebuild: node scripts/gen-delicate-assets.mjs -->\n${a.draw}\n</svg>\n`);
}
writeFileSync(new URL('manifest.json',out),JSON.stringify({assets:assets.map(({draw,...meta})=>meta)},null,2)+'\n');
writeFileSync(new URL('pack.json',out),JSON.stringify({name:'繊細な手描き・余韻セット',author:'AI Paste Effect',license:'MIT'},null,2)+'\n');
console.log(`manga-delicate: ${assets.length} assets (12 variants + 12 new meanings)`);
