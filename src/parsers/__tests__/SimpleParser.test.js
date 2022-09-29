import SimpleParser from '../SimpleParser'

test('parseData', () => {

  const parser = new SimpleParser({
    'number_field': Number,
    'string_field': String,
    'boolean_field': Boolean,
    'custom_field': value => ({ [value]: 'test' }),
  })

  const result = parser.parseData('123|test|0|my_value')
  expect(result).toMatchSnapshot()
})

// test may be redoundant!
test('parseData incoreect field number', () => {
  const parser = new SimpleParser({
    'one': String,
    'two': String,
    'three': String,
  })

  function failToParse () {
    parser.parseData('1|2')
  }
  expect(failToParse).toThrowError(new Error(`Definition and input item length missmatch input: 2 definition: 3`))
})