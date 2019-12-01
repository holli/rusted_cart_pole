# Rusted Cart Pole

An example of an environment for machine learning programmed with Rust and using different languages to interact with the environment.

- WebAssembly & Tensorflow.js:
  - **Live example**: https://holli.github.io/rusted_cart_pole/
  - [www/index.js](https://github.com/holli/rusted_cart_pole/tree/master/)
- Python & Pytorch: [examples/python_pytorch.py](https://github.com/holli/rusted_cart_pole/blob/master/examples/python_pytorch.py)


## Usage

- git clone git@github.com:holli/rusted_cart_pole.git
- cargo build
- to run the game environment in Rust without any machine learning
  - cargo run --bin game

## Info / Links

The implemention of the cart pole is mostly copied from [OpenAi Gym](https://github.com/openai/gym/blob/master/gym/envs/classic_control/cartpole.py). Although in this implementation you are able to do nothing so that it's more intuitive to make an interface for humans. Graphics are drawn using [Plotters](https://docs.rs/plotters/0.2.11/plotters/) which has backends to be used natively or in web assembly.

For ffi example to be used in e.g. Python check out [src/ffi_lib.rs](https://github.com/holli/rusted_cart_pole/blob/master/src/ffi_lib.rs) and the Python example. Good general resources on how to expose FFI from the Rust library [#1](https://svartalf.info/posts/2019-03-01-exposing-ffi-from-the-rust-library/) or [#2](http://jakegoulding.com/rust-ffi-omnibus/). Wasm related infos can be found from the (live example)[https://holli.github.io/rusted_cart_pole/].


