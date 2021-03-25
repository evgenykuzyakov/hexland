import "./Home.scss";
import React, {useCallback, useEffect, useRef, useState} from 'react';
import * as twgl from 'twgl-base.js';
import vs from '../shaders/vs';
import fs from '../shaders/fs';
import Tst from '../images/tst.png';
import img1 from '../images/25000000.png';
import img2 from '../images/25100000.png';
import img3 from '../images/25200000.png';
import img4 from '../images/25300000.png';
import img5 from '../images/25400000.png';
import img6 from '../images/25500000.png';
import img7 from '../images/25600000.png';
import img8 from '../images/25700000.png';
import img9 from '../images/25800000.png';
import imgA from '../images/25900000.png';

let lastMousePos = null;
const Sq3 = Math.sqrt(3.0) / 2;
const DxA = Sq3 * 2;
const DyA = 0;
const DxB = Sq3;
const DyB = 1.5;

const InitialZoom = 1;
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
  pos: [0, 0, 1],
};

function setupRender(gl) {
  const programInfo = twgl.createProgramInfo(gl, [vs, fs])

  const arrays = {
    a_position: [
      - Sq3, 0.75, 0,
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
        255.5, -0.5,
        -0.5, 255.5,
      ]
    }
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, 256, 256);

  const textures = twgl.createTextures(gl, {
    fromCanvas: { src: canvas, mag: gl.NEAREST, min: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE },
  });

  function drawImg(url, x, y) {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      ctx.drawImage(img, x, y, 50, 50);
      twgl.setTextureFromElement(gl, textures.fromCanvas, canvas);
    };
    img.src = url;
  }

  drawImg(img1, 0, 0);
  drawImg(img2, 50, 0);
  drawImg(img3, 100, 0);
  drawImg(img4, 150, 0);
  drawImg(img5, 0, 50);
  drawImg(img6, 50, 50);
  drawImg(img7, 100, 50);
  drawImg(img8, 0, 100);
  drawImg(img9, 50, 100);
  drawImg(imgA, 0, 150);

  function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    twgl.bindFramebufferInfo(gl, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const uniforms = {
      resolution: [gl.canvas.width, gl.canvas.height],
      texSize: [255, 255],
      pos: state.pos,
      u_diffuse: textures.fromCanvas,
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

    Object.assign(state, {
      pos: [view.a, view.b, zoom]
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
