mod cart_pole;
// pub use cart_pole::CartPole;
pub use cart_pole::*;

// use plotters::prelude::*;
// use plotters::style::colors;

// pub extern fn testing_imp() {
pub fn testing_imp() {
    println!("AND INSIDE lib.rs/testing()")
}


#[cfg(target_arch="wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch="wasm32")]
#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

// use log::Level;

#[cfg(target_arch="wasm32")]
#[wasm_bindgen]
pub fn greet() {
    // alert("Hello, from rust!");

    web_sys::console::log_1(&format!("Hello log from rust").into());
}
