#include "mytflite.h"
#include <cstdio>
#include "tensorflow/lite/kernels/register.h"
#include "tensorflow/lite/model.h"
#include "mediapipe/util/tflite/operations/transpose_conv_bias.h"


#define CHECK_TFLITE_ERROR(x)                                    \
    if (!(x))                                                    \
    {                                                            \
        fprintf(stderr, "Error at %s:%d\n", __FILE__, __LINE__); \
        return 1;                                                \
    }

std::unique_ptr<tflite::Interpreter> interpreter;

int run(char * modelData, int modelSize, float * imgFloat, int imgSize, float * tf_output, int maskSize){
    if (interpreter == nullptr){
        printf("init interpreter\n");
        // Load model
        std::unique_ptr<tflite::FlatBufferModel> model =
            tflite::FlatBufferModel::BuildFromBuffer(modelData, modelSize);
        CHECK_TFLITE_ERROR(model != nullptr);

        // Build the interpreter with the InterpreterBuilder.
        // Note: all Interpreters should be built with the InterpreterBuilder,
        // which allocates memory for the Interpreter and does various set up
        // tasks so that the Interpreter can read the provided model.
        tflite::ops::builtin::BuiltinOpResolver resolver;
        resolver.AddCustom("Convolution2DTransposeBias",
                        mediapipe::tflite_operations::RegisterConvolution2DTransposeBias());
        tflite::InterpreterBuilder builder(*model, resolver);
        builder(&interpreter);
        CHECK_TFLITE_ERROR(interpreter != nullptr);

        // Allocate tensor buffers.
        CHECK_TFLITE_ERROR(interpreter->AllocateTensors() == kTfLiteOk);
    }
    memcpy(interpreter->typed_input_tensor<float>(0), imgFloat, imgSize * sizeof(float));
    CHECK_TFLITE_ERROR(interpreter->Invoke() == kTfLiteOk);
    memcpy(tf_output, interpreter->typed_output_tensor<float>(0), maskSize * sizeof(float));

    return 0;
}
