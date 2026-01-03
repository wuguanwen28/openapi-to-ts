import { Configuration, TypescriptFileType } from '../types'
import { logger } from './log'
import * as fs from 'fs'
import * as recast from 'recast'
import {
  ExportNamedDeclaration,
  FunctionDeclaration,
  Statement,
  File as TsAst,
  TSTypeAliasDeclaration,
} from '@babel/types'
const tsParser = require('recast/parsers/typescript')

export const mergeContent = async (options: {
  newContent: string
  filePath: string
  type: TypescriptFileType
  overrideMode?: Configuration['overrideMode']
}) => {
  let { newContent, filePath, type, overrideMode = 'skip-same' } = options
  try {
    if (overrideMode === 'all') return newContent
    if (!fs.existsSync(filePath)) return newContent

    const oldContent = fs.readFileSync(filePath, { encoding: 'utf-8' })

    let oldAst: TsAst = recast.parse(oldContent, { parser: tsParser })
    let newAst: TsAst = recast.parse(newContent, { parser: tsParser })

    const isOverride = overrideMode === 'over-same'

    if (type === 'interface') {
      newContent = await mergeDeclare(newAst, oldAst, isOverride)
    } else if (type.includes('serviceController')) {
      newContent = await mergeService(newAst, oldAst, isOverride)
    } else if (type === 'serviceIndex') {
      // newContent = await mergeIndex(newAst, oldAst)
    }

    return newContent
  } catch (error) {
    logger.error('合并代码出错', error, `\nfilePath: ${filePath}`)
    throw error
  }
}

const mergeDeclare = async (newAst: TsAst, oldAst: TsAst, isOverride?: boolean) => {
  let oldAstNode = oldAst?.program?.body?.[0]
  let newAstNode = newAst?.program?.body?.[0]
  if (
    oldAstNode?.type == 'TSModuleDeclaration' &&
    newAstNode?.type == 'TSModuleDeclaration' &&
    Array.isArray(oldAstNode.body.body) &&
    Array.isArray(newAstNode.body.body)
  ) {
    let oldBody = oldAstNode.body.body
    let newBody = newAstNode.body.body

    const isTypeNode = (node: Statement): node is TSTypeAliasDeclaration => {
      return [
        'TSEnumDeclaration', // 枚举
        'TSTypeAliasDeclaration', // type
        'TSInterfaceDeclaration', // interface
      ].includes(node.type)
    }

    const olwBodyMap = oldBody.reduce((obj, node, index) => {
      if (isTypeNode(node)) obj[node.id.name] = index
      return obj
    }, {})

    newBody.forEach((node) => {
      if (isTypeNode(node)) {
        let index = olwBodyMap[node.id.name]

        if (index == undefined) {
          oldBody.push(node)
        } else if (isOverride) {
          oldBody.splice(index, 1, node)
        }
      }
    })
    return recast.print(oldAst).code
  }
  throw new Error('Declare文件合并失败')
}

const mergeService = async (newAst: TsAst, oldAst: TsAst, isOverride?: boolean) => {
  let oldAstNode = oldAst?.program?.body || []
  let newAstNode = newAst?.program?.body || []

  const isFunctionNode = (node: Statement): node is ExportNamedDeclaration => {
    return node.type == 'ExportNamedDeclaration' && node.declaration?.type == 'FunctionDeclaration'
  }

  const olwBodyMap = oldAstNode.reduce((obj, node, index) => {
    if (isFunctionNode(node)) {
      let functionName = (node.declaration as FunctionDeclaration).id?.name
      obj[functionName] = index
    }
    return obj
  }, {})

  newAstNode.forEach((newNode) => {
    if (isFunctionNode(newNode)) {
      let functionName = (newNode.declaration as FunctionDeclaration).id?.name
      let index = olwBodyMap[functionName]
      if (index === undefined) {
        oldAstNode.push(newNode)
      } else if (isOverride) {
        oldAstNode.splice(index, 1, newNode)
      }
    }
  })

  return recast.print(oldAst).code
}

const mergeIndex = async (newAst: TsAst, oldAst: TsAst) => {
  let oldAstNode = oldAst?.program?.body
  let newAstNode = newAst?.program?.body
}
