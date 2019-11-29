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
    this.transitions_user = []
    this.transitions_automatic = []

    this.vis_real = []
    this.vis_smoothed = []
    this.vis_smoothed_tmp = []

    this.episode_num = 0
    this.mode = ''

    document.getElementById("ui_type_user").onclick = () => { this.userPlay() }
    document.getElementById("ui_type_train_show").onclick = () => { this.trainShow() }
    document.getElementById("ui_type_train").onclick = () => { this.train() }
    document.getElementById("ui_type_eval").onclick = () => { this.eval() }
    document.getElementById("ui_type_pause").onclick = () => { this.changeMode('pause') }
    this.vis_container = document.getElementById('vis-container')
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
    tfvis.render.linechart(this.vis_container,
      { values: [this.vis_real, this.vis_smoothed], series: ['Real', 'Smoothed'] }, { xLabel: 'Episode', yLabel: 'Score' }
    );
  }

  resetCartPole() {
    this.episode_num += 1
    let score = cart_pole.step_count
    // this.episode_scores.push(score)

    this.vis_real.push({x: this.episode_num, y: score })
    this.vis_smoothed_tmp.push(score)
    this.vis_smoothed_tmp = this.vis_smoothed_tmp.slice(this.vis_smoothed_tmp.length - 25)
    this.vis_smoothed.push({ x: this.episode_num, y: this.vis_smoothed_tmp.reduce((prev, curr) => prev + curr) / this.vis_smoothed_tmp.length })

    // for some reason continous tfvis.render causes memory bloating, so not doing too often
    if (this.mode != 'train' || this.episode_num % 10 == 0){ this.plotScores() }
    cart_pole.reset()
  }

  async userDataTrain() {
    this.consoleLog(`Training user-mimicin 4 epochs with sample size: ${this.transitions_user.length}.`)
    policy_network.train_from_user(cart_pole, this.transitions_user)
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
      this.transitions_user.push([cart_pole.observation(), force + 1])
      let transitions_size = 3000
      if (this.transitions_user.length > transitions_size) { this.transitions_user = this.transitions_user.slice(this.transitions_user.length - transitions_size) }

      let reward = cart_pole.step(force);
      cart_pole.draw(canvas);
      // const end = performance.now()

      if (cart_pole.step_count % 100 == 0){ this.userDataTrain() }

      if (reward < 1) {
        this.consoleLog(`User episode ${this.episode_num}, score: ${cart_pole.step_count}. Start new game with keypress.`)
        policy_network.train_from_user(cart_pole, this.transitions_user)
        this.resetCartPole()
        cart_pole.draw(canvas)

        for (let i = 0; i < 15; i++) { await tf.nextFrame() }

        while (this.mode == 'user') {
          await tf.nextFrame()
          if (keyboard.is_down('ArrowLeft') || keyboard.is_down('ArrowRight')) { break }
        }
      }
    }

    this.userDataTrain()
  }

  async trainEpisode() {
    let mode_original = this.mode
    const ep_trans = []
    let reward = 1;
    cart_pole.reset()

    while (reward > 0 && cart_pole.step_count < 1000 && this.mode == mode_original) {
      let observation = cart_pole.observation()
      let action = null

      // e-greedy action selection
      // let epsilon = Math.max(0.02, 0.7 * Math.pow(0.99, this.episode_num))
      // if (Math.random() < epsilon) {
      //   action = Math.floor(Math.random() * 3)
      // } else {
      //   action = policy_network.predict_action(cart_pole)
      // }

      // Boltzmann Approach for action selection
      action = policy_network.predict_action(cart_pole, true)

      reward = cart_pole.step(action - 1)
      ep_trans.push([observation, action, reward])

      if (this.mode == 'train_show') {
        cart_pole.draw(canvas)
        await tf.nextFrame()
      }
    }

    // this.consoleLog(`Trained episode ${this.episode_num}, score: ${cart_pole.step_count}, epsilon: ${Number(Math.round(epsilon + 'e2') + 'e-2')}`)
    this.consoleLog(`Trained episode ${this.episode_num}, score: ${cart_pole.step_count}`)
    this.resetCartPole()

    // by default all rewards are 1, but discounted if we failed at the game
    // rewards range [-xxx..0] are discounted starting from 1 to -1 for the last action
    let discounted_steps = 50
    let total_steps = ep_trans.length
    if (ep_trans[ep_trans.length - 1][2] == 0) {
      let discounted_reward = (x) => 1 - (x / discounted_steps)

      for (let idx = total_steps; idx > Math.max(0, total_steps - discounted_steps); idx--) {
        ep_trans[idx - 1][2] = discounted_reward(discounted_steps - (total_steps - idx))
      }
    }

    this.transitions_automatic.push(...ep_trans)
    let transitions_size = 3000
    if (this.transitions_automatic.length > transitions_size) {
      this.transitions_automatic = this.transitions_automatic.slice(this.transitions_automatic.length - transitions_size)
    }

    let i = 0
    if (this.mode == mode_original && i < 4) {
      i++
      await policy_network.train_from_computer(this.transitions_automatic)
    }

    if (this.mode == 'train') {
      setTimeout(() => { if (this.mode==mode_original) { this.trainEpisode() } }, 10) // let some time for browser to handle ui stuff
    }
  }

  async trainShow() {
    this.changeMode('train_show')
    await tf.nextFrame()
    while (this.mode == 'train_show') { await this.trainEpisode() }
  }

  async train() {
    this.changeMode('train')
    await tf.nextFrame()
    this.trainEpisode()
  }

  async eval() {
    this.changeMode('eval')
    while (this.mode == 'eval') {
      let force = policy_network.predict_action(cart_pole) - 1
      let reward = cart_pole.step(force)
      cart_pole.draw(canvas)
      await tf.nextFrame()  // Unblock UI thread.

      if (reward < 1) {
        this.consoleLog(`Evaluation episode ${this.episode_num}, score: ${cart_pole.step_count}`)
        this.resetCartPole()
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
    model.add(tf.layers.dense({ units: 3 }));
    // model.add(tf.layers.dense({units: 3, activation: 'softmax'}));
    // model.add(tf.layers.dense({ units: 3, activation: 'relu' }));

    console.log("New Model: " + JSON.stringify(model.outputs[0].shape));

    const optimizer = tf.train.adam(0.01)
    this.optimizer = optimizer
    model.compile({
      optimizer: optimizer,
      loss: 'meanSquaredError',
      // metrics: ['accuracy'],
    });

    return model;
  }

  predict_action(cart_pole, randomized = false) {
    return tf.tidy(() => {
      const logits = this.model.predict(tf.tensor2d([cart_pole.observation()]));
      if (randomized) {
        // logits.print() // log().flatten().print()
        return tf.multinomial(logits.flatten().softmax(), 1).arraySync()[0]
      } else {
        const action = logits.argMax(1)
        return action.arraySync()[0]
      }
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

    console.log(`PolicyNetwork.train_from_user training model with ${transitions.length} transitions, loss was ${loss}`)

    return loss
  }

  async train_from_computer(transitions) {
    let minibatch_size = 32
    // let loss_info = ''
    if (transitions.length >= minibatch_size) {
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
      // This is probably so wrong way to do it. There is probably much more elegant way of modifying
      // the tensors directly and not copying so much but I didn't use time to check tensorflow.js manuals.
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

