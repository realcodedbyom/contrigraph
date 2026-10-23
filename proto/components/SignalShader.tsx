"use client";
import { useEffect, useRef } from "react";
export default function SignalShader() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true });
    if (!gl) return;
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const vertex = shader(
      gl.VERTEX_SHADER,
      "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}",
    );
    const fragment = shader(
      gl.FRAGMENT_SHADER,
      `precision mediump float;uniform float time;uniform vec2 resolution;void main(){vec2 uv=gl_FragCoord.xy/resolution;float line=0.;for(int i=0;i<18;i++){float f=float(i);float y=.45+sin(uv.x*5.+f*.14+time*.22)*(.12+f*.009)+cos(uv.x*9.-time*.13)*.04;line+=.0018/max(abs(uv.y-y),.001);}float fade=smoothstep(.02,.45,uv.x);gl_FragColor=vec4(vec3(.95,.44,.24),min(line*.35,.65)*fade);}`,
    );
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const p = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const draw = (time: number) => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(
        gl.getUniformLocation(program, "resolution"),
        canvas.width,
        canvas.height,
      );
      gl.uniform1f(gl.getUniformLocation(program, "time"), time * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);
  return <canvas ref={ref} className="signal-shader" aria-hidden="true" />;
}
