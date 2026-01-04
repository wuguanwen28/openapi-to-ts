import pinyin from 'tiny-pinyin'
import ReservedDict, { check } from 'reserved-words'
import numberToWords from 'number-to-words'

import { logger } from './log'
import type { APIDataType, Methods } from '../types'
import { isObject } from '.'

// 获取标签名
export function getTagName(data: APIDataType) {
  let tags: any[] = []
  if (data['x-swagger-router-controller']) {
    tags = [data['x-swagger-router-controller']]
  } else if (data.tags) {
    tags = data.tags
  } else if (data.operationId) {
    tags = [data.operationId]
  } else {
    tags = [data.path.replace('/', '').split('/')[0]]
  }
  return tags
}

/** 兼容C#泛型的typeLastName取法 */
function getTypeLastName(typeName: string) {
  const tempTypeName = typeName || ''

  const childrenTypeName = tempTypeName?.match(/\[\[.+\]\]/g)?.[0]
  if (!childrenTypeName) {
    let publicKeyToken = (
      tempTypeName.split('PublicKeyToken=')?.[1] ?? ''
    ).replace('null', '')
    const firstTempTypeName = tempTypeName.split(',')?.[0] ?? tempTypeName
    let typeLastName = firstTempTypeName.split('/').pop().split('.').pop()
    if (typeLastName.endsWith('[]')) {
      typeLastName =
        typeLastName.substring(0, typeLastName.length - 2) + 'Array'
    }
    // 特殊处理C#默认系统类型，不追加publicKeyToken
    const isCsharpSystemType = firstTempTypeName.startsWith('System.')
    if (!publicKeyToken || isCsharpSystemType) {
      return typeLastName
    }
    return `${typeLastName}_${publicKeyToken}`
  }
  const currentTypeName = getTypeLastName(
    tempTypeName.replace(childrenTypeName, ''),
  )
  const childrenTypeNameLastName = getTypeLastName(
    childrenTypeName.substring(2, childrenTypeName.length - 2),
  )
  return `${currentTypeName}_${childrenTypeNameLastName}`
}

/** 类型声明过滤关键字 */
export const resolveTypeName = (typeName: string) => {
  if (ReservedDict.check(typeName)) {
    return `__openAPI__${typeName}`
  }
  const typeLastName = getTypeLastName(typeName)

  let name = typeLastName
    .replace(/[-_ ](\w)/g, (_all, letter) => letter.toUpperCase())
    .replace(/[^\w^\s^\u4e00-\u9fa5]/gi, '')

  // 当model名称是number开头的时候，ts会报错。这种场景一般发生在后端定义的名称是中文
  if (name === '_' || /^\d+$/.test(name)) {
    let msg = `⚠️models不能以number开头，原因可能是Model定义名称为中文, 建议联系后台修改`
    logger.warning(msg)
    return `Pinyin_${name}`
  }
  // 前面的解析可能会吧类似"2.0"之类的tag文字解析成首字母带数字的key
  // 后面要是再带点别的字符在生成ts className的时候会由于首字符带数字导致非法变量报错
  // 这里做一个统一处理
  if (/^\d/.test(name)) {
    const firstChar = parseInt(name[0])
    name = `${numberToWords.toWords(firstChar)}${name.substring(1)}`
  }

  if (!/[\u3220-\uFA29]/.test(name) && !/^\d$/.test(name)) {
    return name
  }
  const noBlankName = name.replace(/ +/g, '')
  return pinyin.convertToPinyin(noBlankName, '', true)
}

// 获取 openapi 里面的$ref字段的接口名称
export function getRefName(refObject: any): string {
  if (!isObject(refObject) || !refObject.$ref) {
    return refObject
  }
  const refPaths = refObject.$ref.split('/')
  return resolveTypeName(refPaths[refPaths.length - 1]) as string
}

// 检测所有path重复区域（prefix）
export function getBasePrefix(paths: string[]) {
  if (paths.length == 1) {
    return paths[0].split('/').slice(0, -1).join('/') + '/'
  }

  const arr: any[] = []
  paths.forEach((item) => {
    if (!item.startsWith('/')) item = '/' + item
    let pathItem = item.split('/')
    pathItem.forEach((item, key) => {
      arr[key] ??= []
      if (key === pathItem.length - 1 && /^\{.*\}$/.test(item)) return
      arr[key].push(item)
    })
  })

  const res: any[] = []
  for (let i = 0; i < arr.length; i++) {
    let item = arr[i]
    if (item.length !== paths.length) {
      if (res.length === i) res.pop()
      break
    }
    let keys = Array.from(new Set(item))
    if (keys.length === 1) {
      res.push(keys[0])
    }
  }

  return `${res.join('/')}`
}

// 解析请求方法名称
export function resolveFunctionName(functionName: string, methodName: Methods) {
  // 类型声明过滤关键字
  if (check(functionName)) {
    return `${functionName}Using${methodName.toUpperCase()}`
  }
  return functionName
}

export const stripDot = (str: string) => {
  return str.replace(/[-_ .](\w)/g, (_all, letter) => letter.toUpperCase())
}

// 将地址path路径转为大驼峰
export function genDefaultFunctionName(path: string, pathBasePrefix: string) {
  // 首字母转大写
  function toUpperFirstLetter(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  let newPath = path.replace(new RegExp(`^${pathBasePrefix}/?`), '')

  if (!newPath) {
    let res = []
    let arr = path.split('/')
    for (let i = arr.length - 1; i >= 0; i--) {
      let v = arr[i]
      res.unshift(v)
      if (/[a-zA-Z_]/.test(v[0])) break
    }
    newPath = res.join('/')
  }

  return newPath
    .split('/')
    .map((s) => {
      if (s.includes('-')) {
        s = s.replace(/(-\w)+/g, (_match: string, p1) =>
          p1?.slice(1).toUpperCase(),
        )
      }

      if (s.match(/^{.+}$/gim)) {
        return `By${toUpperFirstLetter(s.slice(1, s.length - 1))}`
      }
      return toUpperFirstLetter(s)
    })
    .join('')
}

// 获取文件名，注意不要去除 . 符号
export function getFinalFileName(s: string): string {
  // 支持下划线、中划线和空格分隔符，注意分隔符枚举值的顺序不能改变，否则正则匹配会报错
  return s.replace(/[-_ ](\w)/g, (_all, letter) => letter.toUpperCase())
}

// 获取自定义请求方法表达式
export function getImportStatement(requestLibPath?: string) {
  if (requestLibPath && requestLibPath.startsWith('import')) {
    return requestLibPath
  }
  if (requestLibPath) {
    return `import { request } from '${requestLibPath}'`
  }
  return `import { request } from "@utils/request"`
}

export function camelCase(input: string) {
  if (input == null) return ''

  return (
    input
      // 1. 将各种分隔符转为空格
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      // 2. 处理大小写边界（XMLHttp → XML Http）
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      // 3. 拆分成单词
      .trim()
      .split(/\s+/)
      // 4. 转换为 camelCase
      .map((word, index) => {
        const lower = word.toLowerCase()
        if (index === 0) return lower
        return lower.charAt(0).toUpperCase() + lower.slice(1)
      })
      .join('')
  )
}
