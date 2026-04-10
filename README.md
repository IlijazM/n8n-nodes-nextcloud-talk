# n8n-nodes-nextcloud-talk

An [n8n](https://n8n.io/) community node for [Nextcloud Talk](https://nextcloud.com/talk/).

**Table of contents**

- [Installation](#installation)
- [Setting up a bot account](#setting-up-a-bot-account)
- [Features](#features)
- [Development](#development)

## Installation

Follow the [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n documentation.

The package name is `n8n-nodes-nextcloud-talk`.

## Setting up a bot account

This node authenticates as a Nextcloud user, so the recommended approach is to create a **dedicated user account** that acts as the bot. This keeps bot activity separate from personal accounts and makes it easy to revoke access later.

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

### Trigger

| Trigger    | Description                                                          |
| ---------- | -------------------------------------------------------------------- |
| On Message | Poll a conversation for new messages and emit them as workflow items |

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
