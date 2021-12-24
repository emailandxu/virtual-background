import { BlendMode } from '../../core/helpers/postProcessingHelper'
import {
  compileShader,
  createPiplelineStageProgram,
  createTexture,
  glsl
} from '../helpers/webglHelper'

export type BackgroundImageStage = {
  render(): void
  updateCoverage(coverage: [number, number]): void
  updateLightWrapping(lightWrapping: number): void
  updateBlendMode(blendMode: BlendMode): void
  cleanUp(): void
}

export function buildBackgroundImageStage(
  gl: WebGL2RenderingContext,
  positionBuffer: WebGLBuffer,
  texCoordBuffer: WebGLBuffer,
  personMaskTexture: WebGLTexture,
  backgroundImage: HTMLImageElement | null,
  canvas: HTMLCanvasElement
): BackgroundImageStage {
  const vertexShaderSource = glsl`#version 300 es

    uniform vec2 u_backgroundScale;
    uniform vec2 u_backgroundOffset;

    in vec2 a_position;
    in vec2 a_texCoord;

    out vec2 v_texCoord;
    out vec2 v_backgroundCoord;

    void main() {
      // Flipping Y is required when rendering to canvas
      gl_Position = vec4(a_position * vec2(1.0, -1.0), 0.0, 1.0);
      v_texCoord = a_texCoord;
      v_backgroundCoord = a_texCoord * u_backgroundScale + u_backgroundOffset;
    }
  `

  const fragmentShaderSource = glsl`#version 300 es

    precision highp float;

    uniform sampler2D u_inputFrame;
    uniform sampler2D u_personMask;
    uniform sampler2D u_background;
    uniform vec2 u_coverage;
    uniform float u_lightWrapping;
    uniform float u_blendMode;

    in vec2 v_texCoord;
    in vec2 v_backgroundCoord;

    out vec4 outColor;

    vec3 screen(vec3 a, vec3 b) {
      return 1.0 - (1.0 - a) * (1.0 - b);
    }

    vec3 linearDodge(vec3 a, vec3 b) {
      return a + b;
    }

    #define INV_SQRT_OF_2PI 0.39894228040143267793994605993439  // 1.0/SQRT_OF_2PI
    #define INV_PI 0.31830988618379067153776752674503


  vec4 smartDeNoise(sampler2D tex, vec2 uv, float sigma, float kSigma, float threshold)
  {
      float radius = round(kSigma*sigma);
      float radQ = radius * radius;

      float invSigmaQx2 = .5 / (sigma * sigma);      // 1.0 / (sigma^2 * 2.0)
      float invSigmaQx2PI = INV_PI * invSigmaQx2;    // 1.0 / (sqrt(PI) * sigma)

      float invThresholdSqx2 = .5 / (threshold * threshold);     // 1.0 / (sigma^2 * 2.0)
      float invThresholdSqrt2PI = INV_SQRT_OF_2PI / threshold;   // 1.0 / (sqrt(2*PI) * sigma)

      vec4 centrPx = texture(tex,uv);

      float zBuff = 0.0;
      vec4 aBuff = vec4(0.0);
      vec2 size = vec2(textureSize(tex, 0));

      for(float x=-radius; x <= radius; x++) {
          float pt = sqrt(radQ-x*x);  // pt = yRadius: have circular trend
          for(float y=-pt; y <= pt; y++) {
              vec2 d = vec2(x,y);

              float blurFactor = exp( -dot(d , d) * invSigmaQx2 ) * invSigmaQx2PI;

              vec4 walkPx =  texture(tex,uv+d/size);

              vec4 dC = walkPx-centrPx;
              float deltaFactor = exp( -dot(dC, dC) * invThresholdSqx2) * invThresholdSqrt2PI * blurFactor;

              zBuff += deltaFactor;
              aBuff += deltaFactor*walkPx;
          }
      }
      return (aBuff/zBuff) * 1.1;
  }

    void main() {
      vec3 frameColor = texture(u_inputFrame, v_texCoord).rgb;

      vec4 smoothedFrameColor = smartDeNoise(u_inputFrame, v_texCoord, 2.5, 2., .100);

      // vec3 backgroundColor = texture(u_background, v_backgroundCoord).rgb;
      vec3 backgroundColor = vec3(0,0,0);
      float personMask = texture(u_personMask, v_texCoord).a;

      float lightWrapMask = 1.0 - max(0.0, personMask - u_coverage.y) / (1.0 - u_coverage.y);
      vec3 lightWrap = u_lightWrapping * lightWrapMask * backgroundColor;
      frameColor = u_blendMode * linearDodge(frameColor, lightWrap) +
        (1.0 - u_blendMode) * screen(frameColor, lightWrap);

      personMask = smoothstep(u_coverage.x, u_coverage.y, personMask);

      vec3 person = personMask * smoothedFrameColor.xyz;
      vec3  background = frameColor * (1. - personMask);
      outColor = vec4( person + background ,  1.0);

    }
  `

  const { width: outputWidth, height: outputHeight } = canvas
  const outputRatio = outputWidth / outputHeight

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  )
  const program = createPiplelineStageProgram(
    gl,
    vertexShader,
    fragmentShader,
    positionBuffer,
    texCoordBuffer
  )
  const backgroundScaleLocation = gl.getUniformLocation(
    program,
    'u_backgroundScale'
  )
  const backgroundOffsetLocation = gl.getUniformLocation(
    program,
    'u_backgroundOffset'
  )
  const inputFrameLocation = gl.getUniformLocation(program, 'u_inputFrame')
  const personMaskLocation = gl.getUniformLocation(program, 'u_personMask')
  const backgroundLocation = gl.getUniformLocation(program, 'u_background')
  const coverageLocation = gl.getUniformLocation(program, 'u_coverage')
  const lightWrappingLocation = gl.getUniformLocation(
    program,
    'u_lightWrapping'
  )
  const blendModeLocation = gl.getUniformLocation(program, 'u_blendMode')

  gl.useProgram(program)
  gl.uniform2f(backgroundScaleLocation, 1, 1)
  gl.uniform2f(backgroundOffsetLocation, 0, 0)
  gl.uniform1i(inputFrameLocation, 0)
  gl.uniform1i(personMaskLocation, 1)
  gl.uniform2f(coverageLocation, 0, 1)
  gl.uniform1f(lightWrappingLocation, 0)
  gl.uniform1f(blendModeLocation, 0)

  let backgroundTexture: WebGLTexture | null = null
  // TODO Find a better to handle background being loaded
  if (backgroundImage?.complete) {
    updateBackgroundImage(backgroundImage)
  } else if (backgroundImage) {
    backgroundImage.onload = () => {
      updateBackgroundImage(backgroundImage)
    }
  }

  function render() {
    gl.viewport(0, 0, outputWidth, outputHeight)
    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, personMaskTexture)
    if (backgroundTexture !== null) {
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture)
      // TODO Handle correctly the background not loaded yet
      gl.uniform1i(backgroundLocation, 2)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  function updateBackgroundImage(backgroundImage: HTMLImageElement) {
    backgroundTexture = createTexture(
      gl,
      gl.RGBA8,
      backgroundImage.naturalWidth,
      backgroundImage.naturalHeight,
      gl.LINEAR,
      gl.LINEAR
    )
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      backgroundImage.naturalWidth,
      backgroundImage.naturalHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      backgroundImage
    )

    let xOffset = 0
    let yOffset = 0
    let backgroundWidth = backgroundImage.naturalWidth
    let backgroundHeight = backgroundImage.naturalHeight
    const backgroundRatio = backgroundWidth / backgroundHeight
    if (backgroundRatio < outputRatio) {
      backgroundHeight = backgroundWidth / outputRatio
      yOffset = (backgroundImage.naturalHeight - backgroundHeight) / 2
    } else {
      backgroundWidth = backgroundHeight * outputRatio
      xOffset = (backgroundImage.naturalWidth - backgroundWidth) / 2
    }

    const xScale = backgroundWidth / backgroundImage.naturalWidth
    const yScale = backgroundHeight / backgroundImage.naturalHeight
    xOffset /= backgroundImage.naturalWidth
    yOffset /= backgroundImage.naturalHeight

    gl.uniform2f(backgroundScaleLocation, xScale, yScale)
    gl.uniform2f(backgroundOffsetLocation, xOffset, yOffset)
  }

  function updateCoverage(coverage: [number, number]) {
    gl.useProgram(program)
    gl.uniform2f(coverageLocation, coverage[0], coverage[1])
    console.log("coverage", coverage);
  }

  function updateLightWrapping(lightWrapping: number) {
    gl.useProgram(program)
    gl.uniform1f(lightWrappingLocation, lightWrapping)
    console.log("lw", lightWrapping);
  }

  function updateBlendMode(blendMode: BlendMode) {
    gl.useProgram(program)
    gl.uniform1f(blendModeLocation, blendMode === 'screen' ? 0 : 1)
  }

  function cleanUp() {
    gl.deleteTexture(backgroundTexture)
    gl.deleteProgram(program)
    gl.deleteShader(fragmentShader)
    gl.deleteShader(vertexShader)
  }

  return {
    render,
    updateCoverage,
    updateLightWrapping,
    updateBlendMode,
    cleanUp,
  }
}
