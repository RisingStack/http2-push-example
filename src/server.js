'use strict'

const fs = require('fs')
const path = require('path')
// eslint-disable-next-line
const http2 = require('http2')
const helper = require('./helper')

const { HTTP2_HEADER_PATH } = http2.constants
const PORT = process.env.PORT || 3000
const PUBLIC_PATH = path.join(__dirname, '../public')

const publicFiles = helper.getFiles(PUBLIC_PATH)
const server = http2.createSecureServer({
  cert: fs.readFileSync(path.join(__dirname, '../ssl/cert.pem')),
  key: fs.readFileSync(path.join(__dirname, '../ssl/key.pem'))
}, onRequest);


const METADATA = {
  '/bundle1.js': [
    {path: '/bundle2.js'},
    {path: '/bundle3.js'},
  ],
};


// Push file.
function push(stream, path, forPath) {
  const file = publicFiles.get(path)

  if (!file) {
    return
  }

  console.log('push: ', path, 'for: ', forPath);
  stream.pushStream({ [HTTP2_HEADER_PATH]: path }, (err, pushStream) => {
    if (err) {
      console.error(err)
      return
    }
    pushStream.respondWithFD(file.fileDescriptor, file.headers);
  })
}


// Link file.
function link(res, path, forPath, headers) {
  console.log('link: ', path, 'for: ', forPath);
  if (!headers['Link']) {
    headers['Link'] = [];
  }
  headers['Link'].push(`<${path}>; rel=preload; as=script`);
}


// Request handler.
function onRequest(req, res) {
  const [reqPath, query] = req.url.split('?');
  const filePath = reqPath == '/' ? '/index.html' : reqPath;
  console.log('onRequest: ', req.url, reqPath, query);
  const file = publicFiles.get(filePath);

  // File not found
  if (!file) {
    console.log('404 ', reqPath);
    res.statusCode = 404;
    res.end();
    return;
  }

  // Push or link if needed.
  const headers = {};
  const metadata = METADATA[reqPath];
  if (metadata) {
    if (query == 'push') {
      metadata.forEach(r => {
        push(res.stream, r.path, reqPath, headers);
      });
    } else if (query == 'link') {
      metadata.forEach(r => {
        link(res, r.path, reqPath, headers);
      });
    }
  }

  // Serve file
  res.stream.respondWithFD(
      file.fileDescriptor,
      Object.assign(headers, file.headers));
}

server.listen(PORT, (err) => {
  if (err) {
    console.error(err)
    return
  }

  console.log(`Server listening on ${PORT}`)
})
