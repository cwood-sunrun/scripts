const { spawn } = require("child_process");

const RETRYABLE = [
  /rate limit/i,
  /secondary rate/i,
  /HTTP 5\d\d/i,
  /HTTP 429/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /timed out/i,
  /timeout/i,
  /EOF/,
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * FIFO job queue that runs `gh` as child processes with bounded concurrency.
 * Each running job occupies one worker slot; failed jobs that look transient
 * are retried with exponential backoff and jitter.
 */
class GhQueue {
  #pending = [];
  #active = 0;
  #idleResolvers = [];

  constructor({
    concurrency = 6,
    retries = 3,
    timeoutMs = 120_000,
    baseDelayMs = 1_000,
    command = "gh",
  } = {}) {
    this.concurrency = Math.max(1, concurrency);
    this.retries = retries;
    this.timeoutMs = timeoutMs;
    this.baseDelayMs = baseDelayMs;
    this.command = command;
  }

  /** Enqueue a gh invocation (argv array, no shell). Resolves with stdout. */
  run(args) {
    return new Promise((resolve, reject) => {
      this.#pending.push({ args, resolve, reject, attempt: 0 });
      this.#drain();
    });
  }

  /** Run and parse stdout as a single JSON document. */
  async json(args) {
    return JSON.parse(await this.run(args));
  }

  /** Run and parse stdout as newline-delimited JSON (one value per line). */
  async ndjson(args) {
    const out = await this.run(args);
    return out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  /** Resolves once no jobs are pending or running. */
  onIdle() {
    if (this.#active === 0 && this.#pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.#idleResolvers.push(resolve));
  }

  #drain() {
    while (this.#active < this.concurrency && this.#pending.length) {
      const job = this.#pending.shift();
      this.#active++;
      this.#execute(job).finally(() => {
        this.#active--;
        this.#drain();
        this.#notifyIdle();
      });
    }
  }

  #notifyIdle() {
    if (this.#active === 0 && this.#pending.length === 0) {
      for (const resolve of this.#idleResolvers.splice(0)) resolve();
    }
  }

  async #execute(job) {
    try {
      job.resolve(await this.#spawnOnce(job.args));
    } catch (err) {
      if (job.attempt < this.retries && this.#isRetryable(err)) {
        job.attempt++;
        const delay =
          this.baseDelayMs * 2 ** (job.attempt - 1) * (0.5 + Math.random());
        await sleep(delay); // holds the slot as backoff, easing rate limits
        this.#pending.push(job);
      } else {
        job.reject(err);
      }
    }
  }

  #isRetryable(err) {
    return err.timedOut || RETRYABLE.some((re) => re.test(err.stderr ?? ""));
  }

  #spawnOnce(args) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout = [];
      const stderr = [];
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, this.timeoutMs);

      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));

      child.on("error", (err) => {
        clearTimeout(timer);
        err.args = args;
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && !timedOut) {
          resolve(Buffer.concat(stdout).toString("utf-8"));
          return;
        }
        const err = new Error(
          `${this.command} ${args.join(" ")} failed` +
            (timedOut ? " (timed out)" : ` with exit code ${code}`) +
            `: ${Buffer.concat(stderr).toString("utf-8").trim()}`,
        );
        err.code = code;
        err.timedOut = timedOut;
        err.stderr = Buffer.concat(stderr).toString("utf-8");
        err.args = args;
        reject(err);
      });
    });
  }
}

module.exports = { GhQueue };
