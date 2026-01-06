import * as path from 'path'
import {
  getProjectRoot,
  prettierFile,
  configStr,
  logger,
  writeFile,
  getConfiguration,
} from '../utils'

export class InitConfig {
  async run() {
    const filePath = path.resolve(getProjectRoot(), './openapi.config.js')

    try {
      if (getConfiguration()) throw new Error(`配置文件已存在`)
      const content = await prettierFile(configStr)
      await writeFile(filePath, content)
      logger.info(`配置文件已初始化：${filePath}`)
      return filePath
    } catch (error) {
      logger.error(error)
      throw error
    }
  }
}
