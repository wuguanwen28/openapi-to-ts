import { OperationObject } from 'openapi3-ts'
import { METHODS } from '../utils'

export * from './Configuration'

export type TypescriptFileType =
  | 'interface'
  | 'serviceIndex'
  | 'serviceController'
  | 'serviceController3'

export interface APIDataType extends OperationObject {
  path: string
  method: string
}

export interface MappingItemType {
  antTechApi: string
  popAction: string
  popProduct: string
  antTechVersion: string
}

export type Methods = (typeof METHODS)[number]

export interface ControllerType {
  fileName: string
  controllerName: string
}
