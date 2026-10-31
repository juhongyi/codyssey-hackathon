class Recorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data === "stop") {
        this.stopped = true;
        this.port.postMessage("stopped");
      }
    };
  }

  process(inputs) {
    if (!this.stopped && inputs[0]?.[0]) {
      const samples = inputs[0][0].slice();
      this.port.postMessage(samples, [samples.buffer]);
    }
    return !this.stopped;
  }
}

registerProcessor("recorder", Recorder);
