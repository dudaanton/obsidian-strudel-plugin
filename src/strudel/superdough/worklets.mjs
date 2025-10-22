// coarse, crush, and shape processors adapted from dktr0's webdirt: https://github.com/dktr0/WebDirt/blob/5ce3d698362c54d6e1b68acc47eb2955ac62c793/dist/AudioWorklets.js
// LICENSE GNU General Public License v3.0 see https://github.com/dktr0/WebDirt/blob/main/LICENSE
// TOFIX: THIS FILE DOES NOT SUPPORT IMPORTS ON DEPOLYMENT

import OLAProcessor from './ola-processor';
import FFT from './fft.js';
import { getDistortionAlgorithm } from './helpers.mjs';

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const mod = (n, m) => ((n % m) + m) % m;
const lerp = (a, b, n) => n * (b - a) + a;
const pv = (arr, n) => arr[n] ?? arr[0];
const frac = (x) => x - Math.floor(x);
const ffloor = (x) => x | 0; // fast floor for non-negative

const getUnisonDetune = (unison, detune, voiceIndex) => {
  if (unison < 2) {
    return 0;
  }
  return lerp(-detune * 0.5, detune * 0.5, voiceIndex / (unison - 1));
};
const applySemitoneDetuneToFrequency = (frequency, detune) => {
  return frequency * Math.pow(2, detune / 12);
};

// Restrict phase to the range [0, maxPhase) via wrapping
function wrapPhase(phase, maxPhase = 1) {
  if (phase >= maxPhase) {
    phase -= maxPhase;
  } else if (phase < 0) {
    phase += maxPhase;
  }
  return phase;
}
const blockSize = 128;
// Smooth waveshape near discontinuities to remove frequencies above Nyquist and prevent aliasing
// referenced from https://www.kvraudio.com/forum/viewtopic.php?t=375517
function polyBlep(phase, dt) {
  dt = Math.min(dt, 1 - dt);
  // Start of cycle
  if (phase < dt) {
    phase /= dt;
    // 2 * (phase - phase^2/2 - 0.5)
    return phase + phase - phase * phase - 1;
  }

  // End of cycle
  else if (phase > 1 - dt) {
    phase = (phase - 1) / dt;
    // 2 * (phase^2/2 + phase + 0.5)
    return phase * phase + phase + phase + 1;
  }

  // 0 otherwise
  else {
    return 0;
  }
}
// The order is important for dough integration
const waveshapes = {
  tri(phase, skew = 0.5) {
    const x = 1 - skew;
    if (phase >= skew) {
      return 1 / x - phase / x;
    }
    return phase / skew;
  },
  sine(phase) {
    return Math.sin(Math.PI * 2 * phase) * 0.5 + 0.5;
  },
  ramp(phase) {
    return phase;
  },
  saw(phase) {
    return 1 - phase;
  },

  square(phase, skew = 0.5) {
    if (phase >= skew) {
      return 0;
    }
    return 1;
  },
  custom(phase, values = [0, 1]) {
    const numParts = values.length - 1;
    const currPart = Math.floor(phase * numParts);

    const partLength = 1 / numParts;
    const startVal = clamp(values[currPart], 0, 1);
    const endVal = clamp(values[currPart + 1], 0, 1);
    const y2 = endVal;
    const y1 = startVal;
    const x1 = 0;
    const x2 = partLength;
    const slope = (y2 - y1) / (x2 - x1);
    return slope * (phase - partLength * currPart) + startVal;
  },
  sawblep(phase, dt) {
    const v = 2 * phase - 1;
    return v - polyBlep(phase, dt);
  },
};
function getParamValue(block, param) {
  if (param.length > 1) {
    return param[block];
  }
  return param[0];
}

const waveShapeNames = Object.keys(waveshapes);
class LFOProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'begin', defaultValue: 0 },
      { name: 'time', defaultValue: 0 },
      { name: 'end', defaultValue: 0 },
      { name: 'frequency', defaultValue: 0.5 },
      { name: 'skew', defaultValue: 0.5 },
      { name: 'depth', defaultValue: 1 },
      { name: 'phaseoffset', defaultValue: 0 },
      { name: 'shape', defaultValue: 0 },
      { name: 'curve', defaultValue: 1 },
      { name: 'dcoffset', defaultValue: 0 },
      { name: 'min', defaultValue: 0 },
      { name: 'max', defaultValue: 1 },
    ];
  }

  constructor() {
    super();
    this.phase;
  }

  incrementPhase(dt) {
    this.phase += dt;
    if (this.phase > 1.0) {
      this.phase = this.phase - 1;
    }
  }

  process(_inputs, outputs, parameters) {
    const begin = parameters['begin'][0];
    if (currentTime >= parameters.end[0]) {
      return false;
    }
    if (currentTime <= begin) {
      return true;
    }

    const output = outputs[0];
    const frequency = parameters['frequency'][0];

    const time = parameters['time'][0];
    const depth = parameters['depth'][0];
    const skew = parameters['skew'][0];
    const phaseoffset = parameters['phaseoffset'][0];

    const curve = parameters['curve'][0];

    const dcoffset = parameters['dcoffset'][0];
    const min = parameters['min'][0];
    const max = parameters['max'][0];
    const shape = waveShapeNames[parameters['shape'][0]];

    const blockSize = output[0].length ?? 0;

    if (this.phase == null) {
      this.phase = mod(time * frequency + phaseoffset, 1);
    }
    const dt = frequency / sampleRate;
    for (let n = 0; n < blockSize; n++) {
      for (let i = 0; i < output.length; i++) {
        let modval = (waveshapes[shape](this.phase, skew) + dcoffset) * depth;
        modval = Math.pow(modval, curve);
        output[i][n] = clamp(modval, min, max);
      }
      this.incrementPhase(dt);
    }

    return true;
  }
}
registerProcessor('lfo-processor', LFOProcessor);

class CoarseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'coarse', defaultValue: 1 }];
  }

  constructor() {
    super();
    this.started = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);
    if (this.started && !hasInput) {
      return false;
    }
    this.started = hasInput;

    let coarse = parameters.coarse[0] ?? 0;
    coarse = Math.max(1, coarse);
    for (let n = 0; n < blockSize; n++) {
      for (let i = 0; i < input.length; i++) {
        output[i][n] = n % coarse === 0 ? input[i][n] : output[i][n - 1];
      }
    }
    return true;
  }
}
registerProcessor('coarse-processor', CoarseProcessor);

class CrushProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'crush', defaultValue: 0 }];
  }

  constructor() {
    super();
    this.started = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);
    if (this.started && !hasInput) {
      return false;
    }
    this.started = hasInput;

    let crush = parameters.crush[0] ?? 8;
    crush = Math.max(1, crush);

    for (let n = 0; n < blockSize; n++) {
      for (let i = 0; i < input.length; i++) {
        const x = Math.pow(2, crush - 1);
        output[i][n] = Math.round(input[i][n] * x) / x;
      }
    }
    return true;
  }
}
registerProcessor('crush-processor', CrushProcessor);

class ShapeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'shape', defaultValue: 0 },
      { name: 'postgain', defaultValue: 1 },
    ];
  }

  constructor() {
    super();
    this.started = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);
    if (this.started && !hasInput) {
      return false;
    }
    this.started = hasInput;

    let shape = parameters.shape[0];
    shape = shape < 1 ? shape : 1.0 - 4e-10;
    shape = (2.0 * shape) / (1.0 - shape);
    const postgain = Math.max(0.001, Math.min(1, parameters.postgain[0]));

    for (let n = 0; n < blockSize; n++) {
      for (let i = 0; i < input.length; i++) {
        output[i][n] = (((1 + shape) * input[i][n]) / (1 + shape * Math.abs(input[i][n]))) * postgain;
      }
    }
    return true;
  }
}
registerProcessor('shape-processor', ShapeProcessor);

class TwoPoleFilter {
  s0 = 0;
  s1 = 0;
  update(s, cutoff, resonance = 0) {
    // Out of bound values can produce NaNs
    resonance = clamp(resonance, 0, 1);
    cutoff = clamp(cutoff, 0, sampleRate / 2 - 1);
    const c = clamp(2 * Math.sin(cutoff * (_PI / sampleRate)), 0, 1.14);
    const r = Math.pow(0.5, (resonance + 0.125) / 0.125);
    const mrc = 1 - r * c;
    this.s0 = mrc * this.s0 - c * this.s1 + c * s; // bpf
    this.s1 = mrc * this.s1 + c * this.s0; // lpf
    return this.s1; // return lpf by default
  }
}

class DJFProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'value', defaultValue: 0.5 }];
  }

  constructor() {
    super();
    this.filters = [new TwoPoleFilter(), new TwoPoleFilter()];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);
    this.started = hasInput;

    const value = clamp(parameters.value[0], 0, 1);
    let filterType = 'none';
    let cutoff;
    let v = 1;
    if (value > 0.51) {
      filterType = 'hipass';
      v = (value - 0.5) * 2;
    } else if (value < 0.49) {
      filterType = 'lopass';
      v = value * 2;
    }
    cutoff = Math.pow(v * 11, 4);

    for (let i = 0; i < input.length; i++) {
      for (let n = 0; n < blockSize; n++) {
        if (filterType == 'none') {
          output[i][n] = input[i][n];
        } else {
          this.filters[i].update(input[i][n], cutoff, 0.1);
          if (filterType === 'lopass') {
            output[i][n] = this.filters[i].s1;
          } else if (filterType === 'hipass') {
            output[i][n] = input[i][n] - this.filters[i].s1;
          } else {
            output[i][n] = input[i][n];
          }
        }
      }
    }
    return true;
  }
}
registerProcessor('djf-processor', DJFProcessor);

