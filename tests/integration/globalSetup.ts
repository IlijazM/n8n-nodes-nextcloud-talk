import { execSync } from 'node:child_process';
import path from 'node:path';
import axios from 'axios';

const COMPOSE_FILE = 'tests/integration/docker-compose.yml';
const projectRoot = path.resolve(__dirname, '..', '..');

function runVisible(cmd: string): void {
	execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
}

async function createTestUser(baseUrl: string): Promise<void> {
	const createResp = await axios.post(
		`${baseUrl}/ocs/v1.php/cloud/users`,
		'userid=testuser&password=T3stUser%40Int3gration!',
		{
			auth: { username: 'admin', password: 'testpassword123' },
			headers: {
				'OCS-APIRequest': 'true',
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
			},
			validateStatus: () => true,
		},
	);

	const ocsStatus = createResp.data?.ocs?.meta?.statuscode;
	const ocsMessage = createResp.data?.ocs?.meta?.message;
	console.log(
		`createTestUser: HTTP ${createResp.status}, OCS ${ocsStatus} "${ocsMessage}"`,
	);

	// OCS 100 = created, 102 = user already exists — both are OK
	if (ocsStatus !== 100 && ocsStatus !== 102) {
		throw new Error(
			`Failed to create testuser (OCS ${ocsStatus}): ${JSON.stringify(createResp.data)}`,
		);
	}

	// Verify the user is visible via the users endpoint
	const verifyResp = await axios.get(`${baseUrl}/ocs/v1.php/cloud/users/testuser`, {
		auth: { username: 'admin', password: 'testpassword123' },
		headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
		validateStatus: () => true,
	});

	if (verifyResp.data?.ocs?.meta?.statuscode !== 100) {
		throw new Error(
			`testuser was not found after creation (verify OCS status ${verifyResp.data?.ocs?.meta?.statuscode}): ${JSON.stringify(verifyResp.data)}`,
		);
	}

	console.log('testuser verified successfully.');
}

export async function setup(): Promise<void> {
	const port = process.env.NEXTCLOUD_PORT ?? '8080';
	const baseUrl = `http://localhost:${port}`;

	console.log('\n=== Integration test setup ===');

	console.log('Starting Nextcloud container...');
	runVisible(`docker compose -f ${COMPOSE_FILE} up -d`);

	process.env.NEXTCLOUD_URL = baseUrl;
	process.env.NEXTCLOUD_USER = 'admin';
	process.env.NEXTCLOUD_PASS = 'testpassword123';

	console.log('Waiting for Nextcloud to be ready...');
	runVisible(`bash tests/integration/scripts/wait-for-nextcloud.sh`);

	console.log('Installing Talk app...');
	runVisible(`bash tests/integration/scripts/configure-nextcloud.sh`);

	console.log('Creating test user via provisioning API...');
	await createTestUser(baseUrl);

	console.log('=== Setup complete ===\n');
}

export async function teardown(): Promise<void> {
	console.log('\n=== Integration test teardown ===');
	try {
		runVisible(`docker compose -f ${COMPOSE_FILE} down --remove-orphans`);
	} catch {
		console.warn('Warning: docker compose down encountered an error');
	}
	console.log('=== Teardown complete ===\n');
}
