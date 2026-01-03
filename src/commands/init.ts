import * as path from 'path'
import { type CosmiconfigResult, cosmiconfigSync } from 'cosmiconfig'
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
    try {
      if (getConfiguration()) return logger.error(`配置文件已存在`)
      const content = await prettierFile(configStr)
      const filePath = path.resolve(getProjectRoot(), './openapi.config.js')
      await writeFile(filePath, content)
      logger.info(`配置文件已初始化：${path.basename(filePath)}`)
    } catch (error) {
      logger.error(error)
    }
  }
}
