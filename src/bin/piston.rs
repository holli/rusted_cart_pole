#[allow(unused_imports)]
use std::panic;
#[allow(unused_imports)]
use piston_window::{EventLoop, PistonWindow, WindowSettings};
use piston::input::*;
use piston::event_loop::*;
use plotters::prelude::*;
#[allow(unused_imports)]
use plotters::style::colors;
// use std::collections::vec_deque::VecDeque;
// use piston_window::{circle_arc, ellipse, line, rectangle, Event, Loop};
extern crate piston_window;
// #[allow(unused_imports)]
use rusted_cart_pole::*;
// use plotters::coord::Shift;


fn main() {
    struct Keys { left: bool, right: bool };
    let mut keys = Keys { left: false, right: false };

    let mut window: PistonWindow = WindowSettings::new("Hello Piston!", (800, 600))
        .exit_on_esc(true)
        // .controllers(false) // should they listen controller input
        .samples(1)
        .build()
        .unwrap_or_else(|e| { panic!("Failed to build PistonWindow: {}", e) });

    // let mut events = Events::new(EventSettings::new());
    let mut events = Events::new(EventSettings::new().ups(20));

    let mut cp = CartPole::new();

    // while let Some(event) = window.next() {
    while let Some(event) = events.next(&mut window) {

        // Saving keypresses to keys struct
        if let Some(Button::Keyboard(key)) = event.press_args() {
            match key {
                Key::Left => { keys.left = true }
                Key::Right => { keys.right = true }
                _ => {}
            }
        }
        if let Some(Button::Keyboard(key)) = event.release_args() {
            match key {
                Key::Left => { keys.left = false }
                Key::Right => { keys.right = false }
                _ => {}
            }
        }

        // Piston tries to keep update_args happening at a constant rate
        if event.update_args().is_some() {
            let force = if keys.left && !keys.right {
                -1.0
            } else if !keys.left && keys.right {
                1.0
            } else {
                0.0
            };
            let reward = cp.step(force);
            if reward == 0 {
                // println!("CartPole ended, step count {}. {}", cp.step_count, cp);
                println!("CartPole ended, {}", cp);
                cp.reset();
            }
        }

        // Rendering stuff at a constant rate
        if let Some(arg) = event.render_args() {

            window.draw_2d(&event, |c, g, _| {

                let b = PistonBackend {
                    size: (arg.draw_size[0], arg.draw_size[1]),
                    scale: arg.window_size[0] / arg.draw_size[0] as f64,
                    context: c, graphics: g,
                };

                cp.draw(b.into_drawing_area()).expect("Problem in plotter_cart_pole drawing.");

            });
        }

    }

}
