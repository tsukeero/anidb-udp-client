import { ListField, Dateflags, MapField, CodedField } from '../index'
describe('ListField', () => {
  test('simple', () => {
    expect(ListField(String)('a\'b\'c')).toEqual([ 'a', 'b', 'c' ])
  })
  test('no value', () => {
    expect(ListField(String)()).toEqual([ '' ])
  })
  test('Custom type', () => {
    expect(ListField(v => v + 't')('a\'b\'c')).toEqual([ 'at', 'bt', 'ct' ])
  })

  test('Custom separator', () => {
    expect(ListField(String, ',')('a,b,c')).toEqual([ 'a', 'b', 'c' ])
  })

  test('filter empty', () => {
    expect(ListField(String, null, true)('a\'\'c')).toEqual([ 'a', 'c' ])
  })

})

describe('MapField', () => {
  const map_def = new Map([
    [ 'field_string', String ],
    [ 'field_number', Number ],
    [ 'field_custom', v => v + 't' ],
  ])

  const expected = {
    field_string: 'a',
    field_number: 1,
    field_custom: 'ct',
  }

  test('simple', () => {
    expect(MapField(map_def)('a|1|c')).toEqual(expected)
  })

  test('Bad input', () => {
    function badInput () {
      MapField(map_def)('a|1')
    }
    expect(badInput).toThrowError(new Error(`Definition and input item length missmatch input: 2 definition: ${ map_def.size }`))
  })

  test('Custom separator', () => {
    expect(MapField(map_def, ',')('a,1,c')).toEqual(expected)
  })

})

describe('Dateflags', () => {
  const flags = [ 'start_unknown_day', 'start_unknown_month', 'end_unknown_day', 'end_unkown_month', 'ended', 'start_unknown_year', 'end_unknown_year' ]
  for (let i = 0; i <= 6;i++) {
    test(flags[i], () => {
      expect(Dateflags(Math.pow(2, i))).toEqual([ flags[i] ])
    })
  }
  test('Check all flags', () => {
    expect(Dateflags(parseInt('1111111', 2))).toEqual(flags)
  })
})

describe('CodedField', () => {

  test('simple', () => {
    expect(CodedField({ a: 1, b: 2, c: 3 })('c')).toEqual(3)
  })
  test('with parser', () => {
    expect(CodedField({ at: 1, bt: 2, ct: 3 }, v => v + 't')('c')).toEqual(3)
  })
})
