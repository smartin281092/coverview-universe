/**
 * Fond dégradé animé du site (4 novembre 2026) : un fragment shader WebGL de quelques lignes qui
 * mélange trois couleurs par un bruit simplex lent, dessiné à basse résolution puis agrandi et
 * flouté par CSS. Il remplace le dégradé three.js des CTA du comparateur là où le budget
 * JavaScript de la page ne permet pas three.js (accueil), avec les mêmes couleurs et la même
 * lenteur ; sous le flou, le rendu est le même. Décoratif : sans WebGL, le dégradé CSS du
 * conteneur reste seul visible.
 */
export type GradientSceneOptions = {
  colors: readonly [string, string, string];
  /** Vitesse du mouvement, 1 = celle des CTA du comparateur. */
  speed?: number;
  /** Fraction de la taille CSS réellement dessinée (le flou CSS cache la différence). */
  resolution?: number;
  /** Images par seconde visées. */
  fps?: number;
};

const vertex = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
// Bruit simplex 3D d’Ashima Arts / Stefan Gustavson (MIT), condensé.
const fragment = `precision highp float;
uniform vec2 r;uniform float t;uniform vec3 a;uniform vec3 b;uniform vec3 c;
vec3 m3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 m4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 pm(vec4 x){return m4(((x*34.)+1.)*x);}
vec4 ts(vec4 r0){return 1.79284291400159-.85373472095314*r0;}
float sn(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=m3(i);vec4 p=pm(pm(pm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 nm=ts(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=vec2(uv.x*r.x/r.y,uv.y);
float n1=sn(vec3(q*1.15+vec2(0.,t*.06),t*.09));
float n2=sn(vec3(q*2.2-vec2(t*.05,t*.02),3.+t*.07));
float n3=sn(vec3(q*.7+vec2(t*.03,-t*.04),7.-t*.05));
float f1=smoothstep(-.55,.75,n1+.3*n2);
float f2=smoothstep(-.1,.95,n2-.25*n1+.35*n3);
vec3 col=mix(a,b,f1);col=mix(col,c,f2*.8);
float ridge=pow(max(0.,1.-abs(n1-.1)),8.)*.22+pow(max(0.,1.-abs(n2+.2)),10.)*.12;
col+=ridge*vec3(.75,.85,1.);
col=mix(col,a,smoothstep(.55,1.05,uv.y)*.35);
gl_FragColor=vec4(col,1.);}`;

const hex = (value: string): [number, number, number] => {
  const digits = value.replace("#", "");
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits;
  const int = Number.parseInt(full, 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
};

export class GradientScene {
  readonly supported: boolean;
  private gl: WebGLRenderingContext | null = null;
  private frame = 0;
  private running = false;
  private previous = 0;
  private elapsed = Math.random() * 100;
  private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
  private readonly resize: ResizeObserver | undefined;
  private readonly lost = () => this.stop();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: GradientSceneOptions,
  ) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    this.supported = Boolean(gl) && this.setup(gl as WebGLRenderingContext);
    if (!this.supported) return;
    this.gl = gl;
    canvas.addEventListener("webglcontextlost", this.lost);
    if (typeof ResizeObserver !== "undefined") {
      this.resize = new ResizeObserver(() => this.fit());
      this.resize.observe(canvas);
    }
    this.fit();
    this.paint(0);
  }

  private setup(gl: WebGLRenderingContext): boolean {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of ["r", "t", "a", "b", "c"])
      this.uniforms[name] = gl.getUniformLocation(program, name);
    const [a, b, c] = this.options.colors.map(hex);
    gl.uniform3fv(this.uniforms.a ?? null, a ?? [0, 0, 0]);
    gl.uniform3fv(this.uniforms.b ?? null, b ?? [0, 0, 0]);
    gl.uniform3fv(this.uniforms.c ?? null, c ?? [0, 0, 0]);
    return true;
  }

  private fit() {
    const gl = this.gl;
    if (!gl) return;
    const resolution = this.options.resolution ?? 0.22;
    const ratio = Math.min(1, window.devicePixelRatio || 1) * resolution;
    const width = Math.max(32, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(32, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(this.uniforms.r ?? null, width, height);
      this.paint(0);
    }
  }

  private paint(delta: number) {
    const gl = this.gl;
    if (!gl) return;
    this.elapsed += (delta / 1000) * 0.55 * (this.options.speed ?? 1);
    gl.uniform1f(this.uniforms.t ?? null, this.elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private readonly loop = (time: number) => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.loop);
    const interval = 1000 / (this.options.fps ?? 30);
    if (this.previous && time - this.previous < interval) return;
    const delta = this.previous ? Math.min(time - this.previous, 100) : 0;
    this.previous = time;
    this.paint(delta);
  };

  start() {
    if (!this.supported || this.running) return;
    this.running = true;
    this.previous = 0;
    this.frame = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  setRunning(running: boolean) {
    if (running) this.start();
    else this.stop();
  }

  destroy() {
    this.stop();
    this.resize?.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
  }
}

/** Couleurs des CTA du comparateur et des fonds CoverView : nuit, bleu, indigo. */
export const coverviewColors = ["#111e38", "#3b82f6", "#6366f1"] as const;
