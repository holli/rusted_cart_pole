import { CartPole, wasm_setup } from "rusted-cart-pole";

wasm_setup();

const canvas = document.getElementById("canvas");
const status = document.getElementById("status");

CartPole.prototype.observation = function () {
  return [this.x, this.velocity, this.pole_angle, this.pole_velocity]
}
window.CartPole = CartPole
var cart_pole = CartPole.new()
window.cart_pole = cart_pole

//////////////////////////////////////////////////////////////

class UI {
  constructor() {
    this.transitions = []
    this.transitions_automatic = []
    // this.episode_scores_model = [{x:0, y:0}]
    // this.episode_scores_user = [{x:0, y:0}]
    this.episode_scores = []
    this.episode_scores_smoothed = []
    this.episode_scores_smoothed_avg = []

    this.episode_num = 0
    this.mode = ''
    this.setup()
  }

  setup() {
    document.getElementById("ui_type_user").onclick = () => { this.userPlay() }
    document.getElementById("ui_type_train_show").onclick = () => { this.trainShow() }
    document.getElementById("ui_type_train").onclick = () => { this.train() }
    document.getElementById("ui_type_eval").onclick = () => { this.eval() }
    this.consoleLog('Initialized...')
    this.trainShow()
    this.plotScores()
  }

  consoleLog(str) {
    console.log(str)
    const dom = document.getElementById('console')
    if (dom.childElementCount > 10) { dom.removeChild(dom.lastChild) }
    const div = document.createElement('div')
    div.textContent = str
    dom.prepend(div)
  }

  changeMode(mode) {
    this.mode = mode
    this.consoleLog(`Mode changed to: ${mode}`)

    for (let btn of document.getElementById('ui_type_buttons').children) { btn.classList.remove('active') }
    document.getElementById('ui_type_' + this.mode).classList.add('active')
    tf.nextFrame()
  }

  plotScores() {
    const container = document.getElementById('score-container')

    const scores = []
    const smoothed = []
    var smoothed_tmp = []

    this.episode_scores.forEach((score, i) => {
      scores.push({ x: i, y: score })
      smoothed_tmp.push(score)
      smoothed_tmp = smoothed_tmp.slice(smoothed_tmp.length - 25)
      smoothed.push({ x: i, y: smoothed_tmp.reduce((prev, curr) => prev + curr) / smoothed_tmp.length })
    })

    tfvis.render.linechart(container,
      { values: [scores, smoothed], series: ['Real', 'Smoothed'] }, { xLabel: 'Episode', yLabel: 'Score' }
    );
  }

  reset_cart_pole() {
    this.episode_num += 1
    this.episode_scores.push(cart_pole.step_count)
    this.plotScores()
    cart_pole.reset()
  }

  async trainUserData() {
    this.changeMode('train')
    await tf.nextFrame()
    await policy_network.train_from_user(cart_pole, this.transitions)
    this.train()
  }

  async trainEpisode() {
    const ep_trans = []
    let epsilon = Math.max(0.02, 0.7 * Math.pow(0.99, this.episode_num))
    let reward = 1;
    cart_pole.reset()

    while (reward > 0 && cart_pole.step_count < 1000 && (this.mode == 'train' || this.mode == 'train_show')) {
      let observation = cart_pole.observation()
      let action = null

      if (Math.random() < epsilon) {
        action = Math.floor(Math.random() * 3)
      } else {
        action = policy_network.predict_force(cart_pole) + 1
      }

      reward = cart_pole.step(action - 1)
      ep_trans.push([observation, action, reward])

      if (this.mode == 'train_show') {
        cart_pole.draw(canvas)
        await tf.nextFrame()
      }
    }

    this.consoleLog(`Trained episode ${this.episode_num}, score: ${cart_pole.step_count}, epsilon: ${Number(Math.round(epsilon + 'e2') + 'e-2')}`)
    this.reset_cart_pole()

    // by default all rewards are 1, but discounted if we failed at the game
    // rewards range [-100..0] are discounted starting from 1 to -1 for the last action
    let discounted_steps = 100
    let total_steps = ep_trans.length
    if (ep_trans[ep_trans.length - 1][2] == 0) {
      let discounted_reward = (x) => -(0.5 - x / discounted_steps) * 2

      for (let idx = total_steps; idx > Math.max(0, total_steps - discounted_steps); idx--) {
        ep_trans[idx - 1][2] = discounted_reward(total_steps - idx)
      }
    }
    this.transitions_automatic.push(...ep_trans)
    let transitions_size = 3000
    if (this.transitions_automatic.length > transitions_size) {
      this.transitions_automatic = this.transitions_automatic.slice(this.transitions_automatic.length - transitions_size)
    }

    await policy_network.train_from_computer(this.transitions_automatic)

    if (this.mode == 'train') {
      setTimeout(() => { this.trainEpisode() }, 50)
    }
  }

