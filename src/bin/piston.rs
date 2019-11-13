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
use plotters::coord::Shift;


pub struct PlotterCartPole<DB: DrawingBackend> {
    root_area: DrawingArea<DB, Shift>,
}

impl<DB: DrawingBackend> PlotterCartPole<DB> {
    pub fn cp_test(cp: CartPole, root: DrawingArea<DB, Shift>){
        println!("CHARTPUILD");
    }
}

// #[allow(dead_code)]
// // fn plotter_cart_pole_test(cp: CartPole, root: DrawingArea<PistonBackend, plotters::coord::Shift>){
// // fn plotter_cart_pole_test(cp: CartPole, root: DrawingArea<dyn DrawingBackend, plotters::coord::Shift>){
// // fn plotter_cart_pole_test<T: DrawingArea>(cp: CartPole, root: T){
// // fn plotter_cart_pole_test(cp: CartPole, root: DrawingArea<dyn DrawingBackend<ErrorType = DummyBackendError>, plotters::coord::Shift>){
// // fn plotter_cart_pole_test(cp: CartPole, root: DrawingArea<dyn DrawingBackend<ErrorType = &std::io::Error>, plotters::coord::Shift>){
// fn plotter_cart_pole_test(cp: CartPole, root: &'a DrawingArea<dyn DrawingBackend, plotters::coord::Shift>){
// fn plotter_cart_pole<T: DrawingBackend>(cp: CartPole, root: DrawingArea<T, plotters::coord::Shift>){

fn plotter_cart_pole<T: DrawingBackend>(cp: CartPole, root: DrawingArea<T, plotters::coord::Shift>){
    root.fill(&colors::WHITE);
    root.fill(&colors::BLUE);

    let y = 400;
    // root.draw(&Rectangle::new([(10, 10), (100, 100)], Into::<ShapeStyle>::into(color).filled()));
    root.draw(&Rectangle::new([(0, y), (800, y+1)], Into::<ShapeStyle>::into(&colors::BLACK).filled()));
}


// fn plotter_cart_pole(cp: CartPole, b: PistonBackend){
// fn plotter_cart_pole(cp: CartPole, root: dyn DrawingBackend){

    // let root = b.into_drawing_area();

    // root.fill(&colors::WHITE);

    // let y = 400;
    // // root.draw(&Rectangle::new([(10, 10), (100, 100)], Into::<ShapeStyle>::into(color).filled()));
    // root.draw(&Rectangle::new([(0, y), (800, y+1)], Into::<ShapeStyle>::into(&colors::BLACK).filled()));

    // // let x = (cp.x+CARTPOLE_MAX_X) * self.window_size.x/(2.0*CARTPOLE_MAX_X);
    // let x = (cp.x+CARTPOLE_MAX_X) * 800.0/(2.0*CARTPOLE_MAX_X);
    // // let y = self.window_size.y - 10.0;
    // let x_width = 100.0;

    // // let screen_size = window.screen_size();

    // // Cart
    // root.draw(&Rectangle::new([(0, y), (800, y+1)], Into::<ShapeStyle>::into(&colors::BLACK).filled()));
    // root.draw(&Rectangle::new([((x-x_width/2.0) as i32, y-10), ((x+x_width/2.0) as i32, y+10)], Into::<ShapeStyle>::into(&colors::BLACK).filled()));

    // // Pole
    // let pole_length = 100.0;
    // let pole_x = pole_length * cp.pole_angle.sin();
    // let pole_y = (pole_length * cp.pole_angle.cos()) as i32;
    // let points = [(x as i32, y as i32), ((x+pole_x) as i32, (y-pole_y) as i32)];
    // root.draw(&PathElement::new(points.to_vec(),
    //                             Into::<ShapeStyle>::into(&colors::BLACK).filled()));
// }


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
            if keys.left && !keys.right {
                cp.step(-1.0);
            } else if !keys.left && keys.right {
                cp.step(1.0);
            } else {
                cp.step(0.0);
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
                // plotter_cart_pole(cp, b);
                plotter_cart_pole(cp, b.into_drawing_area());
                // root.fill(&RGBColor(100, 100, 100)).expect("Not able to draw");

            });
        }

    }

}
