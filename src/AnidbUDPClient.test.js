import { AnidbUDPClient } from './AnidbUDPClient'
import * as AnidbCacheModule from './utils/AnidbCache'
import * as LoggerModule from './utils/log'

async function simpleCachedCall (command, fn, response_code, args, params, mocked_response, cache) {
  const a = new AnidbUDPClient('test', { cache: cache || false })
  a._callApi = jest.fn()
  a._callApi.mockReturnValueOnce({
    code: response_code,
    response: [ command ],
    data: mocked_response,
  })
  const result = await a[fn](...args)
  let final_params = params

  if (!Array.isArray(params)) {
    final_params = [ params ]
  }
  expect(a._callApi).toBeCalledWith(command, ...final_params)
  expect(result).toMatchSnapshot()
  return a
}

describe('constructor', () => {
  let AnidbCacheConstructor
  beforeAll(() => {
    AnidbCacheConstructor = jest.spyOn(AnidbCacheModule, 'AnidbCache').mockReturnValue()
  })


  afterEach(() => {
    jest.resetModules()
    jest.resetAllMocks()
  })
  afterAll(() => {
    jest.restoreAllMocks()
  })


  it('new AnidbUDPClient()', () => {


    const a = new AnidbUDPClient()

    expect(a.clientId).toBe('anidbudpclientjs')
    expect(a.session).toBe(null)

    expect(a.incomming_port).toBe(undefined)
    expect(a.pingInterval).toBe(300000)

    expect(AnidbCacheConstructor).toHaveBeenCalledWith(undefined)
    expect(AnidbCacheConstructor).toHaveBeenCalledTimes(1)
  })

  it('new AnidbUDPClient(client_id)', () => {
    const a = new AnidbUDPClient('client_id')
    expect(a.clientId).toBe('client_id')
  })

  it('new AnidbUDPClient(null, {ping_interval: 500000 })', () => {
    const a = new AnidbUDPClient('client_id',{ ping_interval: 500000 })
    expect(a.pingInterval).toBe(500000)
  })

  it('new AniAnidbUDPClientdb(null, {debug: true })', () => {
    const forceEnableDebugLog = jest.spyOn(LoggerModule, 'forceEnableDebugLog').mockReturnValue()
    new AnidbUDPClient('client_id',{ debug: true })
    expect(forceEnableDebugLog).toHaveBeenCalledTimes(1)
  })

  it('new AnidbUDPClient(null, {logger: false})', () => {
    const setLog = jest.spyOn(LoggerModule, 'setLog').mockReturnValue()
    new AnidbUDPClient(null, { logger: false })
    expect(setLog).toHaveBeenCalledWith()
  })

  it('new AnidbUDPClient(null, {logger: fn})', () => {
    const logger = jest.fn
    const setLog = jest.spyOn(LoggerModule, 'setLog').mockReturnValue()
    new AnidbUDPClient(null, { logger })
    expect(setLog).toHaveBeenCalledWith(logger)
  })

})
test('episode', async () => {

  await simpleCachedCall(
    'EPISODE',
    'episode',
    240,
    [ 2 ],
    { eid: 2 },
    '2|1|24|750|2|02|Kin of the Stars|Hoshi-tachi no Kenzoku|??????|1295059229|2'
  )
})
test('episode_by_anime', async () => {

  await simpleCachedCall(
    'EPISODE',
    'episode_by_anime',
    240,
    [ 'Kin of the Stars', '02' ],
    { aname: 'Kin of the Stars', epno: '02' },
    '77|20|25|753|7|01|Surface - The Fateful Encounter|Chijou - Unmei no Deai|地上 運命の出逢い|1017705600|1'
  )
})


test('creator', async () => {
  await simpleCachedCall(
    'CREATOR',
    'creator',
    245,
    [ 718 ],
    { creatorid: 718 },
    '718|GAINAX|Gainax|2|10092.png||http://www.gainax.co.jp/|Gainax|Gainax|1485464792'
  )
})

test('character', async () => {
  await simpleCachedCall(
    'CHARACTER',
    'character',
    235,
    [ 488 ],
    { charid: 488 },
    '488|ニコ・ロビン|Nico Robin|80187.jpg|4097,2,1900,1\'69,2,1900,1\'11529,2,1900,1\'8010,3,1900,1\'1254,3,1900,1\'6537,2,1900,1\'2036,3,1900,1\'2644,3,1900,1\'6199,3,1900,1\'8940,2,1900,1\'8142,1,1900,1\'7251,1,,\'5691,3,1900,1\'4851,3,1900,1\'7538,1,,||1326978649|1|F'
  )
})

