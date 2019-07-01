import * as FS from 'fs';
import * as Path from 'path';
import { start } from './socket';

function toJSON(object) {
  return JSON.stringify(object);
}

const socketServerConfiguration = {
  port: 8080,
  path: '/ws'
};

export function startHttp({
  serverRoot = '',
  port = 3000
}) {
  let tttServer;

  const httpServer = require('http').createServer((request, response) => {
    if (request.url === '/') {
      FS.createReadStream(Path.join(serverRoot, 'static', 'index.html')).pipe(response);
      return;
    }

    const sanitizedPath = request.url.slice(1).replace(/[.]{2,}/g, '.');
    const filePath = Path.join(serverRoot, 'static', sanitizedPath);

    if (/\.(js|css)$/.test(request.url) && FS.existsSync(filePath)) {
      FS.createReadStream(filePath).pipe(response);
      return;
    }

    switch (request.url.slice(1)) {
      case 'sockets':
        if (!tttServer) {
          response.end('[]');
          return;
        }

        response.end(toJSON([{
          url: `ws://localhost:${socketServerConfiguration.port}${socketServerConfiguration.path}`
        }]));
        break;

      case 'reset':
        reset();
        response.end('OK');
        break;

      default:
        response.writeHead(404, 'Not found');
        response.end();
    }
  });

  function reset() {
    if (tttServer) {
      tttServer.close();
    }

    tttServer = start({
      ...socketServerConfiguration,
      server: httpServer
    });
  }

  httpServer.listen(port);

  if (!tttServer) {
    reset();
  }
}