function fast_tanh(x) {
  const x2 = x * x;
  return (x * (27.0 + x2)) / (27.0 + 9.0 * x2);
}
const _PI = 3.14159265359;
//adapted from https://github.com/TheBouteillacBear/webaudioworklet-wasm?tab=MIT-1-ov-file
class LadderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 500 },
      { name: 'q', defaultValue: 1 },
      { name: 'drive', defaultValue: 0.69 },
    ];
  }

  constructor() {
    super();
    this.started = false;
    this.p0 = [0, 0];
    this.p1 = [0, 0];
    this.p2 = [0, 0];
    this.p3 = [0, 0];
    this.p32 = [0, 0];
    this.p33 = [0, 0];
    this.p34 = [0, 0];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);
    if (this.started && !hasInput) {
      return false;
    }

    this.started = hasInput;

    const resonance = parameters.q[0];
    const drive = clamp(Math.exp(parameters.drive[0]), 0.1, 2000);

    let cutoff = parameters.frequency[0];
    cutoff = (cutoff * 2 * _PI) / sampleRate;
    cutoff = cutoff > 1 ? 1 : cutoff;

    const k = Math.min(8, resonance * 0.13);
    //               drive makeup  * resonance volume loss makeup
    let makeupgain = (1 / drive) * Math.min(1.75, 1 + k);

    for (let n = 0; n < blockSize; n++) {
      for (let i = 0; i < input.length; i++) {
        const out = this.p3[i] * 0.360891 + this.p32[i] * 0.41729 + this.p33[i] * 0.177896 + this.p34[i] * 0.0439725;

        this.p34[i] = this.p33[i];
        this.p33[i] = this.p32[i];
        this.p32[i] = this.p3[i];

        this.p0[i] += (fast_tanh(input[i][n] * drive - k * out) - fast_tanh(this.p0[i])) * cutoff;
        this.p1[i] += (fast_tanh(this.p0[i]) - fast_tanh(this.p1[i])) * cutoff;
        this.p2[i] += (fast_tanh(this.p1[i]) - fast_tanh(this.p2[i])) * cutoff;
        this.p3[i] += (fast_tanh(this.p2[i]) - fast_tanh(this.p3[i])) * cutoff;

        output[i][n] = out * makeupgain;
      }
    }
    return true;
  }
}
registerProcessor('ladder-processor', LadderProcessor);

class DistortProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'distort', defaultValue: 0 },
      { name: 'postgain', defaultValue: 1 },
    ];
  }

  constructor({ processorOptions }) {
    super();
    this.started = false;
    this.algorithm = getDistortionAlgorithm(processorOptions.algorithm);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);
    if (this.started && !hasInput) {
      return false;
    }
    this.started = hasInput;
    for (let n = 0; n < blockSize; n++) {
      const postgain = clamp(pv(parameters.postgain, n), 0.001, 1);
      const shape = Math.expm1(pv(parameters.distort, n));
      for (let ch = 0; ch < input.length; ch++) {
        const x = input[ch][n];
        output[ch][n] = postgain * this.algorithm(x, shape);
      }
    }
    return true;
  }
}
registerProcessor('distort-processor', DistortProcessor);

// SUPERSAW
class SuperSawOscillatorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = [];
  }
  static get parameterDescriptors() {
    return [
      {
        name: 'begin',
        defaultValue: 0,
        max: Number.POSITIVE_INFINITY,
        min: 0,
      },

      {
        name: 'end',
        defaultValue: 0,
        max: Number.POSITIVE_INFINITY,
        min: 0,
      },

      {
        name: 'frequency',
        defaultValue: 440,
        min: Number.EPSILON,
      },

      {
        name: 'panspread',
        defaultValue: 0.4,
        min: 0,
        max: 1,
      },
      {
        name: 'freqspread',
        defaultValue: 0.2,
        min: 0,
      },
      {
        name: 'detune',
        defaultValue: 0,
        min: 0,
      },

      {
        name: 'voices',
        defaultValue: 5,
        min: 1,
      },
    ];
  }
  process(_input, outputs, params) {
    if (currentTime <= params.begin[0]) {
      return true;
    }
    if (currentTime >= params.end[0]) {
      // this.port.postMessage({ type: 'onended' });
      return false;
    }

    const output = outputs[0];

    for (let i = 0; i < output[0].length; i++) {
      const detune = pv(params.detune, i);
      const voices = pv(params.voices, i);
      const freqspread = pv(params.freqspread, i);
      const panspread = pv(params.panspread, i) * 0.5 + 0.5;
      const gain1 = Math.sqrt(1 - panspread);
      const gain2 = Math.sqrt(panspread);
      let freq = pv(params.frequency, i);
      // Main detuning
      freq = applySemitoneDetuneToFrequency(freq, detune / 100);
      for (let n = 0; n < voices; n++) {
        const isOdd = (n & 1) == 1;
        let gainL = gain1;
        let gainR = gain2;
        // invert right and left gain
        if (isOdd) {
          gainL = gain2;
          gainR = gain1;
        }
        // Individual voice detuning
        const freqVoice = applySemitoneDetuneToFrequency(freq, getUnisonDetune(voices, freqspread, n));
        // We must wrap this here because it is passed into sawblep below which
        // has domain [0, 1]
        const dt = mod(freqVoice / sampleRate, 1);
        this.phase[n] = this.phase[n] ?? Math.random();
        const v = waveshapes.sawblep(this.phase[n], dt);

        output[0][i] = output[0][i] + v * gainL;
        output[1][i] = output[1][i] + v * gainR;

        this.phase[n] = wrapPhase(this.phase[n] + dt);
      }
    }
    return true;
  }
}

