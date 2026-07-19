include!("render_api.rs");
include!("render_core.rs");
include!("commit_items.rs");
include!("evidence.rs");
include!("period_content.rs");

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SubPeriod;
    use crate::report::*;
    use chrono::NaiveDate;
    use std::fs;

    include!("tests_core.rs");
    include!("tests_render.rs");
    include!("tests_period.rs");
    include!("tests_batch.rs");
}
