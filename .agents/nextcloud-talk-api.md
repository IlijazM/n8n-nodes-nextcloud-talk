# Nextcloud Talk (Spreed) REST/OCS API Reference

## Authentication & Global Requirements

All requests must use the Nextcloud OCS API framework.

**Required header on every request:**
```
OCS-APIRequest: true
```

**Authentication:** HTTP Basic Auth with `username:password` or app token. Alternatively, Bearer token:
```
Authorization: Bearer <token>
```

**Response format:** Always add `format=json` as a query parameter or set `Accept: application/json`. The Talk API responses use nested arrays that are invalid XML.

**Base URLs by API version:**

| Area | Base path | Available since |
|---|---|---|
| Conversations/Participants/Calls | `/ocs/v2.php/apps/spreed/api/v4` | Nextcloud 22+ (current) |
| Chat/Messages/Reactions/Polls | `/ocs/v2.php/apps/spreed/api/v1` | Nextcloud 13+ |
| Guest name | `/ocs/v2.php/apps/spreed/api/v1` | v1 only |

All paths below are **relative to their respective base URL** unless the full path is shown.

**Response envelope:** The actual payload is always under `ocs.data`.
```json
{
  "ocs": {
    "meta": { "status": "ok", "statuscode": 200, "message": "OK" },
    "data": [ ... ]
  }
}
```

---

## 1. Conversations/Rooms API

**Base:** `/ocs/v2.php/apps/spreed/api/v4`

### Get user's conversations
```
GET /room
```
| Parameter | Type | Required | Description |
|---|---|---|---|
| `noStatusUpdate` | int | no | Suppress online status update |
| `includeStatus` | bool | no | Include user status for 1:1 conversations |
| `modifiedSince` | int | no | Only return conversations modified after this Unix timestamp |

Response headers:
- `X-Nextcloud-Talk-Hash` — capability refresh signal
- `X-Nextcloud-Talk-Modified-Before` — timestamp for next `modifiedSince`
- `X-Nextcloud-Talk-Federation-Invites` — pending federated invite count

Status codes: `200 OK`, `401 Unauthorized`

Note: Use `Accept: application/json` — XML is invalid due to `lastMessage.reactions`.

### Get a single conversation
```
GET /room/{token}
```
Accessible to authenticated users and guests. Returns same conversation object.

Response header: `X-Nextcloud-Talk-Hash`

Status codes: `200 OK`, `404 Not Found`

### Get note-to-self conversation
```
GET /room/note-to-self
```
Creates it on first access. Status: `200 OK`

### Get open/listed conversations
```
GET /listed-room
```
Requires `listable-rooms` capability. Status: `200 OK`

### Create a conversation
```
POST /room
```
| Parameter | Type | Required | Description |
|---|---|---|---|
| `roomType` | int | yes | 1=one-to-one, 2=group, 3=public |
| `invite` | string | no | User ID (type 1), group/circle ID (type 2) |
| `source` | string | no | `groups` or `circles` (for type 2) |
| `roomName` | string | no | Max 255 chars (not for type 1) |
| `objectType` | string | no | `room` for breakout room |
| `objectId` | string | no | Parent room token (breakout room) |
| `password` | string | no | Room password (requires capability) |

Status: `200 OK` (1:1 already exists), `201 Created`, `400`, `401`, `404`

### Rename a conversation
```
PUT /room/{token}
```
| Parameter | Type | Required |
|---|---|---|
| `roomName` | string | yes (max 255 chars) |

Status: `200`, `400`, `403`, `404`

### Set conversation description
```
PUT /room/{token}/description
```
Requires `room-description` capability.
| Parameter | Type | Description |
|---|---|---|
| `description` | string | Max 2,000 chars |

Status: `200`, `400`, `403`, `404`

### Delete a conversation
```
DELETE /room/{token}
```
Cannot delete 1:1 conversations — remove participants instead.

Status: `200`, `400`, `403`, `404`

### Allow guests (make public)
```
POST /room/{token}/public
```
| Parameter | Type | Required |
|---|---|---|
| `password` | string | no |

Status: `200`, `400`, `403`, `404`

### Disallow guests (make private)
```
DELETE /room/{token}/public
```
Status: `200`, `400`, `403`, `404`

### Set read-only state
```
PUT /room/{token}/read-only
```
Requires `read-only-rooms` capability.
| Parameter | Type | Description |
|---|---|---|
| `state` | int | 0=read-write, 1=read-only |

