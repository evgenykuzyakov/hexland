use crate::*;
use near_sdk::StorageUsage;

pub const MAX_COLOR: u32 = 256u32.pow(3);
pub const MIN_STORAGE_BYTES: StorageUsage = 125;

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Pixel {
    pub x: u32,
    pub y: u32,
    pub c: u32,
}

impl Pixel {
    pub fn assert_valid(&self) {
        assert!(self.x < MAX_SIZE);
        assert!(self.y < MAX_SIZE);
        assert!(self.c < MAX_COLOR);
    }
}

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn draw_json(&mut self, pixels: Vec<Pixel>) {
        self.internal_draw(pixels);
    }

    #[payable]
    pub fn draw_borsh(&mut self, #[serializer(borsh)] pixels: Vec<Pixel>) {
        self.internal_draw(pixels);
    }
}

impl Contract {
    pub fn internal_draw(&mut self, pixels: Vec<Pixel>) {
        let initial_storage_usage = env::storage_usage();

        let mut last_cell_id = None;
        let mut last_cell = None;
        for pixel in pixels {
            pixel.assert_valid();
            let cell_id = CellId {
                level: 0,
                x: pixel.x / CELL_SIZE,
                y: pixel.y / CELL_SIZE,
            };
            let off_x = pixel.x - cell_id.x * CELL_SIZE;
            let off_y = pixel.y - cell_id.y * CELL_SIZE;
            if Some(&cell_id) != last_cell_id.as_ref() {
                if let Some(last_cell) = last_cell {
                    self.save_compute_tree(last_cell_id.unwrap(), last_cell);
                }
                last_cell = Some(self.internal_unwrap_cell_or_default(&cell_id));
                last_cell.as_mut().unwrap().nonce += 1;
                last_cell_id = Some(cell_id);
            }
            last_cell.as_mut().unwrap().colors[(off_y * CELL_SIZE + off_x) as usize] = pixel.c;
        }
        if let Some(last_cell) = last_cell {
            self.save_compute_tree(last_cell_id.unwrap(), last_cell);
        }

        let final_storage_usage = env::storage_usage();
        let attached_deposit = env::attached_deposit();

        if initial_storage_usage != final_storage_usage || attached_deposit > 0 {
            let account_id = env::predecessor_account_id();
            let mut extra_bytes = final_storage_usage - initial_storage_usage;
            let mut balance = if let Some(balance) = self.accounts.get(&account_id) {
                balance
            } else {
                extra_bytes += MIN_STORAGE_BYTES;
                0
            };
            balance += attached_deposit;
            let required_deposit = Balance::from(extra_bytes) * env::storage_byte_cost();
            assert!(
                balance >= required_deposit,
                "Not enough deposit for storage"
            );
            balance -= required_deposit;
            self.accounts.insert(&account_id, &balance);
        }
    }
}
