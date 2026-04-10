# n8n-nodes-nextcloud-talk

An [n8n](https://n8n.io/) community node for [Nextcloud Talk](https://nextcloud.com/talk/).

**Table of contents**

- [Installation](#installation)
- [Setting up credentials](#setting-up-credentials)
- [Features](#features)
- [Triggers](#triggers)
- [Development](#development)

## Installation

Follow the [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n documentation.

The package name is `n8n-nodes-nextcloud-talk`.

## Setting up credentials

### Bot account (for the NextcloudTalk node and polling trigger)

The `NextcloudTalk` node and the polling trigger authenticate as a Nextcloud user to call the API. The recommended approach is to create a **dedicated user account** that acts as the bot. This keeps bot activity separate from personal accounts and makes it easy to revoke access later.

**1. Create a dedicated user**

In the Nextcloud admin panel, create a new user (e.g. `n8n-bot`) with a display name that will appear in Talk alongside its messages. See the [Nextcloud user management documentation](https://docs.nextcloud.com/server/latest/admin_manual/configuration_user/user_configuration.html) for details.

**2. Add the bot to the relevant conversations**

Log in as an admin or as a moderator of each conversation the bot needs access to, then add the bot user as a participant. The bot can only read or post in conversations it is a member of.

**3. Generate an app password**

Log in as the bot user and go to **Settings → Security → Devices & sessions**. Scroll to the *App passwords* section, enter a name (e.g. `n8n`), and click **Create new app password**. Copy the generated password — it is only shown once.

See the [Nextcloud app passwords documentation](https://docs.nextcloud.com/server/latest/user_manual/en/session_management.html#managing-devices) for more detail.

**4. Configure the credential in n8n**

In n8n, create a new **Nextcloud API** credential and fill in:

| Field | Value |
| --- | --- |
| Server URL | Your Nextcloud instance URL, e.g. `https://cloud.example.com` |
| Username | The bot account username, e.g. `n8n-bot` |
| App Password | The app password generated in step 3 |

### Webhook trigger (NextcloudTalk Webhook Trigger)

The webhook trigger works differently — Nextcloud Talk calls n8n when a message is sent, rather than n8n polling Nextcloud. There is **no user account involved** in receiving messages. Instead, a Talk bot is registered on the Nextcloud server with a shared secret. The `NextcloudApi` credential on the webhook trigger node is only used to enable or disable the bot for the configured conversation when you activate or deactivate the workflow.

See the [Nextcloud Talk Webhook Trigger](#nextcloud-talk-webhook-trigger-instant) section below for the full setup.

## Features

### Conversation

| Operation              | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| List                   | Return all conversations the authenticated user is part of |
| Get                    | Get details of a single conversation by token              |
| Create                 | Create a new group conversation                            |
| Delete                 | Delete a conversation                                      |
| Rename                 | Change the display name of a conversation                  |
| Set Description        | Update the conversation description                        |
| Toggle Guest Access    | Allow or disallow guests to join via a public link         |
| Toggle Favorite        | Mark or unmark a conversation as a favorite                |
| Set Notification Level | Control when you receive notifications for a conversation  |
| Set Read-Only          | Lock or unlock a conversation for new messages             |

### Message

| Operation    | Description                                                           |
| ------------ | --------------------------------------------------------------------- |
| Get Many     | Retrieve messages from a conversation, with optional limit and offset |
| Send         | Post a new message to a conversation                                  |
| Reply        | Reply to an existing message                                          |
| Edit         | Update the text of a previously sent message                          |
| Delete       | Delete a message                                                      |
| Mark as Read | Set the read marker to the latest message                             |

### Participant

| Operation             | Description                                    |
| --------------------- | ---------------------------------------------- |
| List                  | List all participants in a conversation        |
| Add                   | Add a user or group to a conversation          |
| Remove                | Remove a participant from a conversation       |
| Promote to Moderator  | Grant moderator privileges to a participant    |
| Demote from Moderator | Remove moderator privileges from a participant |

### Poll

| Operation | Description                                  |
| --------- | -------------------------------------------- |
| Create    | Create a poll in a conversation              |
| Get       | Retrieve a poll and its current results      |
| Vote      | Submit a vote on a poll                      |
| Close     | Close a poll so no further votes can be cast |

### Reaction

| Operation | Description                                                    |
| --------- | -------------------------------------------------------------- |
| Add       | React to a message with an emoji                               |
| Remove    | Remove your reaction from a message                            |
| Get       | List all reactions on a message, with optional filter by emoji |

## Triggers

There are two trigger nodes. Choose based on your setup:

| Node | Latency | Requirement |
| --- | --- | --- |
| **Nextcloud Talk Trigger** | ~1 min (n8n schedule) | Nothing extra |
| **Nextcloud Talk Webhook Trigger** | Instant | Nextcloud admin registers a bot once |

### Nextcloud Talk Trigger (polling)

Polls a conversation for new messages on n8n's workflow schedule (default: every minute). No extra server setup required — just configure the conversation token and activate the workflow.

### Nextcloud Talk Webhook Trigger (instant)

Nextcloud pushes a notification to n8n the moment a message is sent, so the workflow fires instantly. It uses Nextcloud Talk's [Bot API](https://nextcloud-talk.readthedocs.io/en/latest/bot-list/).

#### One-time server setup

A Nextcloud admin must register the bot on the server **once**. Run the following on the Nextcloud host:

```bash
occ talk:bot:install --feature webhook --feature response "n8n" "<YOUR_SECRET>" "<YOUR_N8N_WEBHOOK_URL>"
```

Arguments are positional: **name**, **secret**, **url**.

| Feature flag | What it enables |
| --- | --- |
| `--feature webhook` | Nextcloud Talk sends incoming message events to the bot URL. Required for the webhook trigger to fire. |
| `--feature response` | The bot can send messages and reactions back via the bot API. Required when using the **Bot Secret** option in the Send/Reply operations to post as the bot (actorType `bots`). |

Both features are recommended. Without `--feature response`, sending a message with a bot secret will return a 401 error.

- **url** — use the **production** webhook URL shown in n8n under *Webhook URLs* when the trigger node is selected. Do not use the test URL — it is only active while you are listening for a test event in the editor.
- **secret** — a random string of **at least 40 characters**; you will enter the same value in the node
- The command prints the **Bot ID** — note it down

To list already-registered bots and their IDs:

```bash
occ talk:bot:list
```

#### Configuring the node in n8n

| Field | Value |
| --- | --- |
| Conversation Token | The conversation token (from the Talk URL) |
| Bot ID | The numeric ID printed by `occ spreed:bot:install` |
| Bot Secret | The `--secret` value used during registration |

When you activate the workflow, n8n automatically enables the bot for the configured conversation. When you deactivate it, the bot is disabled for that conversation. The bot registration on the server stays in place and can be reused across multiple workflows and conversations.

## Development

### Prerequisites

- Node.js 20+
- Docker (for the integration test environment)

### Setup

```bash
npm ci
```

### Local development

```bash
npm run dev
```

This starts a local n8n instance at **http://localhost:5678** with the node loaded and hot-reload enabled — changes to source files are picked up automatically without restarting.

### Running the integration tests

The test suite spins up a real Nextcloud instance in Docker, installs the Talk app, and runs every operation against it. No manual setup is required.

```bash
npm run test:integration
```

The test runner handles the full lifecycle automatically:

1. Starts a Nextcloud container (`nextcloud:30-apache`) via Docker Compose
2. Waits for Nextcloud to be ready
3. Installs the Talk (spreed) app via `occ`
4. Creates a `testuser` account used by several tests
5. Runs all tests sequentially (tests share Nextcloud state, so parallel execution is disabled)
6. Tears down the container when done

To run against a different port (e.g. if 8080 is already in use):

```bash
NEXTCLOUD_PORT=9090 npm run test:integration
```

### Linting

```bash
npm run lint        # check
npm run lint:fix    # auto-fix
```
