import { CartPole, wasm_setup } from "rusted-cart-pole";

wasm_setup();

const canvas = document.getElementById("canvas");
const status = document.getElementById("status");

CartPole.prototype.observation = function () {
  return [this.x, this.velocity, this.pole_angle, this.pole_velocity]
}
window.CartPole = CartPole
// var cart_pole = CartPole.new()
// window.cart_pole = cart_pole

//////////////////////////////////////////////////////////////

class UI {
  constructor() {
    this.transitions_user = []
    this.transitions_automatic = []

    this.vis_real = []; this.vis_smoothed = []; this.vis_smoothed_tmp = []
    this.vis_eval_real = []; this.vis_eval_smoothed = []; this.vis_eval_smoothed_tmp = []

    this.episode_num = 0
    this.mode = ''

    document.getElementById("ui_type_user").onclick = () => { this.userPlay() }
    document.getElementById("ui_type_train_show").onclick = () => { this.trainShow() }
    document.getElementById("ui_type_train").onclick = () => { this.train() }
    document.getElementById("ui_type_eval").onclick = () => { this.evalShow() }
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
  }

  plotScores() {
    tfvis.render.linechart(this.vis_container,
      // Newer version of tfvis would have supported colors, but then again it didn't support non-continuous lines
      // { values: [this.vis_real, this.vis_smoothed, this.vis_eval_real, this.vis_eval_smoothed],
      //   series: ['Train', 'Train Smoothed', 'Eval', 'Eval Smoothed'] },
      {
        values: [this.vis_smoothed, this.vis_eval_smoothed,],
        series: ['Train', 'Eval',]
      },
      {
        xLabel: 'Episode', yLabel: 'Score',
      }
    )
  }

  cartPoleNew() {
    this.episode_num += 1
    return CartPole.new()

  }
  cartPoleReset(cart_pole) {
    this.episode_num += 1
    cart_pole.reset()
  }

  trainSaveScore(score) {
    this.vis_real.push({ x: this.episode_num, y: score })
    this.vis_smoothed_tmp.push(score)
    this.vis_smoothed_tmp = this.vis_smoothed_tmp.slice(this.vis_smoothed_tmp.length - 25)
    this.vis_smoothed.push({ x: this.episode_num, y: this.vis_smoothed_tmp.reduce((prev, curr) => prev + curr) / this.vis_smoothed_tmp.length })
  }

  evalSaveScore(score) {
    this.vis_eval_real.push({ x: this.episode_num, y: score })
    this.vis_eval_smoothed_tmp.push(score)
    this.vis_eval_smoothed_tmp = this.vis_eval_smoothed_tmp.slice(this.vis_eval_smoothed_tmp.length - 25)
    this.vis_eval_smoothed.push({ x: this.episode_num, y: this.vis_eval_smoothed_tmp.reduce((prev, curr) => prev + curr) / this.vis_eval_smoothed_tmp.length })
  }

  async userDataTrain(cart_pole) {
    this.consoleLog(`Training user-mimicking 4 epochs with sample size: ${this.transitions_user.length}.`)
    policy_network.trainFromUser(cart_pole, this.transitions_user)
  }

  async userPlay() {
    this.changeMode('user')
    let timing = 0
    const cart_pole = this.cartPoleNew()
    for (let i = 0; i < 5; i++) { await tf.nextFrame() }
    while (this.mode == 'user') {
      if (cart_pole.step_count == 0) {
        this.consoleLog('Game running, use left/right arrow-keys to move.')
      }
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

      if (cart_pole.step_count % 100 == 0) { this.userDataTrain() }

      if (reward < 1) {
        this.consoleLog(`User episode ${this.episode_num}, score: ${cart_pole.step_count}. Press arrow-keys to start.`)
        this.plotScores()
        policy_network.trainFromUser(cart_pole, this.transitions_user)
        this.trainSaveScore(cart_pole.step_count)
        this.cartPoleReset(cart_pole)
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

  async trainEpisode(cart_pole) {
    let mode_original = this.mode
    const ep_trans = []
    let reward = 1;

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
      action = policy_network.predictAction(cart_pole, true)

      reward = cart_pole.step(action - 1)
      ep_trans.push([observation, action, reward])

      if (this.mode == 'train_show') {
        cart_pole.draw(canvas)
        await tf.nextFrame()
      }
    }

    // this.consoleLog(`Trained episode ${this.episode_num}, score: ${cart_pole.step_count}, epsilon: ${Number(Math.round(epsilon + 'e2') + 'e-2')}`)
    this.consoleLog(`Trained episode ${this.episode_num}, score: ${cart_pole.step_count}`)

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

    this.trainSaveScore(cart_pole.step_count)

    let i = 0
    if (this.mode == mode_original && i < 4) {
      i++
      await policy_network.trainFromComputer(this.transitions_automatic)
    }
    if (this.mode == mode_original) {
      if (this.episode_num % 10 == 0 || this.episode_num <= 1) {
        await this.evalEpisode(cart_pole)
      }
      if (this.episode_num % 10 == 0 || this.episode_num < 10) {
        // for some reason continous tfvis.render causes memory bloating, so not doing too often
        this.plotScores()
      }
      this.cartPoleReset(cart_pole)
    }

    if (this.mode == 'train') {
      setTimeout(() => { if (this.mode == mode_original) { this.trainEpisode(cart_pole) } }, 10) // let some time for browser to handle ui stuff
    }
  }

  async trainShow() {
    this.changeMode('train_show')
    for (let i = 0; i < 5; i++) { await tf.nextFrame() }
    const cart_pole = this.cartPoleNew()
    while (this.mode == 'train_show') { await this.trainEpisode(cart_pole) }
  }

  async train() {
    this.changeMode('train')
    for (let i = 0; i < 5; i++) { await tf.nextFrame() }
    this.trainEpisode(this.cartPoleNew())
  }

  async evalEpisode(cart_pole) {
    let reward = 1
    cart_pole.reset()
    while (reward > 0) {
      let force = policy_network.predictAction(cart_pole) - 1
      reward = cart_pole.step(force)
    }
    this.evalSaveScore(cart_pole.step_count)
    cart_pole.reset()
  }

  async evalShow() {
    this.changeMode('eval')
    const cart_pole = this.cartPoleNew()
    while (this.mode == 'eval') {
      let force = policy_network.predictAction(cart_pole) - 1
      let reward = cart_pole.step(force)
      cart_pole.draw(canvas)
      await tf.nextFrame() // Unblock UI thread.

      if (reward < 1) {
        this.consoleLog(`Evaluation episode ${this.episode_num}, score: ${cart_pole.step_count}`)
        this.evalSaveScore(cart_pole.step_count)
        this.cartPoleReset(cart_pole)
        this.plotScores()
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

  predictAction(cart_pole, randomized = false) {
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

  async trainFromUser(transitions) {
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

  async trainFromComputer(transitions) {
    let minibatch_size = 32
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

