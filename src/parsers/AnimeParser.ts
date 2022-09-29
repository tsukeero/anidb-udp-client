import MaskedParser from './MaskedParser'
import { Dateflags, ListField, NumBoolean } from './field_types/'

/**
 * @public
 */
// export type AnimeFieldName = 'aid' | 'dateflags' | 'year' | 'type' | 'related_anime' | 'related_types' | 'romanji_name' | 'kanji_name' | 'english_name' | 'other_name_list' | 'short_name_list' | 'synonym_list' | 'episodes' | 'highest_ep_number' | 'special_ep_count' | 'air_date' | 'end_date' | 'url' | 'picname' | 'rating' | 'vote_count' | 'temp_rating' | 'temp_vote_count' | 'average_review_rating' | 'review_count' | 'award_list' | 'is_18_restricted' | 'ann_id' | 'allcinema_id' | 'animenfo_id' | 'tag_name_list' | 'tag_id_list' | 'tag_weight_list' | 'date_record_updated' | 'character_id_list' | 'specials_count' | 'credits_count' | 'other_count' | 'trailer_count' | 'parody_count';


/**
 * def
 */
const fmaskDef = {
  /*
  7	128	int aid
  6	64	int dateflags
  5	32	str year
  4	16	str type
  3	8	str related aid list
  2	4	str related aid type
  1	2	retired
  0	1	retired
  */
  aid: [ 0, 128, Number ],
  dateflags: [ 0, 64, Dateflags ],
  year: [ 0, 32, String ],
  type: [ 0, 16, String ],
  related_anime: [ 0, 8, ListField(Number, undefined, true) ],
  related_types: [ 0, 4, ListField(Number, undefined, true) ],

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
  romanji_name: [ 1, 128, String ],
  kanji_name: [ 1, 64, String ],
  english_name: [ 1, 32, String ],
  other_name_list: [ 1, 16, ListField(String, undefined, true) ],
  short_name_list: [ 1, 8, ListField(String, undefined, true) ],
  synonym_list: [ 1, 4, ListField(String, undefined, true) ],

  /*
  7	128	int4 episodes
  6	64	int4 highest episode number
  5	32	int4 special ep count
  4	16	int air date
  3	8	int end date
  2	4	str url
  1	2	str picname
  0	1	retired
  */
  episodes: [ 2, 128, Number ],
  highest_ep_number: [ 2, 64, Number ],
  special_ep_count: [ 2, 32, Number ],
  air_date: [ 2, 16, Number ],
  end_date: [ 2, 8, Number ],
  url: [ 2, 4, String ],
  picname: [ 2, 2, String ],

  /*
  7	128	int4 rating
  6	64	int vote count
  5	32	int4 temp rating
  4	16	int temp vote count
  3	8	int4 average review rating
  2	4	int review count
  1	2	str award list
  0	1	bool is 18+ restricted
  */
  rating: [ 3, 128, Number ],
  vote_count: [ 3, 64, Number ],
  temp_rating: [ 3, 32, Number ],
  temp_vote_count: [ 3, 16, Number ],
  average_review_rating: [ 3, 8, Number ],
  review_count: [ 3, 4, Number ],
  award_list: [ 3, 2, ListField(String, undefined, true) ],
  is_18_restricted: [ 3, 1, NumBoolean ],

  /*
  7	128	retired
  6	64	int ANN id
  5	32	int allcinema id
  4	16	str AnimeNfo id
  3	8	str tag name list
  2	4	int tag id list
  1	2	int tag weight list
  0	1	int date record updated
  */
  ann_id: [ 4, 64, Number ],
  allcinema_id: [ 4, 32, Number ],
  animenfo_id: [ 4, 16, String ],
  tag_name_list: [ 4, 8, ListField(String, ',', true) ],
  tag_id_list: [ 4, 4, ListField(Number, ',', true) ],
  tag_weight_list: [ 4, 2, ListField(Number, ',', true) ],
  date_record_updated: [ 4, 1, String ],

  /*
  7	128	int character id list
  6	64	retired
  5	32	retired
  4	16	retired
  3	8	unused
  2	4	unused
  1	2	unused
  0	1	unused
  */
  character_id_list: [ 5, 128, ListField(Number, ',', true) ],
  // todo figure out the response

  /*
  7	128	int4 specials count
  6	64	int4 credits count
  5	32	int4 other count
  4	16	int4 trailer count
  3	8	int4 parody count
  2	4	unused
  1	2	unused
  0	1	unused
  */
  specials_count: [ 6, 128, Number ],
  credits_count: [ 6, 64, Number ],
  other_count: [ 6, 32, Number ],
  trailer_count: [ 6, 16, Number ],
  parody_count: [ 6, 8, Number ],
} as const

export type AnimeResult = {
  [Property in keyof typeof fmaskDef]: ReturnType<typeof fmaskDef[Property][2]>
} & { aid: number}

// export const DEFAULT_ANIME_FIELDS = [ 'aid', 'year', 'type', 'romanji_name', 'kanji_name', 'english_name', 'other_name_list', 'episodes', 'highest_ep_number', 'special_ep_count', 'rating', 'vote_count', 'temp_rating', 'temp_vote_count', 'average_review_rating', 'review_count' ] as const


export default class AnimeParser extends MaskedParser<string> {
  static readonly mask_definition = fmaskDef as typeof MaskedParser.mask_definition
  static DEFAULT_ANIME_FIELDS = [ 'aid', 'year', 'type', 'romanji_name', 'kanji_name', 'english_name', 'other_name_list', 'episodes', 'highest_ep_number', 'special_ep_count', 'rating', 'vote_count', 'temp_rating', 'temp_vote_count', 'average_review_rating', 'review_count' ] as const

  constructor (fields?: Array<keyof AnimeResult>) {
    const actual_fields = fields || AnimeParser.DEFAULT_ANIME_FIELDS

    // id is always requested (cache reasons!) aliases should too
    // todo verify valid fieldsf
    super([ ...actual_fields, 'aid' ])
  }

}