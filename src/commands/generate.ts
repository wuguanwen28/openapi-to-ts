import prompts from 'prompts'
import { getConfiguration, getOpenapiConfig, logger } from '../utils'
import { ServiceGenerator } from '../generator/serviceGenerator'
import { Configuration } from '../types'
import { InitConfig } from './init'
import chalk from 'chalk'

export class GenerateService {
  config: Configuration
  fileConfig: Configuration

  constructor(config: Configuration = {}) {
    this.setConfig(config)
  }

  setConfig(config: Configuration = {}) {
    this.fileConfig = getConfiguration()
    this.config = { ...(this.fileConfig || {}), ...config }
  }

  async run() {
    let { schemaPaths = [], schemaPath } = this.config
    try {
      if (!schemaPath && !schemaPaths?.length) {
        let { confirm } = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: '未检测到配置文件，是否初始化配置文件？',
          initial: true,
        })
        if (!confirm) return
        const init = new InitConfig()
        await init.run()
        return
      }

      if (!schemaPath && schemaPaths.length) {
        const { selectedSchemaPath } = await prompts({
          type: 'select',
          name: 'selectedSchemaPath',
          message: '请选择项目',
          instructions: false,
          choices: schemaPaths.map((item) => ({
            title: `${item.label}（${item.schemaPath}）`,
            value: item.schemaPath,
          })),
        })
        schemaPath = selectedSchemaPath
      }

      if (!schemaPath) return logger.error(`请选择项目`)

      const config = schemaPaths.find((item) => {
        return schemaPath === item.schemaPath
      })

      this.generate({ ...this.config, ...config, schemaPath })

      logger.info('services 生成成功!', 'green', true)
    } catch (error) {
      logger.error(error, chalk.bold.red('\npath:') + schemaPath)
      throw error
    }
  }

  async generate(config: Configuration = this.config) {
    const openAPIData = await getOpenapiConfig(config.schemaPath)
    if (!openAPIData) throw new Error('获取数据失败，请检查路径是否有效')

    const generator = new ServiceGenerator(config, openAPIData)
    await generator.genFile()
  }
}
