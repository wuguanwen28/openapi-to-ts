import chalk, { ColorName } from 'chalk'

class Logger {
  info(msg: string, color: ColorName = 'blue', isBold: boolean = false) {
    if (isBold) {
      console.log(chalk[color].bold(msg))
    } else {
      console.log(chalk[color](msg))
    }
  }

  warning(...msg: string[]) {
    console.log(chalk.yellow(`${chalk.bold('Warning: ')}${msg.join(' ')}`))
  }

  error(...msg: (string | Error)[]) {
    msg = msg.map((item) => (item instanceof Error ? item.message : item))
    console.log(chalk.red(`${chalk.bold('Error: ')}${msg.join(' ')}`))
  }
}

export const logger = new Logger()