registerProcessor('supersaw-oscillator', SuperSawOscillatorProcessor);

// Phase Vocoder sourced from https://github.com/olvb/phaze/tree/master?tab=readme-ov-file
const BUFFERED_BLOCK_SIZE = 2048;

function genHannWindow(length) {
  let win = new Float32Array(length);
  for (var i = 0; i < length; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / length));
  }
  return win;
}

class PhaseVocoderProcessor extends OLAProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'pitchFactor',
        defaultValue: 1.0,
      },
    ];
  }

  constructor(options) {
    options.processorOptions = {
      blockSize: BUFFERED_BLOCK_SIZE,
    };
    super(options);

    this.fftSize = this.blockSize;
    this.timeCursor = 0;

    this.hannWindow = genHannWindow(this.blockSize);
    // prepare FFT and pre-allocate buffers
    this.fft = new FFT(this.fftSize);
    this.freqComplexBuffer = this.fft.createComplexArray();
    this.freqComplexBufferShifted = this.fft.createComplexArray();
    this.timeComplexBuffer = this.fft.createComplexArray();
    this.magnitudes = new Float32Array(this.fftSize / 2 + 1);
    this.peakIndexes = new Int32Array(this.magnitudes.length);
    this.nbPeaks = 0;
  }

  processOLA(inputs, outputs, parameters) {
    // no automation, take last value

    let pitchFactor = parameters.pitchFactor[parameters.pitchFactor.length - 1];

    if (pitchFactor < 0) {
      pitchFactor = pitchFactor * 0.25;
    }
    pitchFactor = Math.max(0, pitchFactor + 1);

    for (var i = 0; i < this.nbInputs; i++) {
      for (var j = 0; j < inputs[i].length; j++) {
        // big assumption here: output is symetric to input
        var input = inputs[i][j];
        var output = outputs[i][j];

        this.applyHannWindow(input);

        this.fft.realTransform(this.freqComplexBuffer, input);

        this.computeMagnitudes();
        this.findPeaks();
        this.shiftPeaks(pitchFactor);

        this.fft.completeSpectrum(this.freqComplexBufferShifted);
        this.fft.inverseTransform(this.timeComplexBuffer, this.freqComplexBufferShifted);
        this.fft.fromComplexArray(this.timeComplexBuffer, output);
        this.applyHannWindow(output);
      }
    }

    this.timeCursor += this.hopSize;
  }

  /** Apply Hann window in-place */
  applyHannWindow(input) {
    for (var i = 0; i < this.blockSize; i++) {
      input[i] = input[i] * this.hannWindow[i] * 1.62;
    }
  }

  /** Compute squared magnitudes for peak finding **/
  computeMagnitudes() {
    var i = 0,
      j = 0;
    while (i < this.magnitudes.length) {
      let real = this.freqComplexBuffer[j];
      let imag = this.freqComplexBuffer[j + 1];
      // no need to sqrt for peak finding
      this.magnitudes[i] = real ** 2 + imag ** 2;
      i += 1;
      j += 2;
    }
  }

  /** Find peaks in spectrum magnitudes **/
  findPeaks() {
    this.nbPeaks = 0;
    var i = 2;
    let end = this.magnitudes.length - 2;

    while (i < end) {
      let mag = this.magnitudes[i];

      if (this.magnitudes[i - 1] >= mag || this.magnitudes[i - 2] >= mag) {
        i++;
        continue;
      }
      if (this.magnitudes[i + 1] >= mag || this.magnitudes[i + 2] >= mag) {
        i++;
        continue;
      }

      this.peakIndexes[this.nbPeaks] = i;
      this.nbPeaks++;
      i += 2;
    }
  }

  /** Shift peaks and regions of influence by pitchFactor into new specturm */
  shiftPeaks(pitchFactor) {
    // zero-fill new spectrum
    this.freqComplexBufferShifted.fill(0);

    for (var i = 0; i < this.nbPeaks; i++) {
      let peakIndex = this.peakIndexes[i];
      let peakIndexShifted = Math.round(peakIndex * pitchFactor);

      if (peakIndexShifted > this.magnitudes.length) {
        break;
      }

      // find region of influence
      var startIndex = 0;
      var endIndex = this.fftSize;
      if (i > 0) {
        let peakIndexBefore = this.peakIndexes[i - 1];
        startIndex = peakIndex - Math.floor((peakIndex - peakIndexBefore) / 2);
      }
      if (i < this.nbPeaks - 1) {
        let peakIndexAfter = this.peakIndexes[i + 1];
        endIndex = peakIndex + Math.ceil((peakIndexAfter - peakIndex) / 2);
      }

      // shift whole region of influence around peak to shifted peak
      let startOffset = startIndex - peakIndex;
      let endOffset = endIndex - peakIndex;
      for (var j = startOffset; j < endOffset; j++) {
        let binIndex = peakIndex + j;
        let binIndexShifted = peakIndexShifted + j;

        if (binIndexShifted >= this.magnitudes.length) {
          break;
        }

        // apply phase correction
        let omegaDelta = (2 * Math.PI * (binIndexShifted - binIndex)) / this.fftSize;
        let phaseShiftReal = Math.cos(omegaDelta * this.timeCursor);
        let phaseShiftImag = Math.sin(omegaDelta * this.timeCursor);

        let indexReal = binIndex * 2;
        let indexImag = indexReal + 1;
        let valueReal = this.freqComplexBuffer[indexReal];
        let valueImag = this.freqComplexBuffer[indexImag];

        let valueShiftedReal = valueReal * phaseShiftReal - valueImag * phaseShiftImag;
        let valueShiftedImag = valueReal * phaseShiftImag + valueImag * phaseShiftReal;

        let indexShiftedReal = binIndexShifted * 2;
        let indexShiftedImag = indexShiftedReal + 1;
        this.freqComplexBufferShifted[indexShiftedReal] += valueShiftedReal;
        this.freqComplexBufferShifted[indexShiftedImag] += valueShiftedImag;
      }
    }
  }
}

