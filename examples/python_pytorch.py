from time import sleep

from cffi import FFI
ffi = FFI()
# ffi.cdef("int callable_from_c(int);")
ffi.cdef("""
    typedef struct cart_pole {
        float x, velocity, pole_angle, pole_velocity;
    } cart_pole;

    typedef void* cart_pole_ptr;

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
C = ffi.dlopen('/home/ohu/koodi/kesken/rusted_cart_pole/target/debug/librusted_cart_pole.so')



print("In python")
# print(C.callable_from_c(9))

pole = C.new()

C.status(pole)
print(C.status(pole))
C.status(pole)
res = C.status(pole)

print("Stepping started")

window = C.window_new()


for i in range(100):
    reward = C.step(pole, 0)
    C.window_draw(window, pole)
    if reward < 1:
        print("Resetting pole")
        C.reset(pole)
    sleep(0.02)

print("Stepped all")

C.window_free(window)

# import ipdb; ipdb.set_trace()
# # import pdb; pdb.set_trace()


# # C = ffi.dlopen("../ffi/target/debug/librusted_cart_pole.so")

# # print(C.double(9))

# C.callable_from_c(9)

