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
    this.model = this.getModel()
    this.train_count = 0
    this.debug = []
  }


  getModel() {
    const model = tf.sequential();

    model.add(tf.layers.dense({units: 8, inputShape: [4], activation: 'relu',}))
    model.add(tf.layers.dense({units: 8, activation: 'relu',}));
    // model.add(tf.layers.dense({units: 3, activation: 'softmax'}));
    model.add(tf.layers.dense({units: 3}));

    console.log("New Model: " + JSON.stringify(model.outputs[0].shape));

    const optimizer = tf.train.adam()
    this.optimizer = optimizer
    model.compile({
      optimizer: optimizer,
      // loss: 'categoricalCrossentropy',
      loss: 'meanSquaredError',
      // metrics: ['accuracy'],
    });

    return model;
  }


  cartPoleInputs(cp) {
    return [cp.x, cp.velocity, cp.pole_angle, cp.pole_velocity]
  }


  async eval_episode(cart_pole) {
    cart_pole.reset()
    this.prf_start = performance.now();
    status.innerHTML = `Running demo episode...`;
    let isDone = false;
    while (!isDone){
      tf.tidy(() => {
        const logits = this.model.predict(tf.tensor2d([this.cartPoleInputs(cart_pole)]));
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
    let transitions = []
    let episodes = []

    for (let episode = 0; episode < max_episodes; episode++) {
      this.train_count += 1
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
            const logits = this.model.predict(tf.tensor2d([observation]));
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
      let transitions_size = 3000
      if (transitions.length > transitions_size){
        transitions = transitions.slice(transitions.length - transitions_size, )
      }

      episodes.push(cart_pole.step_count)
      if (episode % 100 == 0 || episode == max_episodes-1){
        await this.eval_episode(cart_pole);
      }

      let minibatch_size = 32
      let loss_info = ""
      if (transitions.length >= minibatch_size){
        let batch_x = []
        let batch_y_rewards = []
        let batch_y_actions = []
        for (let i = 0; i < minibatch_size; i++){
          let arr = transitions[Math.floor(Math.random() * transitions.length)]
          batch_x.push(arr[0])
          batch_y_actions.push(arr[1])
          batch_y_rewards.push(arr[2])
        }

        window.test_res = batch_x
        batch_x = tf.tensor(batch_x)
        let batch_y = this.model.predict(batch_x)
        window.test_b = batch_y
        batch_y = batch_y.arraySync()

        for (let i = 0; i < minibatch_size; i++){
          batch_y[i][batch_y_actions[i]] = batch_y_rewards[i]
        }

        // This is probably so wrong way to do it. There is probably much
        // more elegant way of modifying the tensors directly and not copying
        // so much but I didn't use time to check tensorflow.js manuals
        let loss = await this.model.fit(batch_x, tf.tensor(batch_y))
        loss_info = loss.history['loss'][0]
      }

      if (episode % 20 == 0 || episode == max_episodes-1){
        let episodes_mean = episodes.reduce((a,b) => a + b, 0) / episodes.length
        episodes = []
        console.log("Ended episode ", episode,
                    ". Avg steps: ", episodes_mean, ". Epsilon: ", epsilon, ". Loss:", loss_info,
                    ". Transitions.len: ", transitions.length)
      }

    }
  }
}


window.PolicyNetwork = PolicyNetwork
window.pn = new PolicyNetwork()
// window.pn.eval_episode(cart_pole);
window.pn.train(cart_pole, 10);
// window.pn.train(cart_pole, 4000);

