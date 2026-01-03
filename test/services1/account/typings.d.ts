declare namespace Account {
  interface IResultDataModel {
    is_success?: boolean
    success?: boolean
    errorcode?: string
    logid?: string
    message?: string
    msg?: string
    /** double */
    timestamp?: number
    /** int3211 */
    status?: number
    errors?: string
  }

  type AA = {
    a: string
  }
}
