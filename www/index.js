// import * as wasm from "rusted-cart-pole";
import { CartPole, wasm_setup } from "rusted-cart-pole";

wasm_setup();

const canvas = document.getElementById("canvas");
const status = document.getElementById("status");

var cart_pole = CartPole.new()

var is_key_down = (() => {
  let state = {};

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
  const end = performance.now();
  let force_text = (force < 0) ? force : `&nbsp;${force}`;
  status.innerHTML = `Force ${force_text}. Rendered in ${Math.ceil(end - start)}ms. Pole info ${cart_pole.text()}`;
}

var timeout_times = 500;
function timeoutStepTimes(){
  updatePlot()
  timeout_times -= 1;
  // console.log("I is : " + timeout_times);
  if (timeout_times > 0) { setTimeout(() => { timeoutStepTimes(); }, 50); }
  else { console.log("GAME STOPPED, reload if needed"); }
}
// timeoutStepTimes();

window.cart_pole = cart_pole;
window.updatePlot = updatePlot;

//////////////////////////////////////////////////////////

class PolicyNetwork {
  constructor() {
    this.model = this.getModel();
  }

  getModel() {
    const model = tf.sequential();

    model.add(tf.layers.dense({units: 16, inputShape: [4]}));
    model.add(tf.layers.dense({units: 32}));
    model.add(tf.layers.dense({units: 3, activation: 'softmax'}));

    console.log("New Model: " + JSON.stringify(model.outputs[0].shape));

    const optimizer = tf.train.adam();
    model.compile({
      optimizer: optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  cartPoleInputs(cp) {
    return tf.tensor2d([[cp.x, cp.velocity, cp.pole_angle, cp.pole_velocity]])
  }

  async eval_episode(cart_pole) {
    cart_pole.reset()
    this.prf_start = performance.now();
    status.innerHTML = `Running demo episode...`;
    let isDone = false;
    while (!isDone){
      tf.tidy(() => {
        const logits = this.model.predict(this.cartPoleInputs(cart_pole));
        const action = logits.argMax(1)
        const force = action.arraySync()[0] - 1
        // console.log("Force: ", force);
        const reward = cart_pole.step(force);
        cart_pole.draw(canvas);
        if (reward == 0 || cart_pole.step_count > 1000){
          isDone = true
        }
      })
      await tf.nextFrame();  // Unblock UI thread.
    }

    console.log("Episode ended at ", cart_pole.step_count)
    const end = performance.now();
    status.innerHTML = `Demo episode end at ${cart_pole.step_count}. ` +
                        `Rendered in ${Math.ceil((end - this.prf_start)/cart_pole.step_count)}ms/step. Pole info ${cart_pole.text()}`;
  }

  async train(pole_cart, max_episodes) {
    const transitions = []
    const episodes = []

    for (let episode = 0; episode < max_episodes; episode++) {
      pole_cart.reset()
      const ep_trans = []
      let observation = this.cartPoleInputs(cart_pole)
      let epsilon = Math.max(0.02, 0.7 * Math.pow(0.99, episode))
      let isDone = false;
      while (!isDone){
        let old_observation = observation
        let action = null

        if (Math.random() < epsilon) {
          action = Math.floor(Math.random()*3)
        } else {
          action = tf.tidy(() => {
            const logits = this.model.predict(observation);
            const action = logits.argMax(1)
            return action.arraySync()[0]
          })
        }

        let reward = cart_pole.step(action - 1)
        observation = this.cartPoleInputs(cart_pole)
        ep_trans.push([old_observation, action, reward, observation])

        if (reward == 0 || cart_pole.step_count > 400) {
          isDone = true
        }

        if (this.abort_signal) {
          return false
        }
      }

      // by default all rewards are 1, but discounted if we failed at the game
      // rewards range [-100..0] are discounted starting from 1 to -1 for the last action
      let discounted_steps = 100
      let total_steps = ep_trans.length
      if (ep_trans[ep_trans.length-1][2] == 0){
        let discounted_reward = (x) => -(0.5 - x/discounted_steps)*2

        for (let idx = total_steps; idx > Math.max(0, total_steps-discounted_steps); idx--) {
          ep_trans[idx-1][2] = discounted_reward(total_steps-idx)
        }
      }
      // console.log(ep_trans.map(x => x[2]))
      transitions.push(...ep_trans)
      if (transitions.length > 10000){
        transitions = transitions.slice(transitions.length - 10000, )
      }

      console.log("Ended episode ", episode, ". Steps: ", cart_pole.step_count,
                  ". Transitions.len: ", transitions.length)


      let minibatch_size = 32
      if (transitions.length >= minibatch_size){
        console.log("MINIBATCH STARTING")
        let batch_x = []
        let batch_y_rewards = []
        let batch_y_actions = []
        for (let i = 0; i < minibatch_size; i++){
          let arr = transitions[Math.floor(Math.random() * transitions.length)]
          // window.test_a= arr[0]
          batch_x.push(arr[0].dataSync())
          batch_y_actions.push(arr[1])
          batch_y_rewards.push(arr[2])
        }

        console.log("Predict size: ")

        window.test_res = batch_x
        batch_x = tf.tensor(batch_x)
        let batch_y = this.model.predict(batch_x)
        window.test_b = batch_y
        batch_y = batch_y.arraySync()

        for (let i = 0; i < minibatch_size; i++){
          batch_y[i][batch_y_actions[i]] = batch_y_rewards[i]
        }

        // this.model.trainOnBatch()
        this.model.fit(batch_x, tf.tensor(batch_y))
      }

    }
  }
}

window.PolicyNetwork = PolicyNetwork
window.pn = new PolicyNetwork()
// window.pn.eval_episode(cart_pole);
window.pn.train(cart_pole, 2);



// if needing timeout version
  // eval_episode(cart_pole) {
  //   cart_pole.reset()
  //   this.prf_start = performance.now();
  //   this.eval_episode_demo(cart_pole);

  //   status.innerHTML = `Running demo episode...`;
  // }

  // eval_episode_demo(cart_pole) {
  //   tf.tidy(() => {
  //     const logits = this.model.predict(this.cartPoleInputs(cart_pole));
  //     const action = logits.argMax(1)
  //     const force = action.arraySync()[0] - 1
  //     // console.log("Force: ", force);
  //     const reward = cart_pole.step(force);
  //     cart_pole.draw(canvas);
  //     if (reward > 0 && cart_pole.step_count < 1000){
  //       setTimeout(() => { this.eval_episode_demo(cart_pole); }, 20);
  //     } else {
  //       console.log("Episode ended at ", cart_pole.step_count)
  //       const end = performance.now();
  //       let force_text = (force < 0) ? force : `&nbsp;${force}`;
  //       status.innerHTML = `Demo episode end at ${cart_pole.step_count}. ` +
  //                          `Rendered in ${Math.ceil((end - this.prf_start)/cart_pole.step_count)}ms/step. Pole info ${cart_pole.text()}`;
  //     }
  //   })
  // }

