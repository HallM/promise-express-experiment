(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof exports === "object") {
    module.exports = factory();
  }
}(this, function() {
  'use strict'

  // Class node
  //  + chCode: integer (not set for dynamic nodes)
  //  + str: string (the path part. for dynamic nodes, this is null)
  //  + regex: regex (only set for dynamic nodes and may still be null)
  //  + children: [Node] (must be sorted for binary search)
  //  + dynamicNodes: [Node] (must be sorted where this.regex.toString().length is DESC; order of complexity)
  //  + middleware: {method: [fn(req, res, next?)]}
  function RouteNode(parent, str, regex) {
    this.str = str;
    this.regex = regex;
    this.parent = parent;
    this.chCode = str ? str.charCodeAt(0) : -1;
    this.children = [];
    // this.children = {};
    this.childrenCount = 0;
    this.dynamicPath = [];
    this.params = null;
    this.middleware = {};
    this.cachedReturn = null;
  }

  RouteNode.prototype.setParams = function(params) {
    if (!params || !params.length) {
      this.params = null;
      this.cachedReturn = {params: {}, route: this};
    } else {
      this.params = params;
    }
  };


  RouteNode.prototype.clearChildren = function() {
    this.children = [];

    // this.children = {};
    this.childrenCount = 0;
  };

  RouteNode.prototype.addMiddleware = function(methods, middleware) {
    for (var i = methods.length; i--;) {
      var method = methods[i].toLowerCase();

      if (!this.middleware[method]) {
        this.middleware[method] = Array.isArray(middleware) ? middleware.slice() : [middleware];
      } else {
        if (Array.isArray(middleware)) {
          this.middleware[method] = this.middleware[method].concat(middleware);
        } else {
          this.middleware[method].push(middleware);
        }
      }
    }
  };

  RouteNode.prototype.insertChild = function(node) {
    var i = this.children.length;
    for (;i--;) {
      if (this.children[i].chCode < node.chCode) { break; }
    }
    this.children.splice(i+1, 0, node);
    // this.children[node.chCode] = node;

    this.childrenCount++;
  };

  RouteNode.prototype.insertDynamicNode = function(regex) {
    var i = 0;
    for (; i < this.dynamicPath.length; i++) {
      var dyn = this.dynamicPath[i];

      // if there already was a node with a matching regex
      // then return that node
      if ((dyn.regex === null && regex === null) || (dyn.regex !== null && regex !== null && dyn.regex.toString() === regex.toString())) {
        return dyn;
      }

      // otherwise, try to find where to place it
      // ordering regexes based on longest first and empty would be last
      if (dyn.regex === null && regex !== null) {
        break;
      }

      if (dyn.regex !== null && regex !== null && dyn.regex.toString().length < regex.toString().length) {
        break;
      }
    }

    // add a new one if there's no match
    var newNode = new RouteNode(this, null, regex);
    this.dynamicPath.splice(i, 0, newNode);
    return newNode;
  };

  RouteNode.prototype.splitNode = function(splitLocation) {
    var i2Node = new RouteNode(this, this.str.slice(splitLocation), null);
    i2Node.children = this.children;
    i2Node.middleware = this.middleware;

    this.str = this.str.slice(0, splitLocation);
    this.clearChildren();
    this.insertChild(i2Node);
    this.middleware = {};
  };

  // chCode must also be obtained through chatCodeAt to be an int
  RouteNode.prototype.binarySearch = function(ch) {
    // return this.children[ch];

    var children = this.children;
    var lb = 0;
    var ub = children.length - 1;
    var mid = 0;
    var node = null;
    var d = 0;
    var diff = 0;

    while (true) {
      d = ub - lb;
      if (d < 0) {
        break;
      }
      mid = (d >> 1) + lb;
      node = children[mid];
      diff = node.chCode - ch;

      if (diff === 0) {
        return node;
      } else if (diff < 0) {
        lb = mid + 1;
      } else {
        ub = mid - 1;
      }
    }

    return null;
  };

  return RouteNode;
}));
