import http from 'http'
import https from 'https'
import nodeFetch from 'node-fetch'

import * as fs from 'fs'
import * as path from 'path'
import * as prettier from 'prettier'
import * as converter from 'swagger2openapi'
import { cosmiconfigSync } from 'cosmiconfig'

import { logger } from './log'
import { Configuration } from '../types'
import { OpenAPIObject } from 'openapi3-ts'
const fetch = typeof nodeFetch === 'function' ? nodeFetch : nodeFetch['default']

export * from './log'
export * from './config'
export * from './nameHandler'
export * from './margerContent'

export const isArray = Array.isArray

export const isValid = (val: any) => {
  return val !== undefined && val !== null
}

export const isString = (val: unknown): val is String => {
  return typeof val === 'string'
}

export const isBoolean = (val: unknown): val is Boolean => {
  return typeof val === 'boolean'
}

export const isFunction = (val: unknown): val is Function => {
  return typeof val === 'function'
}

export const isObject = (val: unknown): val is Object => {
  return val && typeof val === 'object'
}

export function isInVSCodeExtension() {
  return process.env.__VSCODE_EXTENSION__ === 'true'
}

/** 获取项目的根目录 */
export const getProjectRoot = () => {
  if (isInVSCodeExtension()) {
    return process.env.WORKSPACE_FOLDER || process.cwd()
  }
  return process.cwd()
}

/** 获取配置文件 */
export const getConfiguration = (): Configuration | null => {
  const rootPath = getProjectRoot()
  const explorerSync = cosmiconfigSync('openapi')
  const searchedFor = explorerSync.search(rootPath)
  if (searchedFor) {
    const config = searchedFor.config
    if (config['__esModule'] && config['default']) {
      return config['default']
    }
    return config
  }
  return null
}

/** 获取prettier的配置 */
export const getPrettierConfig = async () => {
  const rootPath = path.resolve(getProjectRoot(), './prettier.config.js')

  const config = await prettier.resolveConfig(rootPath, {
    editorconfig: true,
    useCache: false,
  })
  return config
}

/** 格式化文件内容 */
export const prettierFile = async (
  content: string,
  parser: 'typescript' | 'json' = 'typescript',
) => {
  try {
    const prettierConfig = await getPrettierConfig()
    return await prettier.format(content, {
      ...prettierConfig,
      parser,
    })
  } catch (error) {
    logger.error(error)
    return content
  }
}

/** 写入文件 */
export const writeFile = async (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const prettierContent = await prettierFile(content)
  fs.writeFileSync(filePath, prettierContent, {
    encoding: 'utf-8',
  })
}

const getSchema = async (schemaPath: string, authorization?: string) => {
  try {
    if (schemaPath.startsWith('http')) {
      const protocol = schemaPath.startsWith('https:') ? https : http
      const agent = new protocol.Agent({ rejectUnauthorized: false })
      const json = await fetch(schemaPath, {
        agent,
        headers: { Authorization: authorization || '' },
      }).then((res) => res.json())
      return json
    }

    if (typeof require !== 'undefined') {
      return require(schemaPath)
    }

    const res = await import(schemaPath)
    return res.default
  } catch (error) {
    logger.error('获取Openapi配置失败', error)
    return null
  }
}

export const getOpenapiConfig = async (
  schemaPath: string,
  authorization?: string,
): Promise<OpenAPIObject | null> => {
  const schema = await getSchema(schemaPath, authorization)
  if (!schema) return null
  // v3版本没有swagger属性
  if (!schema.swagger) return schema
  // v2版本转v3
  return new Promise((resolve, reject) => {
    converter.convertObj(schema, {}, (err, options) => {
      if (err) return reject(err)
      resolve(options.openapi as any)
    })
  })
}
