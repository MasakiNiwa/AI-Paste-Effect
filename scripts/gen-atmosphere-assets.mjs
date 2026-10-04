#!/usr/bin/env node
/** Original, deterministic SVG overlays. Rebuild only atmosphere pack. */
import {mkdirSync,writeFileSync} from 'node:fs';
const out=new URL('../src/assets/atmosphere/',import.meta.url);mkdirSync(new URL('svg/',out),{recursive:true});
const C='__C1__',A='__C2__';
const p=(d,w=2,color=C,opacity=1)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle=(x,y,r,o=1,color=C)=>`<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}" fill="${color}"/>`;
const wash=(x,y,rx,ry,o=.5)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#wash)" opacity="${o}"/>`;
const gradients=`<defs><radialGradient id="wash"><stop stop-color="${C}" stop-opacity=".65"/><stop offset=".65" stop-color="${A}" stop-opacity=".2"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></radialGradient><linearGradient id="fade" x1="0%" y1="0%" x2="0%" y2="100%"><stop stop-color="${C}" stop-opacity="0"/><stop offset=".3" stop-color="${C}" stop-opacity=".8"/><stop offset="1" stop-color="${C}" stop-opacity="0"/></linearGradient></defs>`;
const a=[];
function add(id,label,size,body,w=200,h=200,colors=['#8d9bb4','#d4e1ed']){a.push({id,file:id.replace('/','-')+'.svg',label,size,colors,w,h,body,tags:[id.split('/')[0],'atmosphere'],license:'MIT',author:'AI Paste Effect'});}
const streak=(n,w=320,h=120,tilt=0)=>Array.from({length:n},(_,i)=>p(`M${16+(i*23)%72} ${18+i*(h-30)/n}Q${w*.5} ${8+i*(h-20)/n+tilt} ${w-18-(i*19)%63} ${21+i*(h-30)/n}`,i%4===0?2.4:.8,C,.2+(i%5)*.12)).join('');
// Background line treatments: not facial expression edits.
add('manga/softFocus','柔らかな疎らな集中線。中心を顔・上半身の外側に置き、人物を保護',.85,Array.from({length:36},(_,i)=>{const t=i*Math.PI/18,r=65+(i%5)*4;return p(`M${100+Math.cos(t)*r} ${100+Math.sin(t)*r}L${100+Math.cos(t)*98} ${100+Math.sin(t)*98}`,i%3?1:2,C,.35+(i%3)*.15)}).join(''));
add('manga/topGloom','上端と下端が消える縦線。背景の上側へ。multiply、顔・肌は保護',.7,Array.from({length:32},(_,i)=>`<path d="M${8+i*7.2} 8Q${8+i*7.2+2} 84 ${8+i*7.2} ${105+(i*13)%88}" stroke="url(#fade)" stroke-width="${i%4===0?2:1}" fill="none"/>`).join(''),240,200);
add('manga/quietHatch','疎らな斜線の陰影。背景の局所に。multiply、顔・首・髪を保護',.5,Array.from({length:23},(_,i)=>p(`M${20+i*9} 95L${45+i*9} ${31+(i%4)*8}`,1,C,.35)).join(''),280,130);
add('manga/waveringAura','揺らぐ細いオーラ線。人物の周辺の余白へ。顔・体は保護',.6,Array.from({length:9},(_,i)=>p(`M${23+i*19} 180Q${5+i*19} 150 ${25+i*19} 128T${23+i*19} 77T${25+i*19} 22`,1.2,C,.3+(i%3)*.1)).join(''));
add('manga/silentRings','静かな波紋状の輪。背景の余白へ。中心を顔から離す',.5,[36,58,81].map((r,i)=>`<ellipse cx="100" cy="100" rx="${r}" ry="${r*.65}" fill="none" stroke="${C}" stroke-width="${1.8-i*.4}" opacity="${.5-i*.12}"/>`).join(''));
add('manga/brokenBorder','途切れた手描きの枠。余白を囲む。全体を囲う場合も人物保護',.8,p('M18 73L20 22L103 19M131 21L179 25L182 110M181 135L177 178L101 180M71 181L22 176L18 112',1.8));
// Soft light assets. Transparent edges rather than rectangular stamps.
add('light/softHalo','透明に消える柔らかな光の輪。光源側の背景へ。screen、低いopacity',.65,wash(100,100,92,92,.8),200,200,['#ffe4b7','#ffffff']);
add('light/sideGlow','横長の淡い光だまり。水平線や窓辺の背景へ。screen、顔を保護',.8,wash(160,60,153,56,.8),320,120,['#ffe4b7','#ffffff']);
add('light/rayFan','疎らな光の放射帯。光源側へ。screen、人物と逆光の向きを合わせる',.8,Array.from({length:7},(_,i)=>`<path d="M100 18L${18+i*25} 185L${32+i*25} 185Z" fill="url(#wash)" opacity=".25"/>`).join(''),200,200,['#fff3cc','#ffffff']);
add('light/rimStreak','縦長の光の筋。人物の輪郭の近くの背景へ。screen、顔には重ねない',.18,wash(36,140,33,132,.9),72,280,['#fff3da','#ffffff']);
add('light/dustCluster','疎らな光の粉。光のある背景へ。screen、顔・肌を保護',.45,Array.from({length:27},(_,i)=>circle(16+(i*61)%167,15+(i*37)%171,.8+(i%4)*.45,.25+(i%5)*.12)).join(''),200,200,['#ffedcc','#ffffff']);
add('light/softBokeh','柔らかな少数の玉ボケ。背景の余白へ。screen、目・顔は保護',.55,[[47,67,25],[134,51,16],[151,130,31],[66,150,19]].map(([x,y,r])=>wash(x,y,r,r,.7)).join(''),200,200,['#ffdfce','#ffffff']);
// Watercolour-like soft washes: abstract texture, no objects.
add('paint/edgeWash','水彩風の淡い縁のにじみ。画面端へ低いopacity、顔・肌を保護',.65,[wash(24,51,59,39),wash(33,110,46,58),wash(22,169,67,28)].join(''),200,200,['#90bbd3','#dbe7ed']);
add('paint/cloudWash','不定形の淡いにじみ。背景の質感用。soft-light、低いopacity',.6,[wash(67,83,58,43),wash(132,103,49,67),wash(88,144,61,35)].join(''));
add('paint/inkBloom','中心から滲むインク風の染み。背景だけに薄く。multiply、人物を保護',.45,wash(100,100,86,76,.9)+Array.from({length:12},(_,i)=>wash(100+Math.cos(i)*60,100+Math.sin(i)*55,17,20,.2)).join(''),200,200,['#61677d','#9eacc2']);
add('paint/washRibbon','横長の水彩風にじみ帯。水平線・余白へ。soft-light、肌を保護',.65,[wash(59,49,52,29),wash(147,47,76,32),wash(247,54,60,24)].join(''),320,100,['#b6a4c7','#f1ced6']);
add('paint/splashFine','細かな絵の具の飛沫。画面の角へ。multiply、顔・肌を保護',.38,Array.from({length:42},(_,i)=>circle(17+(i*53)%169,19+(i*71)%163,.6+(i%7)*.6,.18+(i%4)*.15)).join(''),200,200,['#7198b1','#ffffff']);
add('paint/dryRibbon','横長の乾いた筆跡。背景の余白へ。multiply、低いopacity',.65,streak(19,320,100),320,100,['#8697ad','#ffffff']);
// Edge ornaments. Not additions to the photographed/illustrated world.
add('frame/leafCorner','葉形の線画の角飾り。画面の隅へ。物体として人物に持たせない',.42,p('M22 184Q39 105 152 29',1.5)+[0,1,2,3].map(i=>p(`M${38+i*27} ${143-i*29}Q${10+i*28} ${93-i*23} ${31+i*29} ${80-i*20}Q${69+i*24} ${103-i*24} ${38+i*27} ${143-i*29}`,1.2)).join(''),200,200,['#93aa9c','#ffffff']);
add('frame/flowerCorner','花の輪郭の角飾り。画面の隅へ小さく。顔周辺に密集させない',.4,[0,1,2].map(i=>{let x=49+i*46,y=145-i*48;return p(`M${x} ${y-20}C${x+23} ${y-39} ${x+31} ${y-6} ${x+17} ${y}C${x+40} ${y+22} ${x+4} ${y+29} ${x} ${y+16}C${x-25} ${y+40} ${x-31} ${y} ${x-17} ${y-3}C${x-36} ${y-24} ${x-6} ${y-40} ${x} ${y-20}Z`,1.3)+circle(x,y,3,.5,A)}).join(''),200,200,['#bd94a9','#d7becc']);
add('frame/looseRibbon','ゆるいリボン状の抽象線。余白や画面端へ。人物の服として使わない',.5,p('M14 57C69 13 81 101 131 55S220 96 262 43',1.8)+p('M21 65C69 26 84 113 136 64S225 104 268 52',1.1,A),280,120,['#b09ba8','#d7c9d1']);
add('frame/petalScatter','疎らな抽象花びらの装飾。背景の余白へ。顔・肌を保護',.45,[[44,61,-25],[135,49,35],[79,132,12],[157,149,-40]].map(([x,y,r])=>`<g transform="translate(${x} ${y}) rotate(${r})">${p('M0 -13Q23 0 0 15Q-8 3 0 -13Z',1.3)}</g>`).join(''),200,200,['#be96ac','#ffffff']);
add('frame/dottedArc','点で描いた弧。顔から離れた余白に。優しい囲み・余韻',.45,Array.from({length:21},(_,i)=>circle(100+Math.cos(i/20*Math.PI*1.5-2)*78,100+Math.sin(i/20*Math.PI*1.5-2)*78,1.1+(i%3)*.3,.55)).join(''));
add('frame/openBrackets','緩い括弧状の装飾。余白の言葉や感情を囲む。顔は保護',.5,p('M49 38Q19 79 30 137L44 165',1.5)+p('M152 33Q179 70 170 131L158 164',1.5));
// Atmospheric marks and motion accents.
add('calm/lingeringArc','余韻を示す一本の弧。広い余白へ。人物に沿わせず少数で使う',.4,p('M18 103C84 14 140 177 262 47',1.6),280,140);
add('calm/distantDots','遠ざかる大小の点。背景の余白に横向きで。静けさ・ためらい',.3,[0,1,2,3,4].map(i=>circle(24+i*47,51+(i%2)*8,3-i*.45,.8-i*.1)).join(''),260,100);
add('calm/softPulse','柔らかな鼓動の線。胸の横の余白へ。肌に重ねない',.27,p('M15 66L53 66L71 37L89 93L104 60L122 67L241 67',1.8),260,130,['#b88398','#ffffff']);
add('calm/rippleEcho','薄く広がる余韻の波紋。水面・背景の余白へ。低いopacity',.55,[1,2,3,4].map(i=>`<ellipse cx="160" cy="65" rx="${i*33}" ry="${i*11}" fill="none" stroke="${C}" stroke-width="${2-i*.3}" opacity="${.7-i*.12}"/>`).join(''),320,130);
add('calm/uneasyLoop','不安を示す小さな絡んだ線。頭の横の余白へ。静かな混乱',.18,p('M34 105C22 39 153 38 157 102S51 172 45 103S118 49 127 91S75 152 67 112',1.8));
add('calm/pauseDashes','間を示す短いかすれ線。頭の横や広い余白へ小さく',.18,p('M38 94L64 87',1.8)+p('M88 100L115 94',1.6)+p('M139 105L159 101',1.3));
add('motion/longSwoosh','長い風の弧。空・水面の余白へ。横長を維持して使う',.7,p('M15 75C97 13 180 126 305 35',2)+p('M46 92Q170 47 281 72',1,A),320,130);
add('motion/shortDash','短い勢いの線。手足の横の余白へ小さく。人物は保護',.23,p('M21 32L157 27',2.5)+p('M44 62L173 55',1.5)+p('M81 91L166 87',1),200,120);
add('motion/stopTicks','急停止の短いアクセント線。足元や手の横へ。肌には重ねない',.22,p('M32 87L24 52M65 70L60 28M99 78L108 42',2.3),160,130);
add('motion/impactShards','疎らな衝撃の欠片。動作の周辺の背景に。顔を保護',.3,Array.from({length:7},(_,i)=>{let t=i*Math.PI*2/7;let x=100+Math.cos(t)*67,y=100+Math.sin(t)*67;return p(`M${x} ${y}l${Math.cos(t)*15} ${Math.sin(t)*15}l${-Math.sin(t)*8} ${Math.cos(t)*8}Z`,1.5)}).join(''));
add('motion/windHatch','風向きを示す疎らな斜線。空や背景の余白へ。人物を保護',.5,Array.from({length:13},(_,i)=>p(`M${21+i*17} ${57+(i%4)*13}l${22+(i%3)*10} -23`,1.2,C,.4)).join(''),280,140);
add('motion/softSpeed','柔らかな速度線の帯。動きと同じ方向に背景へ。人物を保護',.65,streak(11,320,120,6),320,120);
for(const v of a)writeFileSync(new URL('svg/'+v.file,out),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.w} ${v.h}">\n<!-- Original artwork, MIT; generated by gen-atmosphere-assets.mjs -->\n${gradients}${v.body}\n</svg>\n`);
writeFileSync(new URL('manifest.json',out),JSON.stringify({assets:a.map(({body,w,h,...meta})=>meta)},null,2)+'\n');
writeFileSync(new URL('pack.json',out),JSON.stringify({name:'光・にじみ・背景演出セット',author:'AI Paste Effect',license:'MIT'},null,2)+'\n');
console.log(`atmosphere: ${a.length} new assets`);
