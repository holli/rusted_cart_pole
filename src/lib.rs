mod cart_pole;
pub use cart_pole::*;

#[cfg(not(target_arch="wasm32"))]
mod ffi_lib;
#[cfg(not(target_arch="wasm32"))]
pub use ffi_lib::*;


#[cfg(target_arch="wasm32")]
use wasm_bindgen::prelude::*;

// #[cfg(target_arch="wasm32")]
// #[wasm_bindgen]
// extern {
//     fn alert(s: &str);
// }

// #[cfg(target_arch="wasm32")]
// #[wasm_bindgen]
// pub fn greet() {
//     // alert("Hello, from rust!");
//     web_sys::console::log_1(&format!("Hello log from rust").into());
// }

#[cfg(target_arch="wasm32")]
#[wasm_bindgen]
pub fn wasm_setup() {
    web_sys::console::log_1(&format!("Rust wasm_setup()").into());
    // https://github.com/rustwasm/console_error_panic_hook#readme
    console_error_panic_hook::set_once();
}