Status: `200`, `400`, `403`, `404`

### Set/update room password
```
PUT /room/{token}/password
```
| Parameter | Type |
|---|---|
| `password` | string |

Status: `200`, `400`, `403`, `404`

### Set default or call permissions
```
PUT /room/{token}/permissions/{mode}
```
`{mode}` = `default` or `call`
| Parameter | Type | Description |
|---|---|---|
| `permissions` | int | Bitmask of permission flags |

Status: `200`, `400`, `403`, `404`

### Set listable scope
```
PUT /room/{token}/listable
```
Requires `listable-rooms` capability.
| Parameter | Type |
|---|---|
| `scope` | int |

Status: `200`, `400`, `403`, `404`

### Set mention permissions
```
PUT /room/{token}/mention-permissions
```
Requires `mention-permissions` capability.
| Parameter | Type |
|---|---|
| `mentionPermissions` | int |

Status: `200`, `400`, `403`, `404`

### Set message expiration
```
POST /room/{token}/message-expiration
```
Requires `message-expiration` capability.
| Parameter | Type | Description |
|---|---|---|
| `seconds` | int | 0=disable; positive=seconds before auto-delete |

Status: `200`, `400`, `403`, `404`

### Set recording consent
```
PUT /room/{token}/recording-consent
```
Requires `recording-consent` capability.
| Parameter | Type |
|---|---|
| `recordingConsent` | int (0 or 1) |

Status: `200`, `400`, `403`, `404`

### Add/remove from favorites
```
POST   /room/{token}/favorite    → add
DELETE /room/{token}/favorite    → remove
```
Both require `favorites` capability. Status: `200`, `401`, `404`

### Set notification level
```
POST /room/{token}/notify
```
Requires `notification-levels` capability.
| Parameter | Type |
|---|---|
| `level` | int |

Status: `200`, `400`, `401`, `404`

### Set call notification level
```
POST /room/{token}/notify-calls
```
Requires `notification-calls` capability.
| Parameter | Type |
|---|---|
| `level` | int |

Status: `200`, `400`, `401`, `404`

### Get room capabilities
```
GET /room/{token}/capabilities
```
Response includes `X-Nextcloud-Talk-Hash` header. Status: `200`

### Get breakout rooms
```
GET /room/{token}/breakout-rooms
```
Status: `200`, `403`, `404`

### Conversation object fields (key fields in responses)

| Field | Type | Description |
|---|---|---|
| `id` | int | Numeric ID |
| `token` | string | Unique token used in all API calls |
| `type` | int | 1=one-to-one, 2=group, 3=public, 4=changelog |
| `name` | string | Internal name |
| `displayName` | string | Display name |
| `description` | string | Room description |
| `participantType` | int | Current user's role: 1=owner, 2=moderator, 3=user, 4=guest |
| `attendeeId` | int | Attendee record ID |
| `permissions` | int | Combined permissions bitmask |
| `hasPassword` | bool | Password-protected |
| `hasCall` | bool | Active call |
| `canStartCall` | bool | User may start a call |
| `readOnly` | int | Read-only state |
| `listable` | int | Listable scope |
| `unreadMessages` | int | Unread count |
| `unreadMention` | bool | Has unread mention |
| `lastReadMessage` | int | Last read message ID |
| `lastMessage` | object | Most recent message object |
| `isFavorite` | bool | Favorited |
| `notificationLevel` | int | Notification preference |
| `lobbyState` | int | Lobby status |
| `lastActivity` | int | Unix timestamp of last activity |
| `objectType` | string | Associated object type |
| `objectId` | string | Associated object ID |

---

## 2. Chat/Messages API

**Base:** `/ocs/v2.php/apps/spreed/api/v1`

### Get messages (history or polling)
```
GET /chat/{token}
```
| Parameter | Type | Default | Description |
|---|---|---|---|
| `lookIntoFuture` | int | — | 1=long-poll for new msgs, 0=history |
| `limit` | int | 100 | Max messages to return (max 200) |
| `lastKnownMessageId` | int | — | Pagination cursor |
| `lastCommonReadId` | int | — | Detect common-read updates |
| `timeout` | int | — | Long-poll wait seconds (max 60) |
| `setReadMarker` | int | 1 | Auto-mark messages as read |
| `includeLastKnown` | int | 0 | Include the cursor message itself |
| `noStatusUpdate` | int | 0 | Skip online status update |
| `markNotificationsAsRead` | int | 1 | Clear notifications |

