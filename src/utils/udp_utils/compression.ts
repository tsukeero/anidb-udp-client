import zlib from 'node:zlib'
// import * as streamConsumers from 'node:stream/consumers'
// import { PassThrough } from 'node:stream'

// TODO: figure out why EOF, and way to fix it
export const decompress = (buffer: Buffer): Promise<Buffer> => new Promise((resolve, reject) => {
  const buffer_builder: Buffer[] = []
  const decompress_stream = zlib.createUnzip()
    .on('data', (chunk: Buffer) => {
      buffer_builder.push(chunk)
    }).on('close', () => {
      resolve(Buffer.concat(buffer_builder))
    }).on('error', (err: any) => {
      if (err.errno !== -5) // EOF: expected
        reject(err)
    })

  decompress_stream.write(buffer.subarray(2))
  decompress_stream.end()
})

// export const decompress = async (buffer: Buffer): Promise<Buffer> => {
//   const decompress_stream = zlib.createUnzip()
// //   const stream = new PassThrough()
// //   decompress_stream.on('error', function (err: any) {
// //     if (err.code === 'Z_BUF_ERROR') {
// //       stream.end()
// //       return
// //     }
// //     stream.emit('error', err)
// //   })
// //   decompress_stream.pipe(stream)

//   decompress_stream.write(buffer.subarray(2))
//   decompress_stream.end()
// //   decompress_stream.flush()
//   const data = await streamConsumers.buffer(decompress_stream)
//   return data
// }
export default decompress