// @ts-ignore
/** eslint-disable */
import { request, RequestConfig } from '@/api/request'

/**此处后端没有提供注释 GET /api/ApiLoginProject/WeiXin/Authorize*/
export async function getAuthorize(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: Account.getAuthorizeParams,
  config?: RequestConfig,
) {
  return request<Account.IResultDataModel>('/api/ApiLoginProject/WeiXin/Authorize', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(config || {}),
  })
}
