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
    // model.add(tf.layers.dense({units: 3}));
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

  async train(pole_cart, num_games, max_steps_per_game) {
    const allGradients = [];
    const allRewards = [];
    const gameSteps = [];
    // onGameEnd(0, numGames);
    for (let i = 0; i < num_games; ++i) {
      pole_cart.reset()

      const rewards = [];
      const gameGradients = [];
      for (let j = 0; j < max_steps_per_game; ++j) {
        // For every step of the game, remember gradients of the policy
        // network's weights with respect to the probability of the action
        // choice that lead to the reward.
        const gradients = tf.tidy(() => {
          const inputTensor = cartPoleSystem.getStateTensor();
          return this.getGradientsAndSaveActions(inputTensor).grads;
        });

        this.pushGradients(gameGradients, gradients);
        const action = this.currentActions_[0];
        const isDone = cartPoleSystem.update(action);

        // await maybeRenderDuringTraining(cartPoleSystem);

        if (isDone) {
          // When the game ends before max step count is reached, a reward of
          // 0 is given.
          rewards.push(0);
          break;
        } else {
          // As long as the game doesn't end, each step leads to a reward of 1.
          // These reward values will later be "discounted", leading to
          // higher reward values for longer-lasting games.
          rewards.push(1);
        }
      }
      onGameEnd(i + 1, num_games);
      gameSteps.push(rewards.length);
      this.pushGradients(allGradients, gameGradients);
      allRewards.push(rewards);
      await tf.nextFrame();
    }

    tf.tidy(() => {
      // The following line does three things:
      // 1. Performs reward discounting, i.e., make recent rewards count more
      //    than rewards from the further past. The effect is that the reward
      //    values from a game with many steps become larger than the values
      //    from a game with fewer steps.
      // 2. Normalize the rewards, i.e., subtract the global mean value of the
      //    rewards and divide the result by the global standard deviation of
      //    the rewards. Together with step 1, this makes the rewards from
      //    long-lasting games positive and rewards from short-lasting
      //    negative.
      // 3. Scale the gradients with the normalized reward values.
      const normalizedRewards =
        discountAndNormalizeRewards(allRewards, discountRate);
      // Add the scaled gradients to the weights of the policy network. This
      // step makes the policy network more likely to make choices that lead
      // to long-lasting games in the future (i.e., the crux of this RL
      // algorithm.)
      optimizer.applyGradients(
        scaleAndAverageGradients(allGradients, normalizedRewards));
    });
    tf.dispose(allGradients);
    return gameSteps;
  }

}

window.PolicyNetwork = PolicyNetwork
window.tes = new PolicyNetwork()
window.tes.eval_episode(cart_pole);



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

