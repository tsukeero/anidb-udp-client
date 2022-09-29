import FileParser from '../FileParser'

test('parseData', () => {

  const parser = new FileParser([ 'aid', 'other_episodes' ])

  const result = parser.parseData('123|123|test')
  expect(result).toEqual({
    'aid': 123,
    'fid': '123',
    'other_episodes': 'test',
  })
})

test('getAmask and getFmask', () => {

  const parser = new FileParser([ 'aid', 'other_episodes', 'eid', 'other_name' ])
  expect(parser.getAmask()).toBe('00100000')
  expect(parser.getFmask()).toBe('6400000000')
})


test('parseData bad data', () => {

  const parser = new FileParser([ 'aid', 'other_episodes' ])

  const badData = 'asdasdasd'
  function failToParse () {
    parser.parseData(badData)
  }
  expect(failToParse).toThrowError(new Error('Bad data: ' + badData))
})