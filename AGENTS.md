# n8n-nodes-nextcloud-talk

n8n community node for Nextcloud Talk. Package name: `n8n-nodes-nextcloud-talk`.

## Nodes

**NextcloudTalk** (`nodes/NextcloudTalk/NextcloudTalk.node.ts`) — programmatic-style node:
- **Conversation**: list, get, create, delete, rename, set description, toggle guest access, toggle favorite, set notification level, set read-only state
- **Message**: get many, send, reply, edit, delete, react, mark as read
- **Participant**: list, add, remove, promote to moderator, demote from moderator
- **Poll**: create, get, vote, close
- **Reaction**: add, remove, get (with optional emoji filter)

**NextcloudTalkTrigger** (`nodes/NextcloudTalk/NextcloudTalkTrigger.node.ts`) — poll-based trigger:
- **On Message**: polls a conversation for new messages and emits them as workflow items

## Credentials

**NextcloudApi** (`credentials/NextcloudApi.credentials.ts`) — Basic auth using a Nextcloud username and app password. Fields: `serverUrl`, `username`, `appPassword`.

## Tests

Integration tests live in `tests/integration/`. Each resource has its own test file. Tests run sequentially against a real Nextcloud instance managed by Docker Compose. `globalSetup.ts` handles the full container lifecycle (start, configure, teardown).

Run with:
```bash
npm run test:integration
```

## Key guidelines
- Use the `n8n-node` CLI for building, linting, and dev mode
- Always fix lint/typecheck errors
- Use proper types throughout
- Update `CHANGELOG.md` when bumping the package version
- Read `.agents/workflow.md` before starting any non-trivial task

## Context-specific docs

| Working on...               | Read first                                  |
|-----------------------------|---------------------------------------------|
| Node files in `nodes/`      | `.agents/nodes.md`, `.agents/properties.md` |
| Programmatic-style node     | above + `.agents/nodes-programmatic.md`     |
| Credentials                 | `.agents/credentials.md`                    |
| Adding a node version       | `.agents/versioning.md`                     |
| Starting a task or planning | `.agents/workflow.md`                       |
