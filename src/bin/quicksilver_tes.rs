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
    window_size: Vector,
    color: quicksilver::graphics::Color,
    // font_asset: graphics::Font,
}

impl State for Draw {
    fn new() -> Result<Draw> {
        let s = Draw {
            window_size: Vector::new(WINDOW_SIZE.x, WINDOW_SIZE.y-300.0),
            color: quicksilver::graphics::Color::YELLOW,
            // font_asset: graphics::Font::from_slice(std::include_bytes!("../static/font.ttf")).unwrap(),
        };

        Ok(s)
    }

    fn update(&mut self, window: &mut Window) -> Result<()> {
        let mut force = 0.0;
        if window.keyboard()[Key::Right].is_down() {
            force = 1.0;
            self.color = quicksilver::graphics::Color::BLUE;
        }
        if window.keyboard()[Key::Left].is_down() {
            force = -1.0;
            self.color = quicksilver::graphics::Color::RED;
        }

        Ok(())
    }

    fn draw(&mut self, window: &mut Window) -> Result<()> {
        window.clear(Color::WHITE)?;

        // let x = (self.cart_pole.x+cart_pole::CARTPOLE_MAX_X) * self.window_size.x/(2.0*cart_pole::CARTPOLE_MAX_X);
        let y = self.window_size.y - 10.0;
        let x_width = 100.0;

        let screen_size = window.screen_size();

        // Black track across screen
        window.draw(&Line::new((0, y), (screen_size.x, y)).with_thickness(2.0), Col(Color::BLACK));
        // Cart
        window.draw(&Line::new((50, 50), (50, 100)).with_thickness(50.0), Col(self.color));

        // // Pole
        // let pole_length = 60.0;
        // let pole_x = pole_length * self.cart_pole.pole_angle.sin();
        // let pole_y = pole_length * self.cart_pole.pole_angle.cos();
        // let pole = Line::new((x, y), (x+pole_x, y-pole_y)).with_thickness(4.0);
        // window.draw(&pole, Col(Color::BLUE));

        Ok(())
    }
}

fn main_run_draw() {
    let mut settings = Settings::default();
    // settings.update_rate = (cart_pole::CARTPOLE_UPDATE_TIMESTEP as f64) * 1000.0;
    // settings.update_rate *= 2.0; // bit slower for humans
    // // lifecycle::run::<Draw>("Draw Geometry", WINDOW_SIZE, settings);
    lifecycle::run::<Draw>("Draw Geometry", WINDOW_SIZE, settings)
}

#[cfg(not(target_arch="wasm32"))]
fn main() {
    main_run_draw()
}

#[cfg(target_arch="wasm32")]
use stdweb::js;
#[cfg(target_arch="wasm32")]
fn main() {
    js! {
        console.log("CartPole: Loading with default window size:", @{WINDOW_SIZE.x}, @{WINDOW_SIZE.y})
    };
    stdweb::initialize();
    // Stdweb default panic hook didn't log the error message
    let panic_hook_old = panic::take_hook();
    panic::set_hook(Box::new(move |panic_info| {
        if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            js! { console.error("Rust panic:",  @{s}) }
        }
        panic_hook_old(panic_info);
    }));

    main_run_draw()
}

