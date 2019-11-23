import numpy as np
import random
import signal
import collections
import time

import torch
import torch.nn as nn
from torch.autograd import Variable

from cffi import FFI
ffi = FFI()
ffi.cdef("""
    typedef struct cart_pole {
        float x, velocity, pole_angle, pole_velocity;
        int step_count;
    } cart_pole;
    typedef cart_pole* cart_pole_ptr;

    cart_pole_ptr new();
    void free(cart_pole_ptr);
    void reset(cart_pole_ptr);
    void status(cart_pole_ptr);
    int step(cart_pole_ptr, float force);

    typedef void* window_ptr;
    window_ptr window_new();
    void window_free(window_ptr);
    void window_draw(window_ptr, cart_pole_ptr);
""")
C = ffi.dlopen(
    '/home/ohu/koodi/kesken/rusted_cart_pole/target/debug/librusted_cart_pole.so')


def get_model(obs=4, acts=3):
    model = nn.Sequential(
        nn.Linear(obs, 8),
        torch.nn.ReLU(),
        nn.Linear(8, 8),
        torch.nn.ReLU(),
        nn.Linear(8, acts)
    )
    return model


class KeyboardCtrlC:
    def __init__(self):
        self.key_pressed = False
        signal.signal(signal.SIGINT, self.key_pressed_m)
        signal.signal(signal.SIGTERM, self.key_pressed_m)

    def key_pressed_m(self, signum, frame):
        self.key_pressed = True


def pole_observation(pole):
    return np.array([pole.x, pole.velocity, pole.pole_angle, pole.pole_velocity])


keyboard_input = KeyboardCtrlC()
pole = C.new()
model = get_model().double()  # .cuda()


def train(max_episodes, print_log_episodes=20):
    transitions = collections.deque(maxlen=3000)
    episodes = collections.deque(maxlen=100)
    start_time = time.time()

    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    loss_op = torch.nn.MSELoss()

    for episode in range(max_episodes):
        C.reset(pole)
        observation = pole_observation(pole)
        ep_trans = collections.deque(maxlen=200)


        while True:
            old_observation = observation

            # e-greedy action selection
            epsilon = max(0.02, 0.7 * pow(0.99, episode))
            if np.random.random() < epsilon:
                action = np.random.choice(range(3))
            else:
                x = Variable(torch.from_numpy(np.expand_dims(old_observation, 0)))  # .cuda()
                action = model(x)[0].argmax().item()

            # # another choice, Boltzmann Approach for action selection
            # x = Variable(torch.from_numpy(np.expand_dims(old_observation, 0)))
            # action_prob = torch.nn.functional.softmax(model(x)[0])
            # action = np.random.choice([0, 1, 2], p=action_prob.detach().numpy())

            reward = C.step(pole, action-1)  # Actions are 0,1,2. Translate it to force -1, 0, 1
            observation = pole_observation(pole)
            ep_trans.append([old_observation, action, reward, observation])

            if reward == 0 or pole.step_count > 400:
                break

            if keyboard_input.key_pressed:
                print("Started python console. Quit with 'ctrl-d' or continue with 'c'")
                import ipdb; ipdb.set_trace()

        # by default all rewards are 1, but discounted if we failed at the game
        # rewards range [-100..0] are discounted starting from 1 to -1 for the last action
        discounted_steps = 100
        total_steps = len(ep_trans)
        if ep_trans[-1][2] == 0:  # failed at the game, last reward == 0
            discounted_rewards = [(0.5 - x/discounted_steps)*2 for x in range(0, discounted_steps+1)]

            for idx in range(total_steps, max(0, total_steps-discounted_steps), -1):
                ep_trans[idx-1][2] = discounted_rewards.pop()

        transitions.extend(ep_trans)
        episodes.append(len(ep_trans))

        if episode % print_log_episodes == 0:
            print('Episode {}, last-100-avg-reward: {}, epsilon: {:.2f}, seconds: {:.2f}'.format(episode, sum(episodes)//len(episodes), epsilon, time.time()-start_time))
        if sum(episodes)/len(episodes) > 195:
            print('SOLVED AT EPISODE {}, time: {:.2f}s'.format(episode, time.time()-start_time))
            return episode

        minibatch_size = 32
        if len(transitions) >= minibatch_size:
            for _ in range(4):
                sample_transitions = random.sample(transitions, minibatch_size)
                sample_transitions = np.array(sample_transitions)

                train_x_org = np.array([np.array(x) for x in sample_transitions[:, 0]])
                train_x = Variable(torch.from_numpy(train_x_org))  # .cuda()
                train_y = model(train_x)

                train_y_target = train_y.clone().detach()
                for idx, arr in enumerate(sample_transitions):
                    state, action, reward, next_state = arr
                    train_y_target[idx, action] = reward

                loss = loss_op(train_y, train_y_target)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()


def run_model(window):
    C.reset(pole)
    reward = 1

    while reward != 0 and pole.step_count < 1000:
        C.window_draw(window, pole)
        observation = pole_observation(pole)
        x = Variable(torch.from_numpy(np.expand_dims(observation, 0)))  # .cuda()
        action = model(x)[0].argmax().item()

        # reward = C.step(pole, 0)
        reward = C.step(pole, action-1)
        time.sleep(0.02)

        if keyboard_input.key_pressed:
            print("Started python console. Quit with 'ctrl-d' or continue with 'c'")
            import ipdb; ipdb.set_trace()

    print('CartPole episode finished, total steps: {}'.format(pole.step_count))
    C.window_draw(window, pole)


if __name__ == "__main__":
    results = []
    result = train(3000)
    print("Training done")

    window = C.window_new()

    print("Showing demos")
    for i in range(5):
        run_model(window)

    # import ipdb; ipdb.set_trace()

    C.window_free(window)


