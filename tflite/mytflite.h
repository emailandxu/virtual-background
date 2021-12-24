int run(char * modelData, int modelSize, float * imgFloat, int imgSize, float * tf_output, int maskSize);

int invoke();

void setInput(float * imgFloat, int bufferSize);
void getOutput(float * tf_output, int bufferSize);