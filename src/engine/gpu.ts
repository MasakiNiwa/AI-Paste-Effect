/**
 * GPU（WebGL2）で画素ごとの計算を行う小さな実行環境。
 *
 * 重い画素ループを持つエフェクトは、同じ計算をフラグメントシェーダでも書いておき、
 * GPU モードの時はこちらで実行する（使えない・失敗した時は CPU の処理に戻る）。
 *
 * ■ シェーダの書き方
 *   fragment には main() を含む本体だけを書く。前置き（#version・精度・vUv・outColor・uSize・
 *   共通関数 luma / sstep / hash）は自動で付く。
 *   textures に渡した画像は同名の sampler2D として、uniforms は同名の uniform として使える
 *   （宣言はシェーダ側に書く）。テクスチャは端を引き伸ばし、線形補間で読む（ミップマップ付き。textureLod で縮小版も読める）。
 *   色はすべて 0〜1・アルファは乗算済みでない値で受け渡す（getImageData と同じ）。
 */

export type GpuMode = 'gpu' | 'cpu';

export interface ShaderPass {
  fragment: string;
  width: number;
  height: number;
  textures?: Record<string, TexImageSource>;
  uniforms?: Record<string, number | readonly number[]>;
}

export interface Gpu {
  /** シェーダを実行し、結果を通常の（WebGL に紐づかない）キャンバスで返す */
  run(pass: ShaderPass): HTMLCanvasElement;
}

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uSize;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// smoothstep と同じだが e0 > e1（逆向き）でも使える
float sstep(float e0, float e1, float x) { float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
#line 1
`;

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  // 画像の上端を v = 0 にする（テクスチャを上下反転せずに読み込むため）
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

interface State {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  programs: Map<string, WebGLProgram>;
  maxSize: number;
  name: string;
}

let state: State | null | undefined;
let mode: GpuMode = 'gpu';

/** 設定の処理モード（アプリ側から渡す） */
export function setGpuMode(m: GpuMode) {
  mode = m;
}
export const getGpuMode = () => mode;

function init(): State | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    state = undefined; // 次に使う時に作り直す
  });
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // 画面全体を覆う 1 枚の三角形
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return { canvas, gl, programs: new Map(), maxSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, name };
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`シェーダのコンパイルに失敗: ${log}`);
  }
  return sh;
}

function program(s: State, fragment: string): WebGLProgram {
  const cached = s.programs.get(fragment);
  if (cached) return cached;
  const { gl } = s;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, PRELUDE + fragment));
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`シェーダのリンクに失敗: ${gl.getProgramInfoLog(prog)}`);
  s.programs.set(fragment, prog);
  return prog;
}

function setUniform(gl: WebGL2RenderingContext, loc: WebGLUniformLocation, type: number, v: number | readonly number[]) {
  const a = typeof v === 'number' ? [v] : [...v];
  switch (type) {
    case gl.INT:
    case gl.BOOL:
      return gl.uniform1i(loc, a[0]);
    case gl.FLOAT:
      return gl.uniform1fv(loc, a);
    case gl.FLOAT_VEC2:
      return gl.uniform2fv(loc, a);
    case gl.FLOAT_VEC3:
      return gl.uniform3fv(loc, a);
    case gl.FLOAT_VEC4:
      return gl.uniform4fv(loc, a);
    default:
      throw new Error(`未対応の uniform の型: ${type}`);
  }
}

function run(s: State, pass: ShaderPass): HTMLCanvasElement {
  const { gl, canvas } = s;
  const W = Math.max(1, Math.round(pass.width));
  const H = Math.max(1, Math.round(pass.height));
  if (W > s.maxSize || H > s.maxSize) throw new Error('画像が GPU で扱える大きさを超えています');
  if (gl.isContextLost()) throw new Error('GPU のコンテキストが失われました');
  const prog = program(s, pass.fragment);
  canvas.width = W;
  canvas.height = H;
  gl.viewport(0, 0, W, H);
  gl.useProgram(prog);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const textures: WebGLTexture[] = [];
  try {
    let unit = 0;
    for (const [name, img] of Object.entries(pass.textures ?? {})) {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc) continue; // シェーダで使っていない
      const tex = gl.createTexture()!;
      textures.push(tex);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.uniform1i(loc, unit++);
    }
    const uniforms: Record<string, number | readonly number[]> = { uSize: [W, H], ...pass.uniforms };
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(prog, i)!;
      const name = info.name.replace(/\[0\]$/, '');
      if (info.type === gl.SAMPLER_2D || !(name in uniforms)) continue;
      setUniform(gl, gl.getUniformLocation(prog, info.name)!, info.type, uniforms[name]);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const g = out.getContext('2d')!;
    g.drawImage(canvas, 0, 0);
    return out;
  } finally {
    for (const t of textures) gl.deleteTexture(t);
  }
}

function getState(): State | null {
  if (state === undefined) {
    try {
      state = init();
    } catch {
      state = null;
    }
  }
  return state;
}

/** この端末で GPU（WebGL2）が使えるか、使えるならその名前 */
export function gpuInfo(): { available: boolean; name: string } {
  const s = getState();
  return { available: !!s, name: s?.name ?? '' };
}

/** 現在の設定で使う GPU（CPU モード・非対応なら null） */
export function activeGpu(): Gpu | null {
  if (mode !== 'gpu') return null;
  const s = getState();
  return s ? { run: (pass) => run(s, pass) } : null;
}