registerProcessor('phase-vocoder-processor', PhaseVocoderProcessor);

// Adapted from https://www.musicdsp.org/en/latest/Effects/221-band-limited-pwm-generator.html
class PulseOscillatorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pi = _PI;
    this.phi = -this.pi; // phase
    this.Y0 = 0; // feedback memories
    this.Y1 = 0;
    this.PW = this.pi; // pulse width
    this.B = 2.3; // feedback coefficient
    this.dphif = 0; // filtered phase increment
    this.envf = 0; // filtered envelope
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'begin',
        defaultValue: 0,
        max: Number.POSITIVE_INFINITY,
        min: 0,
      },

      {
        name: 'end',
        defaultValue: 0,
        max: Number.POSITIVE_INFINITY,
        min: 0,
      },

      {
        name: 'frequency',
        defaultValue: 440,
        min: Number.EPSILON,
      },
      {
        name: 'detune',
        defaultValue: 0,
        min: Number.NEGATIVE_INFINITY,
        max: Number.POSITIVE_INFINITY,
      },
      {
        name: 'pulsewidth',
        defaultValue: 1,
        min: 0,
        max: Number.POSITIVE_INFINITY,
      },
    ];
  }

  process(inputs, outputs, params) {
    if (this.disconnected) {
      return false;
    }
    if (currentTime <= params.begin[0]) {
      return true;
    }
    if (currentTime >= params.end[0]) {
      return false;
    }
    const output = outputs[0];
    let env = 1,
      dphi;

    for (let i = 0; i < (output[0].length ?? 0); i++) {
      const pw = (1 - clamp(getParamValue(i, params.pulsewidth), -0.99, 0.99)) * this.pi;
      const detune = getParamValue(i, params.detune);
      const freq = applySemitoneDetuneToFrequency(getParamValue(i, params.frequency), detune / 100);

      dphi = freq * (this.pi / (sampleRate * 0.5)); // phase increment
      this.dphif += 0.1 * (dphi - this.dphif);

      env *= 0.9998; // exponential decay envelope
      this.envf += 0.1 * (env - this.envf);

      // Feedback coefficient control
      this.B = 2.3 * (1 - 0.0001 * freq); // feedback limitation
      if (this.B < 0) this.B = 0;

      // Waveform generation (half-Tomisawa oscillators)
      this.phi += this.dphif; // phase increment
      if (this.phi >= this.pi) this.phi -= 2 * this.pi; // phase wrapping

      // First half-Tomisawa generator
      let out0 = Math.cos(this.phi + this.B * this.Y0); // self-phase modulation
      this.Y0 = 0.5 * (out0 + this.Y0); // anti-hunting filter

      // Second half-Tomisawa generator (with phase offset for pulse width)
      let out1 = Math.cos(this.phi + this.B * this.Y1 + pw);
      this.Y1 = 0.5 * (out1 + this.Y1); // anti-hunting filter

      for (let o = 0; o < output.length; o++) {
        // Combination of both oscillators with envelope applied
        output[o][i] = 0.15 * (out0 - out1) * this.envf;
      }
    }

    return true; // keep the audio processing going
  }
}

registerProcessor('pulse-oscillator', PulseOscillatorProcessor);

/**  BYTE BEATS */
const chyx = {
  /*bit*/ bitC: function (x, y, z) {
    return x & y ? z : 0;
  },
  /*bit reverse*/ br: function (x, size = 8) {
    if (size > 32) {
      throw new Error('br() Size cannot be greater than 32');
    } else {
      let result = 0;
      for (let idx = 0; idx < size - 0; idx++) {
        result += chyx.bitC(x, 2 ** idx, 2 ** (size - (idx + 1)));
      }
      return result;
    }
  },
  /*sin that loops every 128 "steps", instead of every pi steps*/ sinf: function (x) {
    return Math.sin(x / (128 / Math.PI));
  },
  /*cos that loops every 128 "steps", instead of every pi steps*/ cosf: function (x) {
    return Math.cos(x / (128 / Math.PI));
  },
  /*tan that loops every 128 "steps", instead of every pi steps*/ tanf: function (x) {
    return Math.tan(x / (128 / Math.PI));
  },
  /*converts t into a string composed of it's bits, regex's that*/ regG: function (t, X) {
    return X.test(t.toString(2));
  },
};