Response headers:
- `X-Chat-Last-Given` — next page cursor
- `X-Chat-Last-Common-Read` — last message read by all

Status: `200 OK`, `304 Not Modified` (long-poll timeout/no new), `404 Not Found`, `412 Precondition Failed` (lobby active)

### Get message context (surrounding messages)
```
GET /chat/{token}/{messageId}/context
```
Requires `chat-get-context` capability.
| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | int | 50 | Messages per direction (max 100) |

Response headers: `X-Chat-Last-Given`, `X-Chat-Last-Common-Read`

Status: `200`, `404`, `412`

### Send a message
```
POST /chat/{token}
```
| Parameter | Type | Required | Description |
|---|---|---|---|
| `message` | string | yes | Message text (max 32,000 chars) |
| `actorDisplayName` | string | no | Guest display name |
| `replyTo` | int | no | Parent message ID for reply/thread |
| `referenceId` | string | no | SHA-256 client deduplication ID |
| `silent` | bool | no | Send without triggering notifications |

Response header: `X-Chat-Last-Common-Read`

Status: `201 Created`, `400`, `403`, `404`, `412`, `413 Too Large`, `429 Rate Limited`

### Edit a message
```
PUT /chat/{token}/{messageId}
```
Requires `edit-messages` capability.
| Parameter | Type | Required |
|---|---|---|
| `message` | string | yes |

Response header: `X-Chat-Last-Common-Read`

Status: `200`, `202` (async), `400`, `403`, `404`, `405`, `412`

### Delete a message
```
DELETE /chat/{token}/{messageId}
```
Requires `delete-messages` capability.

Response header: `X-Chat-Last-Common-Read`

Status: `200`, `202`, `400`, `403`, `404`, `405`, `412`

### Clear entire chat history
```
DELETE /chat/{token}
```
Requires `clear-history` capability. Moderator only.

Response header: `X-Chat-Last-Common-Read`

Status: `200`, `202`, `403`, `404`

### Mark chat as read
```
POST /chat/{token}/read
```
Requires `chat-read-marker` capability.
| Parameter | Type | Description |
|---|---|---|
| `lastReadMessage` | int or null | Last read message ID |

Response header: `X-Chat-Last-Common-Read`

Status: `200`, `404`

### Mark chat as unread
```
DELETE /chat/{token}/read
```
Requires `chat-unread` capability.

Response header: `X-Chat-Last-Common-Read`

Status: `200`, `404`

### Share a rich object to chat
```
POST /chat/{token}/share
```
Requires `rich-object-sharing` capability.
| Parameter | Type | Required | Description |
|---|---|---|---|
| `objectType` | string | yes | Object category |
| `objectId` | string | yes | Object identifier |
| `metaData` | string | yes | JSON-encoded object metadata |
| `actorDisplayName` | string | no | Guest display name |
| `referenceId` | string | no | SHA-256 dedup ID |

Status: `201`, `400`, `403`, `404`, `412`, `413`

### Share a file to chat
```
POST /ocs/v2.php/apps/files_sharing/api/v1/shares
```
(Different base path — files_sharing API)
| Parameter | Type | Description |
|---|---|---|
| `shareType` | int | Must be `10` (talk conversation) |
| `shareWith` | string | Conversation token |
| `path` | string | File path |
| `referenceId` | string | SHA-256 dedup ID |
| `talkMetaData` | string | JSON: `{messageType, caption, replyTo, silent}` |

### List shared items — overview
```
GET /chat/{token}/share/overview
```
Requires `rich-object-list-media` capability.
| Parameter | Type |
|---|---|
| `limit` | int |

Status: `200`, `404`, `412`

### List shared items by type
```
GET /chat/{token}/share
```
Requires `rich-object-list-media` capability.
| Parameter | Type | Description |
|---|---|---|
| `objectType` | string | Filter by type: `file`, `media`, `voice`, `location`, `other` |
| `lastKnownMessageId` | int | Pagination cursor |
| `limit` | int | Result count |

Response header: `X-Chat-Last-Given`

Status: `200`, `404`, `412`

