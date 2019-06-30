const {start} = require('./dist/index');
const FS = require('fs');
const Path = require('path');

function toJSON(object) {
  return JSON.stringify(object);
}

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

  function reset() {
    server = start({
      ...socketServerConfiguration,
      server: httpServer
    });
  }

  switch (request.url.slice(1)) {
    case 'sockets':
      if (!server) {
        reset();
      }

      response.end(toJSON([{
        url: `ws://localhost:${socketServerConfiguration.port}${socketServerConfiguration.path}`
      }]));
      break;

    case 'reset':
      reset();
      response.end('OK');
      break;

    case 'sessions':
      if (server) {
        response.end(toJSON(server.getSessions()));
        return;
      }

      response.end('[]');

      break;

    default:
      response.writeHead(404, 'Not found');
      response.end();
  }
})

httpServer.listen(3000);
