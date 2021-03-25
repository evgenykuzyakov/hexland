import "./Home.scss";
import React, {useCallback, useEffect, useRef, useState} from 'react';
import * as twgl from 'twgl-base.js';
import vs from '../shaders/vs';
import fs from '../shaders/fs';
import Tst from '../images/tst.png';

let lastMousePos = null;
const Sq3 = Math.sqrt(3.0) / 2;
const DxA = Sq3 * 2;
const DyA = 0;
const DxB = Sq3;
const DyB = 1.5;

const InitialZoom = 1 / 30;
const MinZoom = 1 / 256;


function drawHex(ctx, cx, cy, side, color) {
  // `rgb(${((i * 16 % 256) + 256) % 256}, ${((j * 16 % 256) + 256) % 256},${(((i + 13 + j * 17) % 256) + 256) % 256})`
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - side);
  ctx.lineTo(cx - Sq3 * side, cy - side / 2);
  ctx.lineTo(cx - Sq3 * side, cy + side / 2);
  ctx.lineTo(cx, cy + side);
  ctx.lineTo( cx + Sq3 * side, cy + side / 2);
  ctx.lineTo(cx + Sq3 * side, cy - side / 2);
  ctx.fill();
}

const state = {
  hexes: [],
};

function setupRender(gl) {
  const programInfo = twgl.createProgramInfo(gl, [vs, fs])

  const arrays = {
    a_position: [
      -Sq3, 0.75, 0,
      Sq3, 0.75, 0,
      0, -0.75, 0,
    ],
    a_texcoord: [
      0, 0,
      1, 0,
      0, 1,
    ],
    a_ab: {
      numComponents: 2, data: [
        -0.5, -0.5,
        49.5, -0.5,
        -0.5, 49.5,
      ]
    }
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  const textures = twgl.createTextures(gl, {
    test: { src: Tst, mag: gl.NEAREST, min: gl.NEAREST },
  });

  function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const uniforms = {
      resolution: [gl.canvas.width, gl.canvas.height],
      zoom: state.zoom,
      offset: [state.oa, state.ob],
      u_diffuse: textures.test,
    };
    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function GlPage(props) {
  const canvasEl = useRef(null);
  const [ctx, setCtx] = useState(null);
  const [view, setView] = useState({
    a: 0,
    b: 0,
    zoom: InitialZoom,
    aspect: 1,
  });
  const [mouseAb, setMouseAb] = useState({a: 0, b: 0});

  const refresh = useCallback(() => {
    let width = 1;
    let height = view.aspect;
    const zoom = view.zoom;
    let maxA = width / zoom / DxA;
    let maxB = height / zoom / DyB;

    const db = height / zoom / DyB / 2;
    const da = (width / zoom / 2 - db * DxB) / DxA;

    const oa = view.a - da;
    const ob = view.b - db;

    let a1 = Math.floor(oa);
    let a2 = Math.ceil(oa + maxA);
    let b1 = Math.floor(ob);
    let b2 = Math.floor(ob + maxB + 1);

    const hexes = [];

    for (let b = b1; b <= b2; ++b) {
      for (let ia = a1; ia <= a2; ++ia) {
        const a = ia - Math.floor((b - b1) / 2);
        hexes.push({
          a,
          b,
          color: [
            (((a * 16 % 256) + 256) % 256) / 255,
            (((b * 16 % 256) + 256) % 256) / 255,
            (((a + 13 + b * 17) + 256) % 256) / 255,
            ],
        });
        // ctx.fillStyle = 'white';
        // ctx.fillText(`${a}, ${b}`, cx, cy);
      }
    }
    Object.assign(state, {
      hexes,
      zoom,
      oa,
      ob,
    })
    /*
    if (mouseAb) {
      let a = view.a + mouseAb.a / zoom;
      let b = view.b + mouseAb.b / zoom;

      function dist(na, nb) {
        const cy = ((nb - b) * DyB + (na - a) * DyA);
        const cx = ((nb - b) * DxB + (na - a) * DxA);
        return cx * cx + cy * cy;
      }

      const ta = Math.trunc(a);
      const tb = Math.trunc(b);
      let best = null;
      let minD = 10;

      for (let i = -1; i < 2 ; ++i) {
        for (let j = -1; j < 2; ++j) {
          const a = ta + i;
          const b = tb + j;
          const d = dist(a, b);
          if (d < minD + 1e-9) {
            best = {a, b};
            minD = d;
          }
        }
      }

      a = best.a;
      b = best.b;

      const cy = ((b - ob) * DyB + (a - oa) * DyA) * zoom;
      const cx = ((b - ob) * DxB + (a - oa) * DxA) * zoom;
      drawHex(
        ctx,
        cx,
        cy,
        zoom,
        'rgba(0, 0, 0, 0.25)'
      );
    }
   */

  }, [ctx, view, mouseAb])

  useEffect(() => {
    if (ctx) {
      refresh();
    }
  }, [mouseAb, view, ctx, refresh])

  useEffect(() => {
    if (canvasEl.current) {
      const ctx = canvasEl.current.getContext('webgl');
      setCtx(ctx);

      setupRender(ctx);
      canvasEl.current.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        const rect = e.target.getBoundingClientRect();
        const dx = ((e.clientX - rect.x) / rect.width - 0.5);
        const dy = ((e.clientY - rect.y) / rect.width - rect.height / rect.width * 0.5);
        const b = dy / DyB;
        const a = (dx - b * DxB) / DxA;
        setMouseAb({
          a, b
        })
        if (lastMousePos) {
          const dx = (x - lastMousePos.x) / rect.width;
          const dy = (y - lastMousePos.y) / rect.width;
          const db = dy / DyB;
          const da = (dx - db * DxB) / DxA;
          setView((view) => {
            return {
              a: view.a - da / view.zoom,
              b: view.b - db / view.zoom,
              zoom: view.zoom,
              aspect: view.aspect,
            }
          })
        }
        if (e.buttons & 1) {
          lastMousePos = {x, y};
        } else {
          lastMousePos = null;
        }
      });

      canvasEl.current.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = e.target.getBoundingClientRect();
        const dx = ((e.clientX - rect.x) / rect.width - 0.5);
        const dy = ((e.clientY - rect.y) / rect.width - rect.height / rect.width * 0.5);
        const mb = dy / DyB;
        const ma = (dx - mb * DxB) / DxA;
        setView((view) => {
          const newZoom = Math.max(MinZoom, view.zoom * Math.exp(-e.deltaY * 0.001));
          const oa = view.a + ma / view.zoom;
          const ob = view.b + mb / view.zoom;
          const va = oa - ma / newZoom;
          const vb = ob - mb / newZoom;

          return {
            a: va,
            b: vb,
            zoom: newZoom,
            aspect: view.aspect,
          }
        })
      });

      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const bsr = ctx.webkitBackingStorePixelRatio ||
          ctx.mozBackingStorePixelRatio ||
          ctx.msBackingStorePixelRatio ||
          ctx.oBackingStorePixelRatio ||
          ctx.backingStorePixelRatio || 1;

        const pixelRatio = dpr / bsr;
        const width  = window.innerWidth || document.documentElement.clientWidth ||
          document.body.clientWidth;
        const height = window.innerHeight|| document.documentElement.clientHeight||
          document.body.clientHeight;
        canvasEl.current.width = width * pixelRatio;
        canvasEl.current.height = height * pixelRatio;
        // ctx.scale(canvasEl.current.width, canvasEl.current.width);
        setView((v) => Object.assign({}, v, {aspect: height / width}));
      };

      window.addEventListener('resize', resize);

      resize();

    }
  }, [canvasEl])

  return (
    <div>
      <canvas
        ref={canvasEl}
        className="canvas"
        width={640}
      />
    </div>
  );
}

export default GlPage;
