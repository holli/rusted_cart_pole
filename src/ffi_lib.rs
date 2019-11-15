use crate::cart_pole::*;

use piston_window::{PistonWindow, WindowSettings};
use plotters::prelude::*;

// #[no_mangle]
// pub extern fn callable_from_c(x: i32) -> i32 {
//     x * 2 + 1
// }

#[no_mangle]
pub extern fn new() -> *mut CartPole {
    let t = CartPole::new();
    Box::into_raw(Box::new(t))
}

#[no_mangle]
pub extern fn free(ptr: *mut CartPole) {
    println!("Freeing cartpole from Rust");
    if ptr.is_null() { return; }
    unsafe {
        Box::from_raw(ptr);
    }
}

#[no_mangle]
pub extern fn reset(ptr: *mut CartPole) {
    assert!(!ptr.is_null());
    let cp = unsafe { &mut *ptr };
    cp.reset();
}

#[no_mangle]
pub extern fn status(ptr: *const CartPole){
    assert!(!ptr.is_null());
    let cp = unsafe { &*ptr };
    println!("rusted_cart_pole status(): {}", cp);
}

#[no_mangle]
pub extern fn step(ptr: *mut CartPole, force: f32) -> i32 {
    assert!(!ptr.is_null());
    let cp = unsafe { &mut *ptr };
    let reward = cp.step(force);
    println!("New status: {}", cp);
    reward
}

#[no_mangle]
pub extern fn window_new() -> *mut PistonWindow {
    let window: PistonWindow = WindowSettings::new("Hello Piston!", (800, 600))
        .exit_on_esc(true)
        // .controllers(false) // should they listen controller input
        .samples(1)
        .build()
        .unwrap_or_else(|e| { panic!("Failed to build PistonWindow: {}", e) });
    Box::into_raw(Box::new(window))
}

#[no_mangle]
pub extern fn window_free(window: *mut PistonWindow) {
    println!("Freeing window from Rust");
    if window.is_null() { return; }
    unsafe {
        Box::from_raw(window);
    }
}

#[no_mangle]
pub extern fn window_draw(window: *mut PistonWindow, cp: *const CartPole) {
    let window = unsafe { &mut *window };
    let cp = unsafe { &*cp };

    draw_piston_window(window, |b| {
        cp.draw(b.into_drawing_area())?;
        Ok(())
    });
}