### Mention autocomplete
```
GET /chat/{token}/mentions
```
| Parameter | Type | Default | Description |
|---|---|---|---|
| `search` | string | — | Search term (min 1 char) |
| `limit` | int | 20 | Result count |
| `includeStatus` | bool | — | Include user status |

Status: `200`, `403`, `404`, `412`

### Set message reminder
```
POST /chat/{token}/{messageId}/reminder
```
Requires `remind-me-later` capability.
| Parameter | Type |
|---|---|
| `timestamp` | int (Unix) |

Status: `201`, `401`, `404`

### Get message reminder
```
GET /chat/{token}/{messageId}/reminder
```
Requires `remind-me-later` capability. Status: `200`, `401`, `404`

### Delete message reminder
```
DELETE /chat/{token}/{messageId}/reminder
```
Requires `remind-me-later` capability. Status: `200`, `401`, `404`

---

## 3. Reactions API

**Base:** `/ocs/v2.php/apps/spreed/api/v1`

### Add a reaction
```
POST /reaction/{token}/{messageId}
```
| Parameter | Type | Required |
|---|---|---|
| `reaction` | string (emoji) | yes |

Status: `200 OK` (already exists), `201 Created` (new), `400`, `403`, `404`

### Remove a reaction
```
DELETE /reaction/{token}/{messageId}
```
| Parameter | Type | Required |
|---|---|---|
| `reaction` | string (emoji) | yes |

Status: `200`, `400`, `403`, `404`

### Get reactions for a message
```
GET /reaction/{token}/{messageId}
```
| Parameter | Type | Required |
|---|---|---|
| `reaction` | string (emoji) | no — filter by specific emoji |

Response: Array of `{actorType, actorId, actorDisplayName, timestamp}` per reaction.

Status: `200`, `400`, `404`

---

## 4. Participants API

**Base:** `/ocs/v2.php/apps/spreed/api/v4`

### Get participants in a conversation
```
GET /room/{token}/participants
```
| Parameter | Type | Description |
|---|---|---|
| `includeStatus` | bool | Include user status data |

Response: Array of participant objects with `attendeeId`, `actorType`, `actorId`, `displayName`, `sessionIds`, `participantType`, `permissions`, `lastPing`, etc.

Status: `200`, `403`, `404`, `412`

### Get participants including breakout rooms
```
GET /room/{token}/breakout-rooms/participants
```
Requires `breakout-rooms-v1` capability. Status: `200`, `403`, `404`, `412`

### Add a participant
```
POST /room/{token}/participants
```
| Parameter | Type | Required | Description |
|---|---|---|---|
| `newParticipant` | string | yes | User ID, group ID, email, etc. |
| `source` | string | no | `users` (default), `groups`, `circles`, `emails`, `phones` |

Status: `200`, `400`, `403`, `404`

### Remove a participant (by attendeeId)
```
DELETE /room/{token}/attendees
```
| Parameter | Type | Required |
|---|---|---|
| `attendeeId` | int | yes |

Status: `200`, `400`, `403`, `404`

### Leave a conversation (self)
```
DELETE /room/{token}/participants/self
```
Status: `200`, `400`, `404`

### Join a conversation (create session)
```
POST /room/{token}/participants/active
```
| Parameter | Type | Required | Description |
|---|---|---|---|
| `password` | string | no | Room password if required |
| `force` | bool | no | Force join even if already in another call |

Status: `200`, `403`, `404`, `409 Conflict` (already in call with `force=false`)

### Leave a conversation (end session)
```
DELETE /room/{token}/participants/active
```
Status: `200`, `404`

### Set session state
```
PUT /room/{token}/participants/state
```
Requires `session-state` capability. Status: `200`, `400`, `404`

### Promote participant to moderator
```
POST /room/{token}/moderators
```
| Parameter | Type | Required |
|---|---|---|
| `attendeeId` | int | yes |

Status: `200`, `400`, `403`, `404`

### Demote moderator to participant
```
DELETE /room/{token}/moderators
```
| Parameter | Type | Required |
|---|---|---|
| `attendeeId` | int | yes |

Status: `200`, `400`, `403`, `404`

### Set permissions for a specific attendee
```
PUT /room/{token}/attendees/permissions
```
| Parameter | Type | Required | Description |
|---|---|---|---|
| `attendeeId` | int | yes | Target attendee |
| `method` | string | yes | `set`, `add`, or `remove` |
| `permissions` | int | yes | Bitmask of permissions |