test('calendar', async () => {
  await simpleCachedCall(
    'CALENDAR',
    'calendar',
    297,
    [],
    {},
    '12276|1500076800|0\n12646|1500076800|0\n12889|1500076800|0\n13277|1500249600|0\n13227|1500249600|0\n12618|1500595200|0\n12899|1500681600|0\n11745|1500681600|0\n13289|1500854400|0\n13146|1501200000|0\n13155|1501372800|0\n13326|1501372800|0\n13145|1501459200|0\n13005|1501718400|0\n13243|1501804800|0\n13167|1501804800|0\n12442|1501804800|0\n13327|1502323200|0\n13377|1502496000|0\n12605|1503014400|0\n12658|1503446400|0\n13379|1503619200|0\n13162|1503619200|0\n12727|1503619200|0\n12093|1503619200|0\n13157|1503619200|0\n12728|1503619200|0\n13170|1503619200|0\n12420|1503705600|0\n12993|1503705600|0\n13378|1504224000|0\n13391|1504483200|0\n13393|1504569600|0\n12683|1504828800|0\n13357|1504828800|0\n13060|1505260800|0\n12982|1505433600|0\n13279|1506038400|0\n13251|1506643200|0\n12962|1506729600|0\n12956|1506988800|0\n13274|1506988800|0\n12578|1507075200|0\n13154|1507075200|0\n12988|1505520000|8\n9788|1500681600|16\n13317|1500854400|16\n13332|1501804800|16\n13242|1501804800|16\n13033|1502496000|16\n'
  )
})

test('group', async () => {
  await simpleCachedCall(
    'GROUP',
    'group',
    250,
    [ 7091 ],
    { gid: 7091 },
    "7091|823|1519|52|831|Frostii|Frostii|#frostii|irc.rizon.net|http://frostii.net|15844.jpg|1228089600|0|1|1498435200|1498505949|7255,1'3097,4'748,4'8106,1'8159,2'8402,1'8696,1'5200,2'9022,1'10438,1'5590,105"
  )
})


test('groupstatus', async () => {
  await simpleCachedCall(
    'GROUPSTATUS',
    'groupstatus',
    250,
    [ 20, 'ongoing' ],
    { aid: 20, state: '1' },
    '11111|Hi10 Anime|3|26|0|0|1-26\n13044|10bit-Anime|3|26|0|0|1-26\n240|Anime-MX|3|26|813|4|1-26\n631|Vision-Anime|3|26|818|19|1-26\n6|Anime-Empire|3|26|534|22|1-26\n1598|Exiled-Destiny|3|26|891|6|1-26\n925|Baka-Anime|3|26|488|6|1-26'
  )
})

test('animeDesc', async () => {
  const command = 'ANIMEDESC'
  const response_code = 233
  const a = new AnidbUDPClient('test', { cache: false })
  a._callApi = jest.fn()
  a._callApi
    .mockReturnValueOnce(Promise.resolve({
      code: response_code,
      response: [ command ],
      data: '0|2|By 2307 AD, fossil fuels had already long become virtually exhausted. Humankind spent several decades on wars around the little that remained of such fuels and on constructing a large-scale system to draw in solar power from orbit, with an orbital ring, power microwaving technology, and three orbital elevators. In order to construct such a gigantic, resource-intensive system, however, most relevant countries had consolidated into three major power blocks: the [url=http://anidb.net/ch8593]World Economic Union[/url], centered around the United States of America; the [url=http://anidb.net/ch8594]Advanced European Union[/url], centered around the European Union; and the [url=http://anidb.net/ch8592]Human Reform League[/url], centered around Russia, India and China. As only these power blocs and their allies had participated in the construction of the solar power system, only they were entitled to its benefits; with fossil fuels nearing extinction, countries with economies based on them, such as those from the Middle East, became progressively poorer.<br /><br />Meanwhile, these three superpowers continued to intervene militarily where they see fit, terrorism was still rampant, and peace was a faraway dream for many people. Even in the 24th century, humankind was far from unified. A',
    }))
    .mockReturnValueOnce(Promise.resolve({
      code: response_code,
      response: [ command ],
      data: '1|2|nd even though humans insisted in not learning about the horrors of war and did not make a point of pursuing peace, they still intended to venture away from the Earth, with colonies having been built and nanomachines already allowing for decent life conditions even during prolonged periods in space.<br /><br />In this still disgracefully conflict-ridden world, a private paramilitary organization unveils its existence, announcing its intention to bring forth the eradication of war and conflict through force of arms. This organization, called [url=http://anidb.net/ch2214]Celestial Being[/url], possesses its own mobile suits, the [i]Gundams[/i], which are much more powerful than those in the hands of any military in the world, and proceeds to using them to intervene in conflicts in order to stop them by force. Their actions quickly divide public opinion, and governments and other groups begin to act by taking their existence into consideration, but will they manage to bring peace to the world? Beyond the question of how the world will reply immediately, what is going to happen in the future as a result of their actions?<br /><br />[i]— written by Hinoe[/i]',
    }))
  const result = await a.animeDesc(5252)
  expect(a._callApi).toBeCalledWith(command, { aid: 5252, part: 0 })

  expect(a._callApi).toBeCalledWith(command, { aid: 5252, part: 1 })
  expect(result).toMatchSnapshot()
})
test('anime', async () => {
  await simpleCachedCall(
    'ANIME',
    'anime',
    230,
    [ 20, [ 'aid', 'type', 'romanji_name', 'kanji_name', 'url', 'air_date', 'is_18_restricted', 'rating', 'ann_id', 'specials_count' ]],
    [{ aid: 20, amask: '90c01481400080' }, [ 230 ]],
    '20|TV Series|Tokyo Underground|東京アンダーグラウンド|1017705600|http://pierrot.jp/title/tug/|431|0|888|0'
  )
})


