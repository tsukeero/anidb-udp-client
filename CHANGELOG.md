# Changelog

## [2.0.0](https://github.com/tsukeero/anidb-udp-client/compare/v1.1.1...v2.0.0) (2026-10-28)


### ⚠ BREAKING CHANGES

* node 18 and 20 are no longer supported, minimum is node 22
* file()/file_by_hash()/file_by_episode() field 'other_name' is renamed to 'other_name_list' and now returns string[]

### Bug Fixes

* accept cache: false in AnidbUDPClient options ([#22](https://github.com/tsukeero/anidb-udp-client/issues/22)) ([151c62c](https://github.com/tsukeero/anidb-udp-client/commit/151c62ca09c3e4322392f2fd3227b89e4ed9956f)), closes [#19](https://github.com/tsukeero/anidb-udp-client/issues/19)
* remove debug output and compressed-response dump from UDP requests ([#23](https://github.com/tsukeero/anidb-udp-client/issues/23)) ([3bae649](https://github.com/tsukeero/anidb-udp-client/commit/3bae64944f9829e1c23acbd77d2c9a9e59681d31))
* return FILE other names as other_name_list array ([#21](https://github.com/tsukeero/anidb-udp-client/issues/21)) ([cb8ebf0](https://github.com/tsukeero/anidb-udp-client/commit/cb8ebf0739b75d8749cf1300c4e24212f76c57a9)), closes [#20](https://github.com/tsukeero/anidb-udp-client/issues/20)


### Miscellaneous Chores

* update dependencies, remove multiversion docs ([d034f1a](https://github.com/tsukeero/anidb-udp-client/commit/d034f1adb739babd58b7bc47f60960e93afbe7ad))
* require node >= 22 ([#25](https://github.com/tsukeero/anidb-udp-client/issues/25)) ([54ecc66](https://github.com/tsukeero/anidb-udp-client/commit/54ecc66f393dd1e2ce8f4a60da05ea92ffec8265))

## [1.1.1](https://github.com/tsukeero/anidb-udp-client/compare/v1.1.0...v1.1.1) (2023-05-03)


### Bug Fixes

* readme and changelog fixes ([23b1999](https://github.com/tsukeero/anidb-udp-client/commit/23b1999fecc0e109a66b978b46a6d26ed8384f03))

## [1.1.0](https://github.com/tsukeero/anidb-udp-client/compare/v1.0.4...v1.1.0) (2022-10-07)


### Features

* add support for encryption using Anidb UDP Api key ([24dea5f](https://github.com/tsukeero/anidb-udp-client/commit/24dea5f3cfa6a40d6daee6152a9dd720c92d9ef6))

## [1.0.4](https://github.com/tsukeero/anidb-udp-client/compare/v1.0.3...v1.0.4) (2022-09-30)


### Bug Fixes

* fixed default client id ([016b189](https://github.com/tsukeero/anidb-udp-client/commit/016b1896aad664694fd60fc86c253f8af0f21fca))

## [1.0.3](https://github.com/tsukeero/anidb-udp-client/compare/v1.0.2...v1.0.3) (2022-09-30)


### Bug Fixes

* npm publish 3nd attempt ([656c113](https://github.com/tsukeero/anidb-udp-client/commit/656c113bfa9227424c83cb13b2b22b1da77d605b))


## 1.0.0 (2022-09-30)


### Features

* let there be lib ([5acb623](https://github.com/tsukeero/anidb-udp-client/commit/5acb623f47d77c487ccabec9bcde4093c3c7ff6d))
