import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Vec3 } from 'ogl';

// Galla's presence — a glossy 3D Paytm-blue orb (Apple-ish): real volume + highlight + rim light,
// flowing surface, crisp circular edge (no box), no neon. Voice energizes + swells it.

const VERT = /* glsl */ `
  precision highp float;
  attribute vec2 position; attribute vec2 uv; varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float iTime; uniform vec3 iResolution; uniform float uVoice;
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

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 p = (fragCoord - center) / size * 2.0;

    // gentle voice swell + wobble
    p *= (1.0 - uVoice * 0.08);
    p += uVoice * 0.035 * vec2(sin(iTime*3.0 + p.y*6.0), cos(iTime*2.6 + p.x*6.0));

    float radius = 0.92;
    float r = length(p);
    float alpha = smoothstep(radius, radius - 0.05, r);   // crisp-soft circular edge, contained
    if (alpha <= 0.001) { gl_FragColor = vec4(0.0); return; }

    // fake sphere normal -> 3D volume
    float z = sqrt(max(0.0, radius*radius - r*r)) / radius;
    vec3 N = normalize(vec3(p / radius, z));
    vec3 L = normalize(vec3(-0.35, 0.55, 0.85));
    float diff = clamp(dot(N, L), 0.0, 1.0);

    // flowing surface for life
    float t = iTime * (0.22 + uVoice * 0.35);
    float fl  = snoise3(vec3(p * 2.1, t)) * 0.5 + 0.5;
    float fl2 = snoise3(vec3(p * 4.4 - 3.0, t * 0.8)) * 0.5 + 0.5;

    // Paytm palette: deep navy-blue in shadow -> blue -> bright sky in light
    vec3 deep = vec3(0.02, 0.22, 0.62);
    vec3 blue = vec3(0.05, 0.49, 0.95);
    vec3 sky  = vec3(0.60, 0.83, 1.00);
    vec3 col = mix(deep, blue, diff);
    col = mix(col, sky, smoothstep(0.5, 1.0, diff) * (0.5 + 0.3 * fl));
    col = mix(col, blue, fl2 * 0.22);                       // subtle flowing variation

    // cool glassy rim (fresnel)
    float fres = pow(1.0 - z, 2.4);
    col += sky * fres * (0.30 + 0.35 * uVoice);

    // specular highlight (glossy)
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(clamp(dot(N, H), 0.0, 1.0), 30.0);
    col += vec3(1.0) * spec * 0.55;

    col += blue * uVoice * 0.22;                            // voice brightens
    col = clamp(col, 0.0, 1.0);
    gl_FragColor = vec4(col * alpha, alpha);                // premultiplied
  }
`;

export default function Orb({ className, listening = false, onLevel }) {
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
      return Math.min(Math.sqrt(sum / dataArr.length) * 6.0, 1);
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
        uniforms: { iTime: { value: 0 }, iResolution: { value: new Vec3(1, 1, 1) }, uVoice: { value: 0 } },
      });
      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      const resize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
      };
      window.addEventListener('resize', resize); resize();

      let last = 0, lvl = 0;
      const tick = (t) => {
        raf = requestAnimationFrame(tick);
        last = t;
        program.uniforms.iTime.value = t * 0.001;
        if (listeningRef.current && !micOn) startMic();
        if (!listeningRef.current && micOn) stopMic();
        const target = (listeningRef.current && micOn) ? level() : 0;
        lvl = lvl * 0.8 + target * 0.2;
        onLevelRef.current?.(lvl);
        program.uniforms.uVoice.value = lvl;
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
  }, []);

  return <div ref={ctn} className={className} />;
}
