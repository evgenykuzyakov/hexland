const allCells = {};

const Limit = 16;
const CellSize = 16;
const CellSize2 = CellSize * CellSize;
const NumLevels = 3;
const MaxNumberLevels = 5;
const MaxSize = Math.pow(CellSize, MaxNumberLevels);
export const StartOffsetX = MaxSize / 2;
export const StartOffsetY = MaxSize / 2;

const RootCellId = {
  level: NumLevels,
  x: StartOffsetX / Math.pow(CellSize, NumLevels + 1),
  y: StartOffsetY / Math.pow(CellSize, NumLevels + 1),
};

const intToColor = (c) => `#${(c & 0xffffff).toString(16).padStart(6, "0")}`;
const s = (c) => JSON.stringify(c);
const p = (c) => JSON.parse(c);

export class Board {
  constructor(contract, ctx, redraw) {
    this.contract = contract;
    this.ctx = ctx;
    this.redraw = redraw;

    this.needRedraw = false;
  }

  async fetchCells(cellIds) {
    const cells = await this.contract.get_cells_json({cell_ids: cellIds});
    return cellIds.reduce((acc, cellId, i) => {
      acc[s(cellId)] = cells[i];
      return acc;
    }, {})
  }

  getCell(cellId) {
    const cellIdStr = s(cellId);
    if (cellIdStr in allCells) {
      return allCells[cellIdStr]
    } else {
      return {
        nonce: 0,
        colors: new Array(CellSize2).fill(0),
      }
    }
  }

  setCell(cellId, cell) {
    allCells[s(cellId)] = cell;
  }

  internalPaint(cellId, color) {
    if (!(s(cellId) in allCells)) {
      const w = Math.pow(CellSize, cellId.level + 1);
      const x = cellId.x * w - StartOffsetX;
      const y = cellId.y * w - StartOffsetY;
      this.ctx.fillStyle = intToColor(color);
      this.ctx.fillRect(x, y, w, w);
      this.needRedraw = true;
    }
  }

  internalRender(cellId, cell) {
    const imageData = this.ctx.createImageData(CellSize, CellSize);
    const data = imageData.data;
    let off = 0;
    for (let i = 0; i < CellSize; ++i) {
      for (let j = 0; j < CellSize; ++j) {
        const index = i * CellSize + j;
        const color = cell.colors[index];
        data[off++] = (color >> 16) & 0xff;
        data[off++] = (color >> 8) & 0xff;
        data[off++] = color & 0xff;
        data[off++] = 255;
      }
    }
    const w = Math.pow(CellSize, cellId.level + 1);
    const x = cellId.x * w - StartOffsetX;
    const y = cellId.y * w - StartOffsetY;
    this.ctx.putImageData(imageData, x, y);
    this.needRedraw = true;
  }

  internalRedraw() {
    if (this.needRedraw) {
      this.needRedraw = false;
      this.redraw();
    }
  }

  async refreshCells() {
    const q = [RootCellId];
    while (q.length > 0) {
      const cellIds = q.splice(0, Limit);
      const newCells = await this.fetchCells(cellIds);
      // console.log(newCells);
      Object.entries(newCells).forEach(([cellId, cell]) => {
        if (cell) {
          cellId = p(cellId);
          console.log(cellId, cell)
          if (cellId.level === 0) {
            this.internalRender(cellId, cell);
          } else {
            let oldCell = this.getCell(cellId);
            if (cell.nonce !== oldCell.nonce) {
              for (let i = 0; i < CellSize; ++i) {
                for (let j = 0; j < CellSize; ++j) {
                  const index = i * CellSize + j;
                  if (cell.colors[index] !== oldCell.colors[index]) {
                    const newCellId = {
                      level: cellId.level - 1,
                      x: cellId.x * CellSize + j,
                      y: cellId.y * CellSize + i,
                    };
                    this.internalPaint(newCellId, cell.colors[index]);
                    q.push(newCellId);
                  }
                }
              }
            }
          }
          this.setCell(cellId, cell);
        }
      });
      this.internalRedraw();
    }
  }
};
