/** Only one PUT may be in flight; subsequent edits replace the pending snapshot. */
export class SaveQueue<T> {
  private pending: { value: T } | null = null;
  private running: Promise<void> | null = null;
  constructor(private readonly save: (value: T) => Promise<unknown>) {}
  set(value: T) {
    this.pending = { value };
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async drain() {
    while (this.pending) {
      const snapshot = this.pending;
      await this.save(snapshot.value);
      if (this.pending === snapshot) this.pending = null;
    }
  }
}
