import type {
  ContentObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject,
} from 'openapi3-ts'
import type {
  APIDataType,
  Configuration,
  ControllerType,
  MappingItemType,
  Methods,
  TypescriptFileType,
} from '../types'

import {
  camelCase,
  dateEnum,
  DEFAULT_PATH_PARAM,
  DEFAULT_SCHEMA,
  defaultConfig,
  genDefaultFunctionName,
  getBasePrefix,
  getFinalFileName,
  getImportStatement,
  getProjectRoot,
  getRefName,
  getTagName,
  isArray,
  isBoolean,
  isFunction,
  isObject,
  isString,
  isValid,
  logger,
  mergeContent,
  METHODS,
  numberEnum,
  resolveFunctionName,
  resolveTypeName,
  stringEnum,
  stripDot,
  writeFile,
} from '../utils'
import nunjucks from 'nunjucks'
import * as path from 'path'
import * as fs from 'fs'

export class ServiceGenerator {
  version: string
  finalPath: string
  config: Configuration
  openAPIData: OpenAPIObject

  includesMap: Record<string, true>
  apiData: Record<string, APIDataType[]> = {}
  protected classNameList: ControllerType[] = []

  protected mappings: MappingItemType[] = []

  private currentTag: string
  private interfaceMap: Map<string, Set<string>> = new Map()
  private allInterfaceMap: Map<string, Set<string>> = new Map() // 所有接口，排除循环引用

  constructor(config: Configuration, openAPIData: OpenAPIObject) {
    this.config = Object.assign({}, defaultConfig, config)
    this.openAPIData = openAPIData
    this.version = openAPIData.info.version
    this.init()
  }

  async init() {
    const paths = this.openAPIData.paths || {}
    const {
      hooks = {},
      isCamelCase,
      includes,
      serversPath,
      namespace,
    } = this.config
    const { customFileNames } = hooks

    this.finalPath = path.join(serversPath, namespace.toLowerCase())

    this.includesMap = includes.reduce((obj, item) => {
      const { method, path } = item || {}
      if (path && method) {
        obj[`${item.method}-${item.path}`] = true
      } else if (path) {
        obj[item.path] = true
      }
      return obj
    }, {})

    Object.keys(paths).forEach((p) => {
      const pathItem = paths[p]
      METHODS.forEach((method) => {
        const operationObject: OperationObject = pathItem[method]
        if (!operationObject) return
        const data = {
          path: p,
          method,
          ...operationObject,
        }

        let tags = customFileNames?.(data)
        if (!tags?.length) tags = getTagName(data)

        tags.forEach((tagString) => {
          let tag = resolveTypeName(tagString)
          if (isCamelCase) tag = camelCase(tag)
          this.apiData[tag] ||= []
          this.apiData[tag].push(data)
        })
      })
    })
  }

  async genFile() {
    await this.genServiceFile()
    await this.genDeclareFile()
    await this.genExportFile()
  }

  /** 生成请求方法 */
  async genServiceFile() {
    const serviceTp = this.getServiceTP()
    const {
      namespace,
      serviceTemplate,
      requestLibPath,
      requestConfigType,
      requestConfigTypeLibPath,
    } = this.config
    for (const tp of serviceTp) {
      const fileName = getFinalFileName(`${tp.className}.ts`)
      const requestImportStatement = getImportStatement(requestLibPath)
      await this.genFileFromTemplate(fileName, serviceTemplate, {
        namespace,
        requestConfigType,
        requestImportStatement,
        requestConfigTypeLibPath,
        ...tp,
      })
    }
  }

