import MaskedParser from './MaskedParser'
import { ListField, NumBoolean } from './field_types/'

// export type FileFieldName = 'aid' | 'eid' | 'gid' | 'mylist_id' | 'other_episodes' | 'is_deprecated' | 'state' | 'size' | 'ed2k' | 'md5' | 'sha1' | 'crc32' | 'video_color_depth' | 'quality' | 'source' | 'audio_codecs' | 'audio_bitrates' | 'video_codec' | 'video_bitrate' | 'video_resolution' | 'file_extension' | 'dub_language' | 'sub_language' | 'length_seconds' | 'description' | 'aired_date' | 'anidb_filename' | 'mylist_state' | 'mylist_filestate' | 'mylist_viewed' | 'mylist_viewdate' | 'mylist_storage' | 'mylist_source' | 'mylist_other' | 'anime_total_episodes' | 'highest_episode' | 'year' | 'type' | 'related_aid_list' | 'related_aid_type' | 'category_list' | 'romanji_name' | 'kanji_name' | 'english_name' | 'other_name' | 'short_name_list' | 'synonym_list' | 'epno' | 'ep_name' | 'ep_romanji_name' | 'ep_kanji_name' | 'ep_rating' | 'ep_vote_count' | 'group_name' | 'group_short_name' | 'aid_record_updated';
const amaskDef = {
  /*
  7	128	unused
  6	64	int4 aid
  5	32	int4 eid
  4	16	int4 gid
  3	8	int4 mylist id
  2	4	list other episodes
  1	2	int2 IsDeprecated
  0	1	int2 state
  */
  aid: [ 0, 64, Number ],
  eid: [ 0, 32, Number ],
  gid: [ 0, 16, Number ],
  mylist_id: [ 0, 8, Number ],
  other_episodes: [ 0, 4, String ],
  // todo parse
  is_deprecated: [ 0, 2, NumBoolean ],
  state: [ 0, 1, String ],
  // todo parse!

  /*
  7	128	int8 size
  6	64	str ed2k
  5	32	str md5
  4	16	str sha1
  3	8	str crc32
  2	4	unused
  1	2	video colour depth
  0	1	reserved
  */
  size: [ 1, 128, Number ],
  ed2k: [ 1, 64, String ],
  md5: [ 1, 32, String ],
  sha1: [ 1, 16, String ],
  crc32: [ 1, 8, String ],
  video_color_depth: [ 1, 2, String ],
  // todo parse

  /*
  7	128	str quality
  6	64	str source
  5	32	str audio codec list
  4	16	int4 audio bitrate list
  3	8	str video codec
  2	4	int4 video bitrate
  1	2	str video resolution
  0	1	str file type (extension)
  */
  quality: [ 2, 128, String ],
  source: [ 2, 64, String ],
  audio_codecs: [ 2, 32, String ],
  // parse
  audio_bitrates: [ 2, 16, String ],
  // parse
  video_codec: [ 2, 8, String ],
  video_bitrate: [ 2, 4, String ],
  video_resolution: [ 2, 2, String ],
  file_extension: [ 2, 1, String ],

  /*
  7	128	str dub language
  6	64	str sub language
  5	32	int4 length in seconds
  4	16	str description
  3	8	int4 aired date
  2	4	unused
  1	2	unused
  0	1	str anidb file name
  */
  dub_language: [ 3, 128, String ],
  sub_language: [ 3, 64, String ],
  length_seconds: [ 3, 32, Number ],
  description: [ 3, 16, String ],
  aired_date: [ 3, 8, String ],
  // date?
  anidb_filename: [ 3, 1, String ],

  /*
  7	128	int4 mylist state
  6	64	int4 mylist filestate
  5	32	int4 mylist viewed
  4	16	int4 mylist viewdate
  3	8	str mylist storage
  2	4	str mylist source
  1	2	str mylist other
  0	1	unused
  */
  mylist_state: [ 4, 128, Number ],
  // parse
  mylist_filestate: [ 4, 64, Number ],
  // parse
  mylist_viewed: [ 4, 32, Number ],
  // parse
  mylist_viewdate: [ 4, 16, Number ],
  // parse date
  mylist_storage: [ 4, 8, String ],
  mylist_source: [ 4, 4, String ],
  mylist_other: [ 4, 2, String ],

  /*
  7	128	int4 anime total episodes
  6	64	int4 highest episode number
  5	32	str year
  4	16	str type
  3	8	str related aid list
  2	4	str related aid type
  1	2	str category list
  0	1	reserved
  */
  anime_total_episodes: [ 5, 128, Number ],
  highest_episode: [ 5, 64, Number ],
  year: [ 5, 32, String ],
  type: [ 5, 16, String ],
  // parse
  related_aid_list: [ 5, 8, ListField(Number, undefined, true) ],
  // parse
  related_aid_type: [ 5, 4, ListField(Number, undefined, true) ],
  // parse
  category_list: [ 5, 2, ListField(String, ',', true) ],
  // parse

  /*
  7	128	str romaji name
  6	64	str kanji name
  5	32	str english name
  4	16	str other name
  3	8	str short name list
  2	4	str synonym list
  1	2	retired
  0	1	retired
  */
  romanji_name: [ 6, 128, String ],
  kanji_name: [ 6, 64, String ],
  english_name: [ 6, 32, String ],
  other_name: [ 6, 16, String ],
  short_name_list: [ 6, 8, ListField(String, undefined, true) ],
  // parse
  synonym_list: [ 6, 4, ListField(String, undefined, true) ],
  // parse

  /*
  7	128	str epno
  6	64	str ep name
  5	32	str ep romaji name
  4	16	str ep kanji name
  3	8	int4 episode rating
  2	4	int4 episode vote count
  1	2	unused
  0	1	unused
  */
  epno: [ 7, 128, String ],
  ep_name: [ 7, 64, String ],
  ep_romanji_name: [ 7, 32, String ],
  ep_kanji_name: [ 7, 16, String ],
  ep_rating: [ 7, 8, Number ],
  ep_vote_count: [ 7, 4, Number ],

  /*
  7	128	str group name
  6	64	str group short name
  5	32	unused
  4	16	unused
  3	8	unused
  2	4	unused
  1	2	unused
  0	1	int4 date aid record updated
  */
  group_name: [ 8, 128, String ],
  group_short_name: [ 8, 64, String ],
  aid_record_updated: [ 8, 1, Number ], // date?

} as const

export type FileResult = {
  [Property in keyof typeof amaskDef]: ReturnType<typeof amaskDef[Property][2]>
} & { fid: number}

export default class FileParser extends MaskedParser<keyof FileResult> {
  static readonly mask_definition = amaskDef

  constructor (fields: Array<keyof FileResult>) {
    super(fields)
    const orig_parseData = this.parseData

    this.parseData = data => {
      // todo: handle multi file result?
      const matched_data = data.match(/([0-9]+)\|((:?.|\n)*)/)

      if (!matched_data) {
        throw new Error('Bad data: ' + data)
      }

      const resp_obj = orig_parseData(matched_data[2])
      resp_obj.fid = matched_data[1]
      return resp_obj
    }
  }

  getFmask () {
    return this.mask.substr(0, 5 * 2)
  }

  getAmask () {
    return this.mask.substr(5 * 2)
  }

}