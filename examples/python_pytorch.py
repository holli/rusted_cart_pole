


# import myrustlib


from cffi import FFI
ffi = FFI()

print("Begin")
# ffi.cdef("int callable_from_c(int);")
# ffi.cdef("""
#     int callable_from_c(int);

#     typedef struct {
#         float x, velocity, pole_angle, pole_velocity;
#     } cart_pole;

#     cart_pole cp_new();
#     void cp_free(cart_pole);
#     void cp_step(cart_pole, float force);
# """)
ffi.cdef("""
    int callable_from_c(int);

    typedef struct cart_pole_s {
        float x, y, i, j;
    } cart_pole_o;

    typedef void* cart_pole_episode;

    cart_pole_episode cp_new();
    cart_pole_o status(cart_pole_episode);
    void step(cart_pole_episode, float force);
    void free(cart_pole_episode);
""")


C = ffi.dlopen('/home/ohu/koodi/kesken/rusted_cart_pole/target/debug/librusted_cart_pole.so')

pole = C.cp_new()

C.status(pole)
C.status(pole)
res = C.status(pole)

print("Stepping")
C.step(pole, 2)
print("Stepped first")
C.step(pole, 3)

import ipdb; ipdb.set_trace()
# import pdb; pdb.set_trace()


# C = ffi.dlopen("../ffi/target/debug/librusted_cart_pole.so")

# print(C.double(9))

C.callable_from_c(9)

