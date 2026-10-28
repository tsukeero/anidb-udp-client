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

test('parseData other_name_list', () => {

  const parser = new FileParser([ 'aid', 'english_name', 'other_name_list' ])

  expect(parser.parseData('3601313|18675|MF Ghost 2|MFゴースト (2024)\'MF Ghost (2024)\'极速车魂 第二季')).toEqual({
    'aid': 18675,
    'fid': '3601313',
    'english_name': 'MF Ghost 2',
    'other_name_list': [ 'MFゴースト (2024)', 'MF Ghost (2024)', '极速车魂 第二季' ],
  })
  expect(parser.parseData('3601313|18675|MF Ghost 2|').other_name_list).toEqual([])
})

test('getAmask and getFmask', () => {

  const parser = new FileParser([ 'aid', 'other_episodes', 'eid', 'other_name_list' ])
  expect(parser.getAmask()).toBe('00100000')
  expect(parser.getFmask()).toBe('6400000000')
})


test('parseData bad data', () => {

  const parser = new FileParser([ 'aid', 'other_episodes' ])

  const badData = 'asdasdasd'
  function failToParse () {
    parser.parseData(badData)
  }
  expect(failToParse).toThrow(new Error('Bad data: ' + badData))
})