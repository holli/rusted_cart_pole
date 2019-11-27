// import * as wasm from "rusted-cart-pole";
import { CartPole, wasm_setup } from "rusted-cart-pole";

wasm_setup();

const canvas = document.getElementById("canvas");
const status = document.getElementById("status");

CartPole.prototype.observation = function(){
  return [this.x, this.velocity, this.pole_angle, this.pole_velocity]
}
window.CartPole = CartPole
var cart_pole = CartPole.new()
window.cart_pole = cart_pole

//////////////////////////////////////////////////////////////

class UI {
  constructor() {
    this.transitions = []
    this.episode_scores_model = [{x:0, y:0}]
    this.episode_scores_user = [{x:0, y:0}]
    this.episode_num = 0
    this.gameOn = false
    this.setup()
  }

  setup(){
    document.getElementById("ui_type").onclick = () => {
      if (this.gameOn) {
        this.trainAndDemo()
      } else {
        this.playGame()
      }
    }
    this.plotScores()
  }

  plotScores() {
    const container = document.getElementById('score-container')
    tfvis.render.linechart(container,
    // tfvis.render.scatterplot(container,
      {values: [this.episode_scores_model, this.episode_scores_user], series: ['Model', 'User']}, {
      xLabel: 'Episode', yLabel: 'Score'
    });
  }

  reset_cart_pole(){
    cart_pole.reset()
    this.episode_num += 1
  }

  async trainAndDemo(){
    this.gameOn = false
    document.getElementById("ui_type").innerHTML = 'Training'
    document.getElementById("ui_type").className = 'btn btn-secondary'
    await tf.nextFrame()
    await policy_network.train_from_user(cart_pole, this.transitions)
    this.modelGame()
  }

  async modelGame() {
    this.gameOn = false
    document.getElementById("ui_type").innerHTML = 'Computer'
    document.getElementById("ui_type").className = 'btn btn-info'
    while (!this.gameOn) {
      // this.prf_start = performance.now();

      let force = policy_network.predict_force(cart_pole)
      let reward = cart_pole.step(force)
      cart_pole.draw(canvas)
      await tf.nextFrame();  // Unblock UI thread.

      if (reward < 1){
        this.episode_scores_model.push({x: this.episode_num, y: cart_pole.step_count})
        console.log("modelGame episode ended at ", cart_pole.step_count)
        this.reset_cart_pole()
        this.plotScores()
      }
    }
  }

  async playGame() {
    this.gameOn = true
    document.getElementById("ui_type").innerHTML = 'User'
    document.getElementById("ui_type").className = 'btn btn-primary'
    let timing = 0
    while (this.gameOn){
      while (performance.now() - timing < 60 && this.gameOn) {
        await tf.nextFrame()
      }
      timing = performance.now()
      let force = 0;

      if (keyboard.is_down('ArrowLeft')){
        force = -1;
      } else if (keyboard.is_down('ArrowRight')) {
        force = 1
      }
      this.transitions.push([cart_pole.observation(), force+1])
      if (this.transitions.length > 500){ this.transitions = this.transitions.slice(this.transitions.length - 5000, ) }

      let reward = cart_pole.step(force);
      cart_pole.draw(canvas);
      const end = performance.now();
      let force_text = (force < 0) ? force : `&nbsp;${force}`;
      // status.innerHTML = `Force ${force_text}. Rendered in ${Math.ceil(end - start)}ms. ` +
      //                    `Sample size ${this.transitions.length}. Pole info ${cart_pole.text()}`

      if (reward < 1){
        console.log(`Resetting cartpole at ${cart_pole.text()}.`)
        let step_count = cart_pole.step_count
        let start_game = false
        this.episode_scores_user.push({x: this.episode_num, y: cart_pole.step_count})
        this.reset_cart_pole()
        this.plotScores()
        cart_pole.draw(canvas)

        status.innerHTML = `Game ended at step ${step_count}. Sample size ${this.transitions.length}. Start new game with keypress.`
        for (let i = 0; i < 15; i++){
          await tf.nextFrame()
        }

        while (true) {
          await tf.nextFrame()
          if (keyboard.is_down('ArrowLeft') || keyboard.is_down('ArrowRight')) { break }
        }
      }

      // await tf.nextFrame()
      // // window.requestAnimationFrame(() => this.playGame());
      // await tf.nextFrame()
      // await tf.nextFrame()
    }
  }
}

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

  predict_force(cart_pole) {
    return tf.tidy(() => {
      const logits = this.model.predict(tf.tensor2d([cart_pole.observation()]));
      const action = logits.argMax(1)
      return action.arraySync()[0] - 1
    })
  }

  // async eval_episode(cart_pole) {
  //   cart_pole.reset()
  //   this.prf_start = performance.now();
  //   status.innerHTML = `Running demo episode...`;
  //   let isDone = false;
  //   while (!isDone){
  //     tf.tidy(() => {
  //       const logits = this.model.predict(tf.tensor2d([cart_pole.observation()]));
  //       const action = logits.argMax(1)
  //       const force = action.arraySync()[0] - 1
  //       // console.log("Force: ", force);
  //       const reward = cart_pole.step(force);
  //       cart_pole.draw(canvas);
  //       if (reward == 0 || cart_pole.step_count > 1000){
  //         isDone = true
  //       }
  //     })
  //     await tf.nextFrame();  // Unblock UI thread.
  //   }

  //   console.log("Episode ended at ", cart_pole.step_count)
  //   const end = performance.now();
  //   status.innerHTML = `Demo episode end at ${cart_pole.step_count}. ` +
  //                       `Rendered in ${Math.ceil((end - this.prf_start)/cart_pole.step_count)}ms/step. Pole info ${cart_pole.text()}`;
  // }

  async train_from_user(pole_cart, transitions) {
    let x = [], y = []

    transitions.forEach(trans => {
      x.push(trans[0])
      let y_keys = [0, 0, 0]
      y_keys[trans[1]] = 1
      y.push(y_keys)
    })

    let loss = await this.model.fit(tf.tensor(x), tf.tensor(y), {'epochs': 4, 'shuffle': true})
    loss = loss.history['loss'][0]

    console.log(`Trained model with ${transitions.length} transitions, loss was ${loss}`)

    return loss
  }

  async train_game(pole_cart, max_episodes) {
    let transitions = []
    let episodes = []

    for (let episode = 0; episode < max_episodes; episode++) {
      this.train_count += 1
      pole_cart.reset()
      const ep_trans = []
      let observation = cart_pole.observation
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
        observation = cart_pole.observation
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

///////////////////////////////////////////////////////////////////////////////

class Keyboard {
  constructor() {
    this.state = {}
    window.addEventListener('keydown', (e) => {this.state[e.key] = true});
    window.addEventListener('keyup', (e) => {this.state[e.key] = false});
    console.log("Keyboard handling set.")
  }

  is_down(key) {
    return this.state.hasOwnProperty(key) && this.state[key] || false;
  }
}

const keyboard = new Keyboard()

///////////////////////////////////////////////////////////////////////////////


const policy_network = new PolicyNetwork()
window.PolicyNetwork = PolicyNetwork
window.policy_network = policy_network
// window.pn.eval_episode(cart_pole);
// window.pn.train(cart_pole, 10);
// window.pn.train(cart_pole, 4000);

const ui = new UI()
window.ui = ui
ui.playGame()
