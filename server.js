const {start} = require('./dist/index');
const FS = require('fs');
const Path = require('path');
// const server = start();

const socketServerConfiguration = {
  port: 8080,
  path: '/ws'
};

const httpServer = require('http').createServer((request, response) => {
  let server;

  if (request.url === '/') {
    FS.createReadStream('./index.html').pipe(response);
    return;
  }

  const sanitizedPath = request.url.slice(1).replace(/[.]{2,}/g, '.');
  const filePath = Path.join(__dirname, sanitizedPath);

  if (/\.(js|css)$/.test(request.url) && FS.existsSync(filePath)) {
    FS.createReadStream(filePath).pipe(response);
    return;
  }

  switch (request.url.slice(1)) {
    case 'sockets':
      if (!server) {
        server = start({
          ...socketServerConfiguration,
          server: httpServer
        });
      }

      response.end(JSON.stringify([{
        url: `ws://localhost:${socketServerConfiguration.port}${socketServerConfiguration.path}`
      }]));
      break;

    case 'reset':
      server = start();
      response.end('OK');
      break;

    case 'sessions':
      if (!server) {
        response.writeHead(404, 'Not found');
        response.end();
      }

      response.end(server.getSessions());
      break;

    default:
      response.writeHead(404, 'Not found');
      response.end();
  }
})

httpServer.listen(3000);
