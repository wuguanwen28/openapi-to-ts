import prompts from 'prompts'
import { getConfiguration, getOpenapiConfig, logger } from '../utils'
import { Configuration } from '../types'
import { ServiceGenerator } from '../generator/serviceGenerator'

export class GenerateService {
  config: Configuration
  constructor(config: Configuration = {}) {
    const defaultConfig = getConfiguration() || {}
    this.config = { ...defaultConfig, ...config }
  }
  async run() {
    try {
      if (!this.config) return logger.error('请先初始化配置文件')
      let { schemaPaths = [], schemaPath } = this.config
      if (!schemaPath) {
        if (schemaPaths.length === 1) {
          schemaPath = schemaPaths[0].schemaPath
        } else if (schemaPaths.length >= 2) {
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
      }

      if (!schemaPath) return logger.error('请选择项目')

      const openAPIData = await getOpenapiConfig(schemaPath)
      if (!openAPIData) {
        throw new Error('获取 openapi 数据失败，请检查路径是否有效')
      }

      const config = schemaPaths.find((item) => {
        return schemaPath === item.schemaPath
      })

      const generator = new ServiceGenerator(
        {
          ...this.config,
          ...config,
          schemaPath: undefined,
        },
        openAPIData,
      )
      await generator.genFile()
      logger.info('services 生成成功!', 'green', true)
    } catch (error) {
      logger.error(error)
      throw error
    }
  }
}
