class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0 || !channels[0] || channels[0].length === 0) {
      return true;
    }
    if (channels.length === 1) {
      this.port.postMessage(channels[0].slice(0));
      return true;
    }
    const mixed = new Float32Array(channels[0].length);
    for (let index = 0; index < mixed.length; index += 1) {
      let sum = 0;
      for (let channel = 0; channel < channels.length; channel += 1) {
        sum += channels[channel][index] || 0;
      }
      mixed[index] = sum / channels.length;
    }
    this.port.postMessage(mixed);
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
