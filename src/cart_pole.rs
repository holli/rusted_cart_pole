use rand::distributions::{Distribution, Uniform};
// #[cfg(target_arch="wasm32")]
use plotters::prelude::*;
use plotters::style::colors;
use wasm_bindgen::prelude::*;

pub const CARTPOLE_THRESHOLD_X: f32 = 2.4;
pub const CARTPOLE_THRESHOLD_POLE: f32 = 24.0 * 2.0 * std::f32::consts::PI / 360.0;
pub const CARTPOLE_UPDATE_TIMESTEP: f32 = 0.02;

// https://github.com/openai/gym/blob/master/gym/envs/classic_control/cartpole.py
#[wasm_bindgen]
#[derive(Debug, Default, Clone, Copy)]
#[repr(C)]
pub struct CartPole {
    pub x: f32, // x-axis [-CARTPOLE_MAX_X, CARTPOLE_MAX_X] == [-4.8, 4.8], same as in openaigym
    pub velocity: f32,
    pub pole_angle: f32,
    pub pole_velocity: f32, // at the pole tip
    pub step_count: i32,
}

impl std::fmt::Display for CartPole {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "step: {:04}, box: ({:>+.4}, {:>+.4}), pole: ({:>+.4}, {:>+.4})",
            self.step_count,
            self.x,
            self.velocity,
            self.pole_angle.to_degrees(),
            self.pole_velocity
        )
    }
}

#[wasm_bindgen]
impl CartPole {
    #[allow(dead_code)]
    pub fn still() -> CartPole {
        let cp: CartPole = Default::default();
        cp
    }

    pub fn new() -> CartPole {
        let mut cp = CartPole::still();
        cp.reset();
        // CartPole {
        //     cp.x: uni.sample(&mut rng);
        //     velocity: uni.sample(&mut rng),
        //     pole_angle: uni.sample(&mut rng),
        //     pole_velocity: uni.sample(&mut rng),
        // }
        cp
    }

    pub fn reset(&mut self) {
        let mut rng = rand::thread_rng();
        // let uni = Uniform::from(-0.05..0.05);
        let uni_small = Uniform::from(-0.10..0.10);
        let uni = Uniform::from(-0.30..0.30);

        self.step_count = 0;
        self.x = uni_small.sample(&mut rng);
        self.velocity = uni.sample(&mut rng);
        self.pole_angle = uni_small.sample(&mut rng);
        self.pole_velocity = uni.sample(&mut rng);
    }

    pub fn step(&mut self, force_input: f32) -> i32 {
        self.step_count += 1;
        let gravity = 9.8;
        let masscart = 1.0;
        let masspole = 0.5;
        let total_mass = masspole + masscart;
        let length = 0.5; // actually half the pole's length
        let polemass_length = masspole * length;
        let force = force_input * 10.0;
        let tau = CARTPOLE_UPDATE_TIMESTEP; // seconds between state updates

        let temp = (force + polemass_length * self.pole_velocity.powi(2) * self.pole_angle.sin())
            / total_mass;
        let thetaacc = (gravity * self.pole_angle.sin() - self.pole_angle.cos() * temp)
            / (length * (4.0 / 3.0 - masspole * self.pole_angle.cos().powi(2) / total_mass));
        let xacc = temp - polemass_length * thetaacc * self.pole_angle.cos() / total_mass;

        self.x = self.x + tau * self.velocity;
        self.velocity += tau * xacc;
        self.pole_angle += tau * self.pole_velocity;
        self.pole_angle %= 2.0 * std::f32::consts::PI;
        self.pole_velocity += tau * thetaacc;

        let done = self.x < -CARTPOLE_THRESHOLD_X
            || self.x > CARTPOLE_THRESHOLD_X
            || self.pole_angle < -CARTPOLE_THRESHOLD_POLE
            || self.pole_angle > CARTPOLE_THRESHOLD_POLE;
        if done {
            0
        } else {
            1
        }
    }
}

impl CartPole {
    pub fn draw_plotter<DB: DrawingBackend>(
        &self,
        root: DrawingArea<DB, plotters::coord::Shift>,
    ) -> Result<(), plotters::drawing::DrawingAreaErrorKind<DB::ErrorType>> {
        root.fill(&colors::WHITE)?;

        let y = 300;
        root.draw(&Rectangle::new(
            [(0, y), (800, y + 1)],
            Into::<ShapeStyle>::into(&colors::BLACK).filled(),
        ))?;

        let world_with = CARTPOLE_THRESHOLD_X + 0.5;
        let x = (self.x + world_with) * 800.0 / (2.0 * world_with);
        let x_width = 100.0;

        // Cart
        root.draw(&Rectangle::new(
            [(0, y), (800, y + 1)],
            Into::<ShapeStyle>::into(&colors::BLACK).filled(),
        ))?;
        root.draw(&Rectangle::new(
            [
                ((x - x_width / 2.0) as i32, y - 10),
                ((x + x_width / 2.0) as i32, y + 10),
            ],
            Into::<ShapeStyle>::into(&colors::BLACK).filled(),
        ))?;

        // Pole
        let pole_length = 100.0;
        let pole_x = pole_length * self.pole_angle.sin();
        let pole_y = (pole_length * self.pole_angle.cos()) as i32;
        let points = [
            (x as i32, y as i32),
            ((x + pole_x) as i32, (y - pole_y) as i32),
        ];
        root.draw(&PathElement::new(
            points.to_vec(),
            Into::<ShapeStyle>::into(&colors::BLACK).filled(),
        ))?;

        Ok(())
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl CartPole {
    pub fn draw<DB: DrawingBackend>(
        &self,
        root: DrawingArea<DB, plotters::coord::Shift>,
    ) -> Result<(), plotters::drawing::DrawingAreaErrorKind<DB::ErrorType>> {
        self.draw_plotter(root)
    }
}

#[cfg(target_arch = "wasm32")]
use web_sys::HtmlCanvasElement;
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl CartPole {
    pub fn draw(&self, element: HtmlCanvasElement) -> () {
        // web_sys::console::log_1(&format!("Basic htmlcanvas in rust drawing").into());
        let backend = CanvasBackend::with_canvas_object(element).unwrap();
        let root = backend.into_drawing_area();

        self.draw_plotter(root)
            .expect("Not able to draw_plotter() to canvas.");
    }

    pub fn text(&self) -> String {
        format!("{}", self)
    }
}
