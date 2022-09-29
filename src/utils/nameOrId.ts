export default function nameOrId (param: any, id_field: string, name_field: string, other_fields?: Record<string, any>) {
  const request: Record<string, any> = { ...other_fields || {},
  }

  if (typeof param === 'string') {
    request[name_field] = param
  } else {
    request[id_field] = param
  }

  return request
}