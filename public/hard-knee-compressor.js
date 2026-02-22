class HardKneeCompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -20, minValue: -100, maxValue: 0 },
      { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 50 },
      { name: 'attack', defaultValue: 0.005, minValue: 0, maxValue: 1 }, // in seconds
      { name: 'release', defaultValue: 0.2, minValue: 0, maxValue: 3 } // in seconds
    ];
  }

  constructor() {
    super();
    this.gain = 1.0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;
    
    const channelCount = input.length;
    const bufferLength = input[0].length;
    const sampleRate = 48000; // Assuming 48kHz for simple calculation, accurate enough for envelope

    for (let i = 0; i < bufferLength; i++) {
      // 1. Calculate sidechain RMS/Peak level (simplified to peak for VCA style)
      let currentLevel = 0;
      for (let c = 0; c < channelCount; c++) {
        currentLevel = Math.max(currentLevel, Math.abs(input[c][i]));
      }
      
      const currentLevelDb = currentLevel > 0.000001 ? 20 * Math.log10(currentLevel) : -120;

      // 2. Gain calculation (Hard knee)
      const threshold = parameters.threshold.length > 1 ? parameters.threshold[i] : parameters.threshold[0];
      const ratio = parameters.ratio.length > 1 ? parameters.ratio[i] : parameters.ratio[0];
      const attack = parameters.attack.length > 1 ? parameters.attack[i] : parameters.attack[0];
      const release = parameters.release.length > 1 ? parameters.release[i] : parameters.release[0];

      let targetGainDb = 0;
      if (currentLevelDb > threshold) {
        // Amount over threshold
        const over = currentLevelDb - threshold;
        // Compression amount
        targetGainDb = over * (1 / ratio - 1);
      }
      
      const targetGainLinear = Math.pow(10, targetGainDb / 20);

      // 3. Envelope follower (Attack / Release smoothing)
      // Convert attack/release time (seconds) to coefficient
      const alphaA = Math.exp(-1 / (sampleRate * attack));
      const alphaR = Math.exp(-1 / (sampleRate * release));

      if (targetGainLinear < this.gain) {
        // Gain reduction increasing -> Attack phase
        this.gain = alphaA * this.gain + (1 - alphaA) * targetGainLinear;
      } else {
        // Gain reduction decreasing -> Release phase
        this.gain = alphaR * this.gain + (1 - alphaR) * targetGainLinear;
      }

      // 4. Apply gain
      for (let c = 0; c < channelCount; c++) {
        output[c][i] = input[c][i] * this.gain;
      }
    }

    return true;
  }
}

registerProcessor('hard-knee-compressor', HardKneeCompressorProcessor);