import chalk from 'chalk'
import { logger } from '../utils/log'
import { GenerateService } from './generate'
import { InitConfig } from './init'

type CommandType = 'init' | 'generate' | 'help'

export * from './init'

export * from './generate'

export class OpenapiCommand {
  constructor(private command: CommandType = 'generate') {}

  help = {
    run() {
      logger.info(`${chalk.green.bold('npx openapi init')}: 初始化配置文件`)
      logger.info(`${chalk.green.bold('npx openapi generate')}: 生成TS类型`)
    },
  }

  async run() {
    const commandMap = {
      help: this.help,
      init: new InitConfig(),
      generate: new GenerateService(),
    }

    const command = commandMap[this.command]
    if (command) return command.run()

    logger.error(
      `命令不存在, 请运行 ${chalk.blue.bold('npx openapi help')} 查看帮助`,
    )
  }
}
