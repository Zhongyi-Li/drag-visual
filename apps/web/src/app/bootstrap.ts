export interface MockWorkerModule {
  startMockWorker(): Promise<unknown>;
}

export interface BootstrapApplicationOptions {
  useMocks: string | undefined;
  loadMockWorker(): Promise<MockWorkerModule>;
  render(): void;
}

export const bootstrapApplication = async ({
  useMocks,
  loadMockWorker,
  render,
}: BootstrapApplicationOptions): Promise<void> => {
  if (useMocks === "true") {
    const { startMockWorker } = await loadMockWorker();
    await startMockWorker();
  }

  render();
};
