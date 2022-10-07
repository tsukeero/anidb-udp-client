export default function makeid (nr: number) {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < nr; i++) text += possible.charAt(Math.floor(Math.random() * possible.length))

  return text
}