  /** 生成声明文件 */
  async genDeclareFile() {
    const { namespace, nullable, declareType } = this.config
    const tagTypes = this.getInterfaceTP()

    if (this.config.splitDeclare) {
      const typesDir = path.join(this.finalPath, 'types')
      if (!fs.existsSync(typesDir)) {
        fs.mkdirSync(typesDir, { recursive: true })
      }

      Object.keys(tagTypes).forEach((tag) => {
        if (!tagTypes[tag]?.length) return
        const fileName = `${stripDot(tag)}.d.ts`
        // 排序
        tagTypes[tag].sort((a, b) => a.typeName.localeCompare(b.typeName))
        this.genFileFromTemplate(`types/${fileName}`, 'interface', {
          namespace: namespace,
          nullable: nullable,
          list: tagTypes[tag],
          disableTypeCheck: false,
          declareType: declareType || 'type',
        })
      })
    } else {
      let interfaceTP = []
      Object.keys(tagTypes).forEach((tag) => {
        interfaceTP.push(...tagTypes[tag])
      })
      interfaceTP.sort((a, b) => a.typeName.localeCompare(b.typeName))
      this.genFileFromTemplate(`typings.d.ts`, 'interface', {
        namespace: namespace,
        nullable: nullable,
        list: interfaceTP,
        disableTypeCheck: false,
        declareType: declareType || 'type',
      })
    }
  }

  async genDeclareFilesByTag() {
    const { components } = this.openAPIData
    const allSchemas = components.schemas
    if (!allSchemas) return
    const tagTypes: Record<string, any[]> = {}
    Object.keys(this.apiData).forEach((tag) => {
      tagTypes[tag] = []
    })

    // 将schema按使用情况分配到对应的tag
    Object.keys(allSchemas).forEach((typeName) => {
      const schema = allSchemas[typeName]
      const result = this.resolveObject(schema)
      const usedInTags = this.findTagsUsingType(typeName)
      if (usedInTags.length > 0) {
        // 将类型添加到使用它的所有tag中
        usedInTags.forEach((tag) => {
          if (tagTypes[tag]) {
            tagTypes[tag].push({
              typeName: resolveTypeName(typeName),
              type: this.getDefinesType(result),
              parent: result.parent,
              props: result.props || [],
              isEnum: result.isEnum,
            })
          }
        })
      } else {
        // 如果没有找到使用的地方，添加到第一个tag中（作为通用类型）
        const firstTag = Object.keys(tagTypes)[0]
        if (firstTag) {
          tagTypes[firstTag].push({
            typeName: resolveTypeName(typeName),
            type: this.getDefinesType(result),
            parent: result.parent,
            props: result.props || [],
            isEnum: result.isEnum,
          })
        }
      }
    })

    // 为每个tag生成对应的类型文件到types目录
    Object.keys(tagTypes).forEach((tag) => {
      if (tagTypes[tag].length > 0) {
        const fileName = `${stripDot(tag)}.d.ts`

        // 添加该tag下API的参数类型
        const tagApiData = this.apiData[tag]
        if (tagApiData) {
          tagApiData.forEach((api) => {
            const props = []
            if (api.parameters) {
              api.parameters.forEach((parameter: any) => {
                props.push({
                  desc: parameter.description ?? '',
                  name: parameter.name,
                  required: parameter.required,
                  type: this.getType(parameter.schema),
                })
              })
            }

            if (props.length > 0) {
              tagTypes[tag].push({
                typeName: this.getTypeName({
                  ...api,
                  method: api.method,
                  path: api.path,
                }),
                type: 'Record<string, any>',
                parent: undefined,
                props: [props],
                isEnum: false,
              })
            }
          })
        }
        // 排序
        tagTypes[tag].sort((a, b) => a.typeName.localeCompare(b.typeName))
        this.genFileFromTemplate(`types/${fileName}`, 'interface', {
          namespace: this.config.namespace,
          nullable: this.config.nullable,
          list: tagTypes[tag],
          disableTypeCheck: false,
          declareType: this.config.declareType || 'type',
        })
      }
    })
  }

  private findTagsUsingType(typeName: string): string[] {
    const usedInTags: string[] = []
    Object.keys(this.apiData).forEach((tag) => {
      const tagApis = this.apiData[tag]
      const isUsed = tagApis.some((api) => {
        if (api.parameters) {
          return api.parameters.some((param: any) => {
            const resolvedParam = this.resolveRefObject(param)
            return (
              resolvedParam.schema?.$ref?.includes(typeName) ||
              resolvedParam.$ref?.includes(typeName)
            )
          })
        }
        if (api.requestBody) {
          const resolvedBody = this.resolveRefObject(api.requestBody)
          if (resolvedBody.content) {
            const mediaType = Object.keys(resolvedBody.content)[0]
            const schema = resolvedBody.content[mediaType]?.schema
            if (schema?.$ref?.includes(typeName)) {
              return true
            }
          }
        }
        if (api.responses) {
          const response = this.resolveRefObject(
            api.responses['200'] || api.responses.default,
          )
          if (response?.content) {
            const mediaType = Object.keys(response.content)[0]
            const schema = response.content[mediaType]?.schema
            if (schema?.$ref?.includes(typeName)) {
              return true
            }
          }
        }

        return false
      })

      if (isUsed) usedInTags.push(tag)
    })

    return usedInTags
  }
  private getDefinesType(result: any) {
    if (result.type) {
      return (result as any).type === 'object' || result.type
    }
    return 'Record<string, any>'
  }

