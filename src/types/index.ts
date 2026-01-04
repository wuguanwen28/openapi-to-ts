import { OperationObject } from 'openapi3-ts'
import { METHODS } from '../utils'

export * from './Configuration'

export type ServiceTemplate =
  | 'serviceController1'
  | 'serviceController2'
  | 'serviceController3'

export type TypescriptFileType =
  | 'interface'
  | 'serviceIndex'
  | ServiceTemplate
  | (string & {})

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
