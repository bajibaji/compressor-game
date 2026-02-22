# 压缩器游戏 - 算法修复记录

## 修复日期: 2026-02-22

## 已完成的修复

### 1. 自定义 Hard Knee 压缩器 (替代 DynamicsCompressorNode)
- 新建 `public/hard-knee-compressor.js` AudioWorklet
- 实现了标准的 hard knee 压缩算法（peak detection + attack/release envelope）
- 消除了原 DynamicsCompressorNode 固定 30dB soft knee 的问题
- 通过 AudioParam 接口暴露 threshold/ratio/attack/release 参数

### 2. Auto Gain Processor 修复 (`public/auto-gain-processor.js`)
- 修正时间常数注释（smoothingFactor=0.9999 约 208ms@48kHz，gainSmoothing=0.99995 约 416ms@48kHz）
- 增加 `port.onmessage` 支持动态调整 perceptualOffset 和重置增益
- 增益范围从 [0.1, 4.0] 扩大到 [0.01, 10.0]（支持极端压缩补偿）
- 新增 `resetGain` 消息：bypass 切换时快速收敛，避免音量跳变

### 3. 参数生成范围修复 (`src/App.tsx` generateNewRoundParams)
- threshold: 从 [-50, -10] 扩展到完整范围 [-60, 0]
- ratio: 从 [2, 12] 改为对数均匀分布覆盖 [1, 20]

### 4. Bypass 切换增益跳变修复
- applyParamsToAudio 中每次参数变更时向 auto gain worklet 发送 resetGain 消息
- worklet 收到消息后立即将 currentGain 设为 targetGain 并重置能量积分器

### 5. AudioContext 生命周期管理
- 添加 useEffect cleanup 函数
- 组件卸载时断开所有音频节点、关闭 AudioContext、释放资源

### 6. 评分权重调整
- 从 threshold:35% ratio:35% attack:15% release:15%
- 调整为 threshold:30% ratio:10% attack:30% release:30%

## 当前进度: 100% 完成