// Create shortened Math functions
let mathParams, byteBeatHelperFuncs;
function getByteBeatFunc(codetext) {
  if ((mathParams || byteBeatHelperFuncs) == null) {
    mathParams = Object.getOwnPropertyNames(Math);
    byteBeatHelperFuncs = mathParams.map((k) => Math[k]);
    const chyxNames = Object.getOwnPropertyNames(chyx);
    const chyxFuncs = chyxNames.map((k) => chyx[k]);
    mathParams.push('int', 'window', ...chyxNames);
    byteBeatHelperFuncs.push(Math.floor, globalThis, ...chyxFuncs);
  }
  return new Function(...mathParams, 't', `return 0,\n${codetext || 0};`).bind(globalThis, ...byteBeatHelperFuncs);
}

class ByteBeatProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (event) => {
      let { codeText } = event.data;
      const { byteBeatStartTime } = event.data;
      if (byteBeatStartTime != null) {
        this.t = 0;
        this.initialOffset = Math.floor(byteBeatStartTime);
      }

      //Optimization pulled from dollchan.net: https://github.com/Chasyxx/EnBeat_NEW, it seemed important
      //Optimize code like eval(unescape(escape`XXXX`.replace(/u(..)/g,"$1%")))
      codeText = codeText
        .trim()
        .replace(
          /^eval\(unescape\(escape(?:`|\('|\("|\(`)(.*?)(?:`|'\)|"\)|`\)).replace\(\/u\(\.\.\)\/g,["'`]\$1%["'`]\)\)\)$/,
          (match, m1) => unescape(escape(m1).replace(/u(..)/g, '$1%')),
        );

      this.func = getByteBeatFunc(codeText);
    };
    this.initialOffset = null;
    this.t = null;
    this.func = null;
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'begin',
        defaultValue: 0,
        max: Number.POSITIVE_INFINITY,
        min: 0,
      },
      {
        name: 'frequency',
        defaultValue: 440,
        min: Number.EPSILON,
      },
      {
        name: 'detune',
        defaultValue: 0,
        min: Number.NEGATIVE_INFINITY,
        max: Number.POSITIVE_INFINITY,
      },
      {
        name: 'end',
        defaultValue: 0,
        max: Number.POSITIVE_INFINITY,
        min: 0,
      },
    ];
  }

  process(inputs, outputs, params) {
    if (this.disconnected) {
      return false;
    }
    if (currentTime <= params.begin[0]) {
      return true;
    }
    if (currentTime >= params.end[0]) {
      return false;
    }
    if (this.t == null) {
      this.t = params.begin[0] * sampleRate;
    }
    const output = outputs[0];
    for (let i = 0; i < output[0].length; i++) {
      const detune = getParamValue(i, params.detune);
      const freq = applySemitoneDetuneToFrequency(getParamValue(i, params.frequency), detune / 100);
      let local_t = (this.t / (sampleRate / 256)) * freq + this.initialOffset;
      const funcValue = this.func(local_t);
      let signal = (funcValue & 255) / 127.5 - 1;
      const out = signal * 0.2;
      for (let c = 0; c < output.length; c++) {
        //prevent speaker blowout via clipping if threshold exceeds
        output[c][i] = clamp(out, -0.4, 0.4);
      }
      this.t = this.t + 1;
    }

    return true; // keep the audio processing going
  }
}

registerProcessor('byte-beat-processor', ByteBeatProcessor);

export const WarpMode = Object.freeze({
  NONE: 0,
  ASYM: 1,
  MIRROR: 2,
  BENDP: 3,
  BENDM: 4,
  BENDMP: 5,
  SYNC: 6,
  QUANT: 7,
  FOLD: 8,
  PWM: 9,
  ORBIT: 10,
  SPIN: 11,
  CHAOS: 12,
  PRIMES: 13,
  BINARY: 14,
  BROWNIAN: 15,
  RECIPROCAL: 16,
  WORMHOLE: 17,
  LOGISTIC: 18,
  SIGMOID: 19,
  FRACTAL: 20,
  FLIP: 21,
});

function hash32(u) {
  u = u + 0x7ed55d16 + (u << 12);
  u = u ^ 0xc761c23c ^ (u >>> 19);
  u = u + 0x165667b1 + (u << 5);
  u = (u + 0xd3a2646c) ^ (u << 9);
  u = u + 0xfd7046c5 + (u << 3);
  u = u ^ 0xb55a4f09 ^ (u >>> 16);
  return u >>> 0;
}
const hash01 = (i) => (hash32(i) >>> 8) / 0x01000000;

function bitReverse(i, n) {
  let r = 0;
  for (let b = 0; b < n; b++) {
    r = (r << 1) | (i & 1);
    i >>>= 1;
  }
  return r;
}

function noise(x) {
  const i = Math.floor(x),
    f = x - i;
  const a = hash01(i),
    b = hash01(i + 1);
  return a + (b - a) * f;
}

