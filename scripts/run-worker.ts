import { runWorkerJob, WORKER_JOBS, type WorkerJobName } from "../src/server/worker-jobs";

async function main() {
  const job = (process.argv[2] || "worker.tick") as WorkerJobName;
  if (!WORKER_JOBS.includes(job)) {
    console.error(`Invalid job "${job}". Allowed: ${WORKER_JOBS.join(", ")}`);
    process.exit(1);
  }

  const result = await runWorkerJob(job);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});