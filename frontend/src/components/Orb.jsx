import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Vec3 } from 'ogl';

// Galla's living presence. Adapted from a 21st.dev voice-orb (ogl + GLSL), retuned for Galla:
// soft Paytm-blue, glow dialed WAY down (no neon), reacts to the mic when `listening` is true.
// Props: className, listening (open mic + react to voice), onLevel(level 0..1), idleSpin.

const VERT = /* glsl */ `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;

// Paytm-blue, low-luminance build of the orb. baseColors are muted; the moving light is softened.
const FRAG = /* glsl */ `
  precision highp float;
  uniform float iTime;
  uniform vec3 iResolution;
  uniform float hover;
  uniform float rot;
  uniform float hoverIntensity;
  varying vec2 vUv;

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yxz + 19.19);
    return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
  }
  float snoise3(vec3 p) {
    const float K1 = 0.333333333; const float K2 = 0.166666667;
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
    vec3 i1 = e * (1.0 - e.zxy); vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    vec3 d1 = d0 - (i1 - K2); vec3 d2 = d0 - (i2 - K1); vec3 d3 = d0 - 0.5;
    vec4 h = max(0.6 - vec4(dot(d0,d0), dot(d1,d1), dot(d2,d2), dot(d3,d3)), 0.0);
    vec4 n = h*h*h*h*vec4(dot(d0,hash33(i)), dot(d1,hash33(i+i1)), dot(d2,hash33(i+i2)), dot(d3,hash33(i+1.0)));
    return dot(vec4(31.316), n);
  }
  vec4 extractAlpha(vec3 c) { float a = max(max(c.r,c.g),c.b); return vec4(c.rgb/(a+1e-5), a); }

  // muted Paytm palette (no neon): mid-blue, soft sky, deep navy
  const vec3 baseColor1 = vec3(0.07, 0.45, 0.80);
  const vec3 baseColor2 = vec3(0.42, 0.74, 0.93);
  const vec3 baseColor3 = vec3(0.02, 0.16, 0.42);
  const float innerRadius = 0.62;
  const float noiseScale = 0.62;

  float light1(float i, float a, float d) { return i / (1.0 + d * a); }
  float light2(float i, float a, float d) { return i / (1.0 + d * d * a); }

  vec4 draw(vec2 uv) {
    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float invLen = len > 0.0 ? 1.0 / len : 0.0;
    float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.45)) * 0.5 + 0.5;
    float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
    float d0 = distance(uv, (r0 * invLen) * uv);
    float v0 = light1(1.0, 10.0, d0);
    v0 *= smoothstep(r0 * 1.05, r0, len);
    float cl = cos(ang + iTime * 1.6) * 0.5 + 0.5;
    float a = iTime * -1.0;
    vec2 pos = vec2(cos(a), sin(a)) * r0;
    float d = distance(uv, pos);
    float v1 = light2(0.85, 6.5, d);     // softened moving highlight
    v1 *= light1(1.0, 50.0, d0);
    float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
    float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);
    vec3 col = mix(baseColor1, baseColor2, cl);
    col = mix(baseColor3, col, v0);
    col = (col + v1 * 0.5) * v2 * v3;     // less additive glow -> calmer, non-neon
    col = clamp(col, 0.0, 1.0);
    return extractAlpha(col);
  }
  vec4 mainImage(vec2 fragCoord) {
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 2.0;
    float s = sin(rot); float c = cos(rot);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
    uv.x += hover * hoverIntensity * 0.08 * sin(uv.y * 9.0 + iTime);
    uv.y += hover * hoverIntensity * 0.08 * sin(uv.x * 9.0 + iTime);
    return draw(uv);
  }
  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec4 col = mainImage(fragCoord);
    gl_FragColor = vec4(col.rgb * col.a, col.a);
  }
`;

export default function Orb({ className, listening = false, onLevel, idleSpin = 0.18 }) {
  const ctn = useRef(null);
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const onLevelRef = useRef(onLevel);
  onLevelRef.current = onLevel;

  useEffect(() => {
    const container = ctn.current;
    if (!container) return;

    let renderer, gl, raf, program;
    let audioCtx, analyser, micSource, mediaStream, dataArr;
    let micOn = false;

    const stopMic = () => {
      try {
        mediaStream?.getTracks().forEach((t) => t.stop());
        micSource?.disconnect();
        analyser?.disconnect();
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
      } catch { /* noop */ }
      mediaStream = micSource = analyser = audioCtx = dataArr = null;
      micOn = false;
    };

    const startMic = async () => {
      if (micOn) return;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        micSource = audioCtx.createMediaStreamSource(mediaStream);
        micSource.connect(analyser);
        dataArr = new Uint8Array(analyser.frequencyBinCount);
        micOn = true;
      } catch { micOn = false; }
    };

    const level = () => {
      if (!analyser || !dataArr) return 0;
      analyser.getByteFrequencyData(dataArr);
      let sum = 0;
      for (let i = 0; i < dataArr.length; i++) { const v = dataArr[i] / 255; sum += v * v; }
      return Math.min(Math.sqrt(sum / dataArr.length) * 4.5, 1);
    };

    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: false, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
      gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(gl.canvas);
      gl.canvas.style.width = '100%';
      gl.canvas.style.height = '100%';

      const geometry = new Triangle(gl);
      program = new Program(gl, {
        vertex: VERT, fragment: FRAG,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Vec3(1, 1, 1) },
          hover: { value: 0 }, rot: { value: 0 }, hoverIntensity: { value: 0 },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });

      const resize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
      };
      window.addEventListener('resize', resize);
      resize();

      let last = 0, curRot = 0, lvl = 0;
      const tick = (t) => {
        raf = requestAnimationFrame(tick);
        const dt = (t - last) * 0.001; last = t;
        program.uniforms.iTime.value = t * 0.001;

        if (listeningRef.current && !micOn) startMic();
        if (!listeningRef.current && micOn) stopMic();

        if (listeningRef.current && micOn) {
          lvl = lvl * 0.7 + level() * 0.3; // smooth
          onLevelRef.current?.(lvl);
          curRot += dt * (idleSpin + lvl * 1.6);
          program.uniforms.hover.value = Math.min(lvl * 2.0, 1.0);
          program.uniforms.hoverIntensity.value = Math.min(lvl * 0.7, 0.7);
        } else {
          lvl *= 0.9;
          curRot += dt * idleSpin; // gentle idle breath
          program.uniforms.hover.value = 0;
          program.uniforms.hoverIntensity.value = 0;
        }
        program.uniforms.rot.value = curRot;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderer.render({ scene: mesh });
      };
      raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        stopMic();
        try { container.contains(gl.canvas) && container.removeChild(gl.canvas); } catch { /* noop */ }
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    } catch {
      return () => {};
    }
  }, [idleSpin]);

  return <div ref={ctn} className={className} />;
}
