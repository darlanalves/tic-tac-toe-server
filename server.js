const {startHttp} = require('./dist/http');
startHttp({
  serverRoot: __dirname,
  port: process.env.PORT
});
