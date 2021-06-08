import "./Home.scss";
import React, {useCallback, useEffect, useRef, useState} from 'react';
import * as twgl from 'twgl-base.js';
import vs from '../shaders/vs';
import fs from '../shaders/fs';

let lastMousePos = null;
const Sq3 = Math.sqrt(3.0) / 2;
const DxA = Sq3 * 2;
const DyA = 0;
const DxB = Sq3;
const DyB = 1.5;

const InitialZoom = 1;
const MinZoom = 1 / 64;

const TexSize = 2048;

const state = {
  pos: [0, 0, 1],
};

const BoardHeight = 50;
const BoardWidth = 50;
const ExpectedLineLength = 4 + 8 * BoardWidth;

const decodeLine = (line) => {
  let buf = Buffer.from(line, 'base64');
  if (buf.length !== ExpectedLineLength) {
    throw new Error("Unexpected encoded line length");
  }
  let pixels = []
  for (let i = 4; i < buf.length; i += 8) {
    let color = buf.readUInt32LE(i);
    // let ownerIndex = buf.readUInt32LE(i + 4);
    pixels.push(color);
  }
  return pixels;
};

async function viewPixelBoard(berryclub, blockId) {
  const args = {lines: [...Array(BoardHeight).keys()]};
  const rawResult = await berryclub.connection.provider.query({
    request_type: 'call_function',
    block_id: blockId,
    finality: blockId ? undefined : 'optimistic',
    account_id: berryclub.accountId,
    method_name: 'get_lines',
    args_base64: Buffer.from(JSON.stringify(args), 'utf8').toString('base64'),
  });
  const result = rawResult.result && rawResult.result.length > 0 && JSON.parse(Buffer.from(rawResult.result).toString());
  const lines = result.map(decodeLine);
  const imageData = new Uint8ClampedArray(50 * 50 * 4);
  let n = 0;
  lines.forEach((line, i) => {
    const width = line.length;
    for (let i = 0; i < width; i++) {
      const color = line[i];
      imageData[n] = ((color >> 16) & 0xff);
      imageData[n + 1] = ((color >> 8) & 0xff);
      imageData[n + 2] = (color & 0xff);
      imageData[n + 3] = 255;
      n += 4;
    }
  });

  return new ImageData(imageData, 50);
}


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

  const rnd = (w) => Math.floor(Math.random() * (TexSize - w));

  const rendering = setInterval(() => {
    viewPixelBoard(berryclub, 22000000 + Math.floor(Math.random() * 10000000))
      .then((img) => {
        for (let i = 0; i < 10; ++i) {
          ctx.putImageData(img, rnd(50), rnd(50));
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, 1, 1);
        twgl.setTextureFromElement(gl, textures.fromCanvas, canvas);
      })
      .catch((e) => {
        console.log(e);
      })
  }, 100);

  setTimeout(() => {
    clearInterval(rendering);
  }, 60 * 1000);

  /*
  const ww = 100;
  const _bleeding = setInterval(() => {
    const x = rnd(ww);
    const y = rnd(ww);
    const img = ctx.getImageData(x, y, ww, ww);
    const d = img.data;
    for (let i = 1; i < ww - 1; ++i) {
      for (let j = 1; j < ww - 1; ++j) {
        let outputOffset = (i * ww + j) * 4;
        const x = j + Math.round(Math.random() * 2) - 1;
        const y = i + Math.round(Math.random() * 2) - 1;
        let inputOffset = (y * ww + x) * 4;
        d[outputOffset] = d[inputOffset];
        d[outputOffset + 1] = d[inputOffset + 1];
        d[outputOffset + 2] = d[inputOffset + 2];
        d[outputOffset + 3] = d[inputOffset + 3];
      }
    }
    ctx.putImageData(img, x, y);
    ctx.fillRect(0, 0, 1, 1);
    twgl.setTextureFromElement(gl, textures.fromCanvas, canvas);
  }, 100);
  */

  function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    twgl.bindFramebufferInfo(gl, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const uniforms = {
      resolution: [gl.canvas.width, gl.canvas.height],
      texSize: [TexSize - 1, TexSize - 1],
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

  const berryclub = props._near.berryclub;

  useEffect(() => {
    if (canvasEl.current && berryclub) {
      const ctx = canvasEl.current.getContext('webgl');
      setCtx(ctx);

      setupRender(berryclub, ctx);
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