  /** 生成导出文件 */
  async genExportFile() {
    // 生成 index 文件
    await this.genFileFromTemplate(`index.ts`, 'serviceIndex', {
      list: this.classNameList,
      disableTypeCheck: false,
      exportType: this.config.exportType,
    })
  }

  getServiceTP() {
    const { apiPrefix, hooks, isCamelCase } = this.config
    return Object.keys(this.apiData)
      .map((tag, index) => {
        this.currentTag = tag
        this.interfaceMap.set(tag, new Set())
        const tmpFunctionRD: Record<string, number> = {}
        const genParams = this.apiData[tag]
          .filter((api) => {
            if (!this.isInclude(api)) return false
            return !api.path.includes('${')
          })
          .map((api) => {
            const newApi = api
            try {
              // 获取params参数类型
              const allParams = this.getParamsTP(newApi.parameters, newApi.path)
              // 获取body参数类型
              const body = this.getBodyTP(newApi.requestBody)
              // 获取结果类型
              const response = this.getResponseTP(newApi.responses)

              const params = allParams || {}
              const file = this.getFileTP(newApi.requestBody)

              let formData = false
              if ((body && (body.mediaType || '').includes('form')) || file) {
                formData = true
              }

              let functionName = this.getFuncationName(newApi)

              if (functionName && tmpFunctionRD[functionName]) {
                functionName = `${functionName}_${(tmpFunctionRD[functionName] += 1)}`
              } else if (functionName) {
                tmpFunctionRD[functionName] = 1
              }

              let formattedPath = newApi.path.replace(
                /:([^/]*)|{([^}]*)}/gi,
                (_, str, str2) => `$\{${str || str2}}`,
              )

              if (
                newApi.extensions &&
                newApi.extensions['x-antTech-description']
              ) {
                const { extensions } = newApi
                const { apiName, antTechVersion, productCode, antTechApiName } =
                  extensions['x-antTech-description']
                formattedPath = antTechApiName || formattedPath
                this.mappings.push({
                  antTechApi: formattedPath,
                  popAction: apiName,
                  popProduct: productCode,
                  antTechVersion,
                })
                newApi.antTechVersion = antTechVersion
              }

              // 为 path 中的 params 添加 alias
              const escapedPathParams = ((params || {}).path || []).map(
                (ele, index) => ({
                  ...ele,
                  alias: `param${index}`,
                }),
              )
              if (escapedPathParams.length) {
                escapedPathParams.forEach((param) => {
                  formattedPath = formattedPath.replace(
                    `$\{${param.name}}`,
                    `$\{${param.alias}}`,
                  )
                })
              }

              const finalParams: any = escapedPathParams?.length
                ? { ...params, path: escapedPathParams }
                : params

              // 处理 query 中的复杂对象
              if (finalParams && finalParams.query) {
                finalParams.query = finalParams.query.map((ele: any) => ({
                  ...ele,
                  isComplexType: ele.isObject,
                }))
              }

              const getPrefixPath = () => {
                if (!apiPrefix) return formattedPath
                // 静态 apiPrefix
                const prefix = isFunction(apiPrefix)
                  ? `${apiPrefix({
                      path: formattedPath,
                      method: newApi.method,
                      namespace: tag,
                      functionName,
                    })}`.trim()
                  : apiPrefix.trim()

                if (!prefix) return formattedPath

                if (
                  prefix.startsWith("'") ||
                  prefix.startsWith('"') ||
                  prefix.startsWith('`')
                ) {
                  const finalPrefix = prefix.slice(1, prefix.length - 1)
                  if (
                    formattedPath.startsWith(finalPrefix) ||
                    formattedPath.startsWith(`/${finalPrefix}`)
                  ) {
                    return formattedPath
                  }
                  return `${finalPrefix}${formattedPath}`
                }
                // prefix 变量
                return `$\{${prefix}}${formattedPath}`
              }

              if (isCamelCase) functionName = camelCase(functionName)

              const defaultDescription = (
                newApi?.responses?.default as ResponseObject
              )?.description

              return {
                ...newApi,
                functionName,
                typeName: this.getTypeName(newApi),
                path: getPrefixPath(),
                pathInComment: formattedPath.replace(/\*/g, '&#42;'),
                hasPathVariables: formattedPath.includes('{'),
                hasApiPrefix: !!apiPrefix,
                method: newApi.method,
                // 如果 functionName 和 summary 相同，则不显示 summary
                desc:
                  functionName === newApi.summary
                    ? newApi.description
                    : newApi.summary == newApi.description
                      ? newApi.description
                      : [
                          newApi.summary,
                          newApi.description,
                          defaultDescription
                            ? `返回值: ${defaultDescription}`
                            : '',
                        ]
                          .filter((s) => s)
                          .join(' '),
                hasHeader:
                  !!(params && params.header) || !!(body && body.mediaType),
                params: finalParams,
                hasParams: Boolean(
                  Object.keys(finalParams || {}).filter(
                    (key) => key != 'header',
                  ).length,
                ),
                options: hooks?.customOptionsDefaultValue?.(newApi) || {},
                body,
                file,
                hasFormData: formData,
                response,
              }
            } catch (error) {
              logger.error('生成 service 错误：', error)
              throw error
            }
          })
          // 排序下，要不每次git都乱了
          .sort((a, b) => a.path.localeCompare(b.path))

        if (!genParams?.length) return null

        const fileName = stripDot(tag) || `api${index}`

        let className = fileName
        if (hooks.customClassName) {
          className = hooks.customClassName(tag)
        }
        if (genParams.length) {
          this.classNameList.push({
            fileName: className,
            controllerName: className,
          })
        }
        return {
          genType: 'ts',
          className,
          instanceName: `${fileName[0]?.toLowerCase()}${fileName.slice(1)}`,
          list: genParams,
        }
      })
      .filter((ele) => !!ele?.list?.length)
  }

  getInterfaceTP() {
    const { components = {} } = this.openAPIData
    const schemas = components.schemas || {}

    const tagTypes: Record<string, any[]> = {}
    Object.keys(this.apiData).forEach((tag) => {
      tagTypes[tag] = []
    })

    const getInterfaceData = (interfaceSet: Set<string>, tag) => {
      if (!interfaceSet.size) return
      let interfaceList = [...interfaceSet]
      interfaceSet.clear()

      interfaceList.forEach((typeName) => {
        if (!schemas[typeName]) return
        // 获取属性与类型
        const result = this.resolveObject(schemas[typeName])

        tagTypes[tag].push({
          typeName: resolveTypeName(typeName),
          type: this.getDefinesType(result),
          parent: result.parent,
          props: result.props || [],
          isEnum: result.isEnum,
        })
      })

      // 解析对象时，又会有新增的interfaceSet
      getInterfaceData(this.interfaceMap.get(tag), tag)
    }

    // 获取 components 里面定义的类型（只会获取到用到的）
    this.interfaceMap.forEach((interfaceSet, tag) => {
      this.currentTag = tag
      getInterfaceData(interfaceSet, tag)
    })

    // 获取 paths 里面的 params 参数，然后生成对应的 xxxParams 类型
    Object.keys(this.apiData).forEach((tag) => {
      const tagApiData = this.apiData[tag]
      tagApiData.forEach((api) => {
        if (!this.isInclude(api)) return
        const props = []
        api.parameters
          ?.filter((item) => (item as ParameterObject)?.in !== 'header')
          ?.forEach((parameter: ParameterObject) => {
            props.push({
              desc: parameter.description ?? parameter.format ?? '',
              name: parameter.name,
              required: parameter.required,
              type: this.getType(parameter.schema),
            })
          })

        if (props.length > 0) {
          tagTypes[tag].push({
            typeName: this.getTypeName(api),
            type: 'Record<string, any>',
            parent: undefined,
            props: [props],
            isEnum: false,
          })
        }
      })
    })

    return tagTypes
  }

  getParamsTP(
    parameters: (ParameterObject | ReferenceObject)[] = [],
    path: string = null,
  ): Record<string, ParameterObject[]> {
    const { namespace } = this.config
    const templateParams: Record<string, ParameterObject[]> = {}

    if (parameters && parameters.length) {
      ;['query', 'path', 'cookie', 'header'].forEach((source) => {
        const params = parameters
          .map((p) => this.resolveRefObject(p))
          .filter((p: ParameterObject) => p.in === source)
          .map((p) => {
            const isDirectObject =
              ((p.schema || {}).type || p.type) === 'object'
            const refList = ((p.schema || {}).$ref || p.$ref || '').split('/')
            const ref = refList[refList.length - 1]
            const deRefObj = (Object.entries(
              this.openAPIData.components?.schemas || {},
            ).find(([k]) => k === ref) || []) as any
            const isRefObject = (deRefObj[1] || {}).type === 'object'
            return {
              ...p,
              isObject: isDirectObject || isRefObject,
              type: this.getType(p.schema || DEFAULT_SCHEMA, namespace),
            }
          })

        if (params.length) templateParams[source] = params
      })
    }

    if (path && path.length > 0) {
      const regex = /\{(\w+)\}/g
      templateParams.path = templateParams.path || []
      let match: any = null
      while ((match = regex.exec(path))) {
        if (!templateParams.path.some((p) => p.name === match[1])) {
          templateParams.path.push({
            ...DEFAULT_PATH_PARAM,
            name: match[1],
          })
        }
      }

      // 如果 path 没有内容，则将删除 path 参数，避免影响后续的 hasParams 判断
      if (!templateParams.path.length) delete templateParams.path
    }

    return templateParams
  }

  getBodyTP(requestBody: any = {}) {
    const reqBody: RequestBodyObject = this.resolveRefObject(requestBody)
    if (!reqBody) return null
    const reqContent: ContentObject = reqBody.content
    if (!isObject(reqContent) || Object.keys(reqContent).length === 0) {
      return null
    }
    let mediaType = Object.keys(reqContent)[0]

    const schema = (reqContent[mediaType].schema ||
      DEFAULT_SCHEMA) as SchemaObject

    if (mediaType === '*/*') mediaType = ''

    // 如果 requestBody 有 required 属性，则正常展示；如果没有，默认非必填
    const required = isBoolean(requestBody.required)
      ? requestBody.required
      : false

    if (schema.type === 'object' && schema.properties) {
      const propertiesList = Object.keys(schema.properties)
        .map((p) => {
          if (
            schema.properties &&
            schema.properties[p] &&
            !['binary', 'base64'].includes(
              (schema.properties[p] as SchemaObject).format || '',
            ) &&
            !(
              ['string[]', 'array'].includes(
                //@ts-ignore
                (schema.properties[p] as SchemaObject).type || '',
              ) &&
              ['binary', 'base64'].includes(
                ((schema.properties[p] as SchemaObject).items as SchemaObject)
                  .format || '',
              )
            )
          ) {
            return {
              key: p,
              schema: {
                ...schema.properties[p],
                type: this.getType(
                  schema.properties[p] as any,
                  this.config.namespace,
                ),
                required: schema.required?.includes(p) ?? false,
              },
            }
          }
          return undefined
        })
        .filter((p) => p)
      return {
        mediaType,
        ...schema,
        required,
        propertiesList,
      }
    }
    return {
      mediaType,
      required,
      type: this.getType(schema, this.config.namespace),
    }
  }

  getResponseTP(responses: ResponsesObject = {}) {
    const { dataFields, namespace } = this.config
    const { components } = this.openAPIData
    const response: ResponseObject | undefined = this.resolveRefObject(
      responses.default || responses['200'] || responses['201'],
    )

    const defaultResponse = {
      mediaType: '*/*',
      type: 'any',
    }
    if (!response) return defaultResponse
    const resContent: ContentObject | undefined = response.content
    const resContentMediaTypes = Object.keys(resContent || {})
    const mediaType = resContentMediaTypes.includes('application/json')
      ? 'application/json'
      : resContentMediaTypes[0] // 优先使用 application/json

    if (!isObject(resContent) || !mediaType) {
      return defaultResponse
    }
    let schema = (resContent[mediaType].schema ||
      DEFAULT_SCHEMA) as SchemaObject

    if (schema.$ref) {
      const refPaths = schema.$ref.split('/')
      const refName = refPaths[refPaths.length - 1]
      const childrenSchema = components?.schemas?.[refName] as SchemaObject
      if (
        childrenSchema?.type === 'object' &&
        'properties' in childrenSchema &&
        dataFields
      ) {
        schema =
          dataFields
            .map((field) => childrenSchema?.properties?.[field])
            .filter(Boolean)?.[0] ||
          resContent[mediaType].schema ||
          (DEFAULT_SCHEMA as any)
      }
    }

    if ('properties' in schema) {
      Object.keys(schema.properties || {}).map((fieldName) => {
        // @ts-ignore
        schema.properties[fieldName]['required'] =
          schema.required?.includes(fieldName) ?? false
      })
    }
    return {
      mediaType,
      type: this.getType(schema, namespace),
    }
  }

  getFileTP(requestBody: any = {}) {
    const reqBody: RequestBodyObject = this.resolveRefObject(requestBody)
    if (reqBody && reqBody.content && reqBody.content['multipart/form-data']) {
      const ret = this.resolveFileTP(
        reqBody.content['multipart/form-data'].schema,
      )
      return ret.length > 0 ? ret : null
    }
    return null
  }

  resolveFileTP(obj: any): any[] {
    let ret = []
    const resolved = this.resolveObject(obj)
    const props =
      (resolved.props &&
        resolved.props.length > 0 &&
        resolved.props[0].filter(
          (p: any) =>
            p.format === 'binary' ||
            p.format === 'base64' ||
            ((p.type === 'string[]' || p.type === 'array') &&
              (p.items.format === 'binary' || p.items.format === 'base64')),
        )) ||
      []

    if (props.length > 0) {
      ret = props.map((p: any) => {
        return {
          title: p.name,
          multiple: p.type === 'string[]' || p.type === 'array',
        }
      })
    }
    if (resolved.type) ret = [...ret, ...this.resolveFileTP(resolved.type)]
    return ret
  }

  private async genFileFromTemplate(
    fileName: string,
    type: TypescriptFileType,
    params: Record<string, any>,
  ): Promise<boolean> {
    const { overrideMode } = this.config
    const filePath = path.join(this.finalPath, fileName)
    const template = this.getTemplate(type)
    nunjucks.configure({ autoescape: false })
    const newContent = nunjucks.renderString(template, params)
    const content = await mergeContent({
      newContent,
      filePath,
      type,
      overrideMode,
    })
    if (!content) return
    await writeFile(filePath, content)
  }

  private getTemplate(type: TypescriptFileType): string {
    const { templatesFolder } = this.config

    let filePath = ''
    if (templatesFolder) {
      filePath = path.resolve(templatesFolder, `${type}.njk`)
    } else {
      const rootPath = getProjectRoot()
      filePath = path.join(rootPath, `./templates/${type}.njk`)
    }
    return fs.readFileSync(filePath, 'utf8')
  }

  // 获取 TS 类型的属性列表
  private getProps(schemaObject: SchemaObject) {
    const requiredPropKeys = schemaObject?.required ?? false
    return schemaObject.properties
      ? Object.keys(schemaObject.properties).map((propName) => {
          const schema: SchemaObject =
            (schemaObject.properties && schemaObject.properties[propName]) ||
            DEFAULT_SCHEMA
          propName = propName.replace(/[\[|\]]/g, '')
          return {
            ...schema,
            name: propName,
            type: this.getType(schema),
            desc: [schema.title, schema.description, schema.format]
              .filter((s) => s)
              .join(' '),
            // 如果没有 required 信息，默认全部是非必填
            required: requiredPropKeys
              ? requiredPropKeys.some((key) => key === propName)
              : false,
          }
        })
      : []
  }

  // 获取类型
  private getType(schemaObject: SchemaObject | undefined, namespace?: string) {
    const hookFunc = this.config.hooks?.customType
    if (hookFunc) {
      const type = hookFunc(schemaObject, namespace, this.defaultGetType)
      if (isString(type)) return type
    }
    return this.defaultGetType(schemaObject, namespace)
  }

  // 获取类型（默认方式）
  private defaultGetType(
    schemaObject: SchemaObject | undefined,
    namespace: string = '',
  ): string {
    if (!isValid(schemaObject)) return 'any'

    if (!isObject(schemaObject)) return schemaObject

    if (schemaObject.$ref) {
      let refPath = schemaObject.$ref.split('/').pop()
      const tag = this.currentTag
      const allInterfaceSet = this.allInterfaceMap.get(tag) || new Set()
      if (!allInterfaceSet.has(refPath)) {
        allInterfaceSet.add(refPath)
        this.allInterfaceMap.set(tag, allInterfaceSet)

        const interfaceSet = this.interfaceMap.get(tag) || new Set()
        interfaceSet.add(refPath)
        this.interfaceMap.set(tag, interfaceSet)
      }
      let refName = getRefName(schemaObject)
      return [namespace, refName].filter((s) => s).join('.')
    }

    let { type } = schemaObject as any

    if (numberEnum.includes(schemaObject.format!)) type = 'number'

    if (schemaObject.enum) type = 'enum'

    if (numberEnum.includes(type)) return 'number'

    if (dateEnum.includes(type)) return 'Date'

    if (stringEnum.includes(type)) return 'string'

    if (type === 'boolean') return 'boolean'

    if (type === 'array') {
      let { items } = schemaObject
      if ((schemaObject as any).schema) {
        items = (schemaObject as any).schema.items
      }

      if (Array.isArray(items)) {
        const arrayItemType = (items as any)
          .map((subType: any) =>
            this.defaultGetType(subType.schema || subType, namespace),
          )
          .toString()
        return `[${arrayItemType}]`
      }
      const arrayType = this.defaultGetType(items as SchemaObject, namespace)
      return arrayType.includes(' | ') ? `(${arrayType})[]` : `${arrayType}[]`
    }

    if (type === 'enum') {
      return Array.isArray(schemaObject.enum)
        ? Array.from(
            new Set(
              schemaObject.enum.map((v) =>
                isString(v)
                  ? `"${v.replace(/"/g, '"')}"`
                  : this.defaultGetType(v),
              ),
            ),
          ).join(' | ')
        : 'string'
    }

    if (schemaObject.oneOf && schemaObject.oneOf.length) {
      return schemaObject.oneOf
        .map((item) => this.defaultGetType(item as any, namespace))
        .join(' | ')
    }

    if (schemaObject.anyOf && schemaObject.anyOf.length) {
      return schemaObject.anyOf
        .map((item) => this.defaultGetType(item as any, namespace))
        .join(' | ')
    }

    if (schemaObject.allOf && schemaObject.allOf.length) {
      return `(${schemaObject.allOf
        .map((item) => this.defaultGetType(item as any, namespace))
        .join(' & ')})`
    }

    let properties = schemaObject?.properties
    let schemaRequired = schemaObject?.required
    if (schemaObject?.type === 'object' || properties) {
      if (!Object.keys(properties || {}).length) {
        return 'Record<string, any>'
      }
      return `{ ${Object.keys(properties)
        .map((key) => {
          let required = false

          if (isBoolean(schemaRequired) && schemaRequired) required = true

          if (isArray(schemaRequired) && schemaRequired.includes(key)) {
            required = true
          }

          if (
            'required' in (properties[key] || {}) &&
            ((properties[key] || {}) as any).required
          ) {
            required = true
          }
          /**
           * 将类型属性变为字符串，兼容错误格式如：
           * 3d_tile(数字开头)等错误命名，
           * 在后面进行格式化的时候会将正确的字符串转换为正常形式，
           * 错误的继续保留字符串。
           * */
          const type = this.defaultGetType(properties[key] as any, namespace)
          return `'${key}'${required ? '' : '?'}: ${type}; `
        })
        .join('')}}`
    }
    return 'any'
  }

  // 解析对象类型数据
  private resolveObject(schemaObject: SchemaObject) {
    // 引用类型
    if (schemaObject.$ref) {
      return this.resolveRefObject(schemaObject)
    }
    // 枚举类型
    if (schemaObject.enum) {
      return this.resolveEnumObject(schemaObject)
    }
    // 继承类型
    if (schemaObject.allOf && schemaObject.allOf.length) {
      return this.resolveAllOfObject(schemaObject)
    }
    // 对象类型
    if (schemaObject.properties || schemaObject.type === 'object') {
      return this.resolveProperties(schemaObject)
    }
    // 数组类型
    if (schemaObject.items && schemaObject.type === 'array') {
      return this.resolveArray(schemaObject)
    }
    return schemaObject
  }

  private resolveRefObject(refObject: any): any {
    if (!refObject || !refObject.$ref) {
      return refObject
    }
    const refPaths = refObject.$ref.split('/')
    if (refPaths[0] === '#') {
      refPaths.shift()
      let obj: any = this.openAPIData
      refPaths.forEach((node: any) => {
        obj = obj[node]
      })
      if (!obj) {
        throw new Error(`[GenSDK] Data Error! Notfoud: ${refObject.$ref}`)
      }
      return {
        ...this.resolveRefObject(obj),
        type: obj.$ref ? this.resolveRefObject(obj).type : obj,
      }
    }
    return refObject
  }

  private resolveEnumObject(schemaObject: SchemaObject) {
    const enumArray = schemaObject.enum || []

    let enumStr
    switch (this.config.enumStyle) {
      case 'enum':
        enumStr = `{${enumArray.map((v: string) => `${v}="${v}"`).join(',')}}`
        break
      case 'string-literal':
        enumStr = Array.from(
          new Set(
            enumArray.map((v: string) =>
              isString(v) ? `"${v.replace(/"/g, '"')}"` : this.getType(v),
            ),
          ),
        ).join(' | ')
        break
      default:
        break
    }

    return {
      isEnum: this.config.enumStyle == 'enum',
      type: Array.isArray(enumArray) ? enumStr : 'string',
    }
  }

  private resolveAllOfObject(schemaObject: SchemaObject) {
    const props = (schemaObject.allOf || []).map((item) =>
      item.$ref
        ? [{ ...item, type: this.getType(item).split('/').pop() }]
        : this.getProps(item),
    )

    if (schemaObject.properties) {
      const extProps = this.getProps(schemaObject)
      return { props: [...props, extProps] }
    }

    return { props }
  }

  private resolveProperties(schemaObject: SchemaObject) {
    return {
      props: [this.getProps(schemaObject)],
    }
  }

  private resolveArray(schemaObject: SchemaObject) {
    if (schemaObject?.items?.$ref) {
      const refObj = schemaObject.items.$ref.split('/')
      return {
        type: `${refObj[refObj.length - 1]}[]`,
      }
    }
    // TODO: 这里需要解析出具体属性，但由于 parser 层还不确定，所以暂时先返回 any
    return 'any[]'
  }

  public getFuncationName(data: APIDataType) {
    // 获取路径相同部分

    let tagName = resolveTypeName(getTagName(data)[0])
    if (this.config.isCamelCase) tagName = camelCase(tagName)
    let paths = this.apiData[tagName].map((item) => item.path)

    const pathBasePrefix = getBasePrefix(paths)
    const { customFunctionName } = this.config.hooks

    return customFunctionName
      ? customFunctionName(data)
      : data.operationId
        ? resolveFunctionName(
            stripDot(data.operationId),
            data.method as Methods,
          )
        : data.method + genDefaultFunctionName(data.path, pathBasePrefix)
  }

  public getTypeName(data: APIDataType) {
    let { namespace, hooks } = this.config
    namespace = namespace ? `${namespace}.` : ''
    const typeName =
      hooks?.customTypeName?.(data) || this.getFuncationName(data)

    return resolveTypeName(`${namespace}${typeName ?? data.operationId}Params`)
  }

  isInclude(pathOrObj: string | APIDataType, method?: Methods) {
    const map = this.includesMap
    if (!Object.keys(map).length) return true

    let path = ''
    if (isString(pathOrObj)) {
      path = pathOrObj
    } else if (isObject(pathOrObj)) {
      path = pathOrObj.path
      if (!method) method = pathOrObj.method as any
    }

    if (map[path]) return map[path]
    return !!map[`${method}-${path}`]
  }
}
