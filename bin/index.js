#!/usr/bin/env node
require('source-map-support/register')
const { OpenapiCommand } = require('../dist/index')
const command = process.argv[2]
const openapi = new OpenapiCommand(command)
openapi.run()
