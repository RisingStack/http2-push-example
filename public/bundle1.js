'use strict'

console.log('Bundle 1')
document.body.innerHTML += '<p>Bundle 1 loaded</p>'

function addBundle(path) {
  var script = document.createElement('script');
  script.async = true;
  script.src = path;
  document.head.appendChild(script);
}

addBundle('/bundle2.js');
