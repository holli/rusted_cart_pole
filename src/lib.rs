mod cart_pole;
use cart_pole::CartPole;

#[no_mangle]
pub extern fn callable_from_c(x: i32) -> i32 {
    x * 2 + 1
}

#[no_mangle]
pub extern fn new() -> *mut CartPole {
    let t = CartPole::new();
    Box::into_raw(Box::new(t))
}

#[no_mangle]
pub extern fn free(ptr: *mut CartPole) {
    println!("Freeing memory from Rust");
    if ptr.is_null() { return; }
    unsafe {
        Box::from_raw(ptr);
    }
}

#[no_mangle]
pub extern fn status(ptr: *const CartPole) -> CartPole {
    assert!(!ptr.is_null());
    let cp = unsafe { &*ptr };
    // let mut cp = &mut *ptr;
    // cp.x = 12.0;
    println!("Inside status {} {}", cp.x, cp.velocity);
    *cp
}

#[no_mangle]
pub extern fn step(ptr: *mut CartPole, force: f32) {
    assert!(!ptr.is_null());
    let cart_pole = unsafe { &mut *ptr };
    cart_pole.step(force);
    println!("New status: {}", cart_pole);
}


//////////////////////////////////////////////////////////////////////////
/// Draw related things

#[no_mangle]
pub extern fn draw_new() -> *mut Draw {
    let t = Draw::new();
    let mut settings = Settings::default();
    settings.update_rate = (cart_pole::CARTPOLE_UPDATE_TIMESTEP as f64) * 1000.0;
    settings.update_rate *= 2.0; // bit slower for humans
    // lifecycle::run::<Draw>("Draw Geometry", WINDOW_SIZE, settings);
    lifecycle::run::<Draw>("Draw Geometry", WINDOW_SIZE, settings)

    Box::into_raw(Box::new(t))
}

// #[no_mangle]
// pub extern fn step(ptr: *mut CartPole, force: f32) {
//     assert!(!ptr.is_null());
//     let cart_pole = unsafe { &mut *ptr };
//     cart_pole.step(force);
//     println!("New status: {}", cart_pole);
// }






#[allow(unused_imports)]
use quicksilver::{
    Future, Result,
    combinators::result,

    geom::{Circle, Line, Rectangle, Transform, Triangle, Vector, Shape},
    graphics::{Background::Col, Color},
    lifecycle,
    graphics,
    lifecycle::{run, Settings, State, Window, Asset},
    input::Key,
};
#[allow(unused_imports)]
use std::panic;

const WINDOW_SIZE: Vector = Vector{x: 800.0, y: 600.0};

// https://github.com/openai/gym/blob/master/gym/envs/classic_control/cartpole.py
struct Draw {
    cart_pole: CartPole,
    window_size: Vector,
    // font_asset: graphics::Font,
}

impl State for Draw {
    fn new() -> Result<Draw> {
        let s = Draw {
            // cart_pole: CartPole::still(),
            cart_pole: CartPole::new(),
            window_size: Vector::new(WINDOW_SIZE.x, WINDOW_SIZE.y-300.0),
            // font_asset: graphics::Font::from_slice(std::include_bytes!("../static/font.ttf")).unwrap(),
        };

        Ok(s)
    }

    fn update(&mut self, window: &mut Window) -> Result<()> {
        let mut force = 0.0;
        if window.keyboard()[Key::Right].is_down() {
            force = 1.0
        }
        if window.keyboard()[Key::Left].is_down() {
            force = -1.0
        }

        // if force != 0.0 {
            self.cart_pole.step(force);
        // }

        if window.keyboard()[Key::Space].is_down() {
            self.cart_pole = CartPole::new();
        }

        Ok(())
    }

    fn draw(&mut self, window: &mut Window) -> Result<()> {
        window.clear(Color::WHITE)?;

        let x = (self.cart_pole.x+cart_pole::CARTPOLE_MAX_X) * self.window_size.x/(2.0*cart_pole::CARTPOLE_MAX_X);
        let y = self.window_size.y - 10.0;
        let x_width = 100.0;

        let screen_size = window.screen_size();

        // Black track across screen
        window.draw(&Line::new((0, y), (screen_size.x, y)).with_thickness(2.0), Col(Color::BLACK));
        // Cart
        window.draw(&Line::new((x-x_width/2.0, y), (x+x_width/2.0, y)).with_thickness(10.0), Col(Color::BLACK));

        // Pole
        let pole_length = 60.0;
        let pole_x = pole_length * self.cart_pole.pole_angle.sin();
        let pole_y = pole_length * self.cart_pole.pole_angle.cos();
        let pole = Line::new((x, y), (x+pole_x, y-pole_y)).with_thickness(4.0);
        window.draw(&pole, Col(Color::BLUE));

        // let mut text = Asset::new(quicksilver::combinators::result(self.font_asset.render(&self.cart_pole.to_string(), &graphics::FontStyle::new(24.0, Color::BLACK))));
        // text.execute(|image| {
        //             window.draw(&image.area().with_center((WINDOW_SIZE.x/2.0, WINDOW_SIZE.y-200.0)), graphics::Background::Img(&image));
        //             Ok(())
        //         })?;

        // println!("{}", self);
        Ok(())
    }
}

fn main_run_draw() {
    let mut settings = Settings::default();
    settings.update_rate = (cart_pole::CARTPOLE_UPDATE_TIMESTEP as f64) * 1000.0;
    settings.update_rate *= 2.0; // bit slower for humans
    // lifecycle::run::<Draw>("Draw Geometry", WINDOW_SIZE, settings);
    lifecycle::run::<Draw>("Draw Geometry", WINDOW_SIZE, settings)
}