import { EventEmitter } from 'events'
import { UDPRequest } from '../index'

// fake dgram socket: answers every request with a tagged response, or not at all when `silent`
function fakeSocket ({ silent = false, response = '200 OK' } = {}) {
  const socket = new EventEmitter()
  socket.send = jest.fn((buffer) => {
    if (silent) return
    const tag = String(buffer).match(/tag=([^&]+)/)[1]
    setImmediate(() => socket.emit('message', Buffer.from(`${ tag } ${ response }`)))
  })
  return socket
}

function listenerCounts (socket) {
  return {
    message: socket.listenerCount('message'),
    error: socket.listenerCount('error'),
    close: socket.listenerCount('close'),
  }
}

const NO_LISTENERS = { message: 0, error: 0, close: 0 }

describe('UDPRequest', () => {
  test('removes all socket listeners after a response', async () => {
    const client = fakeSocket()
    for (let i = 0; i < 15; i++) {
      await UDPRequest({ client }, 'PING', {})
    }
    expect(listenerCounts(client)).toEqual(NO_LISTENERS)
  })

  test('removes all socket listeners after a socket error', async () => {
    const client = fakeSocket({ silent: true })
    const request = UDPRequest({ client }, 'PING', {})
    client.emit('error', new Error('boom'))
    await expect(request).rejects.toThrow('boom')
    expect(listenerCounts(client)).toEqual(NO_LISTENERS)
  })

  test('removes all socket listeners after a timeout', async () => {
    jest.useFakeTimers()
    try {
      const client = fakeSocket({ silent: true })
      const request = UDPRequest({ client }, 'PING', {})
      jest.runOnlyPendingTimers()
      await expect(request).rejects.toThrow('Timeout')
      expect(listenerCounts(client)).toEqual(NO_LISTENERS)
    } finally {
      jest.useRealTimers()
    }
  })
})
