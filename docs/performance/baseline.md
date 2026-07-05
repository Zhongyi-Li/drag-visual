# Drag Visual rendering performance baseline

- Date: 2026-07-05
- Scope: production `@drag-visual/chart-renderer` bar-option builder
- Machine: Apple Silicon (`arm64`), macOS
- Runtime: Node.js 24.13.0
- Fixture: 10,000 rows shaped as `{ category: string, value: number }`
- Method: median of five option builds in one Vitest process
- Command: `/usr/local/bin/pnpm --dir packages/chart-renderer exec vitest run src/performance.test.ts`
- Threshold: median `buildBarOption` duration is under 100 ms

This timing check is a local/release signal rather than the only CI guarantee. The deterministic blocking safeguard is that dataset preview and rendered table models slice rows to at most 100 before producing DOM nodes.
