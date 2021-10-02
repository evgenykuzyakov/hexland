import Big from "big.js";

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

const MinBalance = Big(10).pow(23);
const DrawGas = Big(100).mul(Big(10).pow(12)).toFixed(0);
const UnclaimedDefaultColor = 0x333333;

const intToColor = (c) => `#${(c & 0xffffff).toString(16).padStart(6, "0")}`;
const s = (c) => JSON.stringify(c);
const p = (c) => JSON.parse(c);
const p2c = (p) => ({
  x: Math.trunc(p.x / CellSize),
  y: Math.trunc(p.y / CellSize),
  level: 0,
});

const BatchOfPixels = 100;
const BatchTimeout = 250;

export class Board {
  constructor(contract, ctx, redraw) {
    this.contract = contract;
    this.setState = contract.setState;
    this.refreshAllowance = contract.refreshAllowance;
    this.ctx = ctx;
    this.redraw = redraw;
    this.pixelQueue = [];
    this.pendingPixels = [];
    this.pending = {};
    this.sendQueueTimer = null;
    this.numFailedTxs = 0;

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
      this.ctx.fillStyle = intToColor(color || UnclaimedDefaultColor);
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

  async refreshAccountBalance() {
    const balance = Big(await this.contract.get_storage_balance({
      account_id: this.contract.account.accountId
    }) || "0");
    this.setState({
      accountBalance: balance,
    });
    return balance;
  }

  async sendQueue() {
    this.pixelQueue.sort((a, b) => s(p2c(a)).localeCompare(s(p2c(b))))
    const pixels = this.pixelQueue.splice(0, BatchOfPixels);
    this.pendingPixels = pixels;

    const balance = await this.refreshAccountBalance();

    try {
      await this.contract.draw_json({
        pixels
      }, DrawGas, balance.lt(MinBalance) ? "1000000000000000000000000" : "0");
      this.numFailedTxs = 0;
    } catch (error) {
      const msg = error.toString();
      if (msg.indexOf("does not have enough balance") !== -1) {
        await this.refreshAllowance();
        return;
      }
      console.log("Failed to send a transaction", error);
      this.numFailedTxs += 1;
      if (this.numFailedTxs < 3) {
        this.pixelQueue = this.pixelQueue.concat(this.pendingPixels);
        this.pendingPixels = [];
      } else {
        this.pendingPixels = [];
        this.pixelQueue = [];
      }
    }
    try {
      await this.refreshAccountBalance();
    } catch (e) {
      // ignore
    }
    this.pendingPixels.forEach((p) => delete this.pending[s(p)]);
    this.pendingPixels = [];
  }

  async pingQueue(ready) {
    if (this.sendQueueTimer) {
      clearTimeout(this.sendQueueTimer);
      this.sendQueueTimer = null;
    }

    if (
      this.pendingPixels.length === 0 &&
      (this.pixelQueue.length >= BatchOfPixels || ready)
    ) {
      await this.sendQueue();
    }
    if (this.pixelQueue.length > 0) {
      this.sendQueueTimer = setTimeout(async () => {
        await this.pingQueue(true);
      }, BatchTimeout);
    }
  }

  modifyPixel(p) {
    const cellId = p2c(p);
    const cell = this.getCell(cellId);
    const index = (p.y - cellId.y * CellSize) * CellSize + p.x - cellId.x * CellSize;
    cell.colors[index] = p.c;

    const x = p.x - StartOffsetX;
    const y = p.y - StartOffsetY;
    this.ctx.fillStyle = intToColor(p.c);
    this.ctx.fillRect(x, y, 1, 1);
    this.needRedraw = true;
    setTimeout(() => {
      this.internalRedraw();
    }, 100)
  }

  draw(ab) {
    const c = 0xffffff;
    const p = {
      x: StartOffsetX + ab.a,
      y: StartOffsetY + ab.b,
      c,
    };
    const sp = s(p);
    if (!(sp in this.pending)) {
      this.pending[sp] = true;
      this.pixelQueue.push(p);

      this.modifyPixel(p);
    }

    this.pingQueue(false);
  }

  async refreshCells() {
    const q = [RootCellId];
    while (q.length > 0) {
      const cellIds = q.splice(0, Limit);
      const newCells = await this.fetchCells(cellIds);
      Object.entries(newCells).forEach(([cellId, cell]) => {
        if (cell) {
          cellId = p(cellId);
          if (cellId.level === 0) {
            this.internalRender(cellId, cell);
          } else {
            let oldCell = this.getCell(cellId);
            if (cell.nonce !== oldCell.nonce) {
              for (let i = 0; i < CellSize; ++i) {
                for (let j = 0; j < CellSize; ++j) {
                  const index = i * CellSize + j;
                  const newCellId = {
                    level: cellId.level - 1,
                    x: cellId.x * CellSize + j,
                    y: cellId.y * CellSize + i,
                  };
                  this.internalPaint(newCellId, cell.colors[index]);
                  if (cell.colors[index] !== oldCell.colors[index]) {
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
