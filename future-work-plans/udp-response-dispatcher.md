# UDP response dispatcher

> **Status: DRAFT — needs refinement.** Nothing here is implemented yet. Open questions are listed at the end.

Follow-up to #33 (`fix: remove per-request socket listeners`).

## Problem

All requests share one `dgram` socket. `UDPRequest` (`src/utils/udp_utils/index.ts`) adds its own `message`,
`error` and `close` listeners for each request and removes them when the request settles. Since #33 nothing
leaks, but the design still has these problems:

- **Every message goes to every waiting request.** Each `handleResponse` decrypts and decompresses the
  packet *before* it checks the tag, so a packet is decoded once per pending request.
- **One bad packet fails requests it doesn't belong to.** If decrypt or decompress throws, every pending
  request rejects, and `encryption_key` is set to `null` for the whole client.
- **Late responses have nowhere to go.** A reply that arrives after its request timed out reaches whatever
  request is pending at that moment. That request ignores it if the tag doesn't match, but if decoding fails
  (see above), the wrong request fails.
- **Untagged server messages are dropped.** There is nowhere to handle notifications or pushes
  (`TODO: handle global responses!`), which the Notify and Notification items in [TODO.md](../TODO.md) need.
- **Responses are usually serial but not always.** Bottleneck (`maxConcurrent: 1`) usually keeps only one
  request in flight. `disconnect()` sends its raw `LOGOUT` outside the queue, though, so it can overlap with a
  request that is already in flight.

## Design

Each socket gets one long-lived dispatcher. Requests register with the dispatcher, not with the socket.

### `UDPConnection` (new, `src/utils/udp_utils/connection.ts`)

Wraps the `dgram.Socket` and owns:

- `pending: Map<string, { resolve, reject, timer }>`, keyed by tag.
- A `getEncryptionKey()` callback, because the key is set after the socket is created (`ENCRYPT` runs first)
  and can be cleared later.
- An `onUnsolicited(parsed)` callback for valid messages that match no pending tag.
- Exactly one `message`, one `error` and one `close` listener, attached in the constructor.

`initUDPClient` returns a `UDPConnection` instead of a bare socket. `AnidbUDPClient.client` keeps the
connection, and `close()` is passed through.

### Message path (decoded once)

1. Decrypt if a key is set, then decompress if the packet starts with `00 00`.
2. Split off the tag: `^(\S+) (\d{3} .*)`.
3. If the tag is in `pending`: clear that entry's timer, delete the entry, then resolve it with
   `parseResponse(rest)`. If parsing throws, reject only that entry.
4. If the tag isn't in `pending` but the message parses as a response, it is untagged or late. Call
   `onUnsolicited` and log it at debug level. For now `AnidbUDPClient` only logs it. Emitting events for it
   belongs to the notifications work.
5. If decoding fails: keep the current fallback, which is to clear the key and treat the packet as fatal,
   **but only if the plaintext looks like an AniDB response** (see open questions). Otherwise log it and drop
   it, and no request is rejected.

### Request path

`UDPRequest(_this, command, params)` keeps its signature, so `_callApi`, Bottleneck and `disconnect()` don't
change:

- Always add a tag, even when `params` is null. Generate tags with `makeid(5)` and generate again if the
  tag is already in `pending`.
- Register `{ resolve, reject, timer }`. On `TIMEOUT` the timer deletes the entry and rejects with
  `Error('Timeout')`, as it does today.
- Encrypt and send. If `send` fails, delete the entry and reject.

### Socket `error` / `close`

Reject every pending entry with that error, clear their timers and empty the map. This is the per-request
`handleError` behaviour, applied once for all requests. The fatal-error and disconnect handling in `_callApi`
stays as it is.

## Steps

1. Add `UDPConnection` with the message, request and error paths above. Move decode logic out of
   `handleResponse`.
2. Change `initUDPClient` and `UDPRequest` to use it. Update `AnidbUDPClient` (type of `client`, pass
   `getEncryptionKey: () => this.encryption_key`).
3. Tests (`src/utils/udp_utils/__tests__/`), using the existing `fakeSocket`:
   - Listener counts stay at 1/1/1 however many requests run.
   - A late reply after a timeout doesn't affect the next request.
   - A packet that can't be decoded rejects nothing (or everything, if it is recognised as fatal).
   - Two overlapping requests (as with the `LOGOUT` in `disconnect`) each get their own reply, even when the
     replies arrive out of order.
   - An untagged `271 ...` reaches `onUnsolicited`.
   - `error` and `close` reject all pending requests and leave the map empty.
4. Release as `fix:` (no public API change).

## Open questions

- **Which replies does AniDB send untagged or unencrypted?** Check the
  [UDP API Definition](https://wiki.anidb.net/UDP_API_Definition) for server errors (`5xx`/`6xx`, e.g. `555 BANNED`,
  `598 UNKNOWN COMMAND`) and for notifications/pushes (`270`/`271`/`272`). Then decide whether an
  untagged fatal code rejects every pending request.
- **Clearing `encryption_key` on decrypt failure.** This is risky when the failing packet is a stray or
  corrupted one. Should we clear it only when the plaintext parses as a valid response?
- **Should `disconnect()` send `LOGOUT` through the queue** (with a high priority) so that requests are
  strictly serial? With the dispatcher, overlapping requests are safe either way.
