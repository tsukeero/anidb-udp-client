import MaskedParser from '../MaskedParser'

class TestMaskedParser extends MaskedParser {
  static mask_definition = {
    field_1: [ 0, 64, String ],
    field_2: [ 0, 32, String ],
    field_3: [ 0, 16, String ],
    field_4: [ 0, 8, String ],
    field_5: [ 0, 4, String ],
    field_6: [ 0, 2, String ],
    field_7: [ 0, 1, String ],

    field_8: [ 1, 64, String ],
    field_9: [ 2, 64, String ],
  }

}

describe('new MaskedParser()', () => {

  it('new MaskedParser(array[])', () => {
    const maskedParser = new TestMaskedParser([ 'field_8', 'field_2', 'field_1', 'field_4', 'field_3', 'field_7', 'field_9', 'field_2' ])
    expect(maskedParser.mask).toBe('794040')
    expect(maskedParser.fields).toMatchSnapshot()
  })

  it('bad field', () => {
    expect(
      () => new TestMaskedParser([ 'bad_field' ])
    ).toThrowError(new Error('Bad field: bad_field'))
  })

  it('new MaskedParser(string)', () => {
    const maskedParser = new TestMaskedParser('794040')
    expect(maskedParser.mask).toBe('794040')
    expect(maskedParser.fields).toMatchSnapshot()
  })
})

describe('verifyObject', () => {
  const maskedParser = new TestMaskedParser([ 'field_1', 'field_2' ])
  it('good object', () => {
    maskedParser.verifyObject({ field_1: 'field_1', field_2: 'field_2' })
  })
  it('bad object', () => {
    maskedParser.verifyObject({ field_1: 'field_1' })
  })
  it('no object', () => {
    maskedParser.verifyObject(undefined)
  })

})