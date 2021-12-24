#include <cstdio>
#include <emscripten.h>
#include "tensorflow/lite/kernels/register.h"
#include "tensorflow/lite/model.h"
#include "mediapipe/util/tflite/operations/transpose_conv_bias.h"

char* getModelBufferMemoryOffset();
float* getInputMemoryOffset();
int getInputHeight();
int getInputWidth();
int getInputChannelCount();
float* getOutputMemoryOffset();
int getOutputHeight();
int getOutputWidth();
int getOutputChannelCount();
int loadModel(int bufferSize);
int runInference();