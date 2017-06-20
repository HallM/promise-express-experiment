/*

// find all path parts split by /
dirRgx = /(\/(?:[a-z0-9._-]*(?:{(?:[a-z0-9_]+)(?:\/(?:[^/]|\\\/)+\/)?})?)*)/ig

// find all dyn parts
dynRgx = /{([a-z0-9_]+)(\/(?:[^/]|\\\/)+\/)??}/ig

// find next slash or next dyn part
dynRgx = /\/|{([a-z0-9_]+)(\/(?:[^/]|\\\/)+\/)??}/ig

*/

(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define(['./RouteNode'], factory);
  } else if (typeof exports === "object") {
    module.exports = factory(require('./routenode'));
  }
}(this, function(RouteNode) {
  'use strict'

  /* *** Public class/interface *** */

  var TrieRouter = function TrieRouter() {
    this.rootNode = new RouteNode(null, '/');
  };

  TrieRouter.prototype.add = function add(config) {
    if (!config.methods) {
      // TODO: error
      console.log('methods does not exist');
      return false;
    }
    if (!config.path || !(typeof(config.path) === 'string')) {
      // TODO: error
      console.log('path does not exist or is not a string', config.path);
      return false;
    }
    if (!config.middleware || !Array.isArray(config.middleware)) {
      // TODO: error
      console.log('middleware does not exist or is not an array of middleware');
      return false;
    }

    var methods = config.methods;
    if (!(methods instanceof Array)) {
      if (typeof(config.path) === 'string') {
        methods = [methods];
      } else {
        // TODO: error
        console.log('methods must be either an array or a string');
        return false;
      }
    }

    // console.log('adding a path', config.path);
    _addPath(this, methods, config.path, config.middleware, config.options);
  };

  TrieRouter.prototype.handle = function handle(method, path) {
    var strLength = path.length;

    if (path === '/') {
      return {params: {}, route: this.rootNode};
    }

    var i = 1;
    var nexti = 0;

    var curNode = this.rootNode;
    var lastNode = null;
    var matchStr = null;
    var dynStack = [];
    var dynStackLength = 0;
    // dynVars: {i: int, data: string}
    var dynVars = [];

    while (curNode && i < strLength) {
      /*
        if curNode has dyn, push to dynStack
        do a children count check.
        if no children, do a dyn-attempt
        if has children, do search on children
        if no match, do dyn-attempt
      */
      dynStackLength = dynStack.length;
      if (curNode.dynamicPath.length && (dynStackLength === 0 || dynStack[dynStackLength-1].node !== curNode)) {
        dynStack.push({i: i, node: curNode, j: 0});
        dynStackLength++;
      }

      var needDynCheck = false;
      if (!curNode.childrenCount) {
        needDynCheck = true;
      } else {
        curNode = curNode.binarySearch(path.charCodeAt(i));

        if (!curNode) {
          needDynCheck = true;
        } else {
          matchStr = curNode.str;
          nexti = i + matchStr.length;

          // make sure the remaining path is long enough to match, then verify the match
          if (nexti > strLength || matchStr !== path.slice(i, nexti)) {
            needDynCheck = true;
          } else {
            // always possible we reached a valid node, yet it has no middleware for the method
            if (nexti === strLength && !curNode.middleware[method]) {
              needDynCheck = true;
            } else {
              i = nexti;
            }
          }
        }
      }

      if (needDynCheck) {
        // prevents a potential infinite loop
        curNode = null;
        while (dynStackLength--) {
          var dyninfo = dynStack.pop();

          var dynnode = dyninfo.node;
          var slashPathIndex = path.indexOf('/', dyninfo.i);
          var nextPathPart = slashPathIndex === -1 ? path.slice(dyninfo.i) : path.slice(dyninfo.i, slashPathIndex);

          // check if a dyn matches
          for (var j = dyninfo.j, dyncount = dynnode.dynamicPath.length; j < dyncount; j++) {
            var dyn = dynnode.dynamicPath[j];

            if (!dyn.regex || dyn.regex.test(nextPathPart)) {
              nexti = dyninfo.i + nextPathPart.length;
              if (nexti === strLength && !dyn.middleware[method]) {
                // skip it, shouldn't try to end on one without a middleware if at all possible
                continue;
              }

              dynVars.push({i: i, data: nextPathPart});
              curNode = dyn;
              i = nexti;

              // might need to process the other dynnodes
              if (++j < dyncount) {
                dyninfo.j = j;
                dynStack.push(dyninfo);
                // no worries about adding 1 to length, it's re-computed at the top of loop
              }

              break;
            }
          }
          if (curNode) {
            break;
          }
          for (var dynvarLength = dynVars.length; dynvarLength--;) {
            if (i < dynVars[i].i) {
              dynVars.pop();
            } else {
              break;
            }
          }
          // may have to loop and try other dyn nodes
        }

        if (curNode) {
          continue;
        } else {
          return null;
        }
      }
    }

    if (i !== strLength) {
      return null;
    }

    var reqparams = {};
    if (!dynVars.length && curNode.cachedReturn) {
      return curNode.cachedReturn;
    } else if (!dynVars.length) {
      return {params: reqparams, route: curNode};
    } else {
      if (dynVars.length !== curNode.params.length) {
        // TODO: error that should never happen
        return null;
      }

      for (var dv = 0; dv < dynVars.length; dv++) {
        reqparams[curNode.params[dv]] = dynVars[dv].data;
      }
    }

    return {params: reqparams, route: curNode};
  }

  /* *** Private, internal functions *** */

  // never pass a dynamic part to this. only static parts
  function _findNodeForAdd(trie, startNode, path) {
    var result = {
      node: null,
      lastIndex: -1,
      isPartialMatch: false
    };

    var strLength = path.length;
    var rootLength = startNode.str ? startNode.str.length : 0;

    if (strLength === rootLength && path === startNode.str) {
      result.node = startNode;
      return result;
    }

    var i = rootLength;
    var nexti = 0;

    var curNode = startNode;
    var lastNode = null;
    var matchStr = null;

    while (curNode && i < strLength) {
      lastNode = curNode;
      // attempt to find a node with the same starting character
      curNode = curNode.binarySearch(path.charCodeAt(i));

      // if no node starts with the same character, we add to curNode
      if (!curNode) {
        result.node = lastNode;
        result.lastIndex = i;
        break;
      }

      matchStr = curNode.str;
      nexti = i + matchStr.length;

      // if we get here, we know at least 1 character matches. check if the whole thing matches
      // make sure the remaining path is long enough to match, then verify the match
      if (nexti > strLength || matchStr !== path.substring(i, nexti)) {
        // we don't have an exact match, so curNode needs to be split
        result.node = curNode;
        result.lastIndex = i;
        result.isPartialMatch = true;
        break;
      }

      i = nexti;

      // if we havent done the whole path...
      if (i < strLength) {
        // and if there are no more children to search...
        if (!curNode.childrenCount) {
          // then add the remainder as a child to curNode
          result.node = curNode;
          result.lastIndex = i;
          break;
        }
        // otherwise, the loop will search the children next
      } else {
        // if we have done the whole path, then we found an exact node
        result.node = curNode;
        break;
      }
    }

    return result;
  }

  function _addNodes(trie, startNode, path, options) {
    // get the parent node (or a node to split)
    var result = _findNodeForAdd(trie, startNode, path);
    var newNode = null;

    if (!result.node) {
      // theoretically, this isn't possible if canBePartial is 1. we will at least get the root
      // but defensive programming anyway
      throw new Error('Unable to determine insert point');
    }

    if (result.lastIndex === -1 || result.lastIndex >= path.length) {
      // if there was an exact match, we just return it
      return result.node;
    } else {
      // there be splittin that needs to happen
      if (result.isPartialMatch) {
        // has remaining and partial means either node.str is longer OR two strings start with some base string

        // need to find the index for each string of the first non-matching character or the end of one string
        // i1 is index of the new path
        // i2 is the index of the node's string
        var i1, i2;
        for (i1 = result.lastIndex, i2 = 0; path[i1] === result.node.str[i2] && i1 < path.length; i1++, i2++) {}

        // it's possible i1 could be at the end of path
        // i2 cannot be at the end of result.node.str
        // or i1 and i2 could just be in the middle of both strings

        /*
          we start by creating a new node to hold the remainder of result.node.str
          move the children array, middlewares, etc over.

          modify the original node to contain only the shared, base string,
          start with fresh children array, no middlewares, etc.
          add the new node as the first child.

          finally, if there's any i1 remaining, create a new node for it.
          else, just add the middleware to the now-modified "original" node.
        */

        result.node.splitNode(i2);

        if (i1 === path.length) {
          // if path had nothing remaining, then we want the original node that got split/shortened
          newNode = result.node;
        } else {
          // otherwise, we need to create a new node with the remainder of path
          newNode = new RouteNode(result.node, path.slice(i1), null);
          result.node.insertChild(newNode);
        }
      } else {
        // if there's no partial match at all, we just add a new child
        newNode = new RouteNode(result.node, path.slice(result.lastIndex), null);
        result.node.insertChild(newNode);
      }
    }

    return newNode;
  }

  function _addPath(trie, methods, path, middleware, options) {
    var node = trie.rootNode;
    var rgx = /{([a-z0-9_]+)(\/(?:[^/]|\\\/)+\/)??}/ig;
    var matchInfo = null;
    var lastIndex = 0;
    var matchIndex = 0;
    var matchLength = 0;
    var params = [];

    while ((matchInfo = rgx.exec(path)) !== null) {
      var matchIndex = matchInfo.index;
      var matchLength = matchInfo[0].length;

      // don't allow two touching dyn nodes at all
      if (matchIndex === lastIndex) {
        throw new Error('Path parameters must have at least one character in between');
      } else {
        // console.log('add node for ', path.substring(lastIndex, matchIndex));
        node = _addNodes(trie, node, path.substring(lastIndex, matchIndex), options);
      }

      var paramName = matchInfo[1];
      if (params.indexOf(paramName) !== -1) {
        throw new Error('A route cannot contain the same path parameter name more than once');
      }

      var paramRgx = matchInfo[2];
      if (paramRgx && paramRgx.length) {
        paramRgx = new RegExp(paramRgx);
      } else {
        // TODO: make up a default based on the next character
        paramRgx = null;
      }
      // console.log('add dynamic node named ', paramName);

      params.push(paramName);

      node = node.insertDynamicNode(paramRgx);

      lastIndex = matchIndex + matchLength;
    }

    // add any remaining bits
    if (lastIndex < path.length) {
      // console.log('add node for ', path.substring(lastIndex));
      node = _addNodes(trie, node, path.substring(lastIndex), options);
    }

    // not sure how this could occur, but prepared for it any way
    if (!node) {
      throw new Error('Unable to create node');
    }

    // add middleware to very last node and set params if they exists
    node.setParams(params);
    node.addMiddleware(methods, middleware);
  }

  // function nextSlashOrBrace(path, index) {
  //   const nextSlash = path.indexOf('/', index);
  //   const nextBrace = path.indexOf('{', index);

  //   console.log(nextSlash, nextBrace);
  //   if (nextSlash !== -1 && (nextBrace === -1 || nextSlash < nextBrace)) {
  //     return nextSlash;
  //   } else {
  //     return nextBrace;
  //   }
  // }

  // function _addPath(trie, methods, path, handler, options) {
  //   var lastIndex = 0;
  //   var dynIndex = 0;
  //   var endDynIndex = 0;
  //   var params = [];
  //   var node = trie.rootNode;

  //   while ((lastIndex = endDynIndex) < path.length && (dynIndex = nextSlashOrBrace(path, lastIndex)) !== -1) {
  //     // breaking dirs into their own routenodes
  //     console.log('split slash?', path[dynIndex], dynIndex);
  //     if (path[dynIndex] === '/') {
  //       node = _addNodes(trie, node, path.slice(lastIndex, dynIndex), options);
  //       endDynIndex = dynIndex + 1;
  //       continue;
  //     }

  //     // this is making sure there is a slash between the dynamic parts
  //     // TODO: I feel like this isnt necessary maybe?
  //     if (path.lastIndexOf('/', dynIndex-1) < path.lastIndexOf('{', dynIndex-1)) {
  //       // TODO: error
  //       return false;
  //     }

  //     // TODO: improve finding the end of the regex. maybe need a regex to properly handle ((())) moments
  //     // need to check for regex and where it ends to properly know the end brace in case the regex uses braces
  //     var regexSepIndex = path.indexOf('(', dynIndex + 1);
  //     var regexEndIndex = regexSepIndex === -1 ? -1 : path.indexOf(')', regexSepIndex);
  //     if (regexSepIndex !== -1 && regexEndIndex === -1) {
  //       // if there is an open to the regex, but no ending, that is an error
  //       // TODO: error
  //       return false;
  //     }

  //     endDynIndex = path.indexOf('}', regexEndIndex === -1 ? dynIndex : regexEndIndex) + 1;
  //     if (endDynIndex === 0 || !(endDynIndex === path.length || path[endDynIndex] === '/')) {
  //       // TODO: error
  //       return false;
  //     }

  //     // process the nodes leading to the DynNode
  //     node = _addNodes(trie, node, path.slice(lastIndex, dynIndex), options);
  //     if (!node) {
  //       // TODO: error
  //       return false;
  //     }

  //     // push the param name to an array
  //     var paramName = null;
  //     var regex = null;

  //     if (regexSepIndex !== -1 && regexEndIndex !== -1) {
  //       paramName = path.slice(dynIndex + 1, regexSepIndex);
  //       regex = new RegExp(path.slice(regexSepIndex + 1, regexEndIndex));
  //     } else {
  //       paramName = path.slice(dynIndex + 1, endDynIndex - 1);
  //     }
  //     // TODO: validate paramname is legit
  //     params.push(paramName);

  //     node = node.insertDynamicNode(regex);
  //   }

  //   // if there's remaining (also if there was no dyn at all), process the rest
  //   if (lastIndex < path.length) {
  //     node = _addNodes(trie, node, path.slice(lastIndex), options);
  //   }

  //   if (!node) {
  //     // TODO: error
  //     return false;
  //   }

  //   // add handler to very last node and set params if they exists
  //   node.setParams(params);
  //   node.addHandler(methods, handler);

  //   return true;
  // }

  return TrieRouter;
}));
