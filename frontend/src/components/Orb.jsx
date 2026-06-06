import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Vec3 } from 'ogl';

// Galla's presence — a large, soft Paytm-blue orb (Apple-ish), no neon, no dark fringe.
// Edges fade via ALPHA (not toward black), so it melts into the light page.
// Reacts to the mic when `listening`; gentle breath otherwise.

const VERT = /* glsl */ `
  precision highp float;
  attribute vec2 position; attribute vec2 uv; varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float iTime; uniform vec3 iResolution; uniform float rot; uniform float uVoice;
  varying vec2 vUv;

  vec3 hash33(vec3 p3){ p3=fract(p3*vec3(0.1031,0.11369,0.13787)); p3+=dot(p3,p3.yxz+19.19);
    return -1.0+2.0*fract(vec3(p3.x+p3.y,p3.x+p3.z,p3.y+p3.z)*p3.zyx); }
  float snoise3(vec3 p){ const float K1=0.333333333; const float K2=0.166666667;
    vec3 i=floor(p+(p.x+p.y+p.z)*K1); vec3 d0=p-(i-(i.x+i.y+i.z)*K2);
    vec3 e=step(vec3(0.0),d0-d0.yzx); vec3 i1=e*(1.0-e.zxy); vec3 i2=1.0-e.zxy*(1.0-e);
    vec3 d1=d0-(i1-K2); vec3 d2=d0-(i2-K1); vec3 d3=d0-0.5;
    vec4 h=max(0.6-vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)),0.0);
    vec4 n=h*h*h*h*vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.0)));
    return dot(vec4(31.316),n); }
  float light1(float i,float a,float d){ return i/(1.0+d*a); }
  float light2(float i,float a,float d){ return i/(1.0+d*d*a); }

  // Paytm light palette — NO dark color anywhere (so there is no black shadow on white).
  const vec3 cDeep  = vec3(0.05, 0.46, 0.95);   // Paytm blue
  const vec3 cMid   = vec3(0.32, 0.66, 1.00);   // brighter sky
  const vec3 cLight = vec3(0.82, 0.91, 1.00);   // soft base (was navy)
  const float innerRadius = 0.58;
  const float noiseScale = 0.7;

  // returns rgb (always light) + soft alpha mask
  vec4 orb(vec2 uv) {
    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float invLen = len > 0.0 ? 1.0/len : 0.0;
    float t = iTime * (0.42 + uVoice * 0.5);
    float n0 = snoise3(vec3(uv * noiseScale, t)) * 0.5 + 0.5;
    float r0 = mix(mix(innerRadius,1.0,0.4), mix(innerRadius,1.0,0.6), n0);
    float d0 = distance(uv, (r0*invLen)*uv);
    float v0 = light1(1.0, 10.0, d0); v0 *= smoothstep(r0*1.05, r0, len);
    float cl = cos(ang + iTime*1.4) * 0.5 + 0.5;
    float a = iTime * -0.9;
    vec2 pos = vec2(cos(a), sin(a)) * r0;
    float v1 = light2(0.9, 6.0, distance(uv,pos)) * light1(1.0, 50.0, d0);

    vec3 col = mix(cDeep, cMid, cl);
    col = mix(cLight, col, v0);          // light base, bluer where lit
    col = col + v1 * (0.45 + uVoice*0.4); // soft highlight, livelier with voice
    col = clamp(col, 0.0, 1.0);

    // soft alpha: full inside, feathered to 0 at the rim -> melts into the page (no fringe)
    float core = smoothstep(1.02, innerRadius*0.92, len);
    float halo = smoothstep(1.18, 0.45, len) * 0.5;
    float alpha = clamp(max(core, halo) * (0.85 + 0.15*v0), 0.0, 1.0);
    return vec4(col, alpha);
  }

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 1.55;   // 1.55 -> the orb fills more of the box
    float s = sin(rot), c = cos(rot);
    uv = vec2(c*uv.x - s*uv.y, s*uv.x + c*uv.y);
    uv *= (1.0 - uVoice * 0.10);                     // gently swells with your voice
    uv.x += uVoice * 0.05 * sin(uv.y*7.0 + iTime*2.2);
    uv.y += uVoice * 0.05 * sin(uv.x*7.0 + iTime*2.2);
    vec4 o = orb(uv);
    gl_FragColor = vec4(o.rgb * o.a, o.a);           // premultiplied -> clean soft edge
  }
`;

export default function Orb({ className, listening = false, onLevel, idleSpin = 0.16 }) {
  const ctn = useRef(null);
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const onLevelRef = useRef(onLevel);
  onLevelRef.current = onLevel;

  useEffect(() => {
    const container = ctn.current;
    if (!container) return;
    let renderer, gl, raf, program;
    let audioCtx, analyser, micSource, mediaStream, dataArr, micOn = false;

    const stopMic = () => {
      try {
        mediaStream?.getTracks().forEach((t) => t.stop());
        micSource?.disconnect(); analyser?.disconnect();
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
      } catch { /* noop */ }
      mediaStream = micSource = analyser = audioCtx = dataArr = null; micOn = false;
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
        analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.35;
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
      return Math.min(Math.sqrt(sum / dataArr.length) * 6.0, 1); // more sensitive
    };

    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: false, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
      gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(gl.canvas);
      gl.canvas.style.width = '100%'; gl.canvas.style.height = '100%';

      program = new Program(gl, {
        vertex: VERT, fragment: FRAG,
        uniforms: { iTime: { value: 0 }, iResolution: { value: new Vec3(1, 1, 1) }, rot: { value: 0 }, uVoice: { value: 0 } },
      });
      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      const resize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
      };
      window.addEventListener('resize', resize); resize();

      let last = 0, curRot = 0, lvl = 0;
      const tick = (t) => {
        raf = requestAnimationFrame(tick);
        const dt = (t - last) * 0.001; last = t;
        program.uniforms.iTime.value = t * 0.001;
        if (listeningRef.current && !micOn) startMic();
        if (!listeningRef.current && micOn) stopMic();
        const target = (listeningRef.current && micOn) ? level() : 0;
        lvl = lvl * 0.78 + target * 0.22;            // smooth, feelsy
        onLevelRef.current?.(lvl);
        program.uniforms.uVoice.value = lvl;
        curRot += dt * (idleSpin + lvl * 1.4);
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
