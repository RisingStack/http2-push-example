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
  key: fs.readFileSync(path.join(__dirname, '../ssl/key.pem')),
  allowHTTP1: true
}, onRequest)

// Push file
function push (stream, path) {
  const file = publicFiles.get(path)

  if (!file) {
    return
  }

  stream.pushStream({ [HTTP2_HEADER_PATH]: path }, (pushStream) => {
    pushStream.respondWithFD(file.fileDescriptor, file.headers)
  })
}

// Request handler
function onRequest (req, res) {
  const reqPath = req.path === '/' ? '/index.html' : req.path
  const file = publicFiles.get(reqPath)

  // File not found
  if (!file) {
    res.statusCode = 404
    res.end()
    return
  }

  // HTTP/2
  if (req.httpVersion === '2.0') {
    if (reqPath === '/index.html') {
      push(res.stream, '/bundle1.js')
      push(res.stream, '/bundle2.js')
    }

    res.stream.respondWithFD(file.fileDescriptor, file.headers)
    return
  }

  // HTTP/1
  res.writeHead(200, file.headers)
  res.write(file.fileDescriptor, 'binary')
  res.end()
}

server.listen(PORT, (err) => {
  if (err) {
    console.error(err)
    return
  }

  console.log(`Server listening on ${PORT}`)
})
