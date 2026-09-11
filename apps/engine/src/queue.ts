type Job = () => Promise<void>;

export class DeploymentQueue {
  private running = 0;
  private readonly pending: Job[] = [];
  private readonly concurrency: number;

  constructor(concurrency = Number(process.env.DEPLOYMENT_CONCURRENCY ?? 2)) {
    this.concurrency = Math.max(1, concurrency);
  }

  enqueue(job: Job) {
    this.pending.push(job);
    void this.drain();
  }

  private async drain() {
    while (this.running < this.concurrency && this.pending.length) {
      const job = this.pending.shift()!;
      this.running++;
      void job().catch(() => undefined).finally(() => {
        this.running--;
        void this.drain();
      });
    }
  }

  stats() {
    return { queued: this.pending.length, running: this.running, concurrency: this.concurrency };
  }
}
