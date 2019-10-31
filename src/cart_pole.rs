#[allow(unused_imports)]
use rand::distributions::{Distribution, Uniform};

pub const CARTPOLE_MAX_X: f32 = 4.8;
pub const CARTPOLE_UPDATE_TIMESTEP: f32 = 0.02;

// https://github.com/openai/gym/blob/master/gym/envs/classic_control/cartpole.py
#[derive(Debug, Default, Clone, Copy)]
#[repr(C)]
pub struct CartPole {
    pub x: f32, // x-axis [-CARTPOLE_MAX_X, CARTPOLE_MAX_X] == [-4.8, 4.8], same as in openaigym
    pub velocity: f32,
    pub pole_angle: f32,
    pub pole_velocity: f32, // at the pole tip
}

impl std::fmt::Display for CartPole {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "box: ({:>+.4}, {:>+.4}), pole: ({:>+.4}, {:>+.4})",
            self.x, self.velocity, self.pole_angle.to_degrees(), self.pole_velocity
        )
    }
}

impl CartPole {
    #[allow(dead_code)]
    pub fn still() -> CartPole {
        let cp: CartPole = Default::default();
        cp
    }

    pub fn new() -> CartPole {
        // let mut rng = rand::thread_rng();
        let mut rng = rand::thread_rng();
        let uni = Uniform::from(-0.05..0.05);
        CartPole {
            x: uni.sample(&mut rng),
            velocity: uni.sample(&mut rng),
            pole_angle: uni.sample(&mut rng),
            pole_velocity: uni.sample(&mut rng),
        }
    }

    pub fn step(&mut self, force_input: f32) {
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
    }
}
