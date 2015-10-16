var DEFAULT_CONFIG = {
  discoveryServers: [],
  services: {},
  timeout: 1000
};

function ServiceClient(cfg) {
  var config = $.extend({}, DEFAULT_CONFIG, cfg);

  return {
    get: get,
    post: post,
    put: put,
    delete: del,
    getServices: getServices,
    getServiceUrlsByTag: getServiceUrlsByTag
  };

  function get(serviceName, path) {
    return ajax('get', serviceName, path);
  }

  function post(serviceName, path, value) {
    return ajax('post', serviceName, path, value);
  }

  function put(serviceName, path, value) {
    return ajax('put', serviceName, path, value);
  }

  function del(serviceName, path) {
    return ajax('delete', serviceName, path, value);
  }

  function ajax(method, serviceName, path, value) {
    return getServiceUrls(serviceName).then(function (urls) {
      if (!urls.length) throw new Error('No endpoint configured for service ' + serviceName);

      // Map url to a list of operations
      var funcs = urls.map(function (url) {
        return function () {
          return $.ajax({
            url: 'http://' + url + path,
            method: method,
            data: value
          });
        };
      });

      return invokeUntilResolved(funcs);
    });
  }

  function getServices(tag){

    var funcs = config.discoveryServers.map(function (discoveryServer) {
      return function () {
        return $
          .get(discoveryServer + '/v1/catalog/services');
      };
    });

    return invokeUntilResolved(funcs).then(function (result) {
      return Object.keys(result).filter(function(key){
        return tag ? result[key].indexOf(tag) !== -1 : key;
      });
    });
  }

  function getServiceUrlsByTag(tag){
    return getServices(tag)
      .then(function(result){
        return q        
          .all(result.map(function (name) {
            return getServiceUrls(name)
              .then(function(data){
                var result = {};
                result[name] = data;
                return result;
              }); 
          }))
          .then(function(data){
            var result = {}; 
            data.forEach(function(itm){
              extend(result, itm);
            });
            return result;
          });
      });
  }

  function getServiceUrls(serviceName) {
    if (config.services[serviceName]) return jQuery.Deferred().resolve(config.services[serviceName]);

    var funcs = config.discoveryServers.map(function (discoveryServer) {
      return function () {
        return $
          .get(discoveryServer + '/v1/catalog/service/' + serviceName);
      };
    });

    return invokeUntilResolved(funcs).then(function (result) {
      var serviceUrls = result.map(function (itm) {
        return itm.Address + ':' + itm.ServicePort;
      });

      config.services[serviceName] = serviceUrls;
      return serviceUrls;
    });
  }

  function invokeUntilResolved(funcs) {
    return funcs.reduce(function (previous, next) {
      return previous.catch(next);
    }, jQuery.Deferred().reject(new Error('No function specified')));
  }

};