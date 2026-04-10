import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/integration/**/*.test.ts'],
		globalSetup: 'tests/integration/globalSetup.ts',
		testTimeout: 20000,
		hookTimeout: 60000,
		teardownTimeout: 30000,
		// Run sequentially — tests mutate shared Nextcloud state
		pool: 'forks',
		poolOptions: {
			forks: { singleFork: true },
		},
	},
});
