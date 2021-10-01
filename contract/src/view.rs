use crate::*;

#[near_bindgen]
impl Contract {
    pub fn get_cells_json(&self, cell_ids: Vec<CellId>) -> Vec<Option<Cell>> {
        self.internal_get_cells(cell_ids)
    }

    #[result_serializer(borsh)]
    pub fn get_cells_borsh(&self, #[serializer(borsh)] cell_ids: Vec<CellId>) -> Vec<Option<Cell>> {
        self.internal_get_cells(cell_ids)
    }

    pub fn get_storage_balance(&self, account_id: ValidAccountId) -> Option<WrappedBalance> {
        self.accounts.get(account_id.as_ref()).map(|b| b.into())
    }
}

impl Contract {
    pub fn internal_get_cells(&self, cell_ids: Vec<CellId>) -> Vec<Option<Cell>> {
        cell_ids
            .into_iter()
            .map(|cell_id| self.internal_get_cell(&cell_id))
            .collect()
    }
}
