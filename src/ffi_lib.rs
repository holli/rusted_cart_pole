use crate::cart_pole::*;

use piston_window::{PistonWindow, WindowSettings};
use plotters::prelude::*;

// #[no_mangle]
// pub extern fn callable_from_c(x: i32) -> i32 {
//     x * 2 + 1
// }

#[no_mangle]
pub extern "C" fn new() -> *mut CartPole {
    let t = CartPole::new();
    Box::into_raw(Box::new(t))
}

#[no_mangle]
pub extern "C" fn free(ptr: *mut CartPole) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        Box::from_raw(ptr);
    }
}

#[no_mangle]
pub extern "C" fn reset(ptr: *mut CartPole) {
    assert!(!ptr.is_null());
    let cp = unsafe { &mut *ptr };
    cp.reset();
}

#[no_mangle]
pub extern "C" fn status(ptr: *const CartPole) {
    assert!(!ptr.is_null());
    let cp = unsafe { &*ptr };
    println!("rusted_cart_pole status(): {}", cp);
}

#[no_mangle]
pub extern "C" fn step(ptr: *mut CartPole, force: f32) -> i32 {
    assert!(!ptr.is_null());
    let cp = unsafe { &mut *ptr };
    let reward = cp.step(force);
    reward
}

#[no_mangle]
pub extern "C" fn window_new() -> *mut PistonWindow {
    let window: PistonWindow = WindowSettings::new("RustedCartPole", (800, 400))
        .exit_on_esc(true)
        // .controllers(false) // should they listen controller input
        .samples(1)
        .build()
        .unwrap_or_else(|e| panic!("Failed to build PistonWindow: {}", e));
    Box::into_raw(Box::new(window))
}

#[no_mangle]
pub extern "C" fn window_free(window: *mut PistonWindow) {
    if window.is_null() {
        return;
    }
    unsafe {
        Box::from_raw(window);
    }
}

#[no_mangle]
pub extern "C" fn window_draw(window: *mut PistonWindow, cp: *const CartPole) {
    let window = unsafe { &mut *window };
    let cp = unsafe { &*cp };

    draw_piston_window(window, |b| {
        cp.draw(b.into_drawing_area())?;
        Ok(())
    });
}
