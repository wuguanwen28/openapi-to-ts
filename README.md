# Openapi-To-Ts

## 功能说明
* 通过 OpenAPI 文档生成 TypeScript 类型和接口方法

## 所有的命令
  1. `npx openapi init` 在根目录创建配置文件
  2. `npx openapi` 根据openapi生成对应API的TS文件

## 配置参数说明

| 字段名                     | 类型                                        | 默认值                   | 说明                                                                         |
| -------------------------- | ------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `label`                    | `string`                                    | -                        | 名称                                                                         |
| `schemaPath`               | `string`                                    | -                        | swagger json 路径                                                            |
| `schemaPaths`              | `Array<Omit<Configuration, 'schemaPaths'>>` | -                        | 多个 swagger json 路径（ 每个项目都可以单独配置其他属性）                    |
| `serversPath`              | `string`                                    | `"./src/services"`       | 生成的文件夹路径，会追加一层命名空间文件夹，如 `./src/services/${namespace}` |
| `namespace`                | `string`                                    | `"API"`                  | ts 类型声明的命名空间名称                                                    |
| `requestLibPath`           | `string`                                    | `"@/utils/request"`      | 请求库的路径；以 `import` 开头则替换整个 import，否则只替换路径              |
| `requestConfigType`        | `string`                                    | `"{[key: string]: any}"` | 请求方法的 `config` 参数类型                                                 |
| `requestConfigTypeLibPath` | `string`                                    | -                        | 引入请求方法 config 参数类型的路径                                           |
| `serviceTemplate`          | `ServiceTemplate`                           | `"serviceController1"`   | service 函数模板                                                             |
| `templatesFolder`          | `string`                                    | -                        | 自定义模板文件夹路径                                                         |
| `nullable`                 | `boolean`                                   | `false`                  | 是否使用 `null` 代替可选字段                                                 |
| `enumStyle`                | `'string-literal' \| 'enum'`                | `"string-literal"`       | 枚举类型生成风格                                                             |
| `apiPrefix`                | `string \| ApiPrefixFn`                     | -                        | api 的统一前缀，支持字符串或变量函数                                         |
| `dataFields`               | `string[]`                                  | -                        | response 中数据字段，如 `['result', 'res']`                                  |
| `overrideMode`             | `'all' \| 'skip-same' \| 'over-same'`       | `"skip-same"`            | 同名方法或类型的处理方式                                                     |
| `splitDeclare`             | `boolean`                                   | `true`                   | 是否拆分类型声明文件                                                         |
| `isCamelCase`              | `boolean`                                   | `true`                   | 是否使用小驼峰命名文件和请求函数                                             |
| `includes`                 | `Array<{ path: string; method: string }>`   | -                        | 只生成指定路径和方法的接口                                                   |
| `declareType`              | `'type' \| 'interface'`                     | -                        | interface 类型声明方式                                                       |
| `exportType`               | `'merge' \| 'alone' \| 'all'`               | `"merge"`                | index 文件的导出方式                                                         |
| `hooks`                    | `object`                                    | -                        | 自定义 hooks 配置                                                            |


## 参数额外说明

1. ### serviceTemplate  
    ```js
    // 预设了三种模板，不可以自定义
    // serviceController1
    request(url, {method, data, params, ...config})
    // serviceController2
    request.post(url, {data, params, ...config})
    // serviceController3
    request.post(url, data/params, config)
    ```
2. ### requestLibPath 
   * 如果以`import`开头则替换掉整个表达式,
   * 否则只替换掉路径，import request from `${requestLibPath}`
3. ### requestConfigTypeLibPath
   * 如果config的类型与request方法在同一个文件导出, 可以与 `requestLibPath` 一同设置
4. ### enumStyle
    ```ts
    // `string-literal` 使用字符串字面量
    type Direction = "UP" | "DOWN"
    // `enum` 使用枚举类型
    enum Direction { Up = "UP", Down = "DOWN"}
    ```
5. ### hooks
   | 字段名                      | 类型                                                          | 说明                  |
   | --------------------------- | ------------------------------------------------------------- | --------------------- |
   | `customClassName`           | `(tagName: string) => string`                                 | 自定义类名            |
   | `customTypeName`            | `(data: APIDataType) => string`                               | 自定义类型名称        |
   | `customFileNames`           | `(data: APIDataType) => string[]`                             | 自定义生成文件名      |
   | `customFunctionName`        | `(data: APIDataType) => string`                               | 自定义方法名          |
   | `customType`                | `(schemaObject, namespace, originGetType) => string`          | 自定义类型生成逻辑    |
   | `customOptionsDefaultValue` | `(data: OperationObject) => Record<string, any> \| undefined` | 自定义 options 默认值 |

