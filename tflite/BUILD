# Description:
#   TensorFlow Lite minimal inference tool.

load("@org_tensorflow//tensorflow/lite:build_def.bzl", "tflite_linkopts")

cc_library(
  name = "mytflite",
  srcs = ["mytflite.cc"],
  hdrs=["mytflite.h"],
  linkopts = tflite_linkopts() ,
  deps = [
    "@org_tensorflow//tensorflow/lite:framework",
    "@org_tensorflow//tensorflow/lite:tflite_with_xnnpack",
    "@org_tensorflow//tensorflow/lite/kernels:builtin_ops",
    "@org_mediapipe//mediapipe/util/tflite/operations:transpose_conv_bias",
  ],
    alwayslink = True,
    linkstatic = 1, # 默认值

)

cc_binary(
  name = "runmytflite",
  srcs = ["test.cc"],
  linkopts = tflite_linkopts() ,
  deps = [
    ":mytflite"
  ],
)