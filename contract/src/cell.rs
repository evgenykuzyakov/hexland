use crate::*;
use near_sdk::serde::Serializer;

pub const CELL_SIZE: u32 = 16;
pub const CELL_SIZE_2: u32 = CELL_SIZE * CELL_SIZE;
pub const NUM_LEVELS: u8 = 5;

pub const MAX_SIZE: u32 = CELL_SIZE.pow(NUM_LEVELS as u32);

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Eq, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct CellId {
    pub level: u8,
    pub x: u32,
    pub y: u32,
}

pub fn serialize_array<S, T>(array: &[T], serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
    T: Serialize,
{
    array.serialize(serializer)
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Cell {
    pub nonce: u64,
    #[serde(serialize_with = "serialize_array")]
    pub colors: [u32; CELL_SIZE_2 as usize],
}

impl Default for Cell {
    fn default() -> Self {
        Cell {
            nonce: 0,
            colors: [0u32; CELL_SIZE_2 as usize],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize)]
pub enum VCell {
    Current(Cell),
}

impl From<VCell> for Cell {
    fn from(v: VCell) -> Self {
        match v {
            VCell::Current(c) => c,
        }
    }
}

impl From<Cell> for VCell {
    fn from(c: Cell) -> Self {
        VCell::Current(c)
    }
}

impl Cell {
    pub fn avg_color(&self) -> u32 {
        let mut b = 0;
        let mut g = 0;
        let mut r = 0;
        for &c in &self.colors {
            b += c & 0xff;
            g += (c & 0xff00) >> 8;
            r += (c & 0xff0000) >> 16;
        }
        ((r >> 8) << 16) | ((g >> 8) << 8) | (b >> 8)
    }
}

impl Contract {
    pub fn internal_unwrap_cell(&self, cell_id: &CellId) -> Cell {
        self.internal_get_cell(cell_id).expect("Cell is not found")
    }

    pub fn internal_get_cell(&self, cell_id: &CellId) -> Option<Cell> {
        self.cells.get(cell_id).map(|o| o.into())
    }

    pub fn internal_unwrap_cell_or_default(&mut self, cell_id: &CellId) -> Cell {
        self.internal_get_cell(cell_id).unwrap_or_default()
    }

    pub fn internal_set_cell(&mut self, cell_id: &CellId, cell: Cell) {
        self.cells.insert(cell_id, &cell.into());
    }

    pub fn save_compute_tree(&mut self, mut cell_id: CellId, cell: Cell) {
        let mut avg_color = cell.avg_color();
        self.internal_set_cell(&cell_id, cell);
        for level in 1..NUM_LEVELS {
            let upper_cell_id = CellId {
                level,
                x: cell_id.x / CELL_SIZE,
                y: cell_id.y / CELL_SIZE,
            };
            let mut cell = self.internal_unwrap_cell_or_default(&upper_cell_id);
            let off_x = cell_id.x - upper_cell_id.x * CELL_SIZE;
            let off_y = cell_id.y - upper_cell_id.y * CELL_SIZE;
            let index = (off_y * CELL_SIZE + off_x) as usize;
            let sub_nonce = ((cell.colors[index] >> 24) + 1) & 0xff;
            cell.nonce += 1;
            cell.colors[index] = (sub_nonce << 24) | avg_color;
            if level + 1 < NUM_LEVELS {
                avg_color = cell.avg_color();
            }
            cell_id = upper_cell_id;
            self.internal_set_cell(&cell_id, cell);
        }
    }
}
