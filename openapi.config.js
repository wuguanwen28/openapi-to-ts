/** @type {import('./dist/index').Configuration} */
module.exports = {
  /**
   * openapi的json路径
   */
  schemaPaths: [
    {
      label: '酆泽云应用-低码平台',
      schemaPath: 'https://cloudlowcode.fengze.cloud/api/ApiLowCodeProject/swagger.json',
    },
    {
      label: 'swagger2.0',
      schemaPath: `${__dirname}/swagger.json`,
    },
    {
      namespace: 'Account',
      label: '酆泽云应用-账号',
      schemaPath: 'https://cloudlowcode.fengze.cloud/api/ApiLoginProject/swagger.json',
      includes: [{
        path: '/api/ApiLoginProject/WeiXin/Authorize',
        method: 'get'
      }]
    },
  ],
  /**
   * 生成的文件夹的路径
   * 会追加一层命名空间为名称的文件夹，如：./src/services/${namespace}"
   */
  serversPath: './test/services1',
  /**
   * ts类型声明的命令空间名称
   */
  namespace: 'Servers',
  /**
   * 请求库的路径
   * 如果以import开头则替换掉整个表达式, 否则只替换掉路径
   * import request from `${requestLibPath}`
   */
  requestLibPath: "import { request, RequestConfig } from '@/api/request'",
  /**
   * 请求方法的 config 参数类型
   * request.post(url: string, data: any, config: RequestConfig)
   */
  requestConfigType: 'RequestConfig',
  /**
   * 引入请求方法的config参数类型的路径
   * 如与请求库位置相同, 可以与 requestLibPath 一同设置
   */
  requestConfigTypeLibPath: '',
  /**
   * service函数模板
   * template1: request.post(url, data/params, config)
   * template2: request.post(url, {data, params, ...config})
   * template3: request(url, {method, data, params, ...config})
   * @type {'template1' | 'template2' | 'template3'}
   */
  serviceTemplate: 'template3',
  /**
   * api的统一前缀
   * @type {string | (params: {
   *  path: string;
   *  method: string;
   *  namespace: string;
   *  functionName: string;
   *  autoExclude?: boolean
   * }) => string}
   */
  apiPrefix: '',
  /**
   * 使用null代替可选
   */
  nullable: false,
  /**
   * 枚举类型的样式
   * type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"
   * enum Direction { Up = "UP", Down = "DOWN", Left = "LEFT", Right = "RIGHT" }
   * @type {'string-literal' | 'enum'}
   */
  enumStyle: 'string-literal',
  /**
   * prettier格式化配置, 默认使用项目根目录下的prettierrc配置
   * @type {object}
   */
  prettierrc: {},

  isCamelCase: false,

  splitDeclare: false,
}
