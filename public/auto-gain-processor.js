class AutoGainProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sumComp = 0;
    this.sumRef = 0;
    this.currentGain = 1.0;
    
    // 增加积分时间 (约 400ms)，让响度评估更稳定
    this.smoothingFactor = 0.9998;
    
    // 增益调整平滑度 (极其缓慢，防止引入任何听得见的泵吸感)
    this.gainSmoothing = 0.99992;

    // 心理声学补偿: 0.8 约为 -2dB
    // 强制将压缩后的响度设定在原声的 80%，以抵消密度感带来的响度提升。
    this.perceptualOffset = 0.8; 
  }

  process(inputs, outputs) {
    const inputComp = inputs[0]; 
    const inputRef = inputs[1];  
    const output = outputs[0];   

    if (!inputComp || !inputComp[0] || inputComp[0].length === 0) return true;
    
    const channelCount = inputComp.length;
    const bufferLength = inputComp[0].length;

    for (let i = 0; i < bufferLength; i++) {
      let powerComp = 0;
      let powerRef = 0;

      for (let c = 0; c < channelCount; c++) {
        // 安全检查
        const sComp = inputComp[c] ? inputComp[c][i] : 0;
        const sRef = (inputRef && inputRef[c]) ? inputRef[c][i] : 0;
        powerComp += sComp * sComp;
        powerRef += sRef * sRef;
      }

      // 实时累积能量
      this.sumComp = this.sumComp * this.smoothingFactor + powerComp * (1 - this.smoothingFactor);
      this.sumRef = this.sumRef * this.smoothingFactor + powerRef * (1 - this.smoothingFactor);

      let targetGain = 1.0;
      if (this.sumRef > 0.000001 && this.sumComp > 0.000001) {
        // 计算增益比并应用心理声学负补偿
        targetGain = Math.sqrt(this.sumRef / this.sumComp) * this.perceptualOffset;
      }

      // 限制增益范围，防止意外
      targetGain = Math.max(0.1, Math.min(targetGain, 4.0));

      // 平滑过度到目标增益
      this.currentGain = this.currentGain * this.gainSmoothing + targetGain * (1 - this.gainSmoothing);

      for (let c = 0; c < channelCount; c++) {
        output[c][i] = inputComp[c][i] * this.currentGain;
      }
    }

    return true;
  }
}

registerProcessor('auto-gain-processor', AutoGainProcessor);
