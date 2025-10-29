import { defineConfig } from "vitest/config";
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    include: ["./test/**/*.ts"],
    exclude: ["./test/support/*"],
    setupFiles: ["./test/support/mocks.ts", "./test/support/setup.ts"],
  },
  plugins: [tsconfigPaths()],
});
