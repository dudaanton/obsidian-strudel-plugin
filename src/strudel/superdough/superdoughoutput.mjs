import { effectSend, getWorklet, webAudioTimeout } from './helpers.mjs';
import { errorLogger } from './logger.mjs';
import { clamp } from './util.mjs';

let hasChanged = (now, before) => now !== undefined && now !== before;

export class Orbit {
  reverbNode;
  delayNode;
  output;
  summingNode;
  djfNode;
  audioContext;
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.output = new GainNode(audioContext, { gain: 1, channelCount: 2, channelCountMode: 'explicit' });
    this.summingNode = new GainNode(audioContext, { gain: 1, channelCount: 2, channelCountMode: 'explicit' });
    this.summingNode.connect(this.output);
  }

  disconnect() {
    this.output.disconnect();
    this.summingNode.disconnect();
    this.delayNode?.disconnect();
    this.reverbNode?.disconnect();
  }

  getDjf(value, t = 0) {
    if (this.djfNode == null) {
      this.djfNode = getWorklet(this.audioContext, 'djf-processor', { value });
      this.summingNode.disconnect();
      this.summingNode.connect(this.djfNode);
      this.djfNode.connect(this.output);
    }
    const val = this.djfNode.parameters.get('value');
    val.setValueAtTime(value, t);
  }

  getDelay(delaytime = 0, feedback = 0.5, t) {
    const maxfeedback = 0.98;
    if (feedback > maxfeedback) {
      //logger(`feedback was clamped to ${maxfeedback} to save your ears`);
    }
    feedback = clamp(feedback, 0, 0.98);
    if (this.delayNode == null) {
      this.delayNode = this.audioContext.createFeedbackDelay(1, delaytime, feedback);
      this.delayNode.connect(this.summingNode);
      this.delayNode.start?.(t); // for some reason, this throws when audion extension is installed..
    }
    this.delayNode.delayTime.value !== delaytime && this.delayNode.delayTime.setValueAtTime(delaytime, t);
    this.delayNode.feedback.value !== feedback && this.delayNode.feedback.setValueAtTime(feedback, t);
    return this.delayNode;
  }

  getReverb(duration, fade, lp, dim, ir, irspeed, irbegin) {
    // If no reverb has been created for a given orbit, create one
    if (this.reverbNode == null) {
      this.reverbNode = this.audioContext.createReverb(duration, fade, lp, dim, ir, irspeed, irbegin);
      this.reverbNode.connect(this.summingNode);
    }

    if (
      hasChanged(duration, this.reverbNode.duration) ||
      hasChanged(fade, this.reverbNode.fade) ||
      hasChanged(lp, this.reverbNode.lp) ||
      hasChanged(dim, this.reverbNode.dim) ||
      hasChanged(irspeed, this.reverbNode.irspeed) ||
      hasChanged(irbegin, this.reverbNode.irbegin) ||
      this.reverbNode.ir !== ir
    ) {
      // only regenerate when something has changed
      // avoids endless regeneration on things like
      // stack(s("a"), s("b").rsize(8)).room(.5)
      // this only works when args may stay undefined until here
      // setting default values breaks this
      this.reverbNode.generate(duration, fade, lp, dim, ir, irspeed, irbegin);
    }
    return this.reverbNode;
  }
  sendReverb(node, amount) {
    effectSend(node, this.reverbNode, amount);
  }

  sendDelay(node, amount) {
    effectSend(node, this.delayNode, amount);
  }

  duck(t, onsettime = 0, attacktime = 0.1, depth = 1) {
    const onset = onsettime;
    const attack = Math.max(attacktime, 0.002);
    const gainParam = this.output.gain;
    webAudioTimeout(
      this.audioContext,
      () => {
        const now = this.audioContext.currentTime;

        // cancelScheduledValues and setValueAtTime together emulate cancelAndHoldAtTime
        // on browsers which lack that method
        const currVal = gainParam.value;
        gainParam.cancelScheduledValues(now);
        gainParam.setValueAtTime(currVal, now);

        const t0 = Math.max(t, now); // guard against now > t
        const duckedVal = clamp(1 - Math.sqrt(depth), 0.01, currVal);
        gainParam.exponentialRampToValueAtTime(duckedVal, t0 + onset);
        gainParam.exponentialRampToValueAtTime(1, t0 + onset + attack);
      },
      0,
      t - 0.01,
    );
  }

  connectToOutput(node) {
    node.connect(this.summingNode);
  }
}

export class SuperdoughOutput {
  channelMerger;
  destinationGain;

  constructor(audioContext) {
    this.audioContext = audioContext;
    this.initializeAudio();
  }

  initializeAudio() {
    const audioContext = this.audioContext;
    const maxChannelCount = audioContext.destination.maxChannelCount;
    this.audioContext.destination.channelCount = maxChannelCount;
    this.channelMerger = new ChannelMergerNode(audioContext, { numberOfInputs: audioContext.destination.channelCount });
    this.destinationGain = new GainNode(audioContext);
    this.channelMerger.connect(this.destinationGain);
    this.destinationGain.connect(audioContext.destination);
  }

  reset() {
    this.disconnect();
    this.initializeAudio();
  }
  disconnect() {
    this.channelMerger.disconnect();
    this.destinationGain.disconnect();
    this.destinationGain = null;
    this.channelMerger = null;
  }
  connectToDestination = (input, channels = [0, 1]) => {
    //This upmix can be removed if correct channel counts are set throughout the app,
    // and then strudel could theoretically support surround sound audio files
    const stereoMix = new StereoPannerNode(this.audioContext);
    input.connect(stereoMix);

    const splitter = new ChannelSplitterNode(this.audioContext, {
      numberOfOutputs: stereoMix.channelCount,
    });
    stereoMix.connect(splitter);
    channels.forEach((ch, i) => {
      splitter.connect(this.channelMerger, i % stereoMix.channelCount, ch % this.audioContext.destination.channelCount);
    });
  };
}

export class SuperdoughAudioController {
  audioContext;
  output;
  nodes = {};

  constructor(audioContext) {
    this.audioContext = audioContext;
    this.output = new SuperdoughOutput(audioContext);
  }

  reset() {
    Array.from(this.nodes).forEach((node) => {
      node.disconnect();
    });
    this.nodes = {};
    this.output.reset();
  }

  duck(targetOrbits, t, onsettime = 0, attacktime = 0.1, depth = 1) {
    const targetArr = [targetOrbits].flat();
    const onsetArr = [onsettime].flat();
    const attackArr = [attacktime].flat();
    const depthArr = [depth].flat();

    targetArr.forEach((target, idx) => {
      const orbit = this.nodes[target];

      if (orbit == null) {
        errorLogger(new Error(`duck target orbit ${target} does not exist`), 'superdough');
        return;
      }
      const onset = onsetArr[idx] ?? onsetArr[0];
      const attack = Math.max(attackArr[idx] ?? attackArr[0], 0.002);
      const depth = depthArr[idx] ?? depthArr[0];

      orbit.duck(t, onset, attack, depth);
    });
  }

  getOrbit(orbitNum, channels) {
    if (this.nodes[orbitNum] == null) {
      this.nodes[orbitNum] = new Orbit(this.audioContext);
      this.output.connectToDestination(this.nodes[orbitNum].output, channels);
    }
    return this.nodes[orbitNum];
  }
}
