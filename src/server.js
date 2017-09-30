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
}, onRequest)

const INDEX = '/index.html'
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

const getPath = (req) => 
  ( req.headers && req.headers[":path"] )
    ? req.headers[":path"]
    : req.path || INDEX

const getView = (path) => (path === '/') ? INDEX : path
// Request handler
function onRequest (req, res) {
  const reqPath = getView(getPath(req))
  const file = publicFiles.get(reqPath)
  
  // File not found
  if (!file) {
    res.statusCode = 404
    return res.end()
  }

  // Push with index.html
  if (reqPath === INDEX) {
    push(res.stream, '/bundle1.js')
    push(res.stream, '/bundle2.js')
  }

  // Serve file
  res.stream.respondWithFD(file.fileDescriptor, file.headers)
}

server.listen(PORT, (err) => 
  (err) 
    ? console.error(err)
    : console.log(`Server listening on ${PORT}`)
)
