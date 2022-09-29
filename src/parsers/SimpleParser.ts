import MapField2 from './field_types/MapFieldStatic'
export default class SimpleParser<V extends { [x: string]: (...args: Array<any>)=>any } > {
  parseData: (data: string)=> { [Property in keyof V]: ReturnType<V[Property]> }

  constructor (response_definition: V) {
    this.parseData = MapField2(response_definition, '|')
  }

}