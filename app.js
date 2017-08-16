'use strict'

const http2 = require('http2')
const fs = require('fs')
const mime = require('mime')

const { HTTP2_HEADER_PATH } = http2.constants

// https://stackoverflow.com/questions/12871565/how-to-create-pem-files-for-https-web-server
// openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem
const cert = fs.readFileSync('./cert.pem')
const key = fs.readFileSync('./key.pem')

const server = http2.createSecureServer({ cert, key, allowHTTP1: true }, onRequest)
const port = process.env.PORT || 3000

// Cache files
const files = new Map()
fs.readdirSync('./public').forEach((fileName) => {
  const filePath = `./public/${fileName}`
  const fileDescriptor = fs.openSync(filePath, 'r')
  const stat = fs.fstatSync(fileDescriptor)
  const contentType = mime.lookup(filePath)

  files.set(`/${fileName}`, { fileDescriptor, stat, contentType })
})

// Helpers
function getFileHeaders (file) {
  return {
    'content-length': file.stat.size,
    'last-modified': file.stat.mtime.toUTCString(),
    'content-type': file.contentType
  }
}

// Push file
function push (stream, path) {
  const file = files.get(path)

  if (!file) {
    return
  }

  stream.pushStream({ [HTTP2_HEADER_PATH]: path }, (pushStream) => {
    const stat = fs.fstatSync(file.fileDescriptor)
    pushStream.respondWithFD(file.fileDescriptor, getFileHeaders(file))
  })
}

// Request handler
function onRequest(req, res) {
  const reqPath = req.path === '/' ? '/index.html' : req.path
  const file = files.get(reqPath)

  // File not found
  if (!file) {
    res.statusCode = 404
    res.end()
    return
  }

  // Detects if it is a HTTPS req or HTTP/2
  const { socket: { alpnProtocol } } = req.httpVersion === '2.0' ? req.stream.session : req

  // HTTP/2
  if (req.httpVersion === '2.0') {
    if (reqPath == '/index.html') {
      push(res.stream, '/bundle1.js')
      push(res.stream, '/bundle2.js')
    }

    res.stream.respondWithFD(file.fileDescriptor, getFileHeaders(file))
    return
  }

  // HTTP/1
  res.writeHead(200, getFileHeaders(file))
  res.write(file.fileDescriptor, 'binary')
  res.end()
}

server.listen(port, (err) => {
  if (err) {
    console.error(err)
    return
  }

  console.log(`Server listening on ${port}`)
})
