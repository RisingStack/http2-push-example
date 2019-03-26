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


// Push file
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

// Request handler
function onRequest(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const file = publicFiles.get(reqPath);
  console.log('onRequest: ', req.url, reqPath);

  // File not found
  if (!file) {
    res.statusCode = 404
    res.end()
    return
  }

  // Push bundle2 with bundle1.
  if (reqPath === '/bundle1.js') {
    push(res.stream, '/bundle2.js', reqPath)
  }

  // Serve file
  res.stream.respondWithFD(file.fileDescriptor, file.headers)
}

server.listen(PORT, (err) => {
  if (err) {
    console.error(err)
    return
  }

  console.log(`Server listening on ${PORT}`)
})
