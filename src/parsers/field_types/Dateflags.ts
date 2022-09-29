const VALID_DATE_FLAGS = [ 'start_unknown_day', 'start_unknown_month', 'end_unknown_day', 'end_unkown_month', 'ended', 'start_unknown_year', 'end_unknown_year' ] as const

export type DateflagsType = typeof VALID_DATE_FLAGS[number];

export default function Dateflags (flags: number): Array<DateflagsType> {
  // const dateflags: Array<DateflagsType> = [ 'start_unknown_day', 'start_unknown_month', 'end_unknown_day', 'end_unkown_month', 'ended', 'start_unknown_year', 'end_unknown_year' ]
  return VALID_DATE_FLAGS.filter((v, i) => !!(flags >>> i & 1))
}