import { config } from '@n8n/node-cli/eslint';

export default [
	// Exclude test infrastructure and config files from n8n Cloud compatibility checks
	{
		ignores: ['tests/**', 'vitest.integration.config.ts'],
	},
	...config,
];
