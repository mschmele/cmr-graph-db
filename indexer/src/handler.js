// import { bootstrapGremilinServer } from '../src/bootstrap'
const { bootstrapGremilinServer } = require('./bootstrap');

module.exports.hello = async event => {
  let body = await bootstrapGremilinServer();
  return {
    statusCode: 200,
    body: ":)"
  };
};
