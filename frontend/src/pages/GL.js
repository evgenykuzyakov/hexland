import React, {useEffect, useRef} from 'react';
import * as twgl from 'twgl-base.js';
import vs from '../shaders/vs';
import fs from '../shaders/fs';
import {Board} from "../components/Board";


const Sq3 = Math.sqrt(3.0) / 2;
const DxA = Sq3 * 2;
const DyA = 0;
const DxB = Sq3;
const DyB = 1.5;

const InitialZoom = 1;
const MinZoom = 1 / 64;

const TexSize = 2048;

let lastMousePos = null;
let isDrawMode = false;
let view = {
  a: 0,
  b: 0,
  zoom: InitialZoom,
  aspect: 1,
};


function setupRender(berryclub, gl) {
  const programInfo = twgl.createProgramInfo(gl, [vs, fs])

  const arrays = {
    a_position: [
      -Sq3 - Sq3/2, 0.75, 0,
      Sq3 - Sq3/2, 0.75, 0,
      0 - Sq3/2, -0.75, 0,

      Sq3 - Sq3/2, 0.75, 0,
      Sq3 * 2 - Sq3/2, -0.75, 0,
      0 - Sq3/2, -0.75, 0,
    ],
    a_texcoord: [
      0, 0,
      1, 0,
      0, 1,

      1, 0,
      1, 1,
      0, 1,
    ],
    a_ab: {
      numComponents: 2, data: [
        -0.5, -0.5,
        TexSize - 0.5, -0.5,
        -0.5, TexSize - 0.5,

        TexSize - 0.5, -0.5,
        TexSize - 0.5, TexSize - 0.5,
        -0.5, TexSize - 0.5,
      ]
    }
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  const canvas = document.createElement('canvas');
  canvas.width = TexSize;
  canvas.height = TexSize;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, TexSize, TexSize);
  // ctx.fillStyle = '#222222';
  // ctx.fillRect(0, 0, TexSize, TexSize);

  const textures = twgl.createTextures(gl, {
    fromCanvas: { src: canvas, mag: gl.NEAREST, min: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE },
  });

  const board = new Board(berryclub, ctx, () => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 1, 1);
    twgl.setTextureFromElement(gl, textures.fromCanvas, canvas);
  });

  board.refreshCells();
  setInterval(() => {
    board.refreshCells();
  }, 5000);

  function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    twgl.bindFramebufferInfo(gl, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const uniforms = {
      resolution: [gl.canvas.width, gl.canvas.height],
      texSize: [TexSize - 1, TexSize - 1],
      pos: [view.a, view.b, view.zoom],
      u_diffuse: textures.fromCanvas,
    };
    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  return board;
}

function dxdyToAb(dx, dy) {
  const b = dy / DyB;
  const a = (dx - b * DxB) / DxA;
  return {
    a, b,
  }
}

function GlPage(props) {
  const canvasEl = useRef(null);
  const berryclub = props._near.contract;

  const propsDraw = props.draw;
  useEffect(() => {
    isDrawMode = propsDraw;
  }, [propsDraw]);

  useEffect(() => {
    if (canvasEl.current && berryclub) {
      console.log("Setup");
      const ctx = canvasEl.current.getContext('webgl');

      const drawNow = async (ab) => {
        let a = (view.a + ab.a / view.zoom + 0.5) * TexSize - 0.5;
        let b = (view.b + ab.b / view.zoom + 0.5) * TexSize - 0.5;

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
        board.draw(best);
      }

      const board = setupRender(berryclub, ctx);
      canvasEl.current.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        const rect = e.target.getBoundingClientRect();
        const dx = ((x - rect.x) / rect.width - 0.5);
        const dy = ((y - rect.y) / rect.width - rect.height / rect.width * 0.5);
        const ab = dxdyToAb(dx, dy);
        if ((e.buttons & 1) && isDrawMode) {
          drawNow(ab);
        } else if (lastMousePos && !isDrawMode) {
          const dx = (x - lastMousePos.x) / rect.width;
          const dy = (y - lastMousePos.y) / rect.width;
          const {a, b} = dxdyToAb(dx, dy);
          view = {
            a: view.a - a / view.zoom,
            b: view.b - b / view.zoom,
            zoom: view.zoom,
            aspect: view.aspect,
          };
        }
        if (e.buttons & 1) {
          lastMousePos = {x, y};
        } else {
          lastMousePos = null;
        }
      });


      canvasEl.current.addEventListener('mousedown', (e) => {
        if ((e.buttons & 1) && isDrawMode) {
          const x = e.clientX;
          const y = e.clientY;
          const rect = e.target.getBoundingClientRect();
          const dx = ((x - rect.x) / rect.width - 0.5);
          const dy = ((y - rect.y) / rect.width - rect.height / rect.width * 0.5);
          drawNow(dxdyToAb(dx, dy));
        }
      });

      canvasEl.current.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = e.target.getBoundingClientRect();
        const dx = ((e.clientX - rect.x) / rect.width - 0.5);
        const dy = ((e.clientY - rect.y) / rect.width - rect.height / rect.width * 0.5);
        const mb = dy / DyB;
        const ma = (dx - mb * DxB) / DxA;

        const newZoom = Math.max(MinZoom, view.zoom * Math.exp(-e.deltaY * 0.001));
        const oa = view.a + ma / view.zoom;
        const ob = view.b + mb / view.zoom;
        const va = oa - ma / newZoom;
        const vb = ob - mb / newZoom;

        view = {
          a: va,
          b: vb,
          zoom: newZoom,
          aspect: view.aspect,
        };

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
        view = Object.assign({}, view, {aspect: height / width})
      };

      window.addEventListener('resize', resize);

      resize();

    }
  }, [canvasEl, berryclub])

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