test('file', async () => {
  await simpleCachedCall(
    'FILE',
    'file',
    220,
    [ 312498, [ 'other_episodes', 'state', 'video_color_depth', 'audio_codecs', 'audio_bitrates', 'mylist_state', 'mylist_filestate', 'mylist_viewed', 'mylist_viewdate', 'type', 'related_aid_list', 'related_aid_type', 'category_list', 'short_name_list', 'synonym_list' ]],
    { 'fid': 312498, 'fmask': '05023000f0', 'amask': '1e0c0000' },
    "312498||1||Vorbis (Ogg Vorbis)|104|||||TV Series|10795'3440|1'2|Contemporary Fantasy,Game,Fantasy World,Parallel Universe,Super Power,Present,Plot Continuity,Mahou Shoujo,Fantasy,Magic,Seinen,Sci-Fi,Human Enhancement,Action,Erotic Game,Cyborgs,Military,Shipboard,Other Planet,Humanoid Alien,Mecha,Calling Your Attacks,Dragon,Henshin,Shower Scene,Inline Skating,Magic Circles,Nudity,Juujin|mglnss'NanohaSS'StrikerS'nanoha3'nanoha strikers'mslnss'mslns|Magical Girl Lyrical Nanoha StrikerS'Garota Mágica Lírica Nanoha StrikerS'魔法少女奈叶SS"
  )
})

test('file_by_hash', async () => {
  await simpleCachedCall(
    'FILE',
    'file_by_hash',
    220,
    [ '4e02d45cddb3504bdcca87876053738a', 920389205, [ 'other_episodes', 'state', 'video_color_depth', 'audio_codecs', 'audio_bitrates', 'mylist_state', 'mylist_filestate', 'mylist_viewed', 'mylist_viewdate', 'type', 'related_aid_list', 'related_aid_type', 'category_list', 'short_name_list', 'synonym_list' ]],
    { 'ed2k': '4e02d45cddb3504bdcca87876053738a', 'size': 920389205, 'fmask': '05023000f0', 'amask': '1e0c0000' },
    "1831304||1||AAC|83|||||Movie|4521|52|Alternative Present,Present,Mecha,Action,Seinen,Bishounen,Sci-Fi,Adventure,Angst||Code Geass: Akito of the Ruined Nation'Code Geass: Akito the Exiled'Code Geass Gaiden'Код Ґіасс: Акіто з країни-руїни'Код Ґіасс: Вигнанець Акіто"
  )
})

test('file_by_episode', async () => {
  await simpleCachedCall(
    'FILE',
    'file_by_episode',
    220,
    [ 4521, 670, '01', [ 'other_episodes', 'state', 'video_color_depth', 'audio_codecs', 'audio_bitrates', 'mylist_state', 'mylist_filestate', 'mylist_viewed', 'mylist_viewdate', 'type', 'related_aid_list', 'related_aid_type', 'category_list', 'short_name_list', 'synonym_list' ]],
    [{ 'epno': '01', 'aid': 4521, 'gid': 670, 'fmask': '05023000f0', 'amask': '1e0c0000' }, [ 322 ]],
    "539446||1||AAC'AAC|82'81|||||TV Series|5373'8914'7508'7126'12567|1'21'51'61'61|Earth,Asia,Present,Alternative Present,New,Mecha,Plot Continuity,Military,Action,Japan,Twisted,Sci-Fi,Tokyo,Piloted Robot,Stereotypes,War,Super Power,Violence,Terrorist,Drugs,Romance,Tragedy,School Life,High School,Thriller,General Lack of Common Sense,Politics,Dark-skinned Girl,Racism,Chess,School Dormitory,Student Council,Revenge,Human Enhancement,Slapstick,Kyoto,Comedy,Shower Scene,Clubs,School Festival,Shoujo Ai,Nudity,Cyborgs,Bishounen,Maid|cg1'geass'CodeGeass'geass1'cghnl'cg r1|Code Geass ~ Lelouch de la rébellion'Code Geass: Lelouch de la Rebelión'Код Гиасс: Восстание Лелуша'Код Гиас: Восставший Лелуш'Código Geass R1'Code Geass: Lelouch da Rebelião'Código Geass: Lelouch da Rebelião'Code Geass: Lelouch de la Rebel·lió'קוד ג`יאס'Kodas Geass: Leloušio sukilimas'Code Geass: Lelouch`un Başkaldırısı'Code Geass: Cuộc khởi nghĩa của Lelouch'Код Геас: Бунтът на Люлюш'Code Geass 1'code geass'Code Geass R1'Код Ґіас: Повстання Лелуша (R1)'叛逆的鲁鲁修"
  )
})


test('mylist_by_id', async () => {
  await simpleCachedCall(
    'MYLIST',
    'mylist_by_id',
    221,
    [ 77217942 ],
    [{ 'lid': 77217942 }],
    '77217942|241783|52060|4196|0|1257862225|0|1257862225||||15'
  )
})
