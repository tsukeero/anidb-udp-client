# Seeding the cache from a mylist export

> **Status: DRAFT — needs refinement.** Nothing here is implemented yet.
> Notes are from the AniDB wiki ([MyList export](https://wiki.anidb.net/MyList_export),
> [template guidelines](https://wiki.anidb.net/MyList_export_template_guidelines)), the template sources in
> the public [anidb/export](https://git.anidb.net/anidb/export) repo, and a real `txt-udp-mylist` export
> (read 2026-10-28). Open questions are listed at the end.

## Goal

Let a user hand the client an AniDB mylist export so the cache is filled up front, instead of paying one
UDP round trip (and the flood limit) per file the first time it is looked up.

## Decisions so far

- **Input:** the export archive as downloaded from AniDB (`.tgz`), passed as a file path or a readable stream.
- **Seeding is explicit.** The cache is seeded at the moment the seed is passed in. Entries use the normal
  cache expiry (7 days with the default cache), counted from that moment. To refresh, pass a seed again.
- **Mylist data is not cached.** The `MYLIST` command stays uncached, as it is today, and the seed does not
  write `mylist_*` fields. Going out of date is therefore not a concern.
- **`txt-udp-mylist` seeds only `FILE` entries and their hash aliases** (see below).
- **`ANIME` / `EPISODE` / `GROUP`:** checked against a real `xml-plain-new` export, see
  [`xml-plain-new` findings](#xml-plain-new-findings) (verified against live UDP). `ANIME` (partial),
  `EPISODE` and a richer `FILE` are feasible; `GROUP` is not possible.

## Export templates

AniDB renders exports from user-contributed templates (`themes/<name>/mylist.tpl` and an optional per-anime
`anime.tpl`) using Perl `HTML::Template`. Only variables the server exposes can appear in an export. The full list is on
the template guidelines page, and the server also has some undocumented ones (`data_file_lid`,
`data_file_ldate_raw`, `data_file_viewdate_raw`, `data_file_myother`, `data_file_ep_is_primary`, used by
`txt-udp-mylist`).

The template sources can be read through the GitLab REST API (`git clone` is blocked by Cloudflare):
`https://git.anidb.net/api/v4/projects/6/repository/files/themes%2F<name>%2Fmylist.tpl/raw?ref=master`.

| Template | Useful content | Problems |
|---|---|---|
| `txt-udp-mylist` | Exact UDP `MYLIST` rows plus `size:ed2k` and file↔episode relations as comments; raw unix times and byte sizes | Only ids, hashes and mylist data, nothing descriptive |
| `xml-plain-new` | Most complete: all titles (type + language), episodes, file hashes/codecs/languages, group names | No lid; many values are display-formatted rather than UDP-shaped; `<TTH>` actually contains SHA1 |
| `json-weltschmerz` | JSON per anime; episodes (eid, epno, names, length, aired), file hashes, `update` timestamps | No anime titles, no lid |
| `json-large` | Rich per-anime data | Hand-built JSON (booleans as `" true "`), size only in MB, ed2k only inside the link |

## `txt-udp-mylist` format

```
# MYLIST export for user: <user> started at: 28.10.2026 19:01.
# MYLIST anime count: 1377
...
# MYLIST export output file count: 10933
# Format: ...
# File: <ed2k file name>
# UID: <size in bytes>:<ed2k hash>
# Related Ep: FID: 82353, EID: 8968, Start%: 0, End%: 100     (0..n lines, primary row only)
# Related episode                                              (instead of the above, on non-primary rows)
221 MYLIST
{lid}|{fid}|{eid}|{aid}|{gid}|{date}|{state}|{viewdate}|{storage}|{source}|{other}|{filestate}
...
# Done with export.
```

Observations from the sample (10,933 rows):

- A file covering several episodes is emitted once per episode with the same lid/fid. The extra rows are
  marked `# Related episode`. 10,629 unique fids; the primary row is the one to use.
- `export output file count` in the header equals the number of data rows, so it can be used to detect a cut-off file.
- `gid` is `0` for 58% of rows (no group / generic files); UDP also returns `0` there.
- Archive contents after extraction: `mylist.txt` and `changelog.txt`.

### What it seeds

For every unique fid (primary row):

- `FILE:{fid}` → partial object `{ fid, aid, eid, gid, size, ed2k }`
- `FILE:s{size}|h{ed2k}` → `ALIASOF:{fid}` (same alias `file_by_hash` writes)

Partial entries are safe. `FileParser.verifyObject` rejects a cached object missing any requested field, and
`onMiss` then fetches from UDP and merges the result over the partial one. So the cache answers only when the
request is limited to seeded fields. The alias makes the common "hash a local file → fid" lookup free.

## `xml-plain-new` findings

From a real export (2026-10-28): 92 MB, one UTF-8 XML file, every value in CDATA, parses cleanly with a
streaming parser. Text values carry HTML entities (`&amp;`, `&lt;`, `&gt;`) inside the CDATA, so they need decoding.

| Table | Rows | Notes |
|---|---|---|
| `anime` | 1,377 | |
| `title` | 13,182 | type 1 main, 2 synonym, 3 short, 4 official, 5 (kana reading, undocumented) + language |
| `anime_category` | 23,734 | tags with `CategoryWeight` (0–600, same scale as UDP) |
| `anime_group` | 957 | per-anime group status, **not** the group's own record |
| `episode` | 10,295 | only episodes that are in the mylist |
| `episode_title` | 43,488 | |
| `file` | 10,933 | same duplicate-per-episode rows as `txt-udp-mylist`; has `Size` + `ed2kHash` |
| `filefile` / `file_episode` | 2,993 / 4,460 | file relations |
| `company`, `award`, `award_type`, `category` | | not used by any UDP command we cache |

Value formats compared with UDP:

- **Dates** are `dd.mm.yyyy hh:mm` (or `dd.mm.yyyy`) in **UTC**, minute precision. Checked against the raw
  unix time in `txt-udp-mylist` (`28.09.2022 05:14` ↔ `1664342073`) and against the UDP snapshot for aid 20
  (`02.04.2002` ↔ `air_date: 1017705600`). Seconds are lost. `-` / `?` mean unknown and become `0`.
- **Ratings** are decimals (`4.29`); UDP sends integers ×100 (`431`). `-` means none.
- `anime.Update` is already a raw unix time.
- `Year` (`2007`, `2009-2011`) and `TypeName` (`TV Series`, `OVA`) match UDP.
- **Episode numbers are not zero-padded** (`1`, `S1`, `T25`); UDP returns `01`. See the padding rules below.
- `anime.NameKanji` falls back to a latin title when there is no Japanese one; take titles from the `title` table instead.
- The `fid` in UDP `FILE` results is a **string** (see snapshots); seeded values must use the same type.

### Live UDP comparison (2026-10-29)

Fetched 5 anime, 12 episodes and 9 files over UDP and diffed them field by field against the converted export
values. The samples were picked to cover edge cases: year ranges, unknown end date, awards, S/C/T/P/O specials,
3-digit episodes, missing air date, HE-AAC, 2+ audio/sub streams, Blu-ray, state 4229, multi-episode file.
Scripts are in the session scratchpad (`udpfetch.js`, `compare.py`) and are not part of the repo.

Exact matches (all samples): numeric ids, ratings (×100), vote counts, review rating/count, dates (UTC
conversion, `-`/`?` → `0`), `type`, `url`, `romanji_name`, `kanji_name`, `is_18_restricted`,
`date_record_updated`, `award_list`; episode `length/rating/votes/eng/romaji/kanji/aired/type`; file hashes,
`state`, `quality`, `source`, codecs (UDP also says `(HE-)AAC`; the old test snapshot was stale), bitrates,
resolution, extension, languages, `length_seconds`, `description`, `aired_date`, episode and group names.

Conversion rules found:

- **`year`:** UDP writes a single year as `2002-2002` when the anime has ended. Export `2002` with a known end
  date → `2002-2002`; with unknown end date (ongoing) keep `1999`.
- **Title lists** (`other_name_list` = official titles, `short_name_list`, `synonym_list`): UDP **dedupes** the
  same name across languages; the export has one row per language. After deduping the sets match, but the
  **order differs** (UDP looks like insert order, the export is sorted by name).
- **`english_name`:** 1 of 5 differs. For aid 24 UDP is empty while the export has an official English title equal
  to `kanji_name`. Probably UDP blanks it when identical, unconfirmed.
- **EPISODE `epno`:** normal episodes zero-padded to **at least 2 digits** (`01`, `10`, `100`, never `001`);
  specials unpadded (`S1`, `C1`, `T1`, `P25`, `O1`).
- **FILE `epno`:** zero-padded to the digit count of the anime's **highest episode number** (aid 584, 110 eps →
  `001`; aid 69, highest 1184 → `0001`; 1-ep anime → `1`), so it differs from EPISODE. Multi-episode files are
  a range (`1-2`). The highest episode number is not in the export (`Eps` is `0` for ongoing anime).
- **`other_episodes`:** `eid,percent` joined with `'`, from `file_episode`, after dropping duplicate rows.
- **Audio/subtitle fields:** values joined with `'`. Only 2 streams exported; a file with 3 audio streams
  (fid 82353) can't be reproduced.

Not usable:

- **Tags:** the export's `anime_category` is the old category system (`Action`, id 4); UDP returns the current tag
  system (`action`, id 2841, plus parent tags, weight 0). No overlap.
- **`ann_id`, `allcinema_id`, `animenfo_id`:** differ for some anime (stale resource links in the export).
- **`special_ep_count`:** the export doesn't count `O`/`P` episodes (One Piece: 141 vs 174).

### Per command

- **`ANIME` — feasible as a partial entry** (the `anime()` validator refetches missing fields). Seedable: `aid,
  year` (with the rule above)`, type, romanji_name, kanji_name, short_name_list, synonym_list, other_name_list`
  (deduped; order differs), `episodes, air_date, end_date, url, rating, vote_count, temp_rating, temp_vote_count,
  average_review_rating, review_count, is_18_restricted, date_record_updated, award_list`, plus name aliases
  like `anime()` writes. Leave out `english_name` until the blanking rule is confirmed.
- **`EPISODE` — feasible.** All 11 fields match with the epno padding rule. Since `episode()` has no validator,
  seeded entries must be complete, and they are. Only episodes in the mylist are covered.
- **`GROUP` — not possible.** The export has only gid, name and short name (the rating in `anime_group` is the
  per-anime rating). `group()` has no validator, so a partial entry would be returned as if complete.
- **`FILE` — feasible and much richer than `txt-udp-mylist`**: everything in the "exact matches" list plus
  `other_episodes` and `year`. Leave out audio fields when `ACount > 2`, subtitle fields when `SubCount > 2`,
  and `epno` (needs the highest episode number, and multi-episode ranges). It also has `Size` + `ed2kHash`, so
  this template alone can seed the hash aliases.

Side finding: the live run printed `MaxListenersExceededWarning: 11 error listeners added to [Socket]`.
The client seems to add `error`/`close` listeners to the UDP socket per request without removing them.

## Sketch

- `src/utils/mylistExportSeed.ts`: gunzip (`node:zlib`) + read the tar entries + parse `mylist.txt` into
  `{ fid, aid, eid, gid, size, ed2k }` records. Validate the header row count.
- Public entry point on the client, e.g.
  `client.seedCache(source: string | NodeJS.ReadableStream): Promise<{ files: number, aliases: number }>`,
  writing through the configured `AnidbCacheImplType`. This keeps it working with custom cache implementations
  and makes it a no-op with `cache: false`.
- When a `FILE:{fid}` entry already exists, merge into it rather than overwrite, so fields fetched earlier are kept.

## Open questions

- Tar reading: hand-rolled ustar reader (512-byte headers, ~30 lines) vs a dependency such as `tar-stream`.
  Currently the only runtime dependencies are `bottleneck` and `node-cache`.
- Merging into an existing entry also resets its expiry. Is that acceptable?
- Should `other_episodes` be built from the `# Related Ep` lines? Need to confirm the UDP format of that field first.
- Is the export's `# File:` name the same as UDP `anidb_filename`? In the sample it is not (no CRC in the
  name), so it is not seeded.
- Is a different title-list order acceptable for seeded `ANIME` entries, or should those lists be left out?
- Support both templates, or only `xml-plain-new`? It covers everything `txt-udp-mylist` gives for `FILE`, but it
  is ~50× bigger and needs an XML parser (Node has none built in).