Status: `200`, `400`, `403`, `404`

### Resend invitations
```
POST /room/{token}/participants/resend-invitations
```
Requires `sip-support` capability.
| Parameter | Type | Description |
|---|---|---|
| `attendeeId` | int or null | null=resend to all |

Status: `200`, `403`, `404`

### Set guest display name
```
POST /guest/{token}/name
```
API v1 only.
| Parameter | Type | Required |
|---|---|---|
| `displayName` | string | yes |

Status: `200`, `403`, `404`

---

## 5. Calls API

**Base:** `/ocs/v2.php/apps/spreed/api/v4`

### Get connected call participants
```
GET /call/{token}
```
Response: Array of `{actorType, actorId, displayName, lastPing, sessionId}`

Status: `200`, `403`, `404`, `412`

### Join a call
```
POST /call/{token}
```
| Parameter | Type | Required | Description |
|---|---|---|---|
| `flags` | int | yes | Bitmask: 1=in-call, 2=with-audio, 4=with-video, 8=with-phone |
| `silent` | bool | no | Don't send call notifications |
| `recordingConsent` | bool | no | User consents to being recorded |

Status: `200`, `400`, `403`, `404`, `412`

### Update call flags
```
PUT /call/{token}
```
| Parameter | Type | Required |
|---|---|---|
| `flags` | int | yes |

Status: `200`, `400`, `403`, `404`, `412`

### Leave a call
```
DELETE /call/{token}
```
| Parameter | Type | Description |
|---|---|---|
| `all` | bool | Moderator only: end call for all participants |

Status: `200`, `403`, `404`, `412`

### Ring a specific attendee
```
POST /call/{token}/ring/{attendeeId}
```
Status: `200`, `400`, `403`, `404`, `412`

### SIP dial-out to attendee
```
POST /call/{token}/dialout/{attendeeId}
```
Status: `200`, `400`, `403`, `404`, `412`, `501`

---

## 6. Polls API

**Base:** `/ocs/v2.php/apps/spreed/api/v1`

### Create a poll
```
POST /poll/{token}
```
| Parameter | Type | Required | Description |
|---|---|---|---|
| `question` | string | yes | Poll question |
| `options` | string[] | yes | Array of answer options |
| `resultMode` | int | yes | 0=public, 1=hidden until closed |
| `maxVotes` | int | yes | 0=unlimited |

Status: `201 Created`; response: poll object

### Get poll state/results
```
GET /poll/{token}/{pollId}
```
Status: `200`; response: poll object

### Vote on a poll
```
POST /poll/{token}/{pollId}
```
| Parameter | Type | Required |
|---|---|---|
| `optionIds` | int[] | yes |

Status: `200`; response: poll object

### Close a poll
```
DELETE /poll/{token}/{pollId}
```
Status: `200`; response: poll object

---

## 7. Common Status Codes Reference

| Code | Meaning |
|---|---|
| `200 OK` | Success |
| `201 Created` | Resource created |
| `304 Not Modified` | Long-poll returned without new data |
| `400 Bad Request` | Invalid parameters |
| `401 Unauthorized` | Not authenticated |
| `403 Forbidden` | Insufficient permissions |
| `404 Not Found` | Conversation/message/participant not found |
| `405 Method Not Allowed` | e.g. trying to delete a system message |
| `409 Conflict` | Session conflict (already in call) |
| `412 Precondition Failed` | Lobby is active, blocking the action |
| `413 Payload Too Large` | Message exceeds 32,000 char limit |
| `429 Too Many Requests` | Rate limited |
| `501 Not Implemented` | Feature not available (SIP/dial-out) |

---

## Sources

Fetched from the official Nextcloud Talk source docs:
- `https://github.com/nextcloud/spreed/blob/main/docs/conversation.md`
- `https://github.com/nextcloud/spreed/blob/main/docs/chat.md`
- `https://github.com/nextcloud/spreed/blob/main/docs/participant.md`
- `https://github.com/nextcloud/spreed/blob/main/docs/reaction.md`
- `https://github.com/nextcloud/spreed/blob/main/docs/call.md`
- `https://github.com/nextcloud/spreed/blob/main/docs/poll.md`
- `https://docs.nextcloud.com/server/latest/developer_manual/client_apis/OCS/ocs-api-overview.html`