  async trainShow() {
    this.changeMode('train_show')
    while (this.mode == 'train_show') { await this.trainEpisode() }
  }

  async train() {
    this.changeMode('train')
    this.trainEpisode()
  }

  async modelGame() {
    this.changeMode('eval')
    while (this.mode == 'eval') {
      // this.prf_start = performance.now();

      let force = policy_network.predict_force(cart_pole)
      let reward = cart_pole.step(force)
      cart_pole.draw(canvas)
      await tf.nextFrame();  // Unblock UI thread.

      if (reward < 1) {
        this.episode_scores_model.push({ x: this.episode_num, y: cart_pole.step_count })
        console.log("modelGame episode ended at ", cart_pole.step_count)
        this.reset_cart_pole()
      }
    }
  }

  async userPlay() {
    this.changeMode('user')
    let timing = 0
    while (this.mode == 'user') {
      while (performance.now() - timing < 60 && this.mode == 'user') {
        await tf.nextFrame()
      }
      timing = performance.now()
      let force = 0;

      if (keyboard.is_down('ArrowLeft')) {
        force = -1;
      } else if (keyboard.is_down('ArrowRight')) {
        force = 1
      }
      this.transitions.push([cart_pole.observation(), force + 1])
      if (this.transitions.length > 500) { this.transitions = this.transitions.slice(this.transitions.length - 5000) }

      let reward = cart_pole.step(force);
      cart_pole.draw(canvas);
      const end = performance.now();
      let force_text = (force < 0) ? force : `&nbsp;${force}`;
      // status.innerHTML = `Force ${force_text}. Rendered in ${Math.ceil(end - start)}ms. ` +
      //                    `Sample size ${this.transitions.length}. Pole info ${cart_pole.text()}`

      if (reward < 1) {
        console.log(`Resetting cartpole at ${cart_pole.text()}.`)
        let step_count = cart_pole.step_count
        // let start_game = false
        // this.episode_scores_user.push({x: this.episode_num, y: cart_pole.step_count})
        this.reset_cart_pole()
        cart_pole.draw(canvas)

        this.consoleLog(`Game ended at step ${step_count}. Sample size ${this.transitions.length}. Start new game with keypress.`)
        for (let i = 0; i < 15; i++) {
          await tf.nextFrame()
        }

        while (true) {
          await tf.nextFrame()
          if (keyboard.is_down('ArrowLeft') || keyboard.is_down('ArrowRight')) { break }
        }
      }

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

    model.add(tf.layers.dense({ units: 8, inputShape: [4], activation: 'relu', }))
    model.add(tf.layers.dense({ units: 8, activation: 'relu', }));
    // model.add(tf.layers.dense({units: 3, activation: 'softmax'}));
    model.add(tf.layers.dense({ units: 3 }));

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

  async train_from_user(transitions) {
    let x = [], y = []

    transitions.forEach(trans => {
      x.push(trans[0])
      let y_keys = [0, 0, 0]
      y_keys[trans[1]] = 1
      y.push(y_keys)
    })

    let loss = await this.model.fit(tf.tensor(x), tf.tensor(y), { 'epochs': 4, 'shuffle': true })
    loss = loss.history['loss'][0]

    console.log(`Trained model with ${transitions.length} transitions, loss was ${loss}`)

    return loss
  }

  async train_from_computer(transitions) {
    let minibatch_size = 32
    // let loss_info = ''
    if (transitions.length >= minibatch_size) {
      // This is probably so wrong way to do it. There is probably much more elegant way of modifying
      // the tensors directly and not copying so much but I didn't use time to check tensorflow.js manuals.
      let batch_x = []
      let batch_y_rewards = []
      let batch_y_actions = []
      for (let i = 0; i < minibatch_size; i++) {
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

      for (let i = 0; i < minibatch_size; i++) {
        batch_y[i][batch_y_actions[i]] = batch_y_rewards[i]
      }

      return await this.model.fit(batch_x, tf.tensor(batch_y))
      // loss_info = loss.history['loss'][0]
    }

  }

}

///////////////////////////////////////////////////////////////////////////////

class Keyboard {
  constructor() {
    this.state = {}
    window.addEventListener('keydown', (e) => { this.state[e.key] = true });
    window.addEventListener('keyup', (e) => { this.state[e.key] = false });
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

const ui = new UI()
window.ui = ui

