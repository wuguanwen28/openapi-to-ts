import { Configuration, TypescriptFileType } from '../types'
import { logger } from './log'
import * as fs from 'fs'
import * as recast from 'recast'
import {
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  FunctionDeclaration,
  ImportDeclaration,
  ObjectExpression,
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
      newContent = await mergeIndex(newAst, oldAst)
    }

    return newContent
  } catch (error) {
    throw new Error(`合并代码出错: ${error}`)
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

  const isImportNode = (node: Statement): node is ImportDeclaration => {
    return node.type == 'ImportDeclaration'
  }
  const isExportNode = (node: Statement): node is ExportDefaultDeclaration => {
    return node.type == 'ExportDefaultDeclaration'
  }
  const isExportAllNode = (node: Statement): node is ExportAllDeclaration => {
    return node.type === 'ExportAllDeclaration'
  }

  const importMap = {}
  const exportMap = {}
  let lastImportIndex = -1
  let lastExportIndex = -1
  let isHasExportDefault = false
  let oldExportProperties: ObjectExpression['properties'] = []

  // 记录导入模块的下标
  oldAstNode.forEach((node, index) => {
    if (isImportNode(node)) {
      const name = node.specifiers[0].local.name
      importMap[name] = index
      lastImportIndex = index
    }
    if (isExportNode(node)) {
      isHasExportDefault = true
      if (node.declaration.type === 'ObjectExpression') {
        oldExportProperties = node.declaration.properties
      }
    }
    if (isExportAllNode(node)) {
      const name = node.source.value
      exportMap[name] = index
      lastExportIndex = index
    }
  })

  const oldExportPropertiesMap = oldExportProperties.reduce((obj, node, index) => {
    if (node.type === 'ObjectProperty' && node.key.type === 'Identifier') {
      let name = node.key.name
      obj[name] = index
    }
    return obj
  }, {})

  newAstNode.forEach((node) => {
    // 没有导入直接添加
    if (isImportNode(node)) {
      let name = node.specifiers[0].local.name
      const index = importMap[name]
      if (index === undefined) {
        oldAstNode.splice(++lastImportIndex, 0, node)
      }
    }

    // 处理默认导出语句
    if (isExportNode(node)) {
      // 没有默认导出语句直接使用新的
      if (!isHasExportDefault) {
        return oldAstNode.splice(++lastImportIndex, 0, node)
      }

      // 有默认导出语句，直接合并
      if (node.declaration.type === 'ObjectExpression') {
        let properties = node.declaration.properties
        properties.forEach((property) => {
          if (property.type === 'ObjectProperty' && property.key.type === 'Identifier') {
            let name = property.key.name
            let index = oldExportPropertiesMap[name]
            if (index === undefined) {
              oldExportProperties.push(property)
            }
          }
        })
      }
    }

    // 处理导出语句
    if (isExportAllNode(node)) {
      const name = node.source.value
      const index = exportMap[name]
      if (index === undefined) {
        oldAstNode.splice(++lastExportIndex, 0, node)
      }
    }
  })

  return recast.print(oldAst).code
}
