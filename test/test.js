require('source-map-support/register')
const { GenerateService } = require('../dist/index.cjs')
const path = require('path')
const fs = require('fs')

const run = async () => {
  await new GenerateService({
    schemaPath: `${__dirname}/examples/swagger-empty.json`,
    serversPath: './test/services/empty',
  }).run()

  await new GenerateService({
    schemaPath: `${__dirname}/examples/swagger.json`,
    serversPath: './test/services/swagger2',
  }).run()

  await new GenerateService({
    schemaPath: `${__dirname}/examples/swagger3.json`,
    serversPath: './test/services/swagger-prefix',
    apiPrefix: '"svgApi"',
    overrideMode: 'over-same',
  }).run()

  await new GenerateService({
    schemaPath: `${__dirname}/examples/swagger3.json`,
    serversPath: './test/services/swagger3',
    splitDeclare: false,
  }).run()
}

run()
