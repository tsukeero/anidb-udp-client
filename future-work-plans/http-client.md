# HTTP API client

> **Status: DRAFT — needs refinement.** Nothing here is decided or implemented yet.
> This is a first pass at the design plus notes taken from the AniDB wiki
> ([HTTP API Definition](https://wiki.anidb.net/HTTP_API_Definition), read 2026-10-28).
> Re-check the wiki before implementing; open questions are listed at the end.

Tracks the `Add HTTP Api support` item in [TODO.md](../TODO.md).

## Goal

Add support for AniDB's [HTTP XML API](https://wiki.anidb.net/HTTP_API_Definition) without making the
existing UDP client awkward to use. The HTTP API returns far richer anime data (all titles, tags with
weights and spoilers, characters with voice actors, episode list, related/similar anime, external links)
but is a very different transport from UDP.

## API reference (from the wiki)

### General

- Base URL: `http://api.anidb.net:9001/httpapi` (plain **http**, port 9001).
- Required on every request:
  - `client={string}`: lower-case client id **registered for the HTTP API**. This is a separate registration from
    the UDP client, so the UDP client id won't work.
  - `clientver={integer}`: registered version for that client.
  - `protover=1`
  - `request={string}`: one of the requests below.
- Responses are UTF-8 XML, **always gzip compressed** and chunked (even for HTTP/1.0 requests).
  Node 22 `fetch` decompresses automatically.
- **Errors do not use HTTP status codes.** The body is a single tag with a text description, e.g. `<error>Banned</error>`.

### Flooding, caching, anti-leech

- Heavy local caching is mandatory. **Requesting the same dataset more than once a day can get you banned.**
- **Max one request every 2 seconds.**
- Using the API to "download" AniDB is detected and banned.

### Requests

| request | extra params | notes |
|---|---|---|
| `anime` | `aid={int}` (required) | full anime data, see below |
| `randomrecommendation` | – | random, does not match the website's random results |
| `randomsimilar` | – | random pairs of an anime and a similar anime |
| `hotanime` | – | matches the AniDB front page, refreshed every few hours |
| `main` | – | `hotanime` + `randomsimilar` + `randomrecommendation` in one call |
| `mylistsummary` | `user`, `pass`, optional `output=xml\|json` | summary of the user's mylist |
| `hints` | `user`, `pass`, `type=1` (always 1, required), optional `output=xml\|json` | unwatched titles + predicted rating; recalculated daily; may be empty for new or inactive users |

`user`/`pass` are the account's **main password**, not the UDP API key, sent in the query string over plain HTTP.

There is no search request. The wiki points elsewhere for search, and the intended name → aid path is the
daily titles dump (`anime-titles.xml.gz` / `.dat.gz`, documented on the wiki's API page; see section 3).

### `anime` response structure

```xml
<anime id="1" restricted="false">
  <type>TV Series</type>
  <episodecount>13</episodecount>
  <startdate>1999-01-03</startdate>
  <enddate>1999-03-28</enddate>
  <titles>
    <title xml:lang="x-jat" type="main">…</title>        <!-- type: main | official | synonym | short -->
  </titles>
  <relatedanime>
    <anime id="4" type="Sequel">…</anime>                 <!-- Sequel, Prequel, Summary, … -->
  </relatedanime>
  <similaranime>
    <anime id="584" approval="75" total="89">…</anime>
  </similaranime>
  <recommendations total="20">
    <recommendation type="Recommended" uid="567190">…full review text…</recommendation>  <!-- Recommended | Must See | … -->
  </recommendations>
  <url>…</url>
  <creators>
    <name id="4303" type="Music">…</name>
  </creators>
  <description>… http://anidb.net/ch28 [Lafiel] …</description>  <!-- inline links: "<url> [label]" -->
  <ratings>
    <permanent count="4430">8.16</permanent>
    <temporary count="4460">8.23</temporary>   <!-- NOW = mean of ALL votes, not "temporary" votes -->
    <review count="12">8.70</review>
  </ratings>
  <picture>440.jpg</picture>
  <resources>
    <resource type="1"><externalentity><identifier>14</identifier></externalentity></resource>
    <resource type="4"><externalentity><url>…</url></externalentity></resource>
  </resources>
  <tags>
    <tag id="36" parentid="2607" infobox="true" weight="300" localspoiler="false" globalspoiler="false"
         verified="true" update="2018-01-21">
      <name>military</name>
      <description>…</description>
      <picurl>212184.jpg</picurl>
    </tag>
  </tags>
  <characters>
    <character id="28" type="main character in" update="2012-07-25">   <!-- main character in | secondary cast in | appears in -->
      <rating votes="1196">9.15</rating>
      <name>…</name>
      <gender>female</gender>
      <charactertype id="1">Character</charactertype>
      <description>…</description>
      <picture>14304.jpg</picture>
      <seiyuu id="12" picture="184301.jpg">…</seiyuu>
    </character>
  </characters>
  <episodes>
    <episode id="1" update="2011-07-01">
      <epno type="1">1</epno>
      <length>25</length>
      <airdate>1999-01-03</airdate>
      <rating votes="28">3.31</rating>
      <title xml:lang="en">Invasion</title>
    </episode>
  </episodes>
</anime>
```

Gotchas:

- Tags have both `spoiler` and `localspoiler`, which mean the same thing. **Use `localspoiler`.** `spoiler` will be removed.
- `<temporary>` rating now means the mean of all votes (permanent + temporary). The parsed result should expose it under an
  honest name (e.g. `ratings.mean`).
- `parentid` on tags lets you rebuild the tag tree. Optional elements (`picurl`, `description`, `parentid`, `infobox`)
  are often missing.
- Descriptions contain inline links like `http://anidb.net/ch28 [Lafiel]`. Consider a helper to strip them or turn them into structured links.
- HTTP is the only source for the tag tree and spoiler flags. UDP `ANIME` gives only flat name/id/weight lists, and there is
  no usable UDP tag command. The UDP wiki lists reply codes `ANIMETAG` 237 / `CHARACTERTAG` 238 (and `SONG` 236) but documents
  no command for them. Probed 2026-10-29: `ANIMETAG` → 598 unknown command; `TAG` exists but every param tried
  (`tagid`, `tid`, `id`, `tag`, `aid`) → 505 illegal input or access denied.
- Example response for aid 1 is ~60 KB (recommendations and tag descriptions are large).
- `resource type` is a numeric site id. The wiki page doesn't map it, so we need to find the mapping elsewhere.

## Proposed design

### 1. Separate class: `AnidbHTTPClient`

Don't bolt it onto `AnidbUDPClient`. The two share almost nothing at the transport level:
UDP has sockets, sessions, encryption and keep-alive pings, while HTTP is a stateless `fetch` with a different client registration
and a different rate limit. Export it next to the UDP client:

```ts
const http = new AnidbHTTPClient('myhttpclient', 1, { cache })
const anime = await http.anime(1)
```

A combined facade can come later if there's demand.

### 2. Share cache storage, not cached values

- `AnidbCache` / `AnidbCacheImplType` don't care about the value type, so we reuse them as-is.
- The default `SimplePersistentCache` is a module-level singleton (`src/utils/AnidbCache.ts`), so both clients share
  the same `.cache` file automatically. Users with a custom cache pass the same instance to both.
- HTTP entries use their own key prefix (`HTTP_ANIME:<aid>`, `HTTP_HOTANIME:…`), separate from UDP `ANIME:<aid>`.
- **Do not** merge HTTP results into UDP `ANIME` entries (or the reverse). Field names and structure differ, and UDP entries
  depend on the amask and its validator, so the mapping would be lossy and brittle.

### 3. Shared title index (`AnidbTitles`)

This is the most useful piece to share between clients:

- ~~Download the titles dump at most once a day and store it in the shared cache.~~ Not possible, see below.
- `search(name)` returns aids.
- `AnidbHTTPClient.anime()` can then accept a name the same way the UDP `anime()` does.
- The UDP client could also check it before sending a request, which saves UDP calls.

**Implemented on `feat/http-client`** (`src/AnidbTitles.ts`), checked 2026-10-29/30:

- **Source** ([wiki API page](https://wiki.anidb.net/API#Anime_Titles)): `http://anidb.net/api/anime-titles.dat.gz` and `.xml.gz`,
  "YOU DO NOT REQUEST THIS FILE MORE THAN ONCE PER DAY". The wiki doesn't describe the format.
- **No automatic download:** Cloudflare answers non-browser requests (curl, Node `fetch`) with a 403 "Just a moment..." JS challenge.
  A browser gets the file. So the user downloads it, and `AnidbTitles.fromFile(path)` / `fromBuffer(buf)` loads it (gzip detected by magic bytes).
  Nothing is stored in the cache: the file on disk is the cache.
- **`.dat` format** (from the file's own header):
  - `# created: Thu Oct 29 03:00:02 2026` (no time zone, parsed as local time and exposed as `created`).
  - `<aid>|<type>|<language>|<title>`.
  - Types: 1 = main (one per anime), 2 = synonym, 3 = short, 4 = official (one per language), 5 = kana reading, 6 = title card.
    They're mapped to `main`/`synonym`/`short`/`official`/`kana`/`card`.
  - **Titles can contain `|`** (e.g. `8895|1|x-jat|Shin Evangelion Gekijouban:||`), so lines are split on the first three pipes only.
  - LF line endings, no BOM. 1.4 MB gzipped, 3.3 MB text, 102k titles, 17,092 anime, 70 languages.
- **API:**
  - `lookup(name)`: exact match after normalising (case, punctuation, full-width, Latin diacritics).
    Ties go to the better title type, then the lowest aid.
  - `search(query, { limit, langs })`: best match per anime. Exact beats prefix, then word-start substring,
    then all words in any order, then plain substring. Title type adds a small bonus.
  - `titles(aid)`, `mainTitle(aid)`, `size`, `created`.
- **`anime(name)`:** `AnidbHTTPClient` takes a `titles` option, and `anime(name)` resolves the name with `lookup`. An unknown name
  throws `NO_SUCH_ANIME` with `payload.suggestions` (top 5 search results) and sends no request. Fuzzy matches never trigger a request,
  so a wrong guess can't use up the daily allowance.
- **Full dump numbers:** load uses about 80 MB of heap, and a search takes 20–33 ms.
- **Fixture:** a trimmed real dump (`src/__tests__/fixtures/anime-titles.dat`): the header plus all titles of aid 1, 4, 979, 6107, 8895, 2643.
- **Not done:** UDP client integration, and a staleness warning based on `created`.

### 4. Client responsibilities

- **Rate limit:** its own Bottleneck queue, `minTime` ≥ 2000 ms, independent of the UDP queue.
- **Caching can't really be off:** with `cache: false`, either keep a minimal in-memory cache with a 24 h lifetime or warn loudly.
- **Cache lifetimes per request:**
  - `anime`: the existing 7-day default.
  - `hotanime`/`main`: about 1 day.
  - `randomrecommendation`/`randomsimilar`: still limited to once a day, so cache or throttle them.
  - The current `AnidbCacheImplType.set` has no TTL parameter, so this would need an API addition (optional `ttl`?).
- **No duplicate requests:** if the same request is already in flight, return the existing promise.
- **Clean output:** convert the XML into plain typed objects. Repeated elements are always arrays, numbers, booleans and dates are parsed,
  and attributes are flattened into properties. Users never see the raw XML structure.
- **Errors:** turn the `<error>` body into `AnidbError`, the same error type the UDP client throws.

### 5. User-data requests (`mylistsummary`, `hints`)

These send the main account password in the query string over plain HTTP. Offer them only with credentials passed per call,
never stored, and document the risk clearly. Implement them last. They support `output=json`, so they could skip XML parsing.

### 6. Costs / trade-offs

- **New runtime dependency:** an XML parser (likely `fast-xml-parser`). JSON output only exists for the user requests, so `anime` still needs XML.
  If that bothers UDP-only users, expose the client via a subpath export (`anidb-udp-client/http`).
- **Package name:** it says "udp" but would also contain an HTTP client. Probably fine; mention it in the README instead of renaming.

## Suggested order

1. `AnidbHTTPClient` with `anime` + typed result + error mapping + rate limit + cache.
   **In progress on `feat/http-client`** (`src/AnidbHTTPClient.ts`, `src/parsers/HTTPAnimeParser.ts`). Decisions so far:
   - The cache stores the **raw XML**, not the parsed object, and parses it on read. Parser fixes then apply to cached entries
     without refetching, which matters with the once-a-day limit.
   - Dates stay as `YYYY-MM-DD` strings so results survive a JSON round trip in custom caches.
   - `cache: false` uses an in-memory cache with a 24 h lifetime and logs a warning.
   - After a `Banned` response, the client rejects every later call without sending it.
   - Only `Banned` → `BANNED` and `Anime not found` → `NO_SUCH_ANIME` are mapped. Other `<error>` texts become
     `UNKNOWN_API_ERROR`, with the text in `message` and `payload.error`. Collect the real error strings and extend the mapping.
   - Exported from the main entry point for now (subpath export is still an open question).
   - Checked live 2026-10-29 with `anime` aid 309 (clientver 1): a 111 KB response, parsed without errors. Every element and
     attribute in it is handled. The test fixture is still written by hand, with the live findings added.
   - Live findings: an `externalentity` can hold several `<identifier>`s whose meaning depends on position
     (type 3 → `1516`, `svewgq`; type 14 → `311`, `v`; type 44 → `85100`, `tv`). Seen resource types: 1, 2, 3, 4, 6, 7, 10, 14, 43, 44.
     Tag `description` text is large: 149 tags, most with a description.
   - Second live check, aid 6107 (FMA: Brotherhood, 273 KB). Episodes can have a `recap="true"` attribute and their own
     `<resources>` (type 28 per episode here, probably streaming ids). Both are now parsed. `epno type` values seen: 1, 2, 3, 4, 6
     (with prefixes `S`, `C`, `T`, `O`; type 5 is presumably `P`, unconfirmed). Related types seen: `Alternative Setting`, `Side Story`.
     Recommendation types seen: `Must See`, `Recommended`. A trimmed copy (first tags/characters, one episode per type plus the recap,
     review text removed) is the fixture `src/parsers/__tests__/fixtures/http-anime-6107.xml`.
2. `AnidbTitles` (titles dump + search); name support in `anime()`.
3. `hotanime`, `randomrecommendation`, `randomsimilar`, `main`.
4. `mylistsummary`, `hints`.

## Open questions

- [x] Titles dump: exact URL, format and download limits (see section 3).
- [ ] Mapping for `resource type` ids → site names/URL templates.
- [ ] Image base URL for `picture` / `picurl` / seiyuu `picture` (CDN path).
- [ ] Does HTTP flood protection share a ban with UDP (same IP or account)? Affects whether the two queues need to coordinate.
- [ ] Add a TTL to `AnidbCacheImplType.set` (breaking for custom implementations?), or handle expiry inside the stored value?
- [ ] Full list of `relatedanime` types, `recommendation` types and `epno type` values (1 = regular; others?).
- [ ] Shape of the `randomrecommendation` / `randomsimilar` / `hotanime` / `mylistsummary` / `hints` responses. Only short examples were noted;
      get full samples before writing parsers.
- [ ] Subpath export vs. main export.
