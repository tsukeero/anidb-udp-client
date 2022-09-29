export default function StringWithLineBreaks (value: string | number): string {
  return (String(value) as any).replaceAll(/<br \/>/gi,'\n')
}