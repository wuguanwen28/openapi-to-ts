import { OperationObject, SchemaObject } from 'openapi3-ts'
import { APIDataType, ServiceTemplate } from '.'

type ApiPrefixFn = (params: {
  /** 路径 */
  path: string
  /** 方法 */
  method: string
  /** 命名空间 */
  namespace: string
  /** 函数名称 */
  functionName: string
}) => string

export interface Configuration {
  /** 名称 */
  label?: string
  /** swagger json 路径 */
  schemaPath?: string
  /** 多个 swagger json 路径 */
  schemaPaths?: Array<Omit<Configuration, 'schemaPaths'>>
  /**
   * 生成的文件夹的路径
   * 会追加一层命名空间为名称的文件夹，如：./src/services/${namespace}"
   * @default "./src/services"
   */
  serversPath?: string
  /**
   * ts类型声明的命令空间名称
   * @default "API"
   */
  namespace?: string
  /**
   * 请求库的路径
   * 如果以import开头则替换掉整个表达式, 否则只替换掉路径
   * import request from `${requestLibPath}`
   * @default "@/utils/request"
   */
  requestLibPath?: string
  /**
   * 请求方法的 config 参数类型
   * request.post(url: string, data: any, config: RequestConfig)
   * @default '{[key: string]: any}'
   */
  requestConfigType?: string
  /**
   * 引入请求方法的config参数类型的路径
   * 如与请求库位置相同, 可以与 requestLibPath 一同设置
   */
  requestConfigTypeLibPath?: string
  /**
   * service函数模板, 传入templatesFolder可自定义模板
   * serviceController1: request(url, {method, data, params, ...config})
   * serviceController2: request.post(url, {data, params, ...config})
   * serviceController3: request.post(url, data/params, config)
   * @default "serviceController1"
   */
  serviceTemplate?: ServiceTemplate

  /** 模板文件夹路径 */
  templatesFolder?: string

  /**
   * 使用null代替可选
   * @default false
   */
  nullable?: boolean
  /**
   * 枚举类型的样式
   * type Direction = "UP" | "DOWN"
   * enum Direction { Up = "UP", Down = "DOWN" }
   * @default "string-literal"
   */
  enumStyle?: 'string-literal' | 'enum'
  /**
   * api的统一前缀
   * 变量模式   `baseUrl` => `${baseUrl}/xxxx`
   * 字符串模式 `"/baseUrl"` => `/baseUrl/xxxx`
   */
  apiPrefix?: string | ApiPrefixFn

  /**
   * response中数据字段
   * @example ['result', 'res']
   */
  dataFields?: string[]

  /**
   * 对同名的方法或类型处理方式
   * - all：覆盖全部
   * - skip-same：跳过相同名称的
   * - over-same：覆盖相同名称的
   * @default 'skip-same'
   */
  overrideMode?: 'all' | 'skip-same' | 'over-same'

  /**
   * 是否分割类型文件
   * @default true
   */
  splitDeclare?: boolean

  /**
   * 小驼峰命名文件和请求函数
   * @default true
   */
  isCamelCase?: boolean

  /** 只生成includes中的方法 */
  includes?: Array<{ path: string; method: string }>

  /** interface 类型声明方式 */
  declareType?: 'type' | 'interface'

  /**
   * index文件的导出类型
   * - merge：合并导出
   * - alone：单独导出
   * - all：全部导出
   * @default 'merge'
   */
  exportType?: 'merge' | 'alone' | 'all'

  /** 自定义hooks */
  hooks?: {
    /** 自定义类名 */
    customClassName?: (tagName: string) => string
    /** 自定义类型名称 */
    customTypeName?: (data: APIDataType) => string
    /** 自定义生成文件名 */
    customFileNames?: (data: APIDataType) => string[]
    /** 自定义方法名 */
    customFunctionName?: (data: APIDataType) => string
    /** 自定义获取type */
    customType?: (
      schemaObject: SchemaObject | undefined,
      namespace: string,
      originGetType: (schemaObject: SchemaObject | undefined, namespace: string) => string,
    ) => string
    /** 自定义 options 默认值 */
    customOptionsDefaultValue?: (data: OperationObject) => Record<string, any> | undefined
  }
}
