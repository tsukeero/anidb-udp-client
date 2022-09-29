import { AnidbCache } from '../AnidbCache'
import NodeCache from 'node-cache'
import * as SimplePersistentCacheModule from '../SimplePersistentCache'
describe('AnidbCache', () => {
  describe('getImplInstance', () => {

    let SimplePersistentCache
    beforeAll(() => {
      SimplePersistentCache = jest.spyOn(SimplePersistentCacheModule, 'SimplePersistentCache').mockReturnValue()
    })

    afterEach(() => {
      jest.resetModules()
      jest.resetAllMocks()
    })
    afterAll(() => {
      jest.restoreAllMocks()
    })
    test('getImplInstance(undefined)',() => {
      const test = jest.fn()
      SimplePersistentCache.mockReturnValueOnce(test)
      const a = new AnidbCache()
      expect(a.cache).toBe(test)
      expect(SimplePersistentCache).toHaveBeenCalledWith({ stdTTL: 604800, checkperiod: 1800 })
    })
    // test('getImplInstance(undefined) - already set',() => {
    //   const first_init_cache = () => ({ one: 'one' })
    //   SimplePersistentCache.mockReturnValueOnce(first_init_cache)
    //   new AnidbCache()


    //   const second_init_cache = () => ({ one: 'two' })
    //   SimplePersistentCache.mockReturnValueOnce(second_init_cache)

    //   const second_init = new AnidbCache()

    //   console.log(second_init.cache)
    //   // expect(second_init.cache).toBe(first_init_cache)
    //   expect(SimplePersistentCache).toHaveBeenCalledWith({ stdTTL: 604800, checkperiod: 600 })
    //   expect(SimplePersistentCache).toHaveBeenCalledTimes(1)


    // })

    test('getImplInstance(cache)',() => {
      const test = jest.fn()
      const a = new AnidbCache(test)
      expect(a.cache).toBe(test)
      expect(SimplePersistentCache).toHaveBeenCalledTimes(0)

    })
    test('getImplInstance(false)',async () => {
      const a = new AnidbCache(false)
      const setResult = await a.cache.set('test',1)
      expect(setResult).toBe(undefined)
      const getResult = await a.cache.get('test')
      expect(getResult).toBe(null)
      expect(SimplePersistentCache).toHaveBeenCalledTimes(0)
    })

  })

  test('get', async () => {

    const cache = new NodeCache()

    const a = new AnidbCache(cache)

    const myMock = jest.fn()
    myMock.mockReturnValueOnce('my fake result')

    const empty_cache = await a.get('TCOMAND', 'ID')
    expect(empty_cache).toBeFalsy()


    const result = await a.get('TCOMAND', 'ID', { onMiss: myMock })

    expect(myMock).toHaveBeenCalled()

    expect(result).toBe('my fake result')

    const from_cache = await a.get('TCOMAND', 'ID')
    expect(from_cache).toBe('my fake result')

    expect(cache.get(`TCOMAND:ID`)).toBe('my fake result')


  })

  test('get - onMiss falsy', async () => {

    const cache = new NodeCache()
    const a = new AnidbCache(cache)
    const result2 = await a.get('TCOMAND', 'ID', { onMiss: () => null })
    expect(result2).toBe(null)

  })

  test('get with validator', async () => {
    const cache = new NodeCache()

    const a = new AnidbCache(cache)
    cache.set(`TCOMAND_2:ID2`, 'Fake')

    // cache validator
    const mockedValidator = jest.fn()
    mockedValidator.mockReturnValueOnce(false)
    const mockedMiss = jest.fn()
    mockedMiss.mockReturnValueOnce('Fake 2')

    await a.get('TCOMAND_2', 'ID2', { validator: mockedValidator, onMiss: mockedMiss } )

    expect(mockedValidator).toHaveBeenCalledWith( 'Fake' )
    expect(mockedMiss).toHaveBeenCalledWith( 'Fake' )

    expect(cache.get(`TCOMAND_2:ID2`)).toBe('Fake 2')


    const mockedValidatorSuccess = jest.fn()
    mockedValidatorSuccess.mockReturnValueOnce(true)
    const mockedNotMiss = jest.fn()

    const result = await a.get('TCOMAND_2', 'ID2', { validator: mockedValidatorSuccess, onMiss: mockedNotMiss })
    expect(mockedValidatorSuccess).toHaveBeenCalledWith( 'Fake 2' )
    expect(mockedNotMiss).not.toHaveBeenCalled()

    expect(result).toBe('Fake 2')

  })


  test('get with validator throws an error', async () => {

    const cache = new NodeCache()

    const a = new AnidbCache(cache)

    await a.get('TCOMAND', 'ID', { onMiss: () => 'cached_value' })

    expect(a.get('TCOMAND_2', 'ID2', { validator: () => { throw new Error('test')}, onMiss: a => a } )).rejects.toThrow(new Error('test'))


    const from_cache = await a.get('TCOMAND', 'ID')
    expect(from_cache).toBe('cached_value')

  })


  test('get by aliases', async () => {
    const cache = new NodeCache()

    const a = new AnidbCache(cache)

    const cached_obj = {
      sample: 'yay',
    }

    cache.set(`TCOMAND_2:NAME1`, 'ALIASOF:ID3')
    cache.set(`TCOMAND_2:NAME2`, 'ALIASOF:ID3')
    cache.set(`TCOMAND_2:ID3`, cached_obj)

    // cache validator)
    const mockedMiss = jest.fn()
    const result = await a.get('TCOMAND_2', 'NAME1', { onMiss: mockedMiss })

    expect(mockedMiss).not.toHaveBeenCalled()

    expect(result).toEqual(cached_obj)


  })

  test('get miss with aliases', async () => {
    const cache = new NodeCache()

    const a = new AnidbCache(cache)
    const cached_obj = {
      sample: 'yay',
    }

    const mockedMiss = jest.fn()
    mockedMiss.mockReturnValueOnce({
      id: 'ID',
      value: cached_obj,
      aliases: [ 'NAME1', 'NAME2', '', null, undefined ],

    })
    const result = await a.get('TCOMAND_2', 'NAME1', { onMiss: mockedMiss })
    expect(mockedMiss).toHaveBeenCalled()

    expect(cache.keys()).toEqual([ 'TCOMAND_2:ID', 'TCOMAND_2:NAME1', 'TCOMAND_2:NAME2' ])
    expect(result).toEqual(cached_obj)


    expect(cache.get(`TCOMAND_2:ID`)).toEqual(cached_obj)
    expect(cache.get(`TCOMAND_2:NAME1`)).toBe('ALIASOF:ID')
    expect(cache.get(`TCOMAND_2:NAME2`)).toBe('ALIASOF:ID')
  })

})