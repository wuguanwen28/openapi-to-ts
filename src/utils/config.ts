import { ParameterObject, SchemaObject } from 'openapi3-ts'
import { Configuration } from '../types'

export const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const

export const configStr = `/** @type {import('openapi-to-ts').Configuration} */
export default {
  openapi: 123,
};`

export const defaultConfig: Required<Configuration> = {
  label: '',
  schemaPath: '',
  schemaPaths: [],
  serversPath: './src/services',
  namespace: 'API',
  requestLibPath: '@/utils/request',
  requestConfigType: '{[key: string]: any}',
  requestConfigTypeLibPath: '',
  serviceTemplate: 'template1',
  templatesFolder: 'templates',
  nullable: false,
  enumStyle: 'string-literal',
  apiPrefix: '',
  dataFields: ['result', 'res'],
  overrideMode: 'skip-same',
  splitDeclare: true,
  isCamelCase: true,
  includes: [],
  declareType: 'interface',
  hooks: {},
}

export const DEFAULT_SCHEMA: SchemaObject = {
  type: 'object',
  properties: { id: { type: 'number' } },
}

export const DEFAULT_PATH_PARAM: ParameterObject = {
  in: 'path',
  name: null,
  schema: {
    type: 'string',
  },
  required: true,
  // @ts-ignore
  isObject: false,
  type: 'string',
}

export const numberEnum = [
  'int64',
  'integer',
  'long',
  'float',
  'double',
  'number',
  'int',
  'float',
  'double',
  'int32',
  'int64',
]

export const dateEnum = ['Date', 'date', 'dateTime', 'date-time', 'datetime']

export const stringEnum = ['string', 'email', 'password', 'url', 'byte', 'binary']
