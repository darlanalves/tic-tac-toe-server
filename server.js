const {startHttp} = require('./dist/app/http');
startHttp({
  serverRoot: __dirname,
  port: process.env.PORT
});
