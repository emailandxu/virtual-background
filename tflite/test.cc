#include "mytflite.h"
#include <fstream>
#include <iostream>


void dumpTGA(char *tga_file, short W, short H, unsigned char *pixel_data) {
    FILE *out = fopen(tga_file, "w");
    short TGAhead[] = {0, 2, 0, 0, 0, 0, W, H, 32};
    fwrite(&TGAhead, sizeof(TGAhead), 1, out);
    fwrite(pixel_data, 4 * W * H, 1, out);
    fclose(out);
}

int main()
{
    
    int bufferSize = 249024;
    char modelData[bufferSize];

    std::ifstream modelFile("/tflite/mlkit.tflite", std::ios::in | std::ios::binary);
    modelFile.read(&modelData[0], bufferSize * sizeof(char));

    char img[256 * 256 * 3];
    float imgFloat[256 * 256 * 3];

    std::ifstream imageFile("/tflite/resize.bytes", std::ios::in | std::ios::binary);
    imageFile.read(&img[0], 256 * 256 * 3 * sizeof(char));
    for(int i=0;i<256*256*3;i++)  imgFloat[i] = img[i] / 255.;
    printf("image 0:%d-%f\n", img[10], imgFloat[10]);



    float tf_output[256*256];
    for(int i=0;i<256*256;i++) tf_output[i] = 1.0;


    run(modelData, bufferSize, imgFloat, 256*256*3, &tf_output[0], 256*256);

    printf("probability 0: %f\n", tf_output[0]);

    for(int i=0;i<256*256;i++){
        if(tf_output[i] > 0.0){
            printf("probability-a %d: %f\n",i, tf_output[i]);
        }
    }

    unsigned char output[256*256*4];
    
    for(int i=0;i<256*256;i++){
        output[i*4] = img[i*3];
        output[i*4 + 1] = img[i*3+1];
        output[i*4 + 2] = img[i*3+2];
        output[i*4 + 3] = tf_output[i] * 255;
    }

    dumpTGA( (char *) "/tflite/a.tga", 256, 256, output);

}