function brownian(x, oct = 4) {
  let amp = 0.5,
    sum = 0,
    norm = 0,
    freq = 1;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise(x * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return (sum / norm) * 2 - 1;
}

const tablesCache = {};
class WavetableOscillatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'begin', defaultValue: 0, min: 0, max: Number.POSITIVE_INFINITY },
      { name: 'end', defaultValue: 0, min: 0, max: Number.POSITIVE_INFINITY },
      { name: 'frequency', defaultValue: 440, min: Number.EPSILON },
      { name: 'detune', defaultValue: 0 },
      { name: 'freqspread', defaultValue: 0.18, min: 0 },
      { name: 'position', defaultValue: 0, min: 0, max: 1 },
      { name: 'warp', defaultValue: 0, min: 0, max: 1 },
      { name: 'warpMode', defaultValue: 0 },
      { name: 'voices', defaultValue: 1, min: 1 },
      { name: 'panspread', defaultValue: 0.7, min: 0, max: 1 },
      { name: 'phaserand', defaultValue: 0, min: 0, max: 1 },
    ];
  }

  constructor(options) {
    super(options);
    this.frameLen = 0;
    this.numFrames = 0;
    this.phase = [];
    this.invSR = 1 / sampleRate;

    this.port.onmessage = (e) => {
      const { type, payload } = e.data || {};
      if (type === 'table') {
        const key = payload.key;
        this.frameLen = payload.frameLen;
        if (!tablesCache[key]) {
          const tables = [payload.frames];
          let table = tables[0];
          for (let level = 1; level < 1; level++) {
            const nextLen = table.length >> 1;
            const nextTable = table.map((frame) => {
              const avg = new Float32Array(nextLen);
              for (let i = 0; i < nextLen; i++) {
                avg[i] = (frame[2 * i] + frame[2 * i + 1]) / 2;
              }
              return avg;
            });
            tables.push(nextTable);
            table = nextTable;
            if (nextLen <= 32) break;
          }
          tablesCache[key] = tables;
        }
        this.tables = tablesCache[key];
        this.numFrames = this.tables[0].length;
      }
    };
  }

  _mirror(x) {
    return 1 - Math.abs(2 * x - 1);
  }

  _toBits(amt, min = 2, max = 12) {
    const b = max + (min - max) * amt;
    return { b, n: Math.round(Math.pow(2, b)) };
  }

  _warpPhase(phase, amt, mode) {
    switch (mode) {
      case WarpMode.NONE: {
        return phase;
      }
      case WarpMode.ASYM: {
        const a = 0.01 + 0.99 * amt;
        return phase < a ? (0.5 * phase) / a : 0.5 + (0.5 * (phase - a)) / (1 - a);
      }
      case WarpMode.MIRROR: {
        // Asym, then mirror
        return this._mirror(this._warpPhase(phase, amt, WarpMode.ASYM));
      }
      case WarpMode.BENDP: {
        return Math.pow(phase, 1 + 3 * amt);
      }
      case WarpMode.BENDM: {
        return Math.pow(phase, 1 / (1 + 3 * amt));
      }
      case WarpMode.BENDMP: {
        return amt < 0.5 ? this._warpPhase(phase, 1 - 2 * amt, 3) : this._warpPhase(phase, 2 * amt - 1, 2);
      }
      case WarpMode.SYNC: {
        const syncRatio = Math.pow(16, amt * amt);
        return (phase * syncRatio) % 1;
      }
      case WarpMode.QUANT: {
        const { n } = this._toBits(amt);
        return ffloor(phase * n) / n;
      }
      case WarpMode.FOLD: {
        const K = 7;
        const k = 1 + Math.max(1, Math.round(K * amt));
        return Math.abs(frac(k * phase) - 0.5) * 2;
      }
      case WarpMode.PWM: {
        const w = clamp(0.5 + 0.49 * (2 * amt - 1), 0, 1);
        if (phase < w) return (phase / w) * 0.5;
        return 0.5 + ((phase - w) / (1 - w)) * 0.5;
      }
      case WarpMode.ORBIT: {
        const depth = 0.5 * amt;
        const n = 3;
        return frac(phase + depth * Math.sin(2 * Math.PI * n * phase));
      }
      case WarpMode.SPIN: {
        const depth = 0.5 * amt;
        const { n } = this._toBits(amt, 1, 6);
        return frac(phase + depth * Math.sin(2 * Math.PI * n * phase));
      }
      case WarpMode.CHAOS: {
        const r = 3.7 + 0.3 * amt;
        const logistic = r * phase * (1 - phase);
        return clamp((1 - amt) * phase + amt * logistic, 0, 1);
      }
      case WarpMode.PRIMES: {
        const isPrime = (n) => {
          if (n < 2) return false;
          if (n % 2 === 0) return n === 2;
          for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
          return true;
        };
        let { n } = this._toBits(amt, 3);
        while (!isPrime(n)) n++;
        return ffloor(phase * n) / n;
      }
      case WarpMode.BINARY: {
        let { b } = this._toBits(amt, 3);
        b = Math.round(b);
        const n = 1 << b;
        const idx = ffloor(phase * n);
        const ridx = bitReverse(idx, b);
        return ridx / n;
      }
      case WarpMode.MODULAR: {
        const { n } = this._toBits(amt);
        const depth = 0.5 * amt;
        const jump = frac(phase * n) / n;
        return frac(phase + depth * jump);
      }
      case WarpMode.BROWNIAN: {
        const disp = 0.25 * amt * brownian(64 * phase, 4);
        return frac(phase + disp);
      }
      case WarpMode.RECIPROCAL: {
        const g = 2 + 4 * amt;
        const num = phase * g;
        const den = phase + (1 - phase) * g;
        const y = den > 1e-12 ? num / den : 0;
        return clamp(y, 0, 1);
      }
      case WarpMode.WORMHOLE: {
        const gap = clamp(0.8 * amt, 0, 1);
        const a = 0.5 * (1 - gap);
        const b = 0.5 * (1 + gap);
        if (phase < a) return (phase / a) * 0.5;
        if (phase > b) return 0.5 * (1 + (phase - b) / (1 - b));
        return 0.5;
      }
      case WarpMode.LOGISTIC: {
        let x = phase;
        const r = 3.6 + 0.4 * amt;
        const iters = 1 + Math.round(2 * amt);
        for (let i = 0; i < iters; i++) x = r * x * (1 - x);
        return clamp(x, 0, 1);
      }
      case WarpMode.SIGMOID: {
        const k = 1 + 10 * amt;
        const x = phase - 0.5;
        const y = 1 / (1 + Math.exp(-k * x));
        const y0 = 1 / (1 + Math.exp(0.5 * k));
        const y1 = 1 / (1 + Math.exp(-0.5 * k));
        return (y - y0) / (y1 - y0);
      }
      case WarpMode.FRACTAL: {
        const d = 0.5 * Math.sin(2 * Math.PI * phase) * amt;
        return frac(phase + d);
      }
      case WarpMode.FLIP: {
        return phase;
      }
      default:
        return phase;
    }
  }

  _sampleFrame(frame, phase) {
    const len = frame.length;
    const pos = phase * len;
    let i = pos | 0;
    if (i >= len) i = 0; // fast wrap
    const frac = pos - i;
    const a = frame[i];
    let i1 = i + 1;
    if (i1 >= len) i1 = 0;
    const b = frame[i1];
    return a + (b - a) * frac;
  }

  _chooseMip(dphi) {
    const approxHarm = clamp(dphi, 1e-6, 64);
    let level = 0;
    while (level + 1 < (this.tables?.length || 1) && approxHarm < this.tables[level][0].length / 8) {
      level++;
    }
    return level;
  }

  process(_inputs, outputs, parameters) {
    if (currentTime >= parameters.end[0]) {
      return false;
    }
    if (currentTime <= parameters.begin[0]) {
      return true;
    }
    const outL = outputs[0][0];
    const outR = outputs[0][1] || outputs[0][0];
    if (!this.tables) {
      outL.fill(0);
      if (outR !== outL) outR.set(outL);
      return true;
    }
    for (let i = 0; i < outL.length; i++) {
      const detune = pv(parameters.detune, i);
      const freqspread = pv(parameters.freqspread, i);
      const tablePos = clamp(pv(parameters.position, i), 0, 1);
      const idx = tablePos * (this.numFrames - 1);
      const fIdx = idx | 0;
      const frac = idx - fIdx;
      const warpAmount = clamp(pv(parameters.warp, i), 0, 1);
      const warpMode = pv(parameters.warpMode, i);
      const voices = pv(parameters.voices, i);
      const phaseRand = clamp(pv(parameters.phaserand, i), 0, 1);
      const panspread = voices > 1 ? clamp(pv(parameters.panspread, i), 0, 1) : 0;
      const gain1 = Math.sqrt(0.5 - 0.5 * panspread);
      const gain2 = Math.sqrt(0.5 + 0.5 * panspread);
      let f = pv(parameters.frequency, i);
      f = applySemitoneDetuneToFrequency(f, detune / 100); // overall detune
      const normalizer = 1 / Math.sqrt(voices);
      for (let n = 0; n < voices; n++) {
        const isOdd = (n & 1) == 1;
        let gainL = gain1;
        let gainR = gain2;
        // invert right and left gain
        if (isOdd) {
          gainL = gain2;
          gainR = gain1;
        }
        const fVoice = applySemitoneDetuneToFrequency(f, getUnisonDetune(voices, freqspread, n)); // voice detune
        const dPhase = fVoice * this.invSR;
        const level = this._chooseMip(dPhase);
        const table = this.tables[level];

        // warp phase then sample
        this.phase[n] = this.phase[n] ?? Math.random() * phaseRand;
        const ph = this._warpPhase(this.phase[n], warpAmount, warpMode);
        const s0 = this._sampleFrame(table[fIdx], ph);
        const s1 = this._sampleFrame(table[Math.min(this.numFrames - 1, fIdx + 1)], ph);
        let s = s0 + (s1 - s0) * frac;
        if (warpMode === WarpMode.FLIP && this.phase[n] < warpAmount) {
          s = -s;
        }
        outL[i] += s * gainL * normalizer;
        outR[i] += s * gainR * normalizer;
        this.phase[n] = wrapPhase(this.phase[n] + dPhase);
      }
    }
    return true;
  }
}

registerProcessor('wavetable-oscillator-processor', WavetableOscillatorProcessor);
