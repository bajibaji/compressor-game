class AutoGainProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sumComp = 0;
    this.sumRef = 0;
    this.currentGain = 1.0;
    
    // 增加积分时间，让响度评估更稳定
    // tau = -1 / (fs * ln(alpha))
    // alpha = 0.99995 (约 416ms @ 48kHz)，足够长以平滑鼓循环的瞬态
    this.smoothingFactor = 0.99995;
    
    // 增益调整平滑度 (极其缓慢，防止引入任何听得见的泵吸感)
    // alpha = 0.99998 (约 1040ms @ 48kHz)
    this.gainSmoothing = 0.99998;

    // 响度匹配比例，1.0 = 完全匹配原始响度
    // 之前用 0.8 做心理声学补偿，但会导致明显的音量差异
    this.perceptualOffset = 1.0;
    
    // 强制重置增益的标记，用于切换时快速收敛
    this.forceReset = false;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'setOffset') {
        this.perceptualOffset = event.data.value;
      } else if (event.data.type === 'resetGain') {
        this.forceReset = true;
      }
    };
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

      // 限制增益范围，扩大到可以补偿极端的压缩 (最大 10 倍, 约 +20dB)
      targetGain = Math.max(0.01, Math.min(targetGain, 10.0));

      if (this.forceReset) {
        this.currentGain = targetGain;
        // 确保不会一直重置，只在接收到消息时触发，并且通过平滑过渡快速贴近
        this.forceReset = false;
        // 加速收敛能量
        this.sumComp = powerComp;
        this.sumRef = powerRef;
      } else {
        // 平滑过度到目标增益
        this.currentGain = this.currentGain * this.gainSmoothing + targetGain * (1 - this.gainSmoothing);
      }

      for (let c = 0; c < channelCount; c++) {
        output[c][i] = inputComp[c][i] * this.currentGain;
      }
    }

    return true;
  }
}

registerProcessor('auto-gain-processor', AutoGainProcessor);
