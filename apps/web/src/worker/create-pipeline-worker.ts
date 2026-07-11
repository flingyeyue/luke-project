export function createPipelineWorker(): Worker {
  return new Worker(new URL('./pipeline.worker.ts', import.meta.url), {
    type: 'module',
  });
}
