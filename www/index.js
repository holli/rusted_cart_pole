// import * as wasm from "rusted-cart-pole";
import { CartPole, wasm_setup } from "rusted-cart-pole";

wasm_setup();

const canvas = document.getElementById("canvas");
const status = document.getElementById("status");


// cartpole = wasm.CartPole.new()
// let cartpole = CartPole.still();
var cart_pole = CartPole.new()

var is_key_down = (() => {
  let state = {};

  // window.addEventListener('keydown', (e) => {state[e.key] = true; console.log('keypress:', state);});
  window.addEventListener('keydown', (e) => state[e.key] = true);
  window.addEventListener('keyup', (e) => state[e.key] = false);
  console.log("Keyboard handling set.")

  return (key) => state.hasOwnProperty(key) && state[key] || false;
})();

/** Redraw currently selected plot. */
function updatePlot() {
  status.innerText = `Rendering ...`;
  const start = performance.now();
  // console.log("CP:", cart_pole);
  let force = 0;

  // console.log("keydown:", is_key_down('ArrowLeft'))

  if (is_key_down('ArrowLeft')){
    force = -1;
  } else if (is_key_down('ArrowRight')) {
    force = 1
  }
  let reward = cart_pole.step(force);
  if (reward < 1){
    console.log(`Resetting cartpole at ${cart_pole.text()}.`)
    cart_pole.reset();
  }

  cart_pole.draw(canvas);
  // console.log("CP angle", cart_pole.pole_angle);
  const end = performance.now();
  let force_text = (force < 0) ? force : `&nbsp;${force}`;
  // status.innerText = `Force ${force_text}. Rendered in ${Math.ceil(end - start)}ms. Pole info ${cart_pole.text()}`;
  status.innerHTML = `Force ${force_text}. Rendered in ${Math.ceil(end - start)}ms. Pole info ${cart_pole.text()}`;
}

// updatePlot();

var timeout_times = 500;
function timeoutStepTimes(){
  updatePlot()
  timeout_times -= 1;
  // console.log("I is : " + timeout_times);
  if (timeout_times > 0) { setTimeout(() => { timeoutStepTimes(); }, 50); }
  else { console.log("GAME STOPPED, reload if needed"); }
}
timeoutStepTimes();



// setInterval(() => { updatePlot() }, 50);
window.cart_pole = cart_pole;
window.updatePlot = updatePlot;

