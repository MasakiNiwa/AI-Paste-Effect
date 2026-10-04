import { ASSET_IDS, findAsset, loadAssetImage } from '../assets';
import { css } from '../color';
import { p } from '../params';
import { defineEffect } from '../types';
import { ctx2d } from './util';

export const illustrationOverlay = defineEffect({
  id: 'illustrationOverlay',
  label: '漫画素材',
  category: 'illustration',
  kind: 'overlay',
  defaultBlend: 'normal',
  description:
    '手描きの漫画素材（驚き線・汗・ガーン・花・ハート・土煙など）を指定位置に貼る。asset は下の「漫画素材カタログ」の ID から選ぶ。顔や体に重ならないよう、頭の横・上や背景側に置くのが基本。色を変えたい時は color（主色）/ accent（副色）。',
  params: {
    asset: p.enum(ASSET_IDS, ASSET_IDS.includes('shock/lines3') ? 'shock/lines3' : ASSET_IDS[0], '素材 ID（漫画素材カタログ参照）'),
    position: p.point(0.6, 0.25, '素材の中心'),
    size: p.num(0.03, 2, 0.25, '大きさ（短辺比。素材の幅）'),
    angle: p.num(-180, 180, 0, '傾き（度）'),
    flipX: p.bool(false, '左右反転'),
    flipY: p.bool(false, '上下反転'),
    color: p.color('#00000000', '主色（省略で素材の標準色）'),
    accent: p.color('#00000000', '副色・縁取り（省略で素材の標準色）'),
  },
  async render(ctx, v) {
    const out = ctx.createCanvas();
    const asset = findAsset(v.asset);
    if (!asset) return out;
    const px = v.size * ctx.short;
    const c1 = v.color.a === 0 ? asset.colors[0] : css(v.color);
    const c2 = v.accent.a === 0 ? asset.colors[1] : css(v.accent);
    const img = await loadAssetImage(asset, c1, c2, px);
    const g = ctx2d(out);
    g.translate(v.position.x * ctx.width, v.position.y * ctx.height);
    g.rotate((v.angle * Math.PI) / 180);
    g.scale(v.flipX ? -1 : 1, v.flipY ? -1 : 1);
    g.drawImage(img, -px / 2, -px / 2, px, px);
    g.setTransform(1, 0, 0, 1, 0, 0);
    return out;
  },
});
