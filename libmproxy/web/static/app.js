(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var $ = require("jquery");

var ActionTypes = {
    // Connection
    CONNECTION_OPEN: "connection_open",
    CONNECTION_CLOSE: "connection_close",
    CONNECTION_ERROR: "connection_error",

    // Stores
    SETTINGS_STORE: "settings",
    EVENT_STORE: "events",
    FLOW_STORE: "flows",
};

var StoreCmds = {
    ADD: "add",
    UPDATE: "update",
    REMOVE: "remove",
    RESET: "reset"
};

var ConnectionActions = {
    open: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_OPEN
        });
    },
    close: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_CLOSE
        });
    },
    error: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_ERROR
        });
    }
};

var SettingsActions = {
    update: function (settings) {

        $.ajax({
            type: "PUT",
            url: "/settings",
            data: settings
        });

        /*
        //Facebook Flux: We do an optimistic update on the client already.
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.SETTINGS_STORE,
            cmd: StoreCmds.UPDATE,
            data: settings
        });
        */
    }
};

var EventLogActions_event_id = 0;
var EventLogActions = {
    add_event: function (message) {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.EVENT_STORE,
            cmd: StoreCmds.ADD,
            data: {
                message: message,
                level: "web",
                id: "viewAction-" + EventLogActions_event_id++
            }
        });
    }
};

var FlowActions = {
    accept: function (flow) {
        $.post("/flows/" + flow.id + "/accept");
    },
    accept_all: function(){
        $.post("/flows/accept");
    },
    "delete": function(flow){
        $.ajax({
            type:"DELETE",
            url: "/flows/" + flow.id
        });
    },
    duplicate: function(flow){
        $.post("/flows/" + flow.id + "/duplicate");
    },
    replay: function(flow){
        $.post("/flows/" + flow.id + "/replay");
    },
    revert: function(flow){
        $.post("/flows/" + flow.id + "/revert");
    },
    update: function (flow) {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.FLOW_STORE,
            cmd: StoreCmds.UPDATE,
            data: flow
        });
    },
    clear: function(){
        $.post("/clear");
    }
};

Query = {
    FILTER: "f",
    HIGHLIGHT: "h",
    SHOW_EVENTLOG: "e"
};

module.exports = {
    ActionTypes: ActionTypes,
    ConnectionActions: ConnectionActions,
    FlowActions: FlowActions,
    StoreCmds: StoreCmds
};

},{"jquery":"jquery"}],3:[function(require,module,exports){

var React = require("react");
var ReactRouter = require("react-router");
var $ = require("jquery");

var Connection = require("./connection");
var proxyapp = require("./components/proxyapp.js");

$(function () {
    window.ws = new Connection("/updates");

    ReactRouter.run(proxyapp.routes, function (Handler) {
        React.render(React.createElement(Handler, null), document.body);
    });
});



},{"./components/proxyapp.js":12,"./connection":14,"jquery":"jquery","react":"react","react-router":"react-router"}],4:[function(require,module,exports){
var React = require("react");
var ReactRouter = require("react-router");
var _ = require("lodash");

// http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html (also contains inverse example)
var AutoScrollMixin = {
    componentWillUpdate: function () {
        var node = this.getDOMNode();
        this._shouldScrollBottom = (
            node.scrollTop !== 0 &&
            node.scrollTop + node.clientHeight === node.scrollHeight
        );
    },
    componentDidUpdate: function () {
        if (this._shouldScrollBottom) {
            var node = this.getDOMNode();
            node.scrollTop = node.scrollHeight;
        }
    },
};


var StickyHeadMixin = {
    adjustHead: function () {
        // Abusing CSS transforms to set the element
        // referenced as head into some kind of position:sticky.
        var head = this.refs.head.getDOMNode();
        head.style.transform = "translate(0," + this.getDOMNode().scrollTop + "px)";
    }
};


var Navigation = _.extend({}, ReactRouter.Navigation, {
    setQuery: function (dict) {
        var q = this.context.getCurrentQuery();
        for(var i in dict){
            if(dict.hasOwnProperty(i)){
                q[i] = dict[i] || undefined; //falsey values shall be removed.
            }
        }
        q._ = "_"; // workaround for https://github.com/rackt/react-router/pull/599
        this.replaceWith(this.context.getCurrentPath(), this.context.getCurrentParams(), q);
    },
    replaceWith: function(routeNameOrPath, params, query) {
        if(routeNameOrPath === undefined){
            routeNameOrPath = this.context.getCurrentPath();
        }
        if(params === undefined){
            params = this.context.getCurrentParams();
        }
        if(query === undefined){
            query = this.context.getCurrentQuery();
        }
        ReactRouter.Navigation.replaceWith.call(this, routeNameOrPath, params, query);
    }
});
_.extend(Navigation.contextTypes, ReactRouter.State.contextTypes);

var State = _.extend({}, ReactRouter.State, {
    getInitialState: function () {
        this._query = this.context.getCurrentQuery();
        this._queryWatches = [];
        return null;
    },
    onQueryChange: function (key, callback) {
        this._queryWatches.push({
            key: key,
            callback: callback
        });
    },
    componentWillReceiveProps: function (nextProps, nextState) {
        var q = this.context.getCurrentQuery();
        for (var i = 0; i < this._queryWatches.length; i++) {
            var watch = this._queryWatches[i];
            if (this._query[watch.key] !== q[watch.key]) {
                watch.callback(this._query[watch.key], q[watch.key], watch.key);
            }
        }
        this._query = q;
    }
});

var Splitter = React.createClass({displayName: "Splitter",
    getDefaultProps: function () {
        return {
            axis: "x"
        };
    },
    getInitialState: function () {
        return {
            applied: false,
            startX: false,
            startY: false
        };
    },
    onMouseDown: function (e) {
        this.setState({
            startX: e.pageX,
            startY: e.pageY
        });
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
        // Occasionally, only a dragEnd event is triggered, but no mouseUp.
        window.addEventListener("dragend", this.onDragEnd);
    },
    onDragEnd: function () {
        this.getDOMNode().style.transform = "";
        window.removeEventListener("dragend", this.onDragEnd);
        window.removeEventListener("mouseup", this.onMouseUp);
        window.removeEventListener("mousemove", this.onMouseMove);
    },
    onMouseUp: function (e) {
        this.onDragEnd();

        var node = this.getDOMNode();
        var prev = node.previousElementSibling;
        var next = node.nextElementSibling;

        var dX = e.pageX - this.state.startX;
        var dY = e.pageY - this.state.startY;
        var flexBasis;
        if (this.props.axis === "x") {
            flexBasis = prev.offsetWidth + dX;
        } else {
            flexBasis = prev.offsetHeight + dY;
        }

        prev.style.flex = "0 0 " + Math.max(0, flexBasis) + "px";
        next.style.flex = "1 1 auto";

        this.setState({
            applied: true
        });
        this.onResize();
    },
    onMouseMove: function (e) {
        var dX = 0, dY = 0;
        if (this.props.axis === "x") {
            dX = e.pageX - this.state.startX;
        } else {
            dY = e.pageY - this.state.startY;
        }
        this.getDOMNode().style.transform = "translate(" + dX + "px," + dY + "px)";
    },
    onResize: function () {
        // Trigger a global resize event. This notifies components that employ virtual scrolling
        // that their viewport may have changed.
        window.setTimeout(function () {
            window.dispatchEvent(new CustomEvent("resize"));
        }, 1);
    },
    reset: function (willUnmount) {
        if (!this.state.applied) {
            return;
        }
        var node = this.getDOMNode();
        var prev = node.previousElementSibling;
        var next = node.nextElementSibling;

        prev.style.flex = "";
        next.style.flex = "";

        if (!willUnmount) {
            this.setState({
                applied: false
            });
        }
        this.onResize();
    },
    componentWillUnmount: function () {
        this.reset(true);
    },
    render: function () {
        var className = "splitter";
        if (this.props.axis === "x") {
            className += " splitter-x";
        } else {
            className += " splitter-y";
        }
        return (
            React.createElement("div", {className: className}, 
                React.createElement("div", {onMouseDown: this.onMouseDown, draggable: "true"})
            )
        );
    }
});

module.exports = {
    State: State,
    Navigation: Navigation,
    StickyHeadMixin: StickyHeadMixin,
    AutoScrollMixin: AutoScrollMixin,
    Splitter: Splitter
}

},{"lodash":"lodash","react":"react","react-router":"react-router"}],5:[function(require,module,exports){
var React = require("react");
var common = require("./common.js");
var VirtualScrollMixin = require("./virtualscroll.js");
var views = require("../store/view.js");

var LogMessage = React.createClass({displayName: "LogMessage",
    render: function () {
        var entry = this.props.entry;
        var indicator;
        switch (entry.level) {
            case "web":
                indicator = React.createElement("i", {className: "fa fa-fw fa-html5"});
                break;
            case "debug":
                indicator = React.createElement("i", {className: "fa fa-fw fa-bug"});
                break;
            default:
                indicator = React.createElement("i", {className: "fa fa-fw fa-info"});
        }
        return (
            React.createElement("div", null, 
                indicator, " ", entry.message
            )
        );
    },
    shouldComponentUpdate: function () {
        return false; // log entries are immutable.
    }
});

var EventLogContents = React.createClass({displayName: "EventLogContents",
    mixins: [common.AutoScrollMixin, VirtualScrollMixin],
    getInitialState: function () {
        return {
            log: []
        };
    },
    componentWillMount: function () {
        this.openView(this.props.eventStore);
    },
    componentWillUnmount: function () {
        this.closeView();
    },
    openView: function (store) {
        var view = new views.StoreView(store, function (entry) {
            return this.props.filter[entry.level];
        }.bind(this));
        this.setState({
            view: view
        });

        view.addListener("add recalculate", this.onEventLogChange);
    },
    closeView: function () {
        this.state.view.close();
    },
    onEventLogChange: function () {
        this.setState({
            log: this.state.view.list
        });
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.filter !== this.props.filter) {
            this.props.filter = nextProps.filter; // Dirty: Make sure that view filter sees the update.
            this.state.view.recalculate();
        }
        if (nextProps.eventStore !== this.props.eventStore) {
            this.closeView();
            this.openView(nextProps.eventStore);
        }
    },
    getDefaultProps: function () {
        return {
            rowHeight: 45,
            rowHeightMin: 15,
            placeholderTagName: "div"
        };
    },
    renderRow: function (elem) {
        return React.createElement(LogMessage, {key: elem.id, entry: elem});
    },
    render: function () {
        var rows = this.renderRows(this.state.log);

        return React.createElement("pre", {onScroll: this.onScroll}, 
             this.getPlaceholderTop(this.state.log.length), 
            rows, 
             this.getPlaceholderBottom(this.state.log.length) 
        );
    }
});

var ToggleFilter = React.createClass({displayName: "ToggleFilter",
    toggle: function (e) {
        e.preventDefault();
        return this.props.toggleLevel(this.props.name);
    },
    render: function () {
        var className = "label ";
        if (this.props.active) {
            className += "label-primary";
        } else {
            className += "label-default";
        }
        return (
            React.createElement("a", {
                href: "#", 
                className: className, 
                onClick: this.toggle}, 
                this.props.name
            )
        );
    }
});

var EventLog = React.createClass({displayName: "EventLog",
    getInitialState: function () {
        return {
            filter: {
                "debug": false,
                "info": true,
                "web": true
            }
        };
    },
    close: function () {
        var d = {};
        d[Query.SHOW_EVENTLOG] = undefined;
        this.setQuery(d);
    },
    toggleLevel: function (level) {
        var filter = _.extend({}, this.state.filter);
        filter[level] = !filter[level];
        this.setState({filter: filter});
    },
    render: function () {
        return (
            React.createElement("div", {className: "eventlog"}, 
                React.createElement("div", null, 
                    "Eventlog", 
                    React.createElement("div", {className: "pull-right"}, 
                        React.createElement(ToggleFilter, {name: "debug", active: this.state.filter.debug, toggleLevel: this.toggleLevel}), 
                        React.createElement(ToggleFilter, {name: "info", active: this.state.filter.info, toggleLevel: this.toggleLevel}), 
                        React.createElement(ToggleFilter, {name: "web", active: this.state.filter.web, toggleLevel: this.toggleLevel}), 
                        React.createElement("i", {onClick: this.close, className: "fa fa-close"})
                    )

                ), 
                React.createElement(EventLogContents, {filter: this.state.filter, eventStore: this.props.eventStore})
            )
        );
    }
});

module.exports = EventLog;

},{"../store/view.js":19,"./common.js":4,"./virtualscroll.js":13,"react":"react"}],6:[function(require,module,exports){
var React = require("react");
var _ = require("lodash");

var common = require("./common.js");
var actions = require("../actions.js");
var flowutils = require("../flow/utils.js");
var toputils = require("../utils.js");

var NavAction = React.createClass({displayName: "NavAction",
    onClick: function (e) {
        e.preventDefault();
        this.props.onClick();
    },
    render: function () {
        return (
            React.createElement("a", {title: this.props.title, 
                href: "#", 
                className: "nav-action", 
                onClick: this.onClick}, 
                React.createElement("i", {className: "fa fa-fw " + this.props.icon})
            )
        );
    }
});

var FlowDetailNav = React.createClass({displayName: "FlowDetailNav",
    render: function () {
        var flow = this.props.flow;

        var tabs = this.props.tabs.map(function (e) {
            var str = e.charAt(0).toUpperCase() + e.slice(1);
            var className = this.props.active === e ? "active" : "";
            var onClick = function (event) {
                this.props.selectTab(e);
                event.preventDefault();
            }.bind(this);
            return React.createElement("a", {key: e, 
                href: "#", 
                className: className, 
                onClick: onClick}, str);
        }.bind(this));

        var acceptButton = null;
        if(flow.intercepted){
            acceptButton = React.createElement(NavAction, {title: "[a]ccept intercepted flow", icon: "fa-play", onClick: actions.FlowActions.accept.bind(null, flow)});
        }
        var revertButton = null;
        if(flow.modified){
            revertButton = React.createElement(NavAction, {title: "revert changes to flow [V]", icon: "fa-history", onClick: actions.FlowActions.revert.bind(null, flow)});
        }

        return (
            React.createElement("nav", {ref: "head", className: "nav-tabs nav-tabs-sm"}, 
                tabs, 
                React.createElement(NavAction, {title: "[d]elete flow", icon: "fa-trash", onClick: actions.FlowActions.delete.bind(null, flow)}), 
                React.createElement(NavAction, {title: "[D]uplicate flow", icon: "fa-copy", onClick: actions.FlowActions.duplicate.bind(null, flow)}), 
                React.createElement(NavAction, {disabled: true, title: "[r]eplay flow", icon: "fa-repeat", onClick: actions.FlowActions.replay.bind(null, flow)}), 
                acceptButton, 
                revertButton
            )
        );
    }
});



var Headers = React.createClass({displayName: "Headers",
    render: function () {
        var rows = this.props.message.headers.map(function (header, i) {
            return (
                React.createElement("tr", {key: i}, 
                    React.createElement("td", {className: "header-name"}, header[0] + ":"), 
                    React.createElement("td", {className: "header-value"}, header[1])
                )
            );
        });
        return (
            React.createElement("table", {className: "header-table"}, 
                React.createElement("tbody", null, 
                    rows
                )
            )
        );
    }
});

var FlowDetailRequest = React.createClass({displayName: "FlowDetailRequest",
    render: function () {
        var flow = this.props.flow;
        var first_line = [
            flow.request.method,
            flowutils.RequestUtils.pretty_url(flow.request),
            "HTTP/" + flow.request.httpversion.join(".")
        ].join(" ");
        var content = null;
	var contentUrl = "/flows/" + flow.id + "/request/content";
	var printableContentUrl = contentUrl + "/printable";

        if (flow.request.contentLength > 0) {
	    content = 
		React.createElement("section", null, 
  		  React.createElement("a", {href: contentUrl, target: "new"}, "Download"), 
		  React.createElement("iframe", {src: printableContentUrl, width: "100%"})
		);
        } else {
            content = React.createElement("div", {className: "alert alert-info"}, "No Content");
        }

        //TODO: Styling

        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "first-line"}, first_line ), 
                React.createElement(Headers, {message: flow.request}), 
                React.createElement("hr", null), 
                content
            )
        );
    }
});


var FlowDetailResponse = React.createClass({displayName: "FlowDetailResponse",
    render: function () {
        var flow = this.props.flow;
        var first_line = [
            "HTTP/" + flow.response.httpversion.join("."),
            flow.response.code,
            flow.response.msg
        ].join(" ");
        var content = null;
	var isPrintable = flowutils.ResponseUtils.isPrintable(flow.response);
	var contentUrl = "/flows/" + flow.id + "/response/content";
	var printableContentUrl = contentUrl + "/printable";

        if (flow.response.contentLength > 0) {
	    if (isPrintable) {
		content = 
		    React.createElement("section", null, 
		      React.createElement("a", {href: contentUrl, target: "new"}, "Download"), 
	              React.createElement("iframe", {src: printableContentUrl, width: "100%"})
		    );
		} else {
		    content = 
			React.createElement("section", null, 
			  "\"Response Content Size: \" + toputils.formatSize(flow.response.contentLength);", 
			  React.createElement("a", {href: contentUrl, target: "new"}, "Download")
		        )
		}
        } else {
            content = React.createElement("div", {className: "alert alert-info"}, "No Content");
        }

        //TODO: Styling

        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "first-line"}, first_line ), 
                React.createElement(Headers, {message: flow.response}), 
                React.createElement("hr", null), 
                content
            )
        );
    }
});

var FlowDetailError = React.createClass({displayName: "FlowDetailError",
    render: function () {
        var flow = this.props.flow;
        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "alert alert-warning"}, 
                flow.error.msg, 
                    React.createElement("div", null, 
                        React.createElement("small", null,  toputils.formatTimeStamp(flow.error.timestamp) )
                    )
                )
            )
        );
    }
});

var TimeStamp = React.createClass({displayName: "TimeStamp",
    render: function () {

        if (!this.props.t) {
            //should be return null, but that triggers a React bug.
            return React.createElement("tr", null);
        }

        var ts = toputils.formatTimeStamp(this.props.t);

        var delta;
        if (this.props.deltaTo) {
            delta = toputils.formatTimeDelta(1000 * (this.props.t - this.props.deltaTo));
            delta = React.createElement("span", {className: "text-muted"}, "(" + delta + ")");
        } else {
            delta = null;
        }

        return React.createElement("tr", null, 
            React.createElement("td", null, this.props.title + ":"), 
            React.createElement("td", null, ts, " ", delta)
        );
    }
});

var ConnectionInfo = React.createClass({displayName: "ConnectionInfo",

    render: function () {
        var conn = this.props.conn;
        var address = conn.address.address.join(":");

        var sni = React.createElement("tr", {key: "sni"}); //should be null, but that triggers a React bug.
        if (conn.sni) {
            sni = React.createElement("tr", {key: "sni"}, 
                React.createElement("td", null, 
                    React.createElement("abbr", {title: "TLS Server Name Indication"}, "TLS SNI:")
                ), 
                React.createElement("td", null, conn.sni)
            );
        }
        return (
            React.createElement("table", {className: "connection-table"}, 
                React.createElement("tbody", null, 
                    React.createElement("tr", {key: "address"}, 
                        React.createElement("td", null, "Address:"), 
                        React.createElement("td", null, address)
                    ), 
                    sni
                )
            )
        );
    }
});

var CertificateInfo = React.createClass({displayName: "CertificateInfo",
    render: function () {
        //TODO: We should fetch human-readable certificate representation
        // from the server
        var flow = this.props.flow;
        var client_conn = flow.client_conn;
        var server_conn = flow.server_conn;

        var preStyle = {maxHeight: 100};
        return (
            React.createElement("div", null, 
            client_conn.cert ? React.createElement("h4", null, "Client Certificate") : null, 
            client_conn.cert ? React.createElement("pre", {style: preStyle}, client_conn.cert) : null, 

            server_conn.cert ? React.createElement("h4", null, "Server Certificate") : null, 
            server_conn.cert ? React.createElement("pre", {style: preStyle}, server_conn.cert) : null
            )
        );
    }
});

var Timing = React.createClass({displayName: "Timing",
    render: function () {
        var flow = this.props.flow;
        var sc = flow.server_conn;
        var cc = flow.client_conn;
        var req = flow.request;
        var resp = flow.response;

        var timestamps = [
            {
                title: "Server conn. initiated",
                t: sc.timestamp_start,
                deltaTo: req.timestamp_start
            }, {
                title: "Server conn. TCP handshake",
                t: sc.timestamp_tcp_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "Server conn. SSL handshake",
                t: sc.timestamp_ssl_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "Client conn. established",
                t: cc.timestamp_start,
                deltaTo: req.timestamp_start
            }, {
                title: "Client conn. SSL handshake",
                t: cc.timestamp_ssl_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "First request byte",
                t: req.timestamp_start,
            }, {
                title: "Request complete",
                t: req.timestamp_end,
                deltaTo: req.timestamp_start
            }
        ];

        if (flow.response) {
            timestamps.push(
                {
                    title: "First response byte",
                    t: resp.timestamp_start,
                    deltaTo: req.timestamp_start
                }, {
                    title: "Response complete",
                    t: resp.timestamp_end,
                    deltaTo: req.timestamp_start
                }
            );
        }

        //Add unique key for each row.
        timestamps.forEach(function (e) {
            e.key = e.title;
        });

        timestamps = _.sortBy(timestamps, 't');

        var rows = timestamps.map(function (e) {
            return React.createElement(TimeStamp, React.__spread({},  e));
        });

        return (
            React.createElement("div", null, 
                React.createElement("h4", null, "Timing"), 
                React.createElement("table", {className: "timing-table"}, 
                    React.createElement("tbody", null, 
                    rows
                    )
                )
            )
        );
    }
});

var FlowDetailConnectionInfo = React.createClass({displayName: "FlowDetailConnectionInfo",
    render: function () {
        var flow = this.props.flow;
        var client_conn = flow.client_conn;
        var server_conn = flow.server_conn;
        return (
            React.createElement("section", null, 

                React.createElement("h4", null, "Client Connection"), 
                React.createElement(ConnectionInfo, {conn: client_conn}), 

                React.createElement("h4", null, "Server Connection"), 
                React.createElement(ConnectionInfo, {conn: server_conn}), 

                React.createElement(CertificateInfo, {flow: flow}), 

                React.createElement(Timing, {flow: flow})

            )
        );
    }
});

var allTabs = {
    request: FlowDetailRequest,
    response: FlowDetailResponse,
    error: FlowDetailError,
    details: FlowDetailConnectionInfo
};

var FlowDetail = React.createClass({displayName: "FlowDetail",
    mixins: [common.StickyHeadMixin, common.Navigation, common.State],
    getTabs: function (flow) {
        var tabs = [];
        ["request", "response", "error"].forEach(function (e) {
            if (flow[e]) {
                tabs.push(e);
            }
        });
        tabs.push("details");
        return tabs;
    },
    nextTab: function (i) {
        var tabs = this.getTabs(this.props.flow);
        var currentIndex = tabs.indexOf(this.getParams().detailTab);
        // JS modulo operator doesn't correct negative numbers, make sure that we are positive.
        var nextIndex = (currentIndex + i + tabs.length) % tabs.length;
        this.selectTab(tabs[nextIndex]);
    },
    selectTab: function (panel) {
        this.replaceWith(
            "flow",
            {
                flowId: this.getParams().flowId,
                detailTab: panel
            }
        );
    },
    render: function () {
        var flow = this.props.flow;
        var tabs = this.getTabs(flow);
        var active = this.getParams().detailTab;

        if (!_.contains(tabs, active)) {
            if (active === "response" && flow.error) {
                active = "error";
            } else if (active === "error" && flow.response) {
                active = "response";
            } else {
                active = tabs[0];
            }
            this.selectTab(active);
        }

        var Tab = allTabs[active];
        return (
            React.createElement("div", {className: "flow-detail", onScroll: this.adjustHead}, 
                React.createElement(FlowDetailNav, {ref: "head", 
                    flow: flow, 
                    tabs: tabs, 
                    active: active, 
                    selectTab: this.selectTab}), 
                React.createElement(Tab, {flow: flow})
            )
        );
    }
});

module.exports = {
    FlowDetail: FlowDetail
};


},{"../actions.js":2,"../flow/utils.js":17,"../utils.js":20,"./common.js":4,"lodash":"lodash","react":"react"}],7:[function(require,module,exports){
var React = require("react");
var flowutils = require("../flow/utils.js");
var utils = require("../utils.js");

var TLSColumn = React.createClass({displayName: "TLSColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "tls", className: "col-tls"});
        }
    },
    render: function () {
        var flow = this.props.flow;
        var ssl = (flow.request.scheme == "https");
        var classes;
        if (ssl) {
            classes = "col-tls col-tls-https";
        } else {
            classes = "col-tls col-tls-http";
        }
        return React.createElement("td", {className: classes});
    }
});


var IconColumn = React.createClass({displayName: "IconColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "icon", className: "col-icon"});
        }
    },
    render: function () {
        var flow = this.props.flow;

        var icon;
        if (flow.response) {
            var contentType = flowutils.ResponseUtils.getContentType(flow.response);

            //TODO: We should assign a type to the flow somewhere else.
            if (flow.response.code == 304) {
                icon = "resource-icon-not-modified";
            } else if (300 <= flow.response.code && flow.response.code < 400) {
                icon = "resource-icon-redirect";
            } else if (contentType && contentType.indexOf("image") >= 0) {
                icon = "resource-icon-image";
            } else if (contentType && contentType.indexOf("javascript") >= 0) {
                icon = "resource-icon-js";
            } else if (contentType && contentType.indexOf("css") >= 0) {
                icon = "resource-icon-css";
            } else if (contentType && contentType.indexOf("html") >= 0) {
                icon = "resource-icon-document";
            }
        }
        if (!icon) {
            icon = "resource-icon-plain";
        }


        icon += " resource-icon";
        return React.createElement("td", {className: "col-icon"}, 
            React.createElement("div", {className: icon})
        );
    }
});

var PathColumn = React.createClass({displayName: "PathColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "path", className: "col-path"}, "Path");
        }
    },
    render: function () {
        var flow = this.props.flow;
        return React.createElement("td", {className: "col-path"}, 
            flow.request.is_replay ? React.createElement("i", {className: "fa fa-fw fa-repeat pull-right"}) : null, 
            flow.intercepted ? React.createElement("i", {className: "fa fa-fw fa-pause pull-right"}) : null, 
            flow.request.scheme + "://" + flow.request.host + flow.request.path
        );
    }
});


var MethodColumn = React.createClass({displayName: "MethodColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "method", className: "col-method"}, "Method");
        }
    },
    render: function () {
        var flow = this.props.flow;
        return React.createElement("td", {className: "col-method"}, flow.request.method);
    }
});


var StatusColumn = React.createClass({displayName: "StatusColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "status", className: "col-status"}, "Status");
        }
    },
    render: function () {
        var flow = this.props.flow;
        var status;
        if (flow.response) {
            status = flow.response.code;
        } else {
            status = null;
        }
        return React.createElement("td", {className: "col-status"}, status);
    }
});


var SizeColumn = React.createClass({displayName: "SizeColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "size", className: "col-size"}, "Size");
        }
    },
    render: function () {
        var flow = this.props.flow;

        var total = flow.request.contentLength;
        if (flow.response) {
            total += flow.response.contentLength || 0;
        }
        var size = utils.formatSize(total);
        return React.createElement("td", {className: "col-size"}, size);
    }
});


var TimeColumn = React.createClass({displayName: "TimeColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "time", className: "col-time"}, "Time");
        }
    },
    render: function () {
        var flow = this.props.flow;
        var time;
        if (flow.response) {
            time = utils.formatTimeDelta(1000 * (flow.response.timestamp_end - flow.request.timestamp_start));
        } else {
            time = "...";
        }
        return React.createElement("td", {className: "col-time"}, time);
    }
});


var all_columns = [
    TLSColumn,
    IconColumn,
    PathColumn,
    MethodColumn,
    StatusColumn,
    SizeColumn,
    TimeColumn];


module.exports = all_columns;




},{"../flow/utils.js":17,"../utils.js":20,"react":"react"}],8:[function(require,module,exports){
var React = require("react");
var common = require("./common.js");
var VirtualScrollMixin = require("./virtualscroll.js");
var flowtable_columns = require("./flowtable-columns.js");

var FlowRow = React.createClass({displayName: "FlowRow",
    render: function () {
        var flow = this.props.flow;
        var columns = this.props.columns.map(function (Column) {
            return React.createElement(Column, {key: Column.displayName, flow: flow});
        }.bind(this));
        var className = "";
        if (this.props.selected) {
            className += " selected";
        }
        if (this.props.highlighted) {
            className += " highlighted";
        }
        if (flow.intercepted) {
            className += " intercepted";
        }
        if (flow.request) {
            className += " has-request";
        }
        if (flow.response) {
            className += " has-response";
        }

        return (
            React.createElement("tr", {className: className, onClick: this.props.selectFlow.bind(null, flow)}, 
                columns
            ));
    },
    shouldComponentUpdate: function (nextProps) {
        return true;
        // Further optimization could be done here
        // by calling forceUpdate on flow updates, selection changes and column changes.
        //return (
        //(this.props.columns.length !== nextProps.columns.length) ||
        //(this.props.selected !== nextProps.selected)
        //);
    }
});

var FlowTableHead = React.createClass({displayName: "FlowTableHead",
    render: function () {
        var columns = this.props.columns.map(function (column) {
            return column.renderTitle();
        }.bind(this));
        return React.createElement("thead", null, 
            React.createElement("tr", null, columns)
        );
    }
});


var ROW_HEIGHT = 32;

var FlowTable = React.createClass({displayName: "FlowTable",
    mixins: [common.StickyHeadMixin, common.AutoScrollMixin, VirtualScrollMixin],
    getInitialState: function () {
        return {
            columns: flowtable_columns
        };
    },
    componentWillMount: function () {
        if (this.props.view) {
            this.props.view.addListener("add update remove recalculate", this.onChange);
        }
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.view !== this.props.view) {
            if (this.props.view) {
                this.props.view.removeListener("add update remove recalculate");
            }
            nextProps.view.addListener("add update remove recalculate", this.onChange);
        }
    },
    getDefaultProps: function () {
        return {
            rowHeight: ROW_HEIGHT
        };
    },
    onScrollFlowTable: function () {
        this.adjustHead();
        this.onScroll();
    },
    onChange: function () {
        this.forceUpdate();
    },
    scrollIntoView: function (flow) {
        this.scrollRowIntoView(
            this.props.view.index(flow),
            this.refs.body.getDOMNode().offsetTop
        );
    },
    renderRow: function (flow) {
        var selected = (flow === this.props.selected);
        var highlighted =
            (
            this.props.view._highlight &&
            this.props.view._highlight[flow.id]
            );

        return React.createElement(FlowRow, {key: flow.id, 
            ref: flow.id, 
            flow: flow, 
            columns: this.state.columns, 
            selected: selected, 
            highlighted: highlighted, 
            selectFlow: this.props.selectFlow}
        );
    },
    render: function () {
        //console.log("render flowtable", this.state.start, this.state.stop, this.props.selected);
        var flows = this.props.view ? this.props.view.list : [];

        var rows = this.renderRows(flows);

        return (
            React.createElement("div", {className: "flow-table", onScroll: this.onScrollFlowTable}, 
                React.createElement("table", null, 
                    React.createElement(FlowTableHead, {ref: "head", 
                        columns: this.state.columns}), 
                    React.createElement("tbody", {ref: "body"}, 
                         this.getPlaceholderTop(flows.length), 
                        rows, 
                         this.getPlaceholderBottom(flows.length) 
                    )
                )
            )
        );
    }
});

module.exports = FlowTable;


},{"./common.js":4,"./flowtable-columns.js":7,"./virtualscroll.js":13,"react":"react"}],9:[function(require,module,exports){
var React = require("react");

var Footer = React.createClass({displayName: "Footer",
    render: function () {
        var mode = this.props.settings.mode;
        var intercept = this.props.settings.intercept;
        return (
            React.createElement("footer", null, 
                mode != "regular" ? React.createElement("span", {className: "label label-success"}, mode, " mode") : null, 
                " ", 
                intercept ? React.createElement("span", {className: "label label-success"}, "Intercept: ", intercept) : null
            )
        );
    }
});

module.exports = Footer;

},{"react":"react"}],10:[function(require,module,exports){
var React = require("react");
var $ = require("jquery");

var Filt = require("../filt/filt.js");
var utils = require("../utils.js");

var common = require("./common.js");

var FilterDocs = React.createClass({displayName: "FilterDocs",
    statics: {
        xhr: false,
        doc: false
    },
    componentWillMount: function () {
        if (!FilterDocs.doc) {
            FilterDocs.xhr = $.getJSON("/filter-help").done(function (doc) {
                FilterDocs.doc = doc;
                FilterDocs.xhr = false;
            });
        }
        if (FilterDocs.xhr) {
            FilterDocs.xhr.done(function () {
                this.forceUpdate();
            }.bind(this));
        }
    },
    render: function () {
        if (!FilterDocs.doc) {
            return React.createElement("i", {className: "fa fa-spinner fa-spin"});
        } else {
            var commands = FilterDocs.doc.commands.map(function (c) {
                return React.createElement("tr", null, 
                    React.createElement("td", null, c[0].replace(" ", '\u00a0')), 
                    React.createElement("td", null, c[1])
                );
            });
            commands.push(React.createElement("tr", null, 
                React.createElement("td", {colSpan: "2"}, 
                    React.createElement("a", {href: "https://mitmproxy.org/doc/features/filters.html", 
                        target: "_blank"}, 
                        React.createElement("i", {className: "fa fa-external-link"}), 
                    "  mitmproxy docs")
                )
            ));
            return React.createElement("table", {className: "table table-condensed"}, 
                React.createElement("tbody", null, commands)
            );
        }
    }
});
var FilterInput = React.createClass({displayName: "FilterInput",
    getInitialState: function () {
        // Consider both focus and mouseover for showing/hiding the tooltip,
        // because onBlur of the input is triggered before the click on the tooltip
        // finalized, hiding the tooltip just as the user clicks on it.
        return {
            value: this.props.value,
            focus: false,
            mousefocus: false
        };
    },
    componentWillReceiveProps: function (nextProps) {
        this.setState({value: nextProps.value});
    },
    onChange: function (e) {
        var nextValue = e.target.value;
        this.setState({
            value: nextValue
        });
        // Only propagate valid filters upwards.
        if (this.isValid(nextValue)) {
            this.props.onChange(nextValue);
        }
    },
    isValid: function (filt) {
        try {
            Filt.parse(filt || this.state.value);
            return true;
        } catch (e) {
            return false;
        }
    },
    getDesc: function () {
        var desc;
        try {
            desc = Filt.parse(this.state.value).desc;
        } catch (e) {
            desc = "" + e;
        }
        if (desc !== "true") {
            return desc;
        } else {
            return (
                React.createElement(FilterDocs, null)
            );
        }
    },
    onFocus: function () {
        this.setState({focus: true});
    },
    onBlur: function () {
        this.setState({focus: false});
    },
    onMouseEnter: function () {
        this.setState({mousefocus: true});
    },
    onMouseLeave: function () {
        this.setState({mousefocus: false});
    },
    onKeyDown: function (e) {
        if (e.keyCode === utils.Key.ESC || e.keyCode === utils.Key.ENTER) {
            this.blur();
            // If closed using ESC/ENTER, hide the tooltip.
            this.setState({mousefocus: false});
        }
    },
    blur: function () {
        this.refs.input.getDOMNode().blur();
    },
    focus: function () {
        this.refs.input.getDOMNode().select();
    },
    render: function () {
        var isValid = this.isValid();
        var icon = "fa fa-fw fa-" + this.props.type;
        var groupClassName = "filter-input input-group" + (isValid ? "" : " has-error");

        var popover;
        if (this.state.focus || this.state.mousefocus) {
            popover = (
                React.createElement("div", {className: "popover bottom", onMouseEnter: this.onMouseEnter, onMouseLeave: this.onMouseLeave}, 
                    React.createElement("div", {className: "arrow"}), 
                    React.createElement("div", {className: "popover-content"}, 
                    this.getDesc()
                    )
                )
            );
        }

        return (
            React.createElement("div", {className: groupClassName}, 
                React.createElement("span", {className: "input-group-addon"}, 
                    React.createElement("i", {className: icon, style: {color: this.props.color}})
                ), 
                React.createElement("input", {type: "text", placeholder: this.props.placeholder, className: "form-control", 
                    ref: "input", 
                    onChange: this.onChange, 
                    onFocus: this.onFocus, 
                    onBlur: this.onBlur, 
                    onKeyDown: this.onKeyDown, 
                    value: this.state.value}), 
                popover
            )
        );
    }
});

var MainMenu = React.createClass({displayName: "MainMenu",
    mixins: [common.Navigation, common.State],
    statics: {
        title: "Start",
        route: "flows"
    },
    onFilterChange: function (val) {
        var d = {};
        d[Query.FILTER] = val;
        this.setQuery(d);
    },
    onHighlightChange: function (val) {
        var d = {};
        d[Query.HIGHLIGHT] = val;
        this.setQuery(d);
    },
    onInterceptChange: function (val) {
        SettingsActions.update({intercept: val});
    },
    render: function () {
        var filter = this.getQuery()[Query.FILTER] || "";
        var highlight = this.getQuery()[Query.HIGHLIGHT] || "";
        var intercept = this.props.settings.intercept || "";

        return (
            React.createElement("div", null, 
                React.createElement("div", {className: "menu-row"}, 
                    React.createElement(FilterInput, {
                        placeholder: "Filter", 
                        type: "filter", 
                        color: "black", 
                        value: filter, 
                        onChange: this.onFilterChange}), 
                    React.createElement(FilterInput, {
                        placeholder: "Highlight", 
                        type: "tag", 
                        color: "hsl(48, 100%, 50%)", 
                        value: highlight, 
                        onChange: this.onHighlightChange}), 
                    React.createElement(FilterInput, {
                        placeholder: "Intercept", 
                        type: "pause", 
                        color: "hsl(208, 56%, 53%)", 
                        value: intercept, 
                        onChange: this.onInterceptChange})
                ), 
                React.createElement("div", {className: "clearfix"})
            )
        );
    }
});


var ViewMenu = React.createClass({displayName: "ViewMenu",
    statics: {
        title: "View",
        route: "flows"
    },
    mixins: [common.Navigation, common.State],
    toggleEventLog: function () {
        var d = {};

        if (this.getQuery()[Query.SHOW_EVENTLOG]) {
            d[Query.SHOW_EVENTLOG] = undefined;
        } else {
            d[Query.SHOW_EVENTLOG] = "t"; // any non-false value will do it, keep it short
        }

        this.setQuery(d);
    },
    render: function () {
        var showEventLog = this.getQuery()[Query.SHOW_EVENTLOG];
        return (
            React.createElement("div", null, 
                React.createElement("button", {
                    className: "btn " + (showEventLog ? "btn-primary" : "btn-default"), 
                    onClick: this.toggleEventLog}, 
                    React.createElement("i", {className: "fa fa-database"}), 
                " Show Eventlog"
                ), 
                React.createElement("span", null, " ")
            )
        );
    }
});


var ReportsMenu = React.createClass({displayName: "ReportsMenu",
    statics: {
        title: "Visualization",
        route: "reports"
    },
    render: function () {
        return React.createElement("div", null, "Reports Menu");
    }
});

var FileMenu = React.createClass({displayName: "FileMenu",
    getInitialState: function () {
        return {
            showFileMenu: false
        };
    },
    handleFileClick: function (e) {
        e.preventDefault();
        if (!this.state.showFileMenu) {
            var close = function () {
                this.setState({showFileMenu: false});
                document.removeEventListener("click", close);
            }.bind(this);
            document.addEventListener("click", close);

            this.setState({
                showFileMenu: true
            });
        }
    },
    handleNewClick: function (e) {
        e.preventDefault();
        if (confirm("Delete all flows?")) {
            FlowActions.clear();
        }
    },
    handleOpenClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleOpenClick");
    },
    handleSaveClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleSaveClick");
    },
    handleShutdownClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleShutdownClick");
    },
    render: function () {
        var fileMenuClass = "dropdown pull-left" + (this.state.showFileMenu ? " open" : "");

        return (
            React.createElement("div", {className: fileMenuClass}, 
                React.createElement("a", {href: "#", className: "special", onClick: this.handleFileClick}, " mitmproxy "), 
                React.createElement("ul", {className: "dropdown-menu", role: "menu"}, 
                    React.createElement("li", null, 
                        React.createElement("a", {href: "#", onClick: this.handleNewClick}, 
                            React.createElement("i", {className: "fa fa-fw fa-file"}), 
                            "New"
                        )
                    ), 
                    React.createElement("li", {role: "presentation", className: "divider"}), 
                    React.createElement("li", null, 
                        React.createElement("a", {href: "http://mitm.it/", target: "_blank"}, 
                            React.createElement("i", {className: "fa fa-fw fa-external-link"}), 
                            "Install Certificates..."
                        )
                    )
                /*
                 <li>
                 <a href="#" onClick={this.handleOpenClick}>
                 <i className="fa fa-fw fa-folder-open"></i>
                 Open
                 </a>
                 </li>
                 <li>
                 <a href="#" onClick={this.handleSaveClick}>
                 <i className="fa fa-fw fa-save"></i>
                 Save
                 </a>
                 </li>
                 <li role="presentation" className="divider"></li>
                 <li>
                 <a href="#" onClick={this.handleShutdownClick}>
                 <i className="fa fa-fw fa-plug"></i>
                 Shutdown
                 </a>
                 </li>
                 */
                )
            )
        );
    }
});


var header_entries = [MainMenu, ViewMenu /*, ReportsMenu */];


var Header = React.createClass({displayName: "Header",
    mixins: [common.Navigation],
    getInitialState: function () {
        return {
            active: header_entries[0]
        };
    },
    handleClick: function (active, e) {
        e.preventDefault();
        this.replaceWith(active.route);
        this.setState({active: active});
    },
    render: function () {
        var header = header_entries.map(function (entry, i) {
            var classes = React.addons.classSet({
                active: entry == this.state.active
            });
            return (
                React.createElement("a", {key: i, 
                    href: "#", 
                    className: classes, 
                    onClick: this.handleClick.bind(this, entry)
                }, 
                     entry.title
                )
            );
        }.bind(this));

        return (
            React.createElement("header", null, 
                React.createElement("nav", {className: "nav-tabs nav-tabs-lg"}, 
                    React.createElement(FileMenu, null), 
                    header
                ), 
                React.createElement("div", {className: "menu"}, 
                    React.createElement(this.state.active, {settings: this.props.settings})
                )
            )
        );
    }
});


module.exports = {
    Header: Header
}

},{"../filt/filt.js":16,"../utils.js":20,"./common.js":4,"jquery":"jquery","react":"react"}],11:[function(require,module,exports){
var React = require("react");

var common = require("./common.js");
var toputils = require("../utils.js");
var views = require("../store/view.js");
var Filt = require("../filt/filt.js");
FlowTable = require("./flowtable.js");
var flowdetail = require("./flowdetail.js");


var MainView = React.createClass({displayName: "MainView",
    mixins: [common.Navigation, common.State],
    getInitialState: function () {
        this.onQueryChange(Query.FILTER, function () {
            this.state.view.recalculate(this.getViewFilt(), this.getViewSort());
        }.bind(this));
        this.onQueryChange(Query.HIGHLIGHT, function () {
            this.state.view.recalculate(this.getViewFilt(), this.getViewSort());
        }.bind(this));
        return {
            flows: []
        };
    },
    getViewFilt: function () {
        try {
            var filt = Filt.parse(this.getQuery()[Query.FILTER] || "");
            var highlightStr = this.getQuery()[Query.HIGHLIGHT];
            var highlight = highlightStr ? Filt.parse(highlightStr) : false;
        } catch (e) {
            console.error("Error when processing filter: " + e);
        }

        return function filter_and_highlight(flow) {
            if (!this._highlight) {
                this._highlight = {};
            }
            this._highlight[flow.id] = highlight && highlight(flow);
            return filt(flow);
        };
    },
    getViewSort: function () {
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.flowStore !== this.props.flowStore) {
            this.closeView();
            this.openView(nextProps.flowStore);
        }
    },
    openView: function (store) {
        var view = new views.StoreView(store, this.getViewFilt(), this.getViewSort());
        this.setState({
            view: view
        });

        view.addListener("recalculate", this.onRecalculate);
        view.addListener("add update remove", this.onUpdate);
        view.addListener("remove", this.onRemove);
    },
    onRecalculate: function () {
        this.forceUpdate();
        var selected = this.getSelected();
        if (selected) {
            this.refs.flowTable.scrollIntoView(selected);
        }
    },
    onUpdate: function (flow) {
        if (flow.id === this.getParams().flowId) {
            this.forceUpdate();
        }
    },
    onRemove: function (flow_id, index) {
        if (flow_id === this.getParams().flowId) {
            var flow_to_select = this.state.view.list[Math.min(index, this.state.view.list.length -1)];
            this.selectFlow(flow_to_select);
        }
    },
    closeView: function () {
        this.state.view.close();
    },
    componentWillMount: function () {
        this.openView(this.props.flowStore);
    },
    componentWillUnmount: function () {
        this.closeView();
    },
    selectFlow: function (flow) {
        if (flow) {
            this.replaceWith(
                "flow",
                {
                    flowId: flow.id,
                    detailTab: this.getParams().detailTab || "request"
                }
            );
            this.refs.flowTable.scrollIntoView(flow);
        } else {
            this.replaceWith("flows", {});
        }
    },
    selectFlowRelative: function (shift) {
        var flows = this.state.view.list;
        var index;
        if (!this.getParams().flowId) {
            if (shift > 0) {
                index = flows.length - 1;
            } else {
                index = 0;
            }
        } else {
            var currFlowId = this.getParams().flowId;
            var i = flows.length;
            while (i--) {
                if (flows[i].id === currFlowId) {
                    index = i;
                    break;
                }
            }
            index = Math.min(
                Math.max(0, index + shift),
                flows.length - 1);
        }
        this.selectFlow(flows[index]);
    },
    onKeyDown: function (e) {
        var flow = this.getSelected();
        if (e.ctrlKey) {
            return;
        }
        switch (e.keyCode) {
            case toputils.Key.K:
            case toputils.Key.UP:
                this.selectFlowRelative(-1);
                break;
            case toputils.Key.J:
            case toputils.Key.DOWN:
                this.selectFlowRelative(+1);
                break;
            case toputils.Key.SPACE:
            case toputils.Key.PAGE_DOWN:
                this.selectFlowRelative(+10);
                break;
            case toputils.Key.PAGE_UP:
                this.selectFlowRelative(-10);
                break;
            case toputils.Key.END:
                this.selectFlowRelative(+1e10);
                break;
            case toputils.Key.HOME:
                this.selectFlowRelative(-1e10);
                break;
            case toputils.Key.ESC:
                this.selectFlow(null);
                break;
            case toputils.Key.H:
            case toputils.Key.LEFT:
                if (this.refs.flowDetails) {
                    this.refs.flowDetails.nextTab(-1);
                }
                break;
            case toputils.Key.L:
            case toputils.Key.TAB:
            case toputils.Key.RIGHT:
                if (this.refs.flowDetails) {
                    this.refs.flowDetails.nextTab(+1);
                }
                break;
            case toputils.Key.C:
                if (e.shiftKey) {
                    FlowActions.clear();
                }
                break;
            case toputils.Key.D:
                if (flow) {
                    if (e.shiftKey) {
                        FlowActions.duplicate(flow);
                    } else {
                        FlowActions.delete(flow);
                    }
                }
                break;
            case toputils.Key.A:
                if (e.shiftKey) {
                    FlowActions.accept_all();
                } else if (flow && flow.intercepted) {
                    FlowActions.accept(flow);
                }
                break;
            case toputils.Key.R:
                if (!e.shiftKey && flow) {
                    FlowActions.replay(flow);
                }
                break;
            case toputils.Key.V:
                if(e.shiftKey && flow && flow.modified) {
                    FlowActions.revert(flow);
                }
                break;
            default:
                console.debug("keydown", e.keyCode);
                return;
        }
        e.preventDefault();
    },
    getSelected: function () {
        return this.props.flowStore.get(this.getParams().flowId);
    },
    render: function () {
        var selected = this.getSelected();

        var details;
        if (selected) {
            details = [
                React.createElement(common.Splitter, {key: "splitter"}),
                React.createElement(flowdetail.FlowDetail, {key: "flowDetails", ref: "flowDetails", flow: selected})
            ];
        } else {
            details = null;
        }

        return (
            React.createElement("div", {className: "main-view", onKeyDown: this.onKeyDown, tabIndex: "0"}, 
                React.createElement(FlowTable, {ref: "flowTable", 
                    view: this.state.view, 
                    selectFlow: this.selectFlow, 
                    selected: selected}), 
                details
            )
        );
    }
});

module.exports = MainView;


},{"../filt/filt.js":16,"../store/view.js":19,"../utils.js":20,"./common.js":4,"./flowdetail.js":6,"./flowtable.js":8,"react":"react"}],12:[function(require,module,exports){
var React = require("react");
var ReactRouter = require("react-router");
var _ = require("lodash");

var common = require("./common.js");
var MainView = require("./mainview.js");
var Footer = require("./footer.js");
var header = require("./header.js");
var EventLog = require("./eventlog.js");
var store = require("../store/store.js");


//TODO: Move out of here, just a stub.
var Reports = React.createClass({displayName: "Reports",
    render: function () {
        return React.createElement("div", null, "ReportEditor");
    }
});


var ProxyAppMain = React.createClass({displayName: "ProxyAppMain",
    mixins: [common.State],
    getInitialState: function () {
        var eventStore = new store.EventLogStore();
        var flowStore = new store.FlowStore();
        var settings = new store.SettingsStore();

        // Default Settings before fetch
        _.extend(settings.dict,{
        });
        return {
            settings: settings,
            flowStore: flowStore,
            eventStore: eventStore
        };
    },
    componentDidMount: function () {
        this.state.settings.addListener("recalculate", this.onSettingsChange);
        window.app = this;
    },
    componentWillUnmount: function () {
        this.state.settings.removeListener("recalculate", this.onSettingsChange);
    },
    onSettingsChange: function(){
        this.setState({
            settings: this.state.settings
        });
    },
    render: function () {

        var eventlog;
        if (this.getQuery()[Query.SHOW_EVENTLOG]) {
            eventlog = [
                React.createElement(common.Splitter, {key: "splitter", axis: "y"}),
                React.createElement(EventLog, {key: "eventlog", eventStore: this.state.eventStore})
            ];
        } else {
            eventlog = null;
        }

        return (
            React.createElement("div", {id: "container"}, 
                React.createElement(header.Header, {settings: this.state.settings.dict}), 
                React.createElement(RouteHandler, {settings: this.state.settings.dict, flowStore: this.state.flowStore}), 
                eventlog, 
                React.createElement(Footer, {settings: this.state.settings.dict})
            )
        );
    }
});


var Route = ReactRouter.Route;
var RouteHandler = ReactRouter.RouteHandler;
var Redirect = ReactRouter.Redirect;
var DefaultRoute = ReactRouter.DefaultRoute;
var NotFoundRoute = ReactRouter.NotFoundRoute;


var routes = (
    React.createElement(Route, {path: "/", handler: ProxyAppMain}, 
        React.createElement(Route, {name: "flows", path: "flows", handler: MainView}), 
        React.createElement(Route, {name: "flow", path: "flows/:flowId/:detailTab", handler: MainView}), 
        React.createElement(Route, {name: "reports", handler: Reports}), 
        React.createElement(Redirect, {path: "/", to: "flows"})
    )
);

module.exports = {
    routes: routes
};



},{"../store/store.js":18,"./common.js":4,"./eventlog.js":5,"./footer.js":9,"./header.js":10,"./mainview.js":11,"lodash":"lodash","react":"react","react-router":"react-router"}],13:[function(require,module,exports){
var React = require("react");

var VirtualScrollMixin = {
    getInitialState: function () {
        return {
            start: 0,
            stop: 0
        };
    },
    componentWillMount: function () {
        if (!this.props.rowHeight) {
            console.warn("VirtualScrollMixin: No rowHeight specified", this);
        }
    },
    getPlaceholderTop: function (total) {
        var Tag = this.props.placeholderTagName || "tr";
        // When a large trunk of elements is removed from the button, start may be far off the viewport.
        // To make this issue less severe, limit the top placeholder to the total number of rows.
        var style = {
            height: Math.min(this.state.start, total) * this.props.rowHeight
        };
        var spacer = React.createElement(Tag, {key: "placeholder-top", style: style});

        if (this.state.start % 2 === 1) {
            // fix even/odd rows
            return [spacer, React.createElement(Tag, {key: "placeholder-top-2"})];
        } else {
            return spacer;
        }
    },
    getPlaceholderBottom: function (total) {
        var Tag = this.props.placeholderTagName || "tr";
        var style = {
            height: Math.max(0, total - this.state.stop) * this.props.rowHeight
        };
        return React.createElement(Tag, {key: "placeholder-bottom", style: style});
    },
    componentDidMount: function () {
        this.onScroll();
        window.addEventListener('resize', this.onScroll);
    },
    componentWillUnmount: function(){
        window.removeEventListener('resize', this.onScroll);
    },
    onScroll: function () {
        var viewport = this.getDOMNode();
        var top = viewport.scrollTop;
        var height = viewport.offsetHeight;
        var start = Math.floor(top / this.props.rowHeight);
        var stop = start + Math.ceil(height / (this.props.rowHeightMin || this.props.rowHeight));

        this.setState({
            start: start,
            stop: stop
        });
    },
    renderRows: function (elems) {
        var rows = [];
        var max = Math.min(elems.length, this.state.stop);

        for (var i = this.state.start; i < max; i++) {
            var elem = elems[i];
            rows.push(this.renderRow(elem));
        }
        return rows;
    },
    scrollRowIntoView: function (index, head_height) {

        var row_top = (index * this.props.rowHeight) + head_height;
        var row_bottom = row_top + this.props.rowHeight;

        var viewport = this.getDOMNode();
        var viewport_top = viewport.scrollTop;
        var viewport_bottom = viewport_top + viewport.offsetHeight;

        // Account for pinned thead
        if (row_top - head_height < viewport_top) {
            viewport.scrollTop = row_top - head_height;
        } else if (row_bottom > viewport_bottom) {
            viewport.scrollTop = row_bottom - viewport.offsetHeight;
        }
    },
};

module.exports  = VirtualScrollMixin;

},{"react":"react"}],14:[function(require,module,exports){

var actions = require("./actions.js");

function Connection(url) {
    if (url[0] === "/") {
        url = location.origin.replace("http", "ws") + url;
    }

    var ws = new WebSocket(url);
    ws.onopen = function () {
        actions.ConnectionActions.open();
    };
    ws.onmessage = function (message) {
        var m = JSON.parse(message.data);
        AppDispatcher.dispatchServerAction(m);
    };
    ws.onerror = function () {
        actions.ConnectionActions.error();
        EventLogActions.add_event("WebSocket connection error.");
    };
    ws.onclose = function () {
        actions.ConnectionActions.close();
        EventLogActions.add_event("WebSocket connection closed.");
    };
    return ws;
}

module.exports = Connection;

},{"./actions.js":2}],15:[function(require,module,exports){

var flux = require("flux");

const PayloadSources = {
    VIEW: "view",
    SERVER: "server"
};


AppDispatcher = new flux.Dispatcher();
AppDispatcher.dispatchViewAction = function (action) {
    action.source = PayloadSources.VIEW;
    this.dispatch(action);
};
AppDispatcher.dispatchServerAction = function (action) {
    action.source = PayloadSources.SERVER;
    this.dispatch(action);
};

module.exports = {
    AppDispatcher: AppDispatcher
};

},{"flux":"flux"}],16:[function(require,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleFunctions = { start: peg$parsestart },
        peg$startRuleFunction  = peg$parsestart,

        peg$c0 = { type: "other", description: "filter expression" },
        peg$c1 = peg$FAILED,
        peg$c2 = function(orExpr) { return orExpr; },
        peg$c3 = [],
        peg$c4 = function() {return trueFilter; },
        peg$c5 = { type: "other", description: "whitespace" },
        peg$c6 = /^[ \t\n\r]/,
        peg$c7 = { type: "class", value: "[ \\t\\n\\r]", description: "[ \\t\\n\\r]" },
        peg$c8 = { type: "other", description: "control character" },
        peg$c9 = /^[|&!()~"]/,
        peg$c10 = { type: "class", value: "[|&!()~\"]", description: "[|&!()~\"]" },
        peg$c11 = { type: "other", description: "optional whitespace" },
        peg$c12 = "|",
        peg$c13 = { type: "literal", value: "|", description: "\"|\"" },
        peg$c14 = function(first, second) { return or(first, second); },
        peg$c15 = "&",
        peg$c16 = { type: "literal", value: "&", description: "\"&\"" },
        peg$c17 = function(first, second) { return and(first, second); },
        peg$c18 = "!",
        peg$c19 = { type: "literal", value: "!", description: "\"!\"" },
        peg$c20 = function(expr) { return not(expr); },
        peg$c21 = "(",
        peg$c22 = { type: "literal", value: "(", description: "\"(\"" },
        peg$c23 = ")",
        peg$c24 = { type: "literal", value: ")", description: "\")\"" },
        peg$c25 = function(expr) { return binding(expr); },
        peg$c26 = "~a",
        peg$c27 = { type: "literal", value: "~a", description: "\"~a\"" },
        peg$c28 = function() { return assetFilter; },
        peg$c29 = "~e",
        peg$c30 = { type: "literal", value: "~e", description: "\"~e\"" },
        peg$c31 = function() { return errorFilter; },
        peg$c32 = "~q",
        peg$c33 = { type: "literal", value: "~q", description: "\"~q\"" },
        peg$c34 = function() { return noResponseFilter; },
        peg$c35 = "~s",
        peg$c36 = { type: "literal", value: "~s", description: "\"~s\"" },
        peg$c37 = function() { return responseFilter; },
        peg$c38 = "true",
        peg$c39 = { type: "literal", value: "true", description: "\"true\"" },
        peg$c40 = function() { return trueFilter; },
        peg$c41 = "false",
        peg$c42 = { type: "literal", value: "false", description: "\"false\"" },
        peg$c43 = function() { return falseFilter; },
        peg$c44 = "~c",
        peg$c45 = { type: "literal", value: "~c", description: "\"~c\"" },
        peg$c46 = function(s) { return responseCode(s); },
        peg$c47 = "~d",
        peg$c48 = { type: "literal", value: "~d", description: "\"~d\"" },
        peg$c49 = function(s) { return domain(s); },
        peg$c50 = "~h",
        peg$c51 = { type: "literal", value: "~h", description: "\"~h\"" },
        peg$c52 = function(s) { return header(s); },
        peg$c53 = "~hq",
        peg$c54 = { type: "literal", value: "~hq", description: "\"~hq\"" },
        peg$c55 = function(s) { return requestHeader(s); },
        peg$c56 = "~hs",
        peg$c57 = { type: "literal", value: "~hs", description: "\"~hs\"" },
        peg$c58 = function(s) { return responseHeader(s); },
        peg$c59 = "~m",
        peg$c60 = { type: "literal", value: "~m", description: "\"~m\"" },
        peg$c61 = function(s) { return method(s); },
        peg$c62 = "~t",
        peg$c63 = { type: "literal", value: "~t", description: "\"~t\"" },
        peg$c64 = function(s) { return contentType(s); },
        peg$c65 = "~tq",
        peg$c66 = { type: "literal", value: "~tq", description: "\"~tq\"" },
        peg$c67 = function(s) { return requestContentType(s); },
        peg$c68 = "~ts",
        peg$c69 = { type: "literal", value: "~ts", description: "\"~ts\"" },
        peg$c70 = function(s) { return responseContentType(s); },
        peg$c71 = "~u",
        peg$c72 = { type: "literal", value: "~u", description: "\"~u\"" },
        peg$c73 = function(s) { return url(s); },
        peg$c74 = { type: "other", description: "integer" },
        peg$c75 = null,
        peg$c76 = /^['"]/,
        peg$c77 = { type: "class", value: "['\"]", description: "['\"]" },
        peg$c78 = /^[0-9]/,
        peg$c79 = { type: "class", value: "[0-9]", description: "[0-9]" },
        peg$c80 = function(digits) { return parseInt(digits.join(""), 10); },
        peg$c81 = { type: "other", description: "string" },
        peg$c82 = "\"",
        peg$c83 = { type: "literal", value: "\"", description: "\"\\\"\"" },
        peg$c84 = function(chars) { return chars.join(""); },
        peg$c85 = "'",
        peg$c86 = { type: "literal", value: "'", description: "\"'\"" },
        peg$c87 = void 0,
        peg$c88 = /^["\\]/,
        peg$c89 = { type: "class", value: "[\"\\\\]", description: "[\"\\\\]" },
        peg$c90 = { type: "any", description: "any character" },
        peg$c91 = function(char) { return char; },
        peg$c92 = "\\",
        peg$c93 = { type: "literal", value: "\\", description: "\"\\\\\"" },
        peg$c94 = /^['\\]/,
        peg$c95 = { type: "class", value: "['\\\\]", description: "['\\\\]" },
        peg$c96 = /^['"\\]/,
        peg$c97 = { type: "class", value: "['\"\\\\]", description: "['\"\\\\]" },
        peg$c98 = "n",
        peg$c99 = { type: "literal", value: "n", description: "\"n\"" },
        peg$c100 = function() { return "\n"; },
        peg$c101 = "r",
        peg$c102 = { type: "literal", value: "r", description: "\"r\"" },
        peg$c103 = function() { return "\r"; },
        peg$c104 = "t",
        peg$c105 = { type: "literal", value: "t", description: "\"t\"" },
        peg$c106 = function() { return "\t"; },

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$parsestart() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parse__();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseOrExpr();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse__();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c2(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = [];
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c4();
        }
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c0); }
      }

      return s0;
    }

    function peg$parsews() {
      var s0, s1;

      peg$silentFails++;
      if (peg$c6.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c7); }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c5); }
      }

      return s0;
    }

    function peg$parsecc() {
      var s0, s1;

      peg$silentFails++;
      if (peg$c9.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c10); }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c8); }
      }

      return s0;
    }

    function peg$parse__() {
      var s0, s1;

      peg$silentFails++;
      s0 = [];
      s1 = peg$parsews();
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$parsews();
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c11); }
      }

      return s0;
    }

    function peg$parseOrExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$parseAndExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 124) {
            s3 = peg$c12;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c13); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseOrExpr();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c14(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseAndExpr();
      }

      return s0;
    }

    function peg$parseAndExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$parseNotExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 38) {
            s3 = peg$c15;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c16); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseAndExpr();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c17(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseNotExpr();
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parsews();
            }
          } else {
            s2 = peg$c1;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseAndExpr();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c17(s1, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseNotExpr();
        }
      }

      return s0;
    }

    function peg$parseNotExpr() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 33) {
        s1 = peg$c18;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c19); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseNotExpr();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c20(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseBindingExpr();
      }

      return s0;
    }

    function peg$parseBindingExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 40) {
        s1 = peg$c21;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c22); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseOrExpr();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 41) {
                s5 = peg$c23;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c24); }
              }
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c25(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseExpr();
      }

      return s0;
    }

    function peg$parseExpr() {
      var s0;

      s0 = peg$parseNullaryExpr();
      if (s0 === peg$FAILED) {
        s0 = peg$parseUnaryExpr();
      }

      return s0;
    }

    function peg$parseNullaryExpr() {
      var s0, s1;

      s0 = peg$parseBooleanLiteral();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c26) {
          s1 = peg$c26;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c27); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c28();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c29) {
            s1 = peg$c29;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c30); }
          }
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c31();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 2) === peg$c32) {
              s1 = peg$c32;
              peg$currPos += 2;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c33); }
            }
            if (s1 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c34();
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 2) === peg$c35) {
                s1 = peg$c35;
                peg$currPos += 2;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c36); }
              }
              if (s1 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c37();
              }
              s0 = s1;
            }
          }
        }
      }

      return s0;
    }

    function peg$parseBooleanLiteral() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c38) {
        s1 = peg$c38;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c39); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c40();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c41) {
          s1 = peg$c41;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c42); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c43();
        }
        s0 = s1;
      }

      return s0;
    }

    function peg$parseUnaryExpr() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c44) {
        s1 = peg$c44;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c45); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parsews();
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parsews();
          }
        } else {
          s2 = peg$c1;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parseIntegerLiteral();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c46(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c47) {
          s1 = peg$c47;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c48); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parsews();
            }
          } else {
            s2 = peg$c1;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseStringLiteral();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c49(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c50) {
            s1 = peg$c50;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c51); }
          }
          if (s1 !== peg$FAILED) {
            s2 = [];
            s3 = peg$parsews();
            if (s3 !== peg$FAILED) {
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parsews();
              }
            } else {
              s2 = peg$c1;
            }
            if (s2 !== peg$FAILED) {
              s3 = peg$parseStringLiteral();
              if (s3 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c52(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 3) === peg$c53) {
              s1 = peg$c53;
              peg$currPos += 3;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c54); }
            }
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parsews();
              if (s3 !== peg$FAILED) {
                while (s3 !== peg$FAILED) {
                  s2.push(s3);
                  s3 = peg$parsews();
                }
              } else {
                s2 = peg$c1;
              }
              if (s2 !== peg$FAILED) {
                s3 = peg$parseStringLiteral();
                if (s3 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c55(s3);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 3) === peg$c56) {
                s1 = peg$c56;
                peg$currPos += 3;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c57); }
              }
              if (s1 !== peg$FAILED) {
                s2 = [];
                s3 = peg$parsews();
                if (s3 !== peg$FAILED) {
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parsews();
                  }
                } else {
                  s2 = peg$c1;
                }
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseStringLiteral();
                  if (s3 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c58(s3);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 2) === peg$c59) {
                  s1 = peg$c59;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c60); }
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parsews();
                  if (s3 !== peg$FAILED) {
                    while (s3 !== peg$FAILED) {
                      s2.push(s3);
                      s3 = peg$parsews();
                    }
                  } else {
                    s2 = peg$c1;
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = peg$parseStringLiteral();
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c61(s3);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 2) === peg$c62) {
                    s1 = peg$c62;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c63); }
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$parsews();
                    if (s3 !== peg$FAILED) {
                      while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$parsews();
                      }
                    } else {
                      s2 = peg$c1;
                    }
                    if (s2 !== peg$FAILED) {
                      s3 = peg$parseStringLiteral();
                      if (s3 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c64(s3);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.substr(peg$currPos, 3) === peg$c65) {
                      s1 = peg$c65;
                      peg$currPos += 3;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c66); }
                    }
                    if (s1 !== peg$FAILED) {
                      s2 = [];
                      s3 = peg$parsews();
                      if (s3 !== peg$FAILED) {
                        while (s3 !== peg$FAILED) {
                          s2.push(s3);
                          s3 = peg$parsews();
                        }
                      } else {
                        s2 = peg$c1;
                      }
                      if (s2 !== peg$FAILED) {
                        s3 = peg$parseStringLiteral();
                        if (s3 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c67(s3);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      if (input.substr(peg$currPos, 3) === peg$c68) {
                        s1 = peg$c68;
                        peg$currPos += 3;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c69); }
                      }
                      if (s1 !== peg$FAILED) {
                        s2 = [];
                        s3 = peg$parsews();
                        if (s3 !== peg$FAILED) {
                          while (s3 !== peg$FAILED) {
                            s2.push(s3);
                            s3 = peg$parsews();
                          }
                        } else {
                          s2 = peg$c1;
                        }
                        if (s2 !== peg$FAILED) {
                          s3 = peg$parseStringLiteral();
                          if (s3 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c70(s3);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c1;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                      if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c71) {
                          s1 = peg$c71;
                          peg$currPos += 2;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c72); }
                        }
                        if (s1 !== peg$FAILED) {
                          s2 = [];
                          s3 = peg$parsews();
                          if (s3 !== peg$FAILED) {
                            while (s3 !== peg$FAILED) {
                              s2.push(s3);
                              s3 = peg$parsews();
                            }
                          } else {
                            s2 = peg$c1;
                          }
                          if (s2 !== peg$FAILED) {
                            s3 = peg$parseStringLiteral();
                            if (s3 !== peg$FAILED) {
                              peg$reportedPos = s0;
                              s1 = peg$c73(s3);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$c1;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c1;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                        if (s0 === peg$FAILED) {
                          s0 = peg$currPos;
                          s1 = peg$parseStringLiteral();
                          if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c73(s1);
                          }
                          s0 = s1;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      return s0;
    }

    function peg$parseIntegerLiteral() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      if (peg$c76.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c77); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$c75;
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c78.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c79); }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$c78.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c79); }
            }
          }
        } else {
          s2 = peg$c1;
        }
        if (s2 !== peg$FAILED) {
          if (peg$c76.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c77); }
          }
          if (s3 === peg$FAILED) {
            s3 = peg$c75;
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c80(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }

      return s0;
    }

    function peg$parseStringLiteral() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 34) {
        s1 = peg$c82;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c83); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseDoubleStringChar();
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseDoubleStringChar();
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 34) {
            s3 = peg$c82;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c83); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c84(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s1 = peg$c85;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c86); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parseSingleStringChar();
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseSingleStringChar();
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s3 = peg$c85;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c86); }
            }
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$currPos;
          peg$silentFails++;
          s2 = peg$parsecc();
          peg$silentFails--;
          if (s2 === peg$FAILED) {
            s1 = peg$c87;
          } else {
            peg$currPos = s1;
            s1 = peg$c1;
          }
          if (s1 !== peg$FAILED) {
            s2 = [];
            s3 = peg$parseUnquotedStringChar();
            if (s3 !== peg$FAILED) {
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parseUnquotedStringChar();
              }
            } else {
              s2 = peg$c1;
            }
            if (s2 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c81); }
      }

      return s0;
    }

    function peg$parseDoubleStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      if (peg$c88.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c89); }
      }
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c92;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c93); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEscapeSequence();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c91(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      }

      return s0;
    }

    function peg$parseSingleStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      if (peg$c94.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c95); }
      }
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c92;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c93); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEscapeSequence();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c91(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      }

      return s0;
    }

    function peg$parseUnquotedStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      s2 = peg$parsews();
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseEscapeSequence() {
      var s0, s1;

      if (peg$c96.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c97); }
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 110) {
          s1 = peg$c98;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c99); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c100();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 114) {
            s1 = peg$c101;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c102); }
          }
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c103();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 116) {
              s1 = peg$c104;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c105); }
            }
            if (s1 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c106();
            }
            s0 = s1;
          }
        }
      }

      return s0;
    }


    var flowutils = require("../flow/utils.js");

    function or(first, second) {
        // Add explicit function names to ease debugging.
        function orFilter() {
            return first.apply(this, arguments) || second.apply(this, arguments);
        }
        orFilter.desc = first.desc + " or " + second.desc;
        return orFilter;
    }
    function and(first, second) {
        function andFilter() {
            return first.apply(this, arguments) && second.apply(this, arguments);
        }
        andFilter.desc = first.desc + " and " + second.desc;
        return andFilter;
    }
    function not(expr) {
        function notFilter() {
            return !expr.apply(this, arguments);
        }
        notFilter.desc = "not " + expr.desc;
        return notFilter;
    }
    function binding(expr) {
        function bindingFilter() {
            return expr.apply(this, arguments);
        }
        bindingFilter.desc = "(" + expr.desc + ")";
        return bindingFilter;
    }
    function trueFilter(flow) {
        return true;
    }
    trueFilter.desc = "true";
    function falseFilter(flow) {
        return false;
    }
    falseFilter.desc = "false";

    var ASSET_TYPES = [
        new RegExp("text/javascript"),
        new RegExp("application/x-javascript"),
        new RegExp("application/javascript"),
        new RegExp("text/css"),
        new RegExp("image/.*"),
        new RegExp("application/x-shockwave-flash")
    ];
    function assetFilter(flow) {
        if (flow.response) {
            var ct = flowutils.ResponseUtils.getContentType(flow.response);
            var i = ASSET_TYPES.length;
            while (i--) {
                if (ASSET_TYPES[i].test(ct)) {
                    return true;
                }
            }
        }
        return false;
    }
    assetFilter.desc = "is asset";
    function responseCode(code){
        function responseCodeFilter(flow){
            return flow.response && flow.response.code === code;
        }
        responseCodeFilter.desc = "resp. code is " + code;
        return responseCodeFilter;
    }
    function domain(regex){
        regex = new RegExp(regex, "i");
        function domainFilter(flow){
            return flow.request && regex.test(flow.request.host);
        }
        domainFilter.desc = "domain matches " + regex;
        return domainFilter;
    }
    function errorFilter(flow){
        return !!flow.error;
    }
    errorFilter.desc = "has error";
    function header(regex){
        regex = new RegExp(regex, "i");
        function headerFilter(flow){
            return (
                (flow.request && flowutils.RequestUtils.match_header(flow.request, regex))
                ||
                (flow.response && flowutils.ResponseUtils.match_header(flow.response, regex))
            );
        }
        headerFilter.desc = "header matches " + regex;
        return headerFilter;
    }
    function requestHeader(regex){
        regex = new RegExp(regex, "i");
        function requestHeaderFilter(flow){
            return (flow.request && flowutils.RequestUtils.match_header(flow.request, regex));
        }
        requestHeaderFilter.desc = "req. header matches " + regex;
        return requestHeaderFilter;
    }
    function responseHeader(regex){
        regex = new RegExp(regex, "i");
        function responseHeaderFilter(flow){
            return (flow.response && flowutils.ResponseUtils.match_header(flow.response, regex));
        }
        responseHeaderFilter.desc = "resp. header matches " + regex;
        return responseHeaderFilter;
    }
    function method(regex){
        regex = new RegExp(regex, "i");
        function methodFilter(flow){
            return flow.request && regex.test(flow.request.method);
        }
        methodFilter.desc = "method matches " + regex;
        return methodFilter;
    }
    function noResponseFilter(flow){
        return flow.request && !flow.response;
    }
    noResponseFilter.desc = "has no response";
    function responseFilter(flow){
        return !!flow.response;
    }
    responseFilter.desc = "has response";

    function contentType(regex){
        regex = new RegExp(regex, "i");
        function contentTypeFilter(flow){
            return (
                (flow.request && regex.test(flowutils.RequestUtils.getContentType(flow.request)))
                ||
                (flow.response && regex.test(flowutils.ResponseUtils.getContentType(flow.response)))
            );
        }
        contentTypeFilter.desc = "content type matches " + regex;
        return contentTypeFilter;
    }
    function requestContentType(regex){
        regex = new RegExp(regex, "i");
        function requestContentTypeFilter(flow){
            return flow.request && regex.test(flowutils.RequestUtils.getContentType(flow.request));
        }
        requestContentTypeFilter.desc = "req. content type matches " + regex;
        return requestContentTypeFilter;
    }
    function responseContentType(regex){
        regex = new RegExp(regex, "i");
        function responseContentTypeFilter(flow){
            return flow.response && regex.test(flowutils.ResponseUtils.getContentType(flow.response));
        }
        responseContentTypeFilter.desc = "resp. content type matches " + regex;
        return responseContentTypeFilter;
    }
    function url(regex){
        regex = new RegExp(regex, "i");
        function urlFilter(flow){
            return flow.request && regex.test(flowutils.RequestUtils.pretty_url(flow.request));
        }
        urlFilter.desc = "url matches " + regex;
        return urlFilter;
    }


    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();

},{"../flow/utils.js":17}],17:[function(require,module,exports){
var _ = require("lodash");

var _MessageUtils = {
    getContentType: function (message) {
        return this.get_first_header(message, /^Content-Type$/i);
    },
    get_first_header: function (message, regex) {
        //FIXME: Cache Invalidation.
        if (!message._headerLookups)
            Object.defineProperty(message, "_headerLookups", {
                value: {},
                configurable: false,
                enumerable: false,
                writable: false
            });
        if (!(regex in message._headerLookups)) {
            var header;
            for (var i = 0; i < message.headers.length; i++) {
                if (!!message.headers[i][0].match(regex)) {
                    header = message.headers[i];
                    break;
                }
            }
            message._headerLookups[regex] = header ? header[1] : undefined;
        }
        return message._headerLookups[regex];
    },
    match_header: function (message, regex) {
        var headers = message.headers;
        var i = headers.length;
        while (i--) {
            if (regex.test(headers[i].join(" "))) {
                return headers[i];
            }
        }
        return false;
    },
    isPrintable: function(message) {
	var printableTypes = ['text/plain', 
			      'text/json', 
			      'application/json',
			      'application/x-javascript',
			      'application/javascript',
			      'text/javascript',
			      'text/xml',
			      'text/html',
			      'text/xhtml'];
	var contentType = this.getContentType(message).split(' ');
	if (printableTypes.indexOf(contentType)) {
	    return true;
	} else {
	    return false;
	}	
    }
};

var defaultPorts = {
    "http": 80,
    "https": 443
};

var RequestUtils = _.extend(_MessageUtils, {
    pretty_host: function (request) {
        //FIXME: Add hostheader
        return request.host;
    },
    pretty_url: function (request) {
        var port = "";
        if (defaultPorts[request.scheme] !== request.port) {
            port = ":" + request.port;
        }
        return request.scheme + "://" + this.pretty_host(request) + port + request.path;
    }
});

var ResponseUtils = _.extend(_MessageUtils, {});


module.exports = {
    ResponseUtils: ResponseUtils,
    RequestUtils: RequestUtils

}


},{"lodash":"lodash"}],18:[function(require,module,exports){

var _ = require("lodash");
var $ = require("jquery");
var EventEmitter = require('events').EventEmitter;

var utils = require("../utils.js");
var actions = require("../actions.js");
var dispatcher = require("../dispatcher.js");


function ListStore() {
    EventEmitter.call(this);
    this.reset();
}
_.extend(ListStore.prototype, EventEmitter.prototype, {
    add: function (elem) {
        if (elem.id in this._pos_map) {
            return;
        }
        this._pos_map[elem.id] = this.list.length;
        this.list.push(elem);
        this.emit("add", elem);
    },
    update: function (elem) {
        if (!(elem.id in this._pos_map)) {
            return;
        }
        this.list[this._pos_map[elem.id]] = elem;
        this.emit("update", elem);
    },
    remove: function (elem_id) {
        if (!(elem_id in this._pos_map)) {
            return;
        }
        this.list.splice(this._pos_map[elem_id], 1);
        this._build_map();
        this.emit("remove", elem_id);
    },
    reset: function (elems) {
        this.list = elems || [];
        this._build_map();
        this.emit("recalculate");
    },
    _build_map: function () {
        this._pos_map = {};
        for (var i = 0; i < this.list.length; i++) {
            var elem = this.list[i];
            this._pos_map[elem.id] = i;
        }
    },
    get: function (elem_id) {
        return this.list[this._pos_map[elem_id]];
    },
    index: function (elem_id) {
        return this._pos_map[elem_id];
    }
});


function DictStore() {
    EventEmitter.call(this);
    this.reset();
}
_.extend(DictStore.prototype, EventEmitter.prototype, {
    update: function (dict) {
        _.merge(this.dict, dict);
        this.emit("recalculate");
    },
    reset: function (dict) {
        this.dict = dict || {};
        this.emit("recalculate");
    }
});

function LiveStoreMixin(type) {
    this.type = type;

    this._updates_before_fetch = undefined;
    this._fetchxhr = false;

    this.handle = this.handle.bind(this);
    dispatcher.AppDispatcher.register(this.handle);

    // Avoid double-fetch on startup.
    if (!(window.ws && window.ws.readyState === WebSocket.CONNECTING)) {
        this.fetch();
    }
}
_.extend(LiveStoreMixin.prototype, {
    handle: function (event) {
        if (event.type === actions.ActionTypes.CONNECTION_OPEN) {
            return this.fetch();
        }
        if (event.type === this.type) {
            if (event.cmd === actions.StoreCmds.RESET) {
                this.fetch(event.data);
            } else if (this._updates_before_fetch) {
                console.log("defer update", event);
                this._updates_before_fetch.push(event);
            } else {
                this[event.cmd](event.data);
            }
        }
    },
    close: function () {
        dispatcher.AppDispatcher.unregister(this.handle);
    },
    fetch: function (data) {
        console.log("fetch " + this.type);
        if (this._fetchxhr) {
            this._fetchxhr.abort();
        }
        this._updates_before_fetch = []; // (JS: empty array is true)
        if (data) {
            this.handle_fetch(data);
        } else {
            this._fetchxhr = $.getJSON("/" + this.type)
                .done(function (message) {
                    this.handle_fetch(message.data);
                }.bind(this))
                .fail(function () {
                    EventLogActions.add_event("Could not fetch " + this.type);
                }.bind(this));
        }
    },
    handle_fetch: function (data) {
        this._fetchxhr = false;
        console.log(this.type + " fetched.", this._updates_before_fetch);
        this.reset(data);
        var updates = this._updates_before_fetch;
        this._updates_before_fetch = false;
        for (var i = 0; i < updates.length; i++) {
            this.handle(updates[i]);
        }
    },
});

function LiveListStore(type) {
    ListStore.call(this);
    LiveStoreMixin.call(this, type);
}
_.extend(LiveListStore.prototype, ListStore.prototype, LiveStoreMixin.prototype);

function LiveDictStore(type) {
    DictStore.call(this);
    LiveStoreMixin.call(this, type);
}
_.extend(LiveDictStore.prototype, DictStore.prototype, LiveStoreMixin.prototype);


function FlowStore() {
    return new LiveListStore(actions.ActionTypes.FLOW_STORE);
}

function SettingsStore() {
    return new LiveDictStore(actions.ActionTypes.SETTINGS_STORE);
}

function EventLogStore() {
    LiveListStore.call(this, actions.ActionTypes.EVENT_STORE);
}
_.extend(EventLogStore.prototype, LiveListStore.prototype, {
    fetch: function(){
        LiveListStore.prototype.fetch.apply(this, arguments);

        // Make sure to display updates even if fetching all events failed.
        // This way, we can send "fetch failed" log messages to the log.
        if(this._fetchxhr){
            this._fetchxhr.fail(function(){
                this.handle_fetch(null);
            }.bind(this));
        }
    }
});


module.exports = {
    EventLogStore: EventLogStore,
    SettingsStore: SettingsStore,
    FlowStore: FlowStore
};

},{"../actions.js":2,"../dispatcher.js":15,"../utils.js":20,"events":1,"jquery":"jquery","lodash":"lodash"}],19:[function(require,module,exports){

var EventEmitter = require('events').EventEmitter;
var _ = require("lodash");


var utils = require("../utils.js");

function SortByStoreOrder(elem) {
    return this.store.index(elem.id);
}

var default_sort = SortByStoreOrder;
var default_filt = function(elem){
    return true;
};

function StoreView(store, filt, sortfun) {
    EventEmitter.call(this);
    filt = filt || default_filt;
    sortfun = sortfun || default_sort;

    this.store = store;

    this.add = this.add.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
    this.recalculate = this.recalculate.bind(this);
    this.store.addListener("add", this.add);
    this.store.addListener("update", this.update);
    this.store.addListener("remove", this.remove);
    this.store.addListener("recalculate", this.recalculate);

    this.recalculate(filt, sortfun);
}

_.extend(StoreView.prototype, EventEmitter.prototype, {
    close: function () {
        this.store.removeListener("add", this.add);
        this.store.removeListener("update", this.update);
        this.store.removeListener("remove", this.remove);
        this.store.removeListener("recalculate", this.recalculate);
        },
        recalculate: function (filt, sortfun) {
        if (filt) {
            this.filt = filt.bind(this);
        }
        if (sortfun) {
            this.sortfun = sortfun.bind(this);
        }

        this.list = this.store.list.filter(this.filt);
        this.list.sort(function (a, b) {
            return this.sortfun(a) - this.sortfun(b);
        }.bind(this));
        this.emit("recalculate");
    },
    index: function (elem) {
        return _.sortedIndex(this.list, elem, this.sortfun);
    },
    add: function (elem) {
        if (this.filt(elem)) {
            var idx = this.index(elem);
            if (idx === this.list.length) { //happens often, .push is way faster.
                this.list.push(elem);
            } else {
                this.list.splice(idx, 0, elem);
            }
            this.emit("add", elem, idx);
        }
    },
    update: function (elem) {
        var idx;
        var i = this.list.length;
        // Search from the back, we usually update the latest entries.
        while (i--) {
            if (this.list[i].id === elem.id) {
                idx = i;
                break;
            }
        }

        if (idx === -1) { //not contained in list
            this.add(elem);
        } else if (!this.filt(elem)) {
            this.remove(elem.id);
        } else {
            if (this.sortfun(this.list[idx]) !== this.sortfun(elem)) { //sortpos has changed
                this.remove(this.list[idx]);
                this.add(elem);
            } else {
                this.list[idx] = elem;
                this.emit("update", elem, idx);
            }
        }
    },
    remove: function (elem_id) {
        var idx = this.list.length;
        while (idx--) {
            if (this.list[idx].id === elem_id) {
                this.list.splice(idx, 1);
                this.emit("remove", elem_id, idx);
                break;
            }
        }
    }
});

module.exports = {
    StoreView: StoreView
};

},{"../utils.js":20,"events":1,"lodash":"lodash"}],20:[function(require,module,exports){
var $ = require("jquery");


var Key = {
    UP: 38,
    DOWN: 40,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    HOME: 36,
    END: 35,
    LEFT: 37,
    RIGHT: 39,
    ENTER: 13,
    ESC: 27,
    TAB: 9,
    SPACE: 32,
    BACKSPACE: 8,
};
// Add A-Z
for (var i = 65; i <= 90; i++) {
    Key[String.fromCharCode(i)] = i;
}


var formatSize = function (bytes) {
    if (bytes === 0)
        return "0";
    var prefix = ["b", "kb", "mb", "gb", "tb"];
    for (var i = 0; i < prefix.length; i++){
        if (Math.pow(1024, i + 1) > bytes){
            break;
        }
    }
    var precision;
    if (bytes%Math.pow(1024, i) === 0)
        precision = 0;
    else
        precision = 1;
    return (bytes/Math.pow(1024, i)).toFixed(precision) + prefix[i];
};


var formatTimeDelta = function (milliseconds) {
    var time = milliseconds;
    var prefix = ["ms", "s", "min", "h"];
    var div = [1000, 60, 60];
    var i = 0;
    while (Math.abs(time) >= div[i] && i < div.length) {
        time = time / div[i];
        i++;
    }
    return Math.round(time) + prefix[i];
};


var formatTimeStamp = function (seconds) {
    var ts = (new Date(seconds * 1000)).toISOString();
    return ts.replace("T", " ").replace("Z", "");
};


function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}
var xsrf = $.param({_xsrf: getCookie("_xsrf")});

//Tornado XSRF Protection.
$.ajaxPrefilter(function (options) {
    if (["post", "put", "delete"].indexOf(options.type.toLowerCase()) >= 0 && options.url[0] === "/") {
        if (options.data) {
            options.data += ("&" + xsrf);
        } else {
            options.data = xsrf;
        }
    }
});
// Log AJAX Errors
$(document).ajaxError(function (event, jqXHR, ajaxSettings, thrownError) {
    var message = jqXHR.responseText;
    console.error(message, arguments);
    EventLogActions.add_event(thrownError + ": " + message);
    window.alert(message);
});

module.exports = {
    formatSize: formatSize,
    formatTimeDelta: formatTimeDelta,
    formatTimeStamp: formatTimeStamp,
    Key: Key
};

},{"jquery":"jquery"}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi9ob21lL2xwZXJhbHRhL2Rldi9taXRtcHJveHkvd2ViL3NyYy9qcy9hY3Rpb25zLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL2FwcC5qcyIsIi9ob21lL2xwZXJhbHRhL2Rldi9taXRtcHJveHkvd2ViL3NyYy9qcy9jb21wb25lbnRzL2NvbW1vbi5qcyIsIi9ob21lL2xwZXJhbHRhL2Rldi9taXRtcHJveHkvd2ViL3NyYy9qcy9jb21wb25lbnRzL2V2ZW50bG9nLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL2NvbXBvbmVudHMvZmxvd2RldGFpbC5qcyIsIi9ob21lL2xwZXJhbHRhL2Rldi9taXRtcHJveHkvd2ViL3NyYy9qcy9jb21wb25lbnRzL2Zsb3d0YWJsZS1jb2x1bW5zLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL2NvbXBvbmVudHMvZmxvd3RhYmxlLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL2NvbXBvbmVudHMvZm9vdGVyLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL2NvbXBvbmVudHMvaGVhZGVyLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL2NvbXBvbmVudHMvbWFpbnZpZXcuanMiLCIvaG9tZS9scGVyYWx0YS9kZXYvbWl0bXByb3h5L3dlYi9zcmMvanMvY29tcG9uZW50cy9wcm94eWFwcC5qcyIsIi9ob21lL2xwZXJhbHRhL2Rldi9taXRtcHJveHkvd2ViL3NyYy9qcy9jb21wb25lbnRzL3ZpcnR1YWxzY3JvbGwuanMiLCIvaG9tZS9scGVyYWx0YS9kZXYvbWl0bXByb3h5L3dlYi9zcmMvanMvY29ubmVjdGlvbi5qcyIsIi9ob21lL2xwZXJhbHRhL2Rldi9taXRtcHJveHkvd2ViL3NyYy9qcy9kaXNwYXRjaGVyLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL2ZpbHQvZmlsdC5qcyIsIi9ob21lL2xwZXJhbHRhL2Rldi9taXRtcHJveHkvd2ViL3NyYy9qcy9mbG93L3V0aWxzLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL3N0b3JlL3N0b3JlLmpzIiwiL2hvbWUvbHBlcmFsdGEvZGV2L21pdG1wcm94eS93ZWIvc3JjL2pzL3N0b3JlL3ZpZXcuanMiLCIvaG9tZS9scGVyYWx0YS9kZXYvbWl0bXByb3h5L3dlYi9zcmMvanMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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LEdBQUcsRUFBRTtRQUM5RixJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUU7WUFDZCxPQUFPLENBQUMsSUFBSSxLQUFLLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQztTQUNoQyxNQUFNO1lBQ0gsT0FBTyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7U0FDdkI7S0FDSjtDQUNKLENBQUMsQ0FBQztBQUNILGtCQUFrQjtBQUNsQixDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDLFVBQVUsS0FBSyxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFO0lBQ3JFLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUM7SUFDakMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDbEMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsSUFBSSxHQUFHLE9BQU8sQ0FBQyxDQUFDO0lBQ3hELE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDMUIsQ0FBQyxDQUFDLENBQUM7O0FBRUgsTUFBTSxDQUFDLE9BQU8sR0FBRztJQUNiLFVBQVUsRUFBRSxVQUFVO0lBQ3RCLGVBQWUsRUFBRSxlQUFlO0lBQ2hDLGVBQWUsRUFBRSxlQUFlO0lBQ2hDLEdBQUcsRUFBRSxHQUFHO0NBQ1giLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyICQgPSByZXF1aXJlKFwianF1ZXJ5XCIpO1xuXG52YXIgQWN0aW9uVHlwZXMgPSB7XG4gICAgLy8gQ29ubmVjdGlvblxuICAgIENPTk5FQ1RJT05fT1BFTjogXCJjb25uZWN0aW9uX29wZW5cIixcbiAgICBDT05ORUNUSU9OX0NMT1NFOiBcImNvbm5lY3Rpb25fY2xvc2VcIixcbiAgICBDT05ORUNUSU9OX0VSUk9SOiBcImNvbm5lY3Rpb25fZXJyb3JcIixcblxuICAgIC8vIFN0b3Jlc1xuICAgIFNFVFRJTkdTX1NUT1JFOiBcInNldHRpbmdzXCIsXG4gICAgRVZFTlRfU1RPUkU6IFwiZXZlbnRzXCIsXG4gICAgRkxPV19TVE9SRTogXCJmbG93c1wiLFxufTtcblxudmFyIFN0b3JlQ21kcyA9IHtcbiAgICBBREQ6IFwiYWRkXCIsXG4gICAgVVBEQVRFOiBcInVwZGF0ZVwiLFxuICAgIFJFTU9WRTogXCJyZW1vdmVcIixcbiAgICBSRVNFVDogXCJyZXNldFwiXG59O1xuXG52YXIgQ29ubmVjdGlvbkFjdGlvbnMgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24gKCkge1xuICAgICAgICBBcHBEaXNwYXRjaGVyLmRpc3BhdGNoVmlld0FjdGlvbih7XG4gICAgICAgICAgICB0eXBlOiBBY3Rpb25UeXBlcy5DT05ORUNUSU9OX09QRU5cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICBBcHBEaXNwYXRjaGVyLmRpc3BhdGNoVmlld0FjdGlvbih7XG4gICAgICAgICAgICB0eXBlOiBBY3Rpb25UeXBlcy5DT05ORUNUSU9OX0NMT1NFXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgZXJyb3I6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgQXBwRGlzcGF0Y2hlci5kaXNwYXRjaFZpZXdBY3Rpb24oe1xuICAgICAgICAgICAgdHlwZTogQWN0aW9uVHlwZXMuQ09OTkVDVElPTl9FUlJPUlxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG52YXIgU2V0dGluZ3NBY3Rpb25zID0ge1xuICAgIHVwZGF0ZTogZnVuY3Rpb24gKHNldHRpbmdzKSB7XG5cbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiUFVUXCIsXG4gICAgICAgICAgICB1cmw6IFwiL3NldHRpbmdzXCIsXG4gICAgICAgICAgICBkYXRhOiBzZXR0aW5nc1xuICAgICAgICB9KTtcblxuICAgICAgICAvKlxuICAgICAgICAvL0ZhY2Vib29rIEZsdXg6IFdlIGRvIGFuIG9wdGltaXN0aWMgdXBkYXRlIG9uIHRoZSBjbGllbnQgYWxyZWFkeS5cbiAgICAgICAgQXBwRGlzcGF0Y2hlci5kaXNwYXRjaFZpZXdBY3Rpb24oe1xuICAgICAgICAgICAgdHlwZTogQWN0aW9uVHlwZXMuU0VUVElOR1NfU1RPUkUsXG4gICAgICAgICAgICBjbWQ6IFN0b3JlQ21kcy5VUERBVEUsXG4gICAgICAgICAgICBkYXRhOiBzZXR0aW5nc1xuICAgICAgICB9KTtcbiAgICAgICAgKi9cbiAgICB9XG59O1xuXG52YXIgRXZlbnRMb2dBY3Rpb25zX2V2ZW50X2lkID0gMDtcbnZhciBFdmVudExvZ0FjdGlvbnMgPSB7XG4gICAgYWRkX2V2ZW50OiBmdW5jdGlvbiAobWVzc2FnZSkge1xuICAgICAgICBBcHBEaXNwYXRjaGVyLmRpc3BhdGNoVmlld0FjdGlvbih7XG4gICAgICAgICAgICB0eXBlOiBBY3Rpb25UeXBlcy5FVkVOVF9TVE9SRSxcbiAgICAgICAgICAgIGNtZDogU3RvcmVDbWRzLkFERCxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgIGxldmVsOiBcIndlYlwiLFxuICAgICAgICAgICAgICAgIGlkOiBcInZpZXdBY3Rpb24tXCIgKyBFdmVudExvZ0FjdGlvbnNfZXZlbnRfaWQrK1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG52YXIgRmxvd0FjdGlvbnMgPSB7XG4gICAgYWNjZXB0OiBmdW5jdGlvbiAoZmxvdykge1xuICAgICAgICAkLnBvc3QoXCIvZmxvd3MvXCIgKyBmbG93LmlkICsgXCIvYWNjZXB0XCIpO1xuICAgIH0sXG4gICAgYWNjZXB0X2FsbDogZnVuY3Rpb24oKXtcbiAgICAgICAgJC5wb3N0KFwiL2Zsb3dzL2FjY2VwdFwiKTtcbiAgICB9LFxuICAgIFwiZGVsZXRlXCI6IGZ1bmN0aW9uKGZsb3cpe1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTpcIkRFTEVURVwiLFxuICAgICAgICAgICAgdXJsOiBcIi9mbG93cy9cIiArIGZsb3cuaWRcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBkdXBsaWNhdGU6IGZ1bmN0aW9uKGZsb3cpe1xuICAgICAgICAkLnBvc3QoXCIvZmxvd3MvXCIgKyBmbG93LmlkICsgXCIvZHVwbGljYXRlXCIpO1xuICAgIH0sXG4gICAgcmVwbGF5OiBmdW5jdGlvbihmbG93KXtcbiAgICAgICAgJC5wb3N0KFwiL2Zsb3dzL1wiICsgZmxvdy5pZCArIFwiL3JlcGxheVwiKTtcbiAgICB9LFxuICAgIHJldmVydDogZnVuY3Rpb24oZmxvdyl7XG4gICAgICAgICQucG9zdChcIi9mbG93cy9cIiArIGZsb3cuaWQgKyBcIi9yZXZlcnRcIik7XG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChmbG93KSB7XG4gICAgICAgIEFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uKHtcbiAgICAgICAgICAgIHR5cGU6IEFjdGlvblR5cGVzLkZMT1dfU1RPUkUsXG4gICAgICAgICAgICBjbWQ6IFN0b3JlQ21kcy5VUERBVEUsXG4gICAgICAgICAgICBkYXRhOiBmbG93XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgY2xlYXI6IGZ1bmN0aW9uKCl7XG4gICAgICAgICQucG9zdChcIi9jbGVhclwiKTtcbiAgICB9XG59O1xuXG5RdWVyeSA9IHtcbiAgICBGSUxURVI6IFwiZlwiLFxuICAgIEhJR0hMSUdIVDogXCJoXCIsXG4gICAgU0hPV19FVkVOVExPRzogXCJlXCJcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEFjdGlvblR5cGVzOiBBY3Rpb25UeXBlcyxcbiAgICBDb25uZWN0aW9uQWN0aW9uczogQ29ubmVjdGlvbkFjdGlvbnMsXG4gICAgRmxvd0FjdGlvbnM6IEZsb3dBY3Rpb25zLFxuICAgIFN0b3JlQ21kczogU3RvcmVDbWRzXG59OyIsIlxudmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xudmFyIFJlYWN0Um91dGVyID0gcmVxdWlyZShcInJlYWN0LXJvdXRlclwiKTtcbnZhciAkID0gcmVxdWlyZShcImpxdWVyeVwiKTtcblxudmFyIENvbm5lY3Rpb24gPSByZXF1aXJlKFwiLi9jb25uZWN0aW9uXCIpO1xudmFyIHByb3h5YXBwID0gcmVxdWlyZShcIi4vY29tcG9uZW50cy9wcm94eWFwcC5qc1wiKTtcblxuJChmdW5jdGlvbiAoKSB7XG4gICAgd2luZG93LndzID0gbmV3IENvbm5lY3Rpb24oXCIvdXBkYXRlc1wiKTtcblxuICAgIFJlYWN0Um91dGVyLnJ1bihwcm94eWFwcC5yb3V0ZXMsIGZ1bmN0aW9uIChIYW5kbGVyKSB7XG4gICAgICAgIFJlYWN0LnJlbmRlcig8SGFuZGxlci8+LCBkb2N1bWVudC5ib2R5KTtcbiAgICB9KTtcbn0pO1xuXG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XG52YXIgUmVhY3RSb3V0ZXIgPSByZXF1aXJlKFwicmVhY3Qtcm91dGVyXCIpO1xudmFyIF8gPSByZXF1aXJlKFwibG9kYXNoXCIpO1xuXG4vLyBodHRwOi8vYmxvZy52amV1eC5jb20vMjAxMy9qYXZhc2NyaXB0L3Njcm9sbC1wb3NpdGlvbi13aXRoLXJlYWN0Lmh0bWwgKGFsc28gY29udGFpbnMgaW52ZXJzZSBleGFtcGxlKVxudmFyIEF1dG9TY3JvbGxNaXhpbiA9IHtcbiAgICBjb21wb25lbnRXaWxsVXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBub2RlID0gdGhpcy5nZXRET01Ob2RlKCk7XG4gICAgICAgIHRoaXMuX3Nob3VsZFNjcm9sbEJvdHRvbSA9IChcbiAgICAgICAgICAgIG5vZGUuc2Nyb2xsVG9wICE9PSAwICYmXG4gICAgICAgICAgICBub2RlLnNjcm9sbFRvcCArIG5vZGUuY2xpZW50SGVpZ2h0ID09PSBub2RlLnNjcm9sbEhlaWdodFxuICAgICAgICApO1xuICAgIH0sXG4gICAgY29tcG9uZW50RGlkVXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaG91bGRTY3JvbGxCb3R0b20pIHtcbiAgICAgICAgICAgIHZhciBub2RlID0gdGhpcy5nZXRET01Ob2RlKCk7XG4gICAgICAgICAgICBub2RlLnNjcm9sbFRvcCA9IG5vZGUuc2Nyb2xsSGVpZ2h0O1xuICAgICAgICB9XG4gICAgfSxcbn07XG5cblxudmFyIFN0aWNreUhlYWRNaXhpbiA9IHtcbiAgICBhZGp1c3RIZWFkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIEFidXNpbmcgQ1NTIHRyYW5zZm9ybXMgdG8gc2V0IHRoZSBlbGVtZW50XG4gICAgICAgIC8vIHJlZmVyZW5jZWQgYXMgaGVhZCBpbnRvIHNvbWUga2luZCBvZiBwb3NpdGlvbjpzdGlja3kuXG4gICAgICAgIHZhciBoZWFkID0gdGhpcy5yZWZzLmhlYWQuZ2V0RE9NTm9kZSgpO1xuICAgICAgICBoZWFkLnN0eWxlLnRyYW5zZm9ybSA9IFwidHJhbnNsYXRlKDAsXCIgKyB0aGlzLmdldERPTU5vZGUoKS5zY3JvbGxUb3AgKyBcInB4KVwiO1xuICAgIH1cbn07XG5cblxudmFyIE5hdmlnYXRpb24gPSBfLmV4dGVuZCh7fSwgUmVhY3RSb3V0ZXIuTmF2aWdhdGlvbiwge1xuICAgIHNldFF1ZXJ5OiBmdW5jdGlvbiAoZGljdCkge1xuICAgICAgICB2YXIgcSA9IHRoaXMuY29udGV4dC5nZXRDdXJyZW50UXVlcnkoKTtcbiAgICAgICAgZm9yKHZhciBpIGluIGRpY3Qpe1xuICAgICAgICAgICAgaWYoZGljdC5oYXNPd25Qcm9wZXJ0eShpKSl7XG4gICAgICAgICAgICAgICAgcVtpXSA9IGRpY3RbaV0gfHwgdW5kZWZpbmVkOyAvL2ZhbHNleSB2YWx1ZXMgc2hhbGwgYmUgcmVtb3ZlZC5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxLl8gPSBcIl9cIjsgLy8gd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL3JhY2t0L3JlYWN0LXJvdXRlci9wdWxsLzU5OVxuICAgICAgICB0aGlzLnJlcGxhY2VXaXRoKHRoaXMuY29udGV4dC5nZXRDdXJyZW50UGF0aCgpLCB0aGlzLmNvbnRleHQuZ2V0Q3VycmVudFBhcmFtcygpLCBxKTtcbiAgICB9LFxuICAgIHJlcGxhY2VXaXRoOiBmdW5jdGlvbihyb3V0ZU5hbWVPclBhdGgsIHBhcmFtcywgcXVlcnkpIHtcbiAgICAgICAgaWYocm91dGVOYW1lT3JQYXRoID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgcm91dGVOYW1lT3JQYXRoID0gdGhpcy5jb250ZXh0LmdldEN1cnJlbnRQYXRoKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYocGFyYW1zID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5jb250ZXh0LmdldEN1cnJlbnRQYXJhbXMoKTtcbiAgICAgICAgfVxuICAgICAgICBpZihxdWVyeSA9PT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHF1ZXJ5ID0gdGhpcy5jb250ZXh0LmdldEN1cnJlbnRRdWVyeSgpO1xuICAgICAgICB9XG4gICAgICAgIFJlYWN0Um91dGVyLk5hdmlnYXRpb24ucmVwbGFjZVdpdGguY2FsbCh0aGlzLCByb3V0ZU5hbWVPclBhdGgsIHBhcmFtcywgcXVlcnkpO1xuICAgIH1cbn0pO1xuXy5leHRlbmQoTmF2aWdhdGlvbi5jb250ZXh0VHlwZXMsIFJlYWN0Um91dGVyLlN0YXRlLmNvbnRleHRUeXBlcyk7XG5cbnZhciBTdGF0ZSA9IF8uZXh0ZW5kKHt9LCBSZWFjdFJvdXRlci5TdGF0ZSwge1xuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLl9xdWVyeSA9IHRoaXMuY29udGV4dC5nZXRDdXJyZW50UXVlcnkoKTtcbiAgICAgICAgdGhpcy5fcXVlcnlXYXRjaGVzID0gW107XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgb25RdWVyeUNoYW5nZTogZnVuY3Rpb24gKGtleSwgY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5fcXVlcnlXYXRjaGVzLnB1c2goe1xuICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICBjYWxsYmFjazogY2FsbGJhY2tcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbiAobmV4dFByb3BzLCBuZXh0U3RhdGUpIHtcbiAgICAgICAgdmFyIHEgPSB0aGlzLmNvbnRleHQuZ2V0Q3VycmVudFF1ZXJ5KCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fcXVlcnlXYXRjaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgd2F0Y2ggPSB0aGlzLl9xdWVyeVdhdGNoZXNbaV07XG4gICAgICAgICAgICBpZiAodGhpcy5fcXVlcnlbd2F0Y2gua2V5XSAhPT0gcVt3YXRjaC5rZXldKSB7XG4gICAgICAgICAgICAgICAgd2F0Y2guY2FsbGJhY2sodGhpcy5fcXVlcnlbd2F0Y2gua2V5XSwgcVt3YXRjaC5rZXldLCB3YXRjaC5rZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3F1ZXJ5ID0gcTtcbiAgICB9XG59KTtcblxudmFyIFNwbGl0dGVyID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXhpczogXCJ4XCJcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXBwbGllZDogZmFsc2UsXG4gICAgICAgICAgICBzdGFydFg6IGZhbHNlLFxuICAgICAgICAgICAgc3RhcnRZOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgb25Nb3VzZURvd246IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgICAgICAgc3RhcnRYOiBlLnBhZ2VYLFxuICAgICAgICAgICAgc3RhcnRZOiBlLnBhZ2VZXG4gICAgICAgIH0pO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCB0aGlzLm9uTW91c2VNb3ZlKTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIHRoaXMub25Nb3VzZVVwKTtcbiAgICAgICAgLy8gT2NjYXNpb25hbGx5LCBvbmx5IGEgZHJhZ0VuZCBldmVudCBpcyB0cmlnZ2VyZWQsIGJ1dCBubyBtb3VzZVVwLlxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgdGhpcy5vbkRyYWdFbmQpO1xuICAgIH0sXG4gICAgb25EcmFnRW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZ2V0RE9NTm9kZSgpLnN0eWxlLnRyYW5zZm9ybSA9IFwiXCI7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwiZHJhZ2VuZFwiLCB0aGlzLm9uRHJhZ0VuZCk7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCB0aGlzLm9uTW91c2VVcCk7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIHRoaXMub25Nb3VzZU1vdmUpO1xuICAgIH0sXG4gICAgb25Nb3VzZVVwOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICB0aGlzLm9uRHJhZ0VuZCgpO1xuXG4gICAgICAgIHZhciBub2RlID0gdGhpcy5nZXRET01Ob2RlKCk7XG4gICAgICAgIHZhciBwcmV2ID0gbm9kZS5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICAgICAgICB2YXIgbmV4dCA9IG5vZGUubmV4dEVsZW1lbnRTaWJsaW5nO1xuXG4gICAgICAgIHZhciBkWCA9IGUucGFnZVggLSB0aGlzLnN0YXRlLnN0YXJ0WDtcbiAgICAgICAgdmFyIGRZID0gZS5wYWdlWSAtIHRoaXMuc3RhdGUuc3RhcnRZO1xuICAgICAgICB2YXIgZmxleEJhc2lzO1xuICAgICAgICBpZiAodGhpcy5wcm9wcy5heGlzID09PSBcInhcIikge1xuICAgICAgICAgICAgZmxleEJhc2lzID0gcHJldi5vZmZzZXRXaWR0aCArIGRYO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmxleEJhc2lzID0gcHJldi5vZmZzZXRIZWlnaHQgKyBkWTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByZXYuc3R5bGUuZmxleCA9IFwiMCAwIFwiICsgTWF0aC5tYXgoMCwgZmxleEJhc2lzKSArIFwicHhcIjtcbiAgICAgICAgbmV4dC5zdHlsZS5mbGV4ID0gXCIxIDEgYXV0b1wiO1xuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgICAgICAgYXBwbGllZDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5vblJlc2l6ZSgpO1xuICAgIH0sXG4gICAgb25Nb3VzZU1vdmU6IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBkWCA9IDAsIGRZID0gMDtcbiAgICAgICAgaWYgKHRoaXMucHJvcHMuYXhpcyA9PT0gXCJ4XCIpIHtcbiAgICAgICAgICAgIGRYID0gZS5wYWdlWCAtIHRoaXMuc3RhdGUuc3RhcnRYO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZFkgPSBlLnBhZ2VZIC0gdGhpcy5zdGF0ZS5zdGFydFk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5nZXRET01Ob2RlKCkuc3R5bGUudHJhbnNmb3JtID0gXCJ0cmFuc2xhdGUoXCIgKyBkWCArIFwicHgsXCIgKyBkWSArIFwicHgpXCI7XG4gICAgfSxcbiAgICBvblJlc2l6ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBUcmlnZ2VyIGEgZ2xvYmFsIHJlc2l6ZSBldmVudC4gVGhpcyBub3RpZmllcyBjb21wb25lbnRzIHRoYXQgZW1wbG95IHZpcnR1YWwgc2Nyb2xsaW5nXG4gICAgICAgIC8vIHRoYXQgdGhlaXIgdmlld3BvcnQgbWF5IGhhdmUgY2hhbmdlZC5cbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KFwicmVzaXplXCIpKTtcbiAgICAgICAgfSwgMSk7XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKHdpbGxVbm1vdW50KSB7XG4gICAgICAgIGlmICghdGhpcy5zdGF0ZS5hcHBsaWVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmdldERPTU5vZGUoKTtcbiAgICAgICAgdmFyIHByZXYgPSBub2RlLnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gICAgICAgIHZhciBuZXh0ID0gbm9kZS5uZXh0RWxlbWVudFNpYmxpbmc7XG5cbiAgICAgICAgcHJldi5zdHlsZS5mbGV4ID0gXCJcIjtcbiAgICAgICAgbmV4dC5zdHlsZS5mbGV4ID0gXCJcIjtcblxuICAgICAgICBpZiAoIXdpbGxVbm1vdW50KSB7XG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgICAgICBhcHBsaWVkOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vblJlc2l6ZSgpO1xuICAgIH0sXG4gICAgY29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5yZXNldCh0cnVlKTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY2xhc3NOYW1lID0gXCJzcGxpdHRlclwiO1xuICAgICAgICBpZiAodGhpcy5wcm9wcy5heGlzID09PSBcInhcIikge1xuICAgICAgICAgICAgY2xhc3NOYW1lICs9IFwiIHNwbGl0dGVyLXhcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcIiBzcGxpdHRlci15XCI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPXtjbGFzc05hbWV9PlxuICAgICAgICAgICAgICAgIDxkaXYgb25Nb3VzZURvd249e3RoaXMub25Nb3VzZURvd259IGRyYWdnYWJsZT1cInRydWVcIj48L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBTdGF0ZTogU3RhdGUsXG4gICAgTmF2aWdhdGlvbjogTmF2aWdhdGlvbixcbiAgICBTdGlja3lIZWFkTWl4aW46IFN0aWNreUhlYWRNaXhpbixcbiAgICBBdXRvU2Nyb2xsTWl4aW46IEF1dG9TY3JvbGxNaXhpbixcbiAgICBTcGxpdHRlcjogU3BsaXR0ZXJcbn0iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XG52YXIgY29tbW9uID0gcmVxdWlyZShcIi4vY29tbW9uLmpzXCIpO1xudmFyIFZpcnR1YWxTY3JvbGxNaXhpbiA9IHJlcXVpcmUoXCIuL3ZpcnR1YWxzY3JvbGwuanNcIik7XG52YXIgdmlld3MgPSByZXF1aXJlKFwiLi4vc3RvcmUvdmlldy5qc1wiKTtcblxudmFyIExvZ01lc3NhZ2UgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHRoaXMucHJvcHMuZW50cnk7XG4gICAgICAgIHZhciBpbmRpY2F0b3I7XG4gICAgICAgIHN3aXRjaCAoZW50cnkubGV2ZWwpIHtcbiAgICAgICAgICAgIGNhc2UgXCJ3ZWJcIjpcbiAgICAgICAgICAgICAgICBpbmRpY2F0b3IgPSA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1odG1sNVwiPjwvaT47XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiZGVidWdcIjpcbiAgICAgICAgICAgICAgICBpbmRpY2F0b3IgPSA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1idWdcIj48L2k+O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBpbmRpY2F0b3IgPSA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1pbmZvXCI+PC9pPjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICB7IGluZGljYXRvciB9IHtlbnRyeS5tZXNzYWdlfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfSxcbiAgICBzaG91bGRDb21wb25lbnRVcGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBsb2cgZW50cmllcyBhcmUgaW1tdXRhYmxlLlxuICAgIH1cbn0pO1xuXG52YXIgRXZlbnRMb2dDb250ZW50cyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBtaXhpbnM6IFtjb21tb24uQXV0b1Njcm9sbE1peGluLCBWaXJ0dWFsU2Nyb2xsTWl4aW5dLFxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbG9nOiBbXVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgY29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMub3BlblZpZXcodGhpcy5wcm9wcy5ldmVudFN0b3JlKTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuY2xvc2VWaWV3KCk7XG4gICAgfSxcbiAgICBvcGVuVmlldzogZnVuY3Rpb24gKHN0b3JlKSB7XG4gICAgICAgIHZhciB2aWV3ID0gbmV3IHZpZXdzLlN0b3JlVmlldyhzdG9yZSwgZnVuY3Rpb24gKGVudHJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9wcy5maWx0ZXJbZW50cnkubGV2ZWxdO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHZpZXc6IHZpZXdcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmlldy5hZGRMaXN0ZW5lcihcImFkZCByZWNhbGN1bGF0ZVwiLCB0aGlzLm9uRXZlbnRMb2dDaGFuZ2UpO1xuICAgIH0sXG4gICAgY2xvc2VWaWV3OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RhdGUudmlldy5jbG9zZSgpO1xuICAgIH0sXG4gICAgb25FdmVudExvZ0NoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIGxvZzogdGhpcy5zdGF0ZS52aWV3Lmxpc3RcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbiAobmV4dFByb3BzKSB7XG4gICAgICAgIGlmIChuZXh0UHJvcHMuZmlsdGVyICE9PSB0aGlzLnByb3BzLmZpbHRlcikge1xuICAgICAgICAgICAgdGhpcy5wcm9wcy5maWx0ZXIgPSBuZXh0UHJvcHMuZmlsdGVyOyAvLyBEaXJ0eTogTWFrZSBzdXJlIHRoYXQgdmlldyBmaWx0ZXIgc2VlcyB0aGUgdXBkYXRlLlxuICAgICAgICAgICAgdGhpcy5zdGF0ZS52aWV3LnJlY2FsY3VsYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5leHRQcm9wcy5ldmVudFN0b3JlICE9PSB0aGlzLnByb3BzLmV2ZW50U3RvcmUpIHtcbiAgICAgICAgICAgIHRoaXMuY2xvc2VWaWV3KCk7XG4gICAgICAgICAgICB0aGlzLm9wZW5WaWV3KG5leHRQcm9wcy5ldmVudFN0b3JlKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByb3dIZWlnaHQ6IDQ1LFxuICAgICAgICAgICAgcm93SGVpZ2h0TWluOiAxNSxcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyVGFnTmFtZTogXCJkaXZcIlxuICAgICAgICB9O1xuICAgIH0sXG4gICAgcmVuZGVyUm93OiBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICByZXR1cm4gPExvZ01lc3NhZ2Uga2V5PXtlbGVtLmlkfSBlbnRyeT17ZWxlbX0vPjtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcm93cyA9IHRoaXMucmVuZGVyUm93cyh0aGlzLnN0YXRlLmxvZyk7XG5cbiAgICAgICAgcmV0dXJuIDxwcmUgb25TY3JvbGw9e3RoaXMub25TY3JvbGx9PlxuICAgICAgICAgICAgeyB0aGlzLmdldFBsYWNlaG9sZGVyVG9wKHRoaXMuc3RhdGUubG9nLmxlbmd0aCkgfVxuICAgICAgICAgICAge3Jvd3N9XG4gICAgICAgICAgICB7IHRoaXMuZ2V0UGxhY2Vob2xkZXJCb3R0b20odGhpcy5zdGF0ZS5sb2cubGVuZ3RoKSB9XG4gICAgICAgIDwvcHJlPjtcbiAgICB9XG59KTtcblxudmFyIFRvZ2dsZUZpbHRlciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICB0b2dnbGU6IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcHMudG9nZ2xlTGV2ZWwodGhpcy5wcm9wcy5uYW1lKTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY2xhc3NOYW1lID0gXCJsYWJlbCBcIjtcbiAgICAgICAgaWYgKHRoaXMucHJvcHMuYWN0aXZlKSB7XG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCJsYWJlbC1wcmltYXJ5XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCJsYWJlbC1kZWZhdWx0XCI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgaHJlZj1cIiNcIlxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3RoaXMudG9nZ2xlfT5cbiAgICAgICAgICAgICAgICB7dGhpcy5wcm9wcy5uYW1lfVxuICAgICAgICAgICAgPC9hPlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgRXZlbnRMb2cgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBmaWx0ZXI6IHtcbiAgICAgICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgIFwiaW5mb1wiOiB0cnVlLFxuICAgICAgICAgICAgICAgIFwid2ViXCI6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkID0ge307XG4gICAgICAgIGRbUXVlcnkuU0hPV19FVkVOVExPR10gPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuc2V0UXVlcnkoZCk7XG4gICAgfSxcbiAgICB0b2dnbGVMZXZlbDogZnVuY3Rpb24gKGxldmVsKSB7XG4gICAgICAgIHZhciBmaWx0ZXIgPSBfLmV4dGVuZCh7fSwgdGhpcy5zdGF0ZS5maWx0ZXIpO1xuICAgICAgICBmaWx0ZXJbbGV2ZWxdID0gIWZpbHRlcltsZXZlbF07XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe2ZpbHRlcjogZmlsdGVyfSk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZXZlbnRsb2dcIj5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICBFdmVudGxvZ1xuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB1bGwtcmlnaHRcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxUb2dnbGVGaWx0ZXIgbmFtZT1cImRlYnVnXCIgYWN0aXZlPXt0aGlzLnN0YXRlLmZpbHRlci5kZWJ1Z30gdG9nZ2xlTGV2ZWw9e3RoaXMudG9nZ2xlTGV2ZWx9Lz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxUb2dnbGVGaWx0ZXIgbmFtZT1cImluZm9cIiBhY3RpdmU9e3RoaXMuc3RhdGUuZmlsdGVyLmluZm99IHRvZ2dsZUxldmVsPXt0aGlzLnRvZ2dsZUxldmVsfS8+XG4gICAgICAgICAgICAgICAgICAgICAgICA8VG9nZ2xlRmlsdGVyIG5hbWU9XCJ3ZWJcIiBhY3RpdmU9e3RoaXMuc3RhdGUuZmlsdGVyLndlYn0gdG9nZ2xlTGV2ZWw9e3RoaXMudG9nZ2xlTGV2ZWx9Lz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxpIG9uQ2xpY2s9e3RoaXMuY2xvc2V9IGNsYXNzTmFtZT1cImZhIGZhLWNsb3NlXCI+PC9pPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxFdmVudExvZ0NvbnRlbnRzIGZpbHRlcj17dGhpcy5zdGF0ZS5maWx0ZXJ9IGV2ZW50U3RvcmU9e3RoaXMucHJvcHMuZXZlbnRTdG9yZX0vPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRMb2c7IiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xudmFyIF8gPSByZXF1aXJlKFwibG9kYXNoXCIpO1xuXG52YXIgY29tbW9uID0gcmVxdWlyZShcIi4vY29tbW9uLmpzXCIpO1xudmFyIGFjdGlvbnMgPSByZXF1aXJlKFwiLi4vYWN0aW9ucy5qc1wiKTtcbnZhciBmbG93dXRpbHMgPSByZXF1aXJlKFwiLi4vZmxvdy91dGlscy5qc1wiKTtcbnZhciB0b3B1dGlscyA9IHJlcXVpcmUoXCIuLi91dGlscy5qc1wiKTtcblxudmFyIE5hdkFjdGlvbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBvbkNsaWNrOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHRoaXMucHJvcHMub25DbGljaygpO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8YSB0aXRsZT17dGhpcy5wcm9wcy50aXRsZX1cbiAgICAgICAgICAgICAgICBocmVmPVwiI1wiXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibmF2LWFjdGlvblwiXG4gICAgICAgICAgICAgICAgb25DbGljaz17dGhpcy5vbkNsaWNrfT5cbiAgICAgICAgICAgICAgICA8aSBjbGFzc05hbWU9e1wiZmEgZmEtZncgXCIgKyB0aGlzLnByb3BzLmljb259PjwvaT5cbiAgICAgICAgICAgIDwvYT5cbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIEZsb3dEZXRhaWxOYXYgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuXG4gICAgICAgIHZhciB0YWJzID0gdGhpcy5wcm9wcy50YWJzLm1hcChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgdmFyIHN0ciA9IGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBlLnNsaWNlKDEpO1xuICAgICAgICAgICAgdmFyIGNsYXNzTmFtZSA9IHRoaXMucHJvcHMuYWN0aXZlID09PSBlID8gXCJhY3RpdmVcIiA6IFwiXCI7XG4gICAgICAgICAgICB2YXIgb25DbGljayA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMuc2VsZWN0VGFiKGUpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICByZXR1cm4gPGEga2V5PXtlfVxuICAgICAgICAgICAgICAgIGhyZWY9XCIjXCJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtvbkNsaWNrfT57c3RyfTwvYT47XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdmFyIGFjY2VwdEJ1dHRvbiA9IG51bGw7XG4gICAgICAgIGlmKGZsb3cuaW50ZXJjZXB0ZWQpe1xuICAgICAgICAgICAgYWNjZXB0QnV0dG9uID0gPE5hdkFjdGlvbiB0aXRsZT1cIlthXWNjZXB0IGludGVyY2VwdGVkIGZsb3dcIiBpY29uPVwiZmEtcGxheVwiIG9uQ2xpY2s9e2FjdGlvbnMuRmxvd0FjdGlvbnMuYWNjZXB0LmJpbmQobnVsbCwgZmxvdyl9IC8+O1xuICAgICAgICB9XG4gICAgICAgIHZhciByZXZlcnRCdXR0b24gPSBudWxsO1xuICAgICAgICBpZihmbG93Lm1vZGlmaWVkKXtcbiAgICAgICAgICAgIHJldmVydEJ1dHRvbiA9IDxOYXZBY3Rpb24gdGl0bGU9XCJyZXZlcnQgY2hhbmdlcyB0byBmbG93IFtWXVwiIGljb249XCJmYS1oaXN0b3J5XCIgb25DbGljaz17YWN0aW9ucy5GbG93QWN0aW9ucy5yZXZlcnQuYmluZChudWxsLCBmbG93KX0gLz47XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPG5hdiByZWY9XCJoZWFkXCIgY2xhc3NOYW1lPVwibmF2LXRhYnMgbmF2LXRhYnMtc21cIj5cbiAgICAgICAgICAgICAgICB7dGFic31cbiAgICAgICAgICAgICAgICA8TmF2QWN0aW9uIHRpdGxlPVwiW2RdZWxldGUgZmxvd1wiIGljb249XCJmYS10cmFzaFwiIG9uQ2xpY2s9e2FjdGlvbnMuRmxvd0FjdGlvbnMuZGVsZXRlLmJpbmQobnVsbCwgZmxvdyl9IC8+XG4gICAgICAgICAgICAgICAgPE5hdkFjdGlvbiB0aXRsZT1cIltEXXVwbGljYXRlIGZsb3dcIiBpY29uPVwiZmEtY29weVwiIG9uQ2xpY2s9e2FjdGlvbnMuRmxvd0FjdGlvbnMuZHVwbGljYXRlLmJpbmQobnVsbCwgZmxvdyl9IC8+XG4gICAgICAgICAgICAgICAgPE5hdkFjdGlvbiBkaXNhYmxlZCB0aXRsZT1cIltyXWVwbGF5IGZsb3dcIiBpY29uPVwiZmEtcmVwZWF0XCIgb25DbGljaz17YWN0aW9ucy5GbG93QWN0aW9ucy5yZXBsYXkuYmluZChudWxsLCBmbG93KX0gLz5cbiAgICAgICAgICAgICAgICB7YWNjZXB0QnV0dG9ufVxuICAgICAgICAgICAgICAgIHtyZXZlcnRCdXR0b259XG4gICAgICAgICAgICA8L25hdj5cbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxuXG5cbnZhciBIZWFkZXJzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcm93cyA9IHRoaXMucHJvcHMubWVzc2FnZS5oZWFkZXJzLm1hcChmdW5jdGlvbiAoaGVhZGVyLCBpKSB7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIDx0ciBrZXk9e2l9PlxuICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwiaGVhZGVyLW5hbWVcIj57aGVhZGVyWzBdICsgXCI6XCJ9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cImhlYWRlci12YWx1ZVwiPntoZWFkZXJbMV19PC90ZD5cbiAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwiaGVhZGVyLXRhYmxlXCI+XG4gICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICB7cm93c31cbiAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIEZsb3dEZXRhaWxSZXF1ZXN0ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcbiAgICAgICAgdmFyIGZpcnN0X2xpbmUgPSBbXG4gICAgICAgICAgICBmbG93LnJlcXVlc3QubWV0aG9kLFxuICAgICAgICAgICAgZmxvd3V0aWxzLlJlcXVlc3RVdGlscy5wcmV0dHlfdXJsKGZsb3cucmVxdWVzdCksXG4gICAgICAgICAgICBcIkhUVFAvXCIgKyBmbG93LnJlcXVlc3QuaHR0cHZlcnNpb24uam9pbihcIi5cIilcbiAgICAgICAgXS5qb2luKFwiIFwiKTtcbiAgICAgICAgdmFyIGNvbnRlbnQgPSBudWxsO1xuXHR2YXIgY29udGVudFVybCA9IFwiL2Zsb3dzL1wiICsgZmxvdy5pZCArIFwiL3JlcXVlc3QvY29udGVudFwiO1xuXHR2YXIgcHJpbnRhYmxlQ29udGVudFVybCA9IGNvbnRlbnRVcmwgKyBcIi9wcmludGFibGVcIjtcblxuICAgICAgICBpZiAoZmxvdy5yZXF1ZXN0LmNvbnRlbnRMZW5ndGggPiAwKSB7XG5cdCAgICBjb250ZW50ID0gXG5cdFx0PHNlY3Rpb24+XG4gIFx0XHQgIDxhIGhyZWY9e2NvbnRlbnRVcmx9IHRhcmdldD1cIm5ld1wiPkRvd25sb2FkPC9hPlxuXHRcdCAgPGlmcmFtZSBzcmM9e3ByaW50YWJsZUNvbnRlbnRVcmx9IHdpZHRoPVwiMTAwJVwiPjwvaWZyYW1lPlxuXHRcdDwvc2VjdGlvbj47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250ZW50ID0gPGRpdiBjbGFzc05hbWU9XCJhbGVydCBhbGVydC1pbmZvXCI+Tm8gQ29udGVudDwvZGl2PjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vVE9ETzogU3R5bGluZ1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8c2VjdGlvbj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpcnN0LWxpbmVcIj57IGZpcnN0X2xpbmUgfTwvZGl2PlxuICAgICAgICAgICAgICAgIDxIZWFkZXJzIG1lc3NhZ2U9e2Zsb3cucmVxdWVzdH0vPlxuICAgICAgICAgICAgICAgIDxoci8+XG4gICAgICAgICAgICAgICAge2NvbnRlbnR9XG4gICAgICAgICAgICA8L3NlY3Rpb24+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cblxudmFyIEZsb3dEZXRhaWxSZXNwb25zZSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHZhciBmaXJzdF9saW5lID0gW1xuICAgICAgICAgICAgXCJIVFRQL1wiICsgZmxvdy5yZXNwb25zZS5odHRwdmVyc2lvbi5qb2luKFwiLlwiKSxcbiAgICAgICAgICAgIGZsb3cucmVzcG9uc2UuY29kZSxcbiAgICAgICAgICAgIGZsb3cucmVzcG9uc2UubXNnXG4gICAgICAgIF0uam9pbihcIiBcIik7XG4gICAgICAgIHZhciBjb250ZW50ID0gbnVsbDtcblx0dmFyIGlzUHJpbnRhYmxlID0gZmxvd3V0aWxzLlJlc3BvbnNlVXRpbHMuaXNQcmludGFibGUoZmxvdy5yZXNwb25zZSk7XG5cdHZhciBjb250ZW50VXJsID0gXCIvZmxvd3MvXCIgKyBmbG93LmlkICsgXCIvcmVzcG9uc2UvY29udGVudFwiO1xuXHR2YXIgcHJpbnRhYmxlQ29udGVudFVybCA9IGNvbnRlbnRVcmwgKyBcIi9wcmludGFibGVcIjtcblxuICAgICAgICBpZiAoZmxvdy5yZXNwb25zZS5jb250ZW50TGVuZ3RoID4gMCkge1xuXHQgICAgaWYgKGlzUHJpbnRhYmxlKSB7XG5cdFx0Y29udGVudCA9IFxuXHRcdCAgICA8c2VjdGlvbj5cblx0XHQgICAgICA8YSBocmVmPXtjb250ZW50VXJsfSB0YXJnZXQ9XCJuZXdcIj5Eb3dubG9hZDwvYT5cblx0ICAgICAgICAgICAgICA8aWZyYW1lIHNyYz17cHJpbnRhYmxlQ29udGVudFVybH0gd2lkdGg9XCIxMDAlXCI+PC9pZnJhbWU+IFxuXHRcdCAgICA8L3NlY3Rpb24+O1xuXHRcdH0gZWxzZSB7XG5cdFx0ICAgIGNvbnRlbnQgPSBcblx0XHRcdDxzZWN0aW9uPlxuXHRcdFx0ICBcIlJlc3BvbnNlIENvbnRlbnQgU2l6ZTogXCIgKyB0b3B1dGlscy5mb3JtYXRTaXplKGZsb3cucmVzcG9uc2UuY29udGVudExlbmd0aCk7XG5cdFx0XHQgIDxhIGhyZWY9e2NvbnRlbnRVcmx9IHRhcmdldD1cIm5ld1wiPkRvd25sb2FkPC9hPlxuXHRcdCAgICAgICAgPC9zZWN0aW9uPlxuXHRcdH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnRlbnQgPSA8ZGl2IGNsYXNzTmFtZT1cImFsZXJ0IGFsZXJ0LWluZm9cIj5ObyBDb250ZW50PC9kaXY+O1xuICAgICAgICB9XG5cbiAgICAgICAgLy9UT0RPOiBTdHlsaW5nXG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxzZWN0aW9uPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmlyc3QtbGluZVwiPnsgZmlyc3RfbGluZSB9PC9kaXY+XG4gICAgICAgICAgICAgICAgPEhlYWRlcnMgbWVzc2FnZT17Zmxvdy5yZXNwb25zZX0vPlxuICAgICAgICAgICAgICAgIDxoci8+XG4gICAgICAgICAgICAgICAge2NvbnRlbnR9XG4gICAgICAgICAgICA8L3NlY3Rpb24+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cbnZhciBGbG93RGV0YWlsRXJyb3IgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPHNlY3Rpb24+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhbGVydCBhbGVydC13YXJuaW5nXCI+XG4gICAgICAgICAgICAgICAge2Zsb3cuZXJyb3IubXNnfVxuICAgICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNtYWxsPnsgdG9wdXRpbHMuZm9ybWF0VGltZVN0YW1wKGZsb3cuZXJyb3IudGltZXN0YW1wKSB9PC9zbWFsbD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L3NlY3Rpb24+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cbnZhciBUaW1lU3RhbXAgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgaWYgKCF0aGlzLnByb3BzLnQpIHtcbiAgICAgICAgICAgIC8vc2hvdWxkIGJlIHJldHVybiBudWxsLCBidXQgdGhhdCB0cmlnZ2VycyBhIFJlYWN0IGJ1Zy5cbiAgICAgICAgICAgIHJldHVybiA8dHI+PC90cj47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdHMgPSB0b3B1dGlscy5mb3JtYXRUaW1lU3RhbXAodGhpcy5wcm9wcy50KTtcblxuICAgICAgICB2YXIgZGVsdGE7XG4gICAgICAgIGlmICh0aGlzLnByb3BzLmRlbHRhVG8pIHtcbiAgICAgICAgICAgIGRlbHRhID0gdG9wdXRpbHMuZm9ybWF0VGltZURlbHRhKDEwMDAgKiAodGhpcy5wcm9wcy50IC0gdGhpcy5wcm9wcy5kZWx0YVRvKSk7XG4gICAgICAgICAgICBkZWx0YSA9IDxzcGFuIGNsYXNzTmFtZT1cInRleHQtbXV0ZWRcIj57XCIoXCIgKyBkZWx0YSArIFwiKVwifTwvc3Bhbj47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWx0YSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gPHRyPlxuICAgICAgICAgICAgPHRkPnt0aGlzLnByb3BzLnRpdGxlICsgXCI6XCJ9PC90ZD5cbiAgICAgICAgICAgIDx0ZD57dHN9IHtkZWx0YX08L3RkPlxuICAgICAgICA8L3RyPjtcbiAgICB9XG59KTtcblxudmFyIENvbm5lY3Rpb25JbmZvID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBjb25uID0gdGhpcy5wcm9wcy5jb25uO1xuICAgICAgICB2YXIgYWRkcmVzcyA9IGNvbm4uYWRkcmVzcy5hZGRyZXNzLmpvaW4oXCI6XCIpO1xuXG4gICAgICAgIHZhciBzbmkgPSA8dHIga2V5PVwic25pXCI+PC90cj47IC8vc2hvdWxkIGJlIG51bGwsIGJ1dCB0aGF0IHRyaWdnZXJzIGEgUmVhY3QgYnVnLlxuICAgICAgICBpZiAoY29ubi5zbmkpIHtcbiAgICAgICAgICAgIHNuaSA9IDx0ciBrZXk9XCJzbmlcIj5cbiAgICAgICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgICAgICAgIDxhYmJyIHRpdGxlPVwiVExTIFNlcnZlciBOYW1lIEluZGljYXRpb25cIj5UTFMgU05JOjwvYWJicj5cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZD57Y29ubi5zbml9PC90ZD5cbiAgICAgICAgICAgIDwvdHI+O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwiY29ubmVjdGlvbi10YWJsZVwiPlxuICAgICAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgICAgICAgICAgPHRyIGtleT1cImFkZHJlc3NcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD5BZGRyZXNzOjwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+e2FkZHJlc3N9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAge3NuaX1cbiAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIENlcnRpZmljYXRlSW5mbyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy9UT0RPOiBXZSBzaG91bGQgZmV0Y2ggaHVtYW4tcmVhZGFibGUgY2VydGlmaWNhdGUgcmVwcmVzZW50YXRpb25cbiAgICAgICAgLy8gZnJvbSB0aGUgc2VydmVyXG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuICAgICAgICB2YXIgY2xpZW50X2Nvbm4gPSBmbG93LmNsaWVudF9jb25uO1xuICAgICAgICB2YXIgc2VydmVyX2Nvbm4gPSBmbG93LnNlcnZlcl9jb25uO1xuXG4gICAgICAgIHZhciBwcmVTdHlsZSA9IHttYXhIZWlnaHQ6IDEwMH07XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAge2NsaWVudF9jb25uLmNlcnQgPyA8aDQ+Q2xpZW50IENlcnRpZmljYXRlPC9oND4gOiBudWxsfVxuICAgICAgICAgICAge2NsaWVudF9jb25uLmNlcnQgPyA8cHJlIHN0eWxlPXtwcmVTdHlsZX0+e2NsaWVudF9jb25uLmNlcnR9PC9wcmU+IDogbnVsbH1cblxuICAgICAgICAgICAge3NlcnZlcl9jb25uLmNlcnQgPyA8aDQ+U2VydmVyIENlcnRpZmljYXRlPC9oND4gOiBudWxsfVxuICAgICAgICAgICAge3NlcnZlcl9jb25uLmNlcnQgPyA8cHJlIHN0eWxlPXtwcmVTdHlsZX0+e3NlcnZlcl9jb25uLmNlcnR9PC9wcmU+IDogbnVsbH1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgVGltaW5nID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcbiAgICAgICAgdmFyIHNjID0gZmxvdy5zZXJ2ZXJfY29ubjtcbiAgICAgICAgdmFyIGNjID0gZmxvdy5jbGllbnRfY29ubjtcbiAgICAgICAgdmFyIHJlcSA9IGZsb3cucmVxdWVzdDtcbiAgICAgICAgdmFyIHJlc3AgPSBmbG93LnJlc3BvbnNlO1xuXG4gICAgICAgIHZhciB0aW1lc3RhbXBzID0gW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlNlcnZlciBjb25uLiBpbml0aWF0ZWRcIixcbiAgICAgICAgICAgICAgICB0OiBzYy50aW1lc3RhbXBfc3RhcnQsXG4gICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlNlcnZlciBjb25uLiBUQ1AgaGFuZHNoYWtlXCIsXG4gICAgICAgICAgICAgICAgdDogc2MudGltZXN0YW1wX3RjcF9zZXR1cCxcbiAgICAgICAgICAgICAgICBkZWx0YVRvOiByZXEudGltZXN0YW1wX3N0YXJ0XG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiU2VydmVyIGNvbm4uIFNTTCBoYW5kc2hha2VcIixcbiAgICAgICAgICAgICAgICB0OiBzYy50aW1lc3RhbXBfc3NsX3NldHVwLFxuICAgICAgICAgICAgICAgIGRlbHRhVG86IHJlcS50aW1lc3RhbXBfc3RhcnRcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJDbGllbnQgY29ubi4gZXN0YWJsaXNoZWRcIixcbiAgICAgICAgICAgICAgICB0OiBjYy50aW1lc3RhbXBfc3RhcnQsXG4gICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIHRpdGxlOiBcIkNsaWVudCBjb25uLiBTU0wgaGFuZHNoYWtlXCIsXG4gICAgICAgICAgICAgICAgdDogY2MudGltZXN0YW1wX3NzbF9zZXR1cCxcbiAgICAgICAgICAgICAgICBkZWx0YVRvOiByZXEudGltZXN0YW1wX3N0YXJ0XG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiRmlyc3QgcmVxdWVzdCBieXRlXCIsXG4gICAgICAgICAgICAgICAgdDogcmVxLnRpbWVzdGFtcF9zdGFydCxcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJSZXF1ZXN0IGNvbXBsZXRlXCIsXG4gICAgICAgICAgICAgICAgdDogcmVxLnRpbWVzdGFtcF9lbmQsXG4gICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxuICAgICAgICAgICAgfVxuICAgICAgICBdO1xuXG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICB0aW1lc3RhbXBzLnB1c2goXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJGaXJzdCByZXNwb25zZSBieXRlXCIsXG4gICAgICAgICAgICAgICAgICAgIHQ6IHJlc3AudGltZXN0YW1wX3N0YXJ0LFxuICAgICAgICAgICAgICAgICAgICBkZWx0YVRvOiByZXEudGltZXN0YW1wX3N0YXJ0XG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJSZXNwb25zZSBjb21wbGV0ZVwiLFxuICAgICAgICAgICAgICAgICAgICB0OiByZXNwLnRpbWVzdGFtcF9lbmQsXG4gICAgICAgICAgICAgICAgICAgIGRlbHRhVG86IHJlcS50aW1lc3RhbXBfc3RhcnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9BZGQgdW5pcXVlIGtleSBmb3IgZWFjaCByb3cuXG4gICAgICAgIHRpbWVzdGFtcHMuZm9yRWFjaChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgZS5rZXkgPSBlLnRpdGxlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aW1lc3RhbXBzID0gXy5zb3J0QnkodGltZXN0YW1wcywgJ3QnKTtcblxuICAgICAgICB2YXIgcm93cyA9IHRpbWVzdGFtcHMubWFwKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gPFRpbWVTdGFtcCB7Li4uZX0vPjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGg0PlRpbWluZzwvaDQ+XG4gICAgICAgICAgICAgICAgPHRhYmxlIGNsYXNzTmFtZT1cInRpbWluZy10YWJsZVwiPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICAgICAgICAgIHtyb3dzfVxuICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIEZsb3dEZXRhaWxDb25uZWN0aW9uSW5mbyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHZhciBjbGllbnRfY29ubiA9IGZsb3cuY2xpZW50X2Nvbm47XG4gICAgICAgIHZhciBzZXJ2ZXJfY29ubiA9IGZsb3cuc2VydmVyX2Nvbm47XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8c2VjdGlvbj5cblxuICAgICAgICAgICAgICAgIDxoND5DbGllbnQgQ29ubmVjdGlvbjwvaDQ+XG4gICAgICAgICAgICAgICAgPENvbm5lY3Rpb25JbmZvIGNvbm49e2NsaWVudF9jb25ufS8+XG5cbiAgICAgICAgICAgICAgICA8aDQ+U2VydmVyIENvbm5lY3Rpb248L2g0PlxuICAgICAgICAgICAgICAgIDxDb25uZWN0aW9uSW5mbyBjb25uPXtzZXJ2ZXJfY29ubn0vPlxuXG4gICAgICAgICAgICAgICAgPENlcnRpZmljYXRlSW5mbyBmbG93PXtmbG93fS8+XG5cbiAgICAgICAgICAgICAgICA8VGltaW5nIGZsb3c9e2Zsb3d9Lz5cblxuICAgICAgICAgICAgPC9zZWN0aW9uPlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgYWxsVGFicyA9IHtcbiAgICByZXF1ZXN0OiBGbG93RGV0YWlsUmVxdWVzdCxcbiAgICByZXNwb25zZTogRmxvd0RldGFpbFJlc3BvbnNlLFxuICAgIGVycm9yOiBGbG93RGV0YWlsRXJyb3IsXG4gICAgZGV0YWlsczogRmxvd0RldGFpbENvbm5lY3Rpb25JbmZvXG59O1xuXG52YXIgRmxvd0RldGFpbCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBtaXhpbnM6IFtjb21tb24uU3RpY2t5SGVhZE1peGluLCBjb21tb24uTmF2aWdhdGlvbiwgY29tbW9uLlN0YXRlXSxcbiAgICBnZXRUYWJzOiBmdW5jdGlvbiAoZmxvdykge1xuICAgICAgICB2YXIgdGFicyA9IFtdO1xuICAgICAgICBbXCJyZXF1ZXN0XCIsIFwicmVzcG9uc2VcIiwgXCJlcnJvclwiXS5mb3JFYWNoKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBpZiAoZmxvd1tlXSkge1xuICAgICAgICAgICAgICAgIHRhYnMucHVzaChlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRhYnMucHVzaChcImRldGFpbHNcIik7XG4gICAgICAgIHJldHVybiB0YWJzO1xuICAgIH0sXG4gICAgbmV4dFRhYjogZnVuY3Rpb24gKGkpIHtcbiAgICAgICAgdmFyIHRhYnMgPSB0aGlzLmdldFRhYnModGhpcy5wcm9wcy5mbG93KTtcbiAgICAgICAgdmFyIGN1cnJlbnRJbmRleCA9IHRhYnMuaW5kZXhPZih0aGlzLmdldFBhcmFtcygpLmRldGFpbFRhYik7XG4gICAgICAgIC8vIEpTIG1vZHVsbyBvcGVyYXRvciBkb2Vzbid0IGNvcnJlY3QgbmVnYXRpdmUgbnVtYmVycywgbWFrZSBzdXJlIHRoYXQgd2UgYXJlIHBvc2l0aXZlLlxuICAgICAgICB2YXIgbmV4dEluZGV4ID0gKGN1cnJlbnRJbmRleCArIGkgKyB0YWJzLmxlbmd0aCkgJSB0YWJzLmxlbmd0aDtcbiAgICAgICAgdGhpcy5zZWxlY3RUYWIodGFic1tuZXh0SW5kZXhdKTtcbiAgICB9LFxuICAgIHNlbGVjdFRhYjogZnVuY3Rpb24gKHBhbmVsKSB7XG4gICAgICAgIHRoaXMucmVwbGFjZVdpdGgoXG4gICAgICAgICAgICBcImZsb3dcIixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmbG93SWQ6IHRoaXMuZ2V0UGFyYW1zKCkuZmxvd0lkLFxuICAgICAgICAgICAgICAgIGRldGFpbFRhYjogcGFuZWxcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcbiAgICAgICAgdmFyIHRhYnMgPSB0aGlzLmdldFRhYnMoZmxvdyk7XG4gICAgICAgIHZhciBhY3RpdmUgPSB0aGlzLmdldFBhcmFtcygpLmRldGFpbFRhYjtcblxuICAgICAgICBpZiAoIV8uY29udGFpbnModGFicywgYWN0aXZlKSkge1xuICAgICAgICAgICAgaWYgKGFjdGl2ZSA9PT0gXCJyZXNwb25zZVwiICYmIGZsb3cuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBhY3RpdmUgPSBcImVycm9yXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFjdGl2ZSA9PT0gXCJlcnJvclwiICYmIGZsb3cucmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICBhY3RpdmUgPSBcInJlc3BvbnNlXCI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFjdGl2ZSA9IHRhYnNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNlbGVjdFRhYihhY3RpdmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIFRhYiA9IGFsbFRhYnNbYWN0aXZlXTtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxvdy1kZXRhaWxcIiBvblNjcm9sbD17dGhpcy5hZGp1c3RIZWFkfT5cbiAgICAgICAgICAgICAgICA8Rmxvd0RldGFpbE5hdiByZWY9XCJoZWFkXCJcbiAgICAgICAgICAgICAgICAgICAgZmxvdz17Zmxvd31cbiAgICAgICAgICAgICAgICAgICAgdGFicz17dGFic31cbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlPXthY3RpdmV9XG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdFRhYj17dGhpcy5zZWxlY3RUYWJ9Lz5cbiAgICAgICAgICAgICAgICA8VGFiIGZsb3c9e2Zsb3d9Lz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBGbG93RGV0YWlsOiBGbG93RGV0YWlsXG59O1xuIiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xudmFyIGZsb3d1dGlscyA9IHJlcXVpcmUoXCIuLi9mbG93L3V0aWxzLmpzXCIpO1xudmFyIHV0aWxzID0gcmVxdWlyZShcIi4uL3V0aWxzLmpzXCIpO1xuXG52YXIgVExTQ29sdW1uID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHN0YXRpY3M6IHtcbiAgICAgICAgcmVuZGVyVGl0bGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiA8dGgga2V5PVwidGxzXCIgY2xhc3NOYW1lPVwiY29sLXRsc1wiPjwvdGg+O1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHZhciBzc2wgPSAoZmxvdy5yZXF1ZXN0LnNjaGVtZSA9PSBcImh0dHBzXCIpO1xuICAgICAgICB2YXIgY2xhc3NlcztcbiAgICAgICAgaWYgKHNzbCkge1xuICAgICAgICAgICAgY2xhc3NlcyA9IFwiY29sLXRscyBjb2wtdGxzLWh0dHBzXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGFzc2VzID0gXCJjb2wtdGxzIGNvbC10bHMtaHR0cFwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiA8dGQgY2xhc3NOYW1lPXtjbGFzc2VzfT48L3RkPjtcbiAgICB9XG59KTtcblxuXG52YXIgSWNvbkNvbHVtbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBzdGF0aWNzOiB7XG4gICAgICAgIHJlbmRlclRpdGxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gPHRoIGtleT1cImljb25cIiBjbGFzc05hbWU9XCJjb2wtaWNvblwiPjwvdGg+O1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG5cbiAgICAgICAgdmFyIGljb247XG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgY29udGVudFR5cGUgPSBmbG93dXRpbHMuUmVzcG9uc2VVdGlscy5nZXRDb250ZW50VHlwZShmbG93LnJlc3BvbnNlKTtcblxuICAgICAgICAgICAgLy9UT0RPOiBXZSBzaG91bGQgYXNzaWduIGEgdHlwZSB0byB0aGUgZmxvdyBzb21ld2hlcmUgZWxzZS5cbiAgICAgICAgICAgIGlmIChmbG93LnJlc3BvbnNlLmNvZGUgPT0gMzA0KSB7XG4gICAgICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1ub3QtbW9kaWZpZWRcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoMzAwIDw9IGZsb3cucmVzcG9uc2UuY29kZSAmJiBmbG93LnJlc3BvbnNlLmNvZGUgPCA0MDApIHtcbiAgICAgICAgICAgICAgICBpY29uID0gXCJyZXNvdXJjZS1pY29uLXJlZGlyZWN0XCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvbnRlbnRUeXBlICYmIGNvbnRlbnRUeXBlLmluZGV4T2YoXCJpbWFnZVwiKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1pbWFnZVwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZW50VHlwZSAmJiBjb250ZW50VHlwZS5pbmRleE9mKFwiamF2YXNjcmlwdFwiKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1qc1wiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZW50VHlwZSAmJiBjb250ZW50VHlwZS5pbmRleE9mKFwiY3NzXCIpID49IDApIHtcbiAgICAgICAgICAgICAgICBpY29uID0gXCJyZXNvdXJjZS1pY29uLWNzc1wiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZW50VHlwZSAmJiBjb250ZW50VHlwZS5pbmRleE9mKFwiaHRtbFwiKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1kb2N1bWVudFwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghaWNvbikge1xuICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1wbGFpblwiO1xuICAgICAgICB9XG5cblxuICAgICAgICBpY29uICs9IFwiIHJlc291cmNlLWljb25cIjtcbiAgICAgICAgcmV0dXJuIDx0ZCBjbGFzc05hbWU9XCJjb2wtaWNvblwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e2ljb259PjwvZGl2PlxuICAgICAgICA8L3RkPjtcbiAgICB9XG59KTtcblxudmFyIFBhdGhDb2x1bW4gPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgc3RhdGljczoge1xuICAgICAgICByZW5kZXJUaXRsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIDx0aCBrZXk9XCJwYXRoXCIgY2xhc3NOYW1lPVwiY29sLXBhdGhcIj5QYXRoPC90aD47XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcbiAgICAgICAgcmV0dXJuIDx0ZCBjbGFzc05hbWU9XCJjb2wtcGF0aFwiPlxuICAgICAgICAgICAge2Zsb3cucmVxdWVzdC5pc19yZXBsYXkgPyA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1yZXBlYXQgcHVsbC1yaWdodFwiPjwvaT4gOiBudWxsfVxuICAgICAgICAgICAge2Zsb3cuaW50ZXJjZXB0ZWQgPyA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1wYXVzZSBwdWxsLXJpZ2h0XCI+PC9pPiA6IG51bGx9XG4gICAgICAgICAgICB7Zmxvdy5yZXF1ZXN0LnNjaGVtZSArIFwiOi8vXCIgKyBmbG93LnJlcXVlc3QuaG9zdCArIGZsb3cucmVxdWVzdC5wYXRofVxuICAgICAgICA8L3RkPjtcbiAgICB9XG59KTtcblxuXG52YXIgTWV0aG9kQ29sdW1uID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHN0YXRpY3M6IHtcbiAgICAgICAgcmVuZGVyVGl0bGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiA8dGgga2V5PVwibWV0aG9kXCIgY2xhc3NOYW1lPVwiY29sLW1ldGhvZFwiPk1ldGhvZDwvdGg+O1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHJldHVybiA8dGQgY2xhc3NOYW1lPVwiY29sLW1ldGhvZFwiPntmbG93LnJlcXVlc3QubWV0aG9kfTwvdGQ+O1xuICAgIH1cbn0pO1xuXG5cbnZhciBTdGF0dXNDb2x1bW4gPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgc3RhdGljczoge1xuICAgICAgICByZW5kZXJUaXRsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIDx0aCBrZXk9XCJzdGF0dXNcIiBjbGFzc05hbWU9XCJjb2wtc3RhdHVzXCI+U3RhdHVzPC90aD47XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcbiAgICAgICAgdmFyIHN0YXR1cztcbiAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHN0YXR1cyA9IGZsb3cucmVzcG9uc2UuY29kZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXR1cyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDx0ZCBjbGFzc05hbWU9XCJjb2wtc3RhdHVzXCI+e3N0YXR1c308L3RkPjtcbiAgICB9XG59KTtcblxuXG52YXIgU2l6ZUNvbHVtbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBzdGF0aWNzOiB7XG4gICAgICAgIHJlbmRlclRpdGxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gPHRoIGtleT1cInNpemVcIiBjbGFzc05hbWU9XCJjb2wtc2l6ZVwiPlNpemU8L3RoPjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuXG4gICAgICAgIHZhciB0b3RhbCA9IGZsb3cucmVxdWVzdC5jb250ZW50TGVuZ3RoO1xuICAgICAgICBpZiAoZmxvdy5yZXNwb25zZSkge1xuICAgICAgICAgICAgdG90YWwgKz0gZmxvdy5yZXNwb25zZS5jb250ZW50TGVuZ3RoIHx8IDA7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHNpemUgPSB1dGlscy5mb3JtYXRTaXplKHRvdGFsKTtcbiAgICAgICAgcmV0dXJuIDx0ZCBjbGFzc05hbWU9XCJjb2wtc2l6ZVwiPntzaXplfTwvdGQ+O1xuICAgIH1cbn0pO1xuXG5cbnZhciBUaW1lQ29sdW1uID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHN0YXRpY3M6IHtcbiAgICAgICAgcmVuZGVyVGl0bGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiA8dGgga2V5PVwidGltZVwiIGNsYXNzTmFtZT1cImNvbC10aW1lXCI+VGltZTwvdGg+O1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHZhciB0aW1lO1xuICAgICAgICBpZiAoZmxvdy5yZXNwb25zZSkge1xuICAgICAgICAgICAgdGltZSA9IHV0aWxzLmZvcm1hdFRpbWVEZWx0YSgxMDAwICogKGZsb3cucmVzcG9uc2UudGltZXN0YW1wX2VuZCAtIGZsb3cucmVxdWVzdC50aW1lc3RhbXBfc3RhcnQpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRpbWUgPSBcIi4uLlwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiA8dGQgY2xhc3NOYW1lPVwiY29sLXRpbWVcIj57dGltZX08L3RkPjtcbiAgICB9XG59KTtcblxuXG52YXIgYWxsX2NvbHVtbnMgPSBbXG4gICAgVExTQ29sdW1uLFxuICAgIEljb25Db2x1bW4sXG4gICAgUGF0aENvbHVtbixcbiAgICBNZXRob2RDb2x1bW4sXG4gICAgU3RhdHVzQ29sdW1uLFxuICAgIFNpemVDb2x1bW4sXG4gICAgVGltZUNvbHVtbl07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBhbGxfY29sdW1ucztcblxuXG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XG52YXIgY29tbW9uID0gcmVxdWlyZShcIi4vY29tbW9uLmpzXCIpO1xudmFyIFZpcnR1YWxTY3JvbGxNaXhpbiA9IHJlcXVpcmUoXCIuL3ZpcnR1YWxzY3JvbGwuanNcIik7XG52YXIgZmxvd3RhYmxlX2NvbHVtbnMgPSByZXF1aXJlKFwiLi9mbG93dGFibGUtY29sdW1ucy5qc1wiKTtcblxudmFyIEZsb3dSb3cgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuICAgICAgICB2YXIgY29sdW1ucyA9IHRoaXMucHJvcHMuY29sdW1ucy5tYXAoZnVuY3Rpb24gKENvbHVtbikge1xuICAgICAgICAgICAgcmV0dXJuIDxDb2x1bW4ga2V5PXtDb2x1bW4uZGlzcGxheU5hbWV9IGZsb3c9e2Zsb3d9Lz47XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHZhciBjbGFzc05hbWUgPSBcIlwiO1xuICAgICAgICBpZiAodGhpcy5wcm9wcy5zZWxlY3RlZCkge1xuICAgICAgICAgICAgY2xhc3NOYW1lICs9IFwiIHNlbGVjdGVkXCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMucHJvcHMuaGlnaGxpZ2h0ZWQpIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcIiBoaWdobGlnaHRlZFwiO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbG93LmludGVyY2VwdGVkKSB7XG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCIgaW50ZXJjZXB0ZWRcIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxvdy5yZXF1ZXN0KSB7XG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCIgaGFzLXJlcXVlc3RcIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxvdy5yZXNwb25zZSkge1xuICAgICAgICAgICAgY2xhc3NOYW1lICs9IFwiIGhhcy1yZXNwb25zZVwiO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDx0ciBjbGFzc05hbWU9e2NsYXNzTmFtZX0gb25DbGljaz17dGhpcy5wcm9wcy5zZWxlY3RGbG93LmJpbmQobnVsbCwgZmxvdyl9PlxuICAgICAgICAgICAgICAgIHtjb2x1bW5zfVxuICAgICAgICAgICAgPC90cj4pO1xuICAgIH0sXG4gICAgc2hvdWxkQ29tcG9uZW50VXBkYXRlOiBmdW5jdGlvbiAobmV4dFByb3BzKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAvLyBGdXJ0aGVyIG9wdGltaXphdGlvbiBjb3VsZCBiZSBkb25lIGhlcmVcbiAgICAgICAgLy8gYnkgY2FsbGluZyBmb3JjZVVwZGF0ZSBvbiBmbG93IHVwZGF0ZXMsIHNlbGVjdGlvbiBjaGFuZ2VzIGFuZCBjb2x1bW4gY2hhbmdlcy5cbiAgICAgICAgLy9yZXR1cm4gKFxuICAgICAgICAvLyh0aGlzLnByb3BzLmNvbHVtbnMubGVuZ3RoICE9PSBuZXh0UHJvcHMuY29sdW1ucy5sZW5ndGgpIHx8XG4gICAgICAgIC8vKHRoaXMucHJvcHMuc2VsZWN0ZWQgIT09IG5leHRQcm9wcy5zZWxlY3RlZClcbiAgICAgICAgLy8pO1xuICAgIH1cbn0pO1xuXG52YXIgRmxvd1RhYmxlSGVhZCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNvbHVtbnMgPSB0aGlzLnByb3BzLmNvbHVtbnMubWFwKGZ1bmN0aW9uIChjb2x1bW4pIHtcbiAgICAgICAgICAgIHJldHVybiBjb2x1bW4ucmVuZGVyVGl0bGUoKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgcmV0dXJuIDx0aGVhZD5cbiAgICAgICAgICAgIDx0cj57Y29sdW1uc308L3RyPlxuICAgICAgICA8L3RoZWFkPjtcbiAgICB9XG59KTtcblxuXG52YXIgUk9XX0hFSUdIVCA9IDMyO1xuXG52YXIgRmxvd1RhYmxlID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIG1peGluczogW2NvbW1vbi5TdGlja3lIZWFkTWl4aW4sIGNvbW1vbi5BdXRvU2Nyb2xsTWl4aW4sIFZpcnR1YWxTY3JvbGxNaXhpbl0sXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2x1bW5zOiBmbG93dGFibGVfY29sdW1uc1xuICAgICAgICB9O1xuICAgIH0sXG4gICAgY29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLnByb3BzLnZpZXcpIHtcbiAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5hZGRMaXN0ZW5lcihcImFkZCB1cGRhdGUgcmVtb3ZlIHJlY2FsY3VsYXRlXCIsIHRoaXMub25DaGFuZ2UpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbiAobmV4dFByb3BzKSB7XG4gICAgICAgIGlmIChuZXh0UHJvcHMudmlldyAhPT0gdGhpcy5wcm9wcy52aWV3KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wcm9wcy52aWV3KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9wcy52aWV3LnJlbW92ZUxpc3RlbmVyKFwiYWRkIHVwZGF0ZSByZW1vdmUgcmVjYWxjdWxhdGVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZXh0UHJvcHMudmlldy5hZGRMaXN0ZW5lcihcImFkZCB1cGRhdGUgcmVtb3ZlIHJlY2FsY3VsYXRlXCIsIHRoaXMub25DaGFuZ2UpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXREZWZhdWx0UHJvcHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJvd0hlaWdodDogUk9XX0hFSUdIVFxuICAgICAgICB9O1xuICAgIH0sXG4gICAgb25TY3JvbGxGbG93VGFibGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5hZGp1c3RIZWFkKCk7XG4gICAgICAgIHRoaXMub25TY3JvbGwoKTtcbiAgICB9LFxuICAgIG9uQ2hhbmdlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZm9yY2VVcGRhdGUoKTtcbiAgICB9LFxuICAgIHNjcm9sbEludG9WaWV3OiBmdW5jdGlvbiAoZmxvdykge1xuICAgICAgICB0aGlzLnNjcm9sbFJvd0ludG9WaWV3KFxuICAgICAgICAgICAgdGhpcy5wcm9wcy52aWV3LmluZGV4KGZsb3cpLFxuICAgICAgICAgICAgdGhpcy5yZWZzLmJvZHkuZ2V0RE9NTm9kZSgpLm9mZnNldFRvcFxuICAgICAgICApO1xuICAgIH0sXG4gICAgcmVuZGVyUm93OiBmdW5jdGlvbiAoZmxvdykge1xuICAgICAgICB2YXIgc2VsZWN0ZWQgPSAoZmxvdyA9PT0gdGhpcy5wcm9wcy5zZWxlY3RlZCk7XG4gICAgICAgIHZhciBoaWdobGlnaHRlZCA9XG4gICAgICAgICAgICAoXG4gICAgICAgICAgICB0aGlzLnByb3BzLnZpZXcuX2hpZ2hsaWdodCAmJlxuICAgICAgICAgICAgdGhpcy5wcm9wcy52aWV3Ll9oaWdobGlnaHRbZmxvdy5pZF1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIDxGbG93Um93IGtleT17Zmxvdy5pZH1cbiAgICAgICAgICAgIHJlZj17Zmxvdy5pZH1cbiAgICAgICAgICAgIGZsb3c9e2Zsb3d9XG4gICAgICAgICAgICBjb2x1bW5zPXt0aGlzLnN0YXRlLmNvbHVtbnN9XG4gICAgICAgICAgICBzZWxlY3RlZD17c2VsZWN0ZWR9XG4gICAgICAgICAgICBoaWdobGlnaHRlZD17aGlnaGxpZ2h0ZWR9XG4gICAgICAgICAgICBzZWxlY3RGbG93PXt0aGlzLnByb3BzLnNlbGVjdEZsb3d9XG4gICAgICAgIC8+O1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJyZW5kZXIgZmxvd3RhYmxlXCIsIHRoaXMuc3RhdGUuc3RhcnQsIHRoaXMuc3RhdGUuc3RvcCwgdGhpcy5wcm9wcy5zZWxlY3RlZCk7XG4gICAgICAgIHZhciBmbG93cyA9IHRoaXMucHJvcHMudmlldyA/IHRoaXMucHJvcHMudmlldy5saXN0IDogW107XG5cbiAgICAgICAgdmFyIHJvd3MgPSB0aGlzLnJlbmRlclJvd3MoZmxvd3MpO1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsb3ctdGFibGVcIiBvblNjcm9sbD17dGhpcy5vblNjcm9sbEZsb3dUYWJsZX0+XG4gICAgICAgICAgICAgICAgPHRhYmxlPlxuICAgICAgICAgICAgICAgICAgICA8Rmxvd1RhYmxlSGVhZCByZWY9XCJoZWFkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbnM9e3RoaXMuc3RhdGUuY29sdW1uc30vPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHkgcmVmPVwiYm9keVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgeyB0aGlzLmdldFBsYWNlaG9sZGVyVG9wKGZsb3dzLmxlbmd0aCkgfVxuICAgICAgICAgICAgICAgICAgICAgICAge3Jvd3N9XG4gICAgICAgICAgICAgICAgICAgICAgICB7IHRoaXMuZ2V0UGxhY2Vob2xkZXJCb3R0b20oZmxvd3MubGVuZ3RoKSB9XG4gICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZsb3dUYWJsZTtcbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcblxudmFyIEZvb3RlciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG1vZGUgPSB0aGlzLnByb3BzLnNldHRpbmdzLm1vZGU7XG4gICAgICAgIHZhciBpbnRlcmNlcHQgPSB0aGlzLnByb3BzLnNldHRpbmdzLmludGVyY2VwdDtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxmb290ZXI+XG4gICAgICAgICAgICAgICAge21vZGUgIT0gXCJyZWd1bGFyXCIgPyA8c3BhbiBjbGFzc05hbWU9XCJsYWJlbCBsYWJlbC1zdWNjZXNzXCI+e21vZGV9IG1vZGU8L3NwYW4+IDogbnVsbH1cbiAgICAgICAgICAgICAgICAmbmJzcDtcbiAgICAgICAgICAgICAgICB7aW50ZXJjZXB0ID8gPHNwYW4gY2xhc3NOYW1lPVwibGFiZWwgbGFiZWwtc3VjY2Vzc1wiPkludGVyY2VwdDoge2ludGVyY2VwdH08L3NwYW4+IDogbnVsbH1cbiAgICAgICAgICAgIDwvZm9vdGVyPlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZvb3RlcjsiLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XG52YXIgJCA9IHJlcXVpcmUoXCJqcXVlcnlcIik7XG5cbnZhciBGaWx0ID0gcmVxdWlyZShcIi4uL2ZpbHQvZmlsdC5qc1wiKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoXCIuLi91dGlscy5qc1wiKTtcblxudmFyIGNvbW1vbiA9IHJlcXVpcmUoXCIuL2NvbW1vbi5qc1wiKTtcblxudmFyIEZpbHRlckRvY3MgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgc3RhdGljczoge1xuICAgICAgICB4aHI6IGZhbHNlLFxuICAgICAgICBkb2M6IGZhbHNlXG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFGaWx0ZXJEb2NzLmRvYykge1xuICAgICAgICAgICAgRmlsdGVyRG9jcy54aHIgPSAkLmdldEpTT04oXCIvZmlsdGVyLWhlbHBcIikuZG9uZShmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgICAgICAgRmlsdGVyRG9jcy5kb2MgPSBkb2M7XG4gICAgICAgICAgICAgICAgRmlsdGVyRG9jcy54aHIgPSBmYWxzZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChGaWx0ZXJEb2NzLnhocikge1xuICAgICAgICAgICAgRmlsdGVyRG9jcy54aHIuZG9uZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mb3JjZVVwZGF0ZSgpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghRmlsdGVyRG9jcy5kb2MpIHtcbiAgICAgICAgICAgIHJldHVybiA8aSBjbGFzc05hbWU9XCJmYSBmYS1zcGlubmVyIGZhLXNwaW5cIj48L2k+O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGNvbW1hbmRzID0gRmlsdGVyRG9jcy5kb2MuY29tbWFuZHMubWFwKGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgPHRkPntjWzBdLnJlcGxhY2UoXCIgXCIsICdcXHUwMGEwJyl9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgPHRkPntjWzFdfTwvdGQ+XG4gICAgICAgICAgICAgICAgPC90cj47XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbW1hbmRzLnB1c2goPHRyPlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xTcGFuPVwiMlwiPlxuICAgICAgICAgICAgICAgICAgICA8YSBocmVmPVwiaHR0cHM6Ly9taXRtcHJveHkub3JnL2RvYy9mZWF0dXJlcy9maWx0ZXJzLmh0bWxcIlxuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0PVwiX2JsYW5rXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8aSBjbGFzc05hbWU9XCJmYSBmYS1leHRlcm5hbC1saW5rXCI+PC9pPlxuICAgICAgICAgICAgICAgICAgICAmbmJzcDsgbWl0bXByb3h5IGRvY3M8L2E+XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDwvdHI+KTtcbiAgICAgICAgICAgIHJldHVybiA8dGFibGUgY2xhc3NOYW1lPVwidGFibGUgdGFibGUtY29uZGVuc2VkXCI+XG4gICAgICAgICAgICAgICAgPHRib2R5Pntjb21tYW5kc308L3Rib2R5PlxuICAgICAgICAgICAgPC90YWJsZT47XG4gICAgICAgIH1cbiAgICB9XG59KTtcbnZhciBGaWx0ZXJJbnB1dCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gQ29uc2lkZXIgYm90aCBmb2N1cyBhbmQgbW91c2VvdmVyIGZvciBzaG93aW5nL2hpZGluZyB0aGUgdG9vbHRpcCxcbiAgICAgICAgLy8gYmVjYXVzZSBvbkJsdXIgb2YgdGhlIGlucHV0IGlzIHRyaWdnZXJlZCBiZWZvcmUgdGhlIGNsaWNrIG9uIHRoZSB0b29sdGlwXG4gICAgICAgIC8vIGZpbmFsaXplZCwgaGlkaW5nIHRoZSB0b29sdGlwIGp1c3QgYXMgdGhlIHVzZXIgY2xpY2tzIG9uIGl0LlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMucHJvcHMudmFsdWUsXG4gICAgICAgICAgICBmb2N1czogZmFsc2UsXG4gICAgICAgICAgICBtb3VzZWZvY3VzOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wczogZnVuY3Rpb24gKG5leHRQcm9wcykge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHt2YWx1ZTogbmV4dFByb3BzLnZhbHVlfSk7XG4gICAgfSxcbiAgICBvbkNoYW5nZTogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIG5leHRWYWx1ZSA9IGUudGFyZ2V0LnZhbHVlO1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHZhbHVlOiBuZXh0VmFsdWVcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIE9ubHkgcHJvcGFnYXRlIHZhbGlkIGZpbHRlcnMgdXB3YXJkcy5cbiAgICAgICAgaWYgKHRoaXMuaXNWYWxpZChuZXh0VmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLnByb3BzLm9uQ2hhbmdlKG5leHRWYWx1ZSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGlzVmFsaWQ6IGZ1bmN0aW9uIChmaWx0KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBGaWx0LnBhcnNlKGZpbHQgfHwgdGhpcy5zdGF0ZS52YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXREZXNjOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkZXNjO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZGVzYyA9IEZpbHQucGFyc2UodGhpcy5zdGF0ZS52YWx1ZSkuZGVzYztcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgZGVzYyA9IFwiXCIgKyBlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkZXNjICE9PSBcInRydWVcIikge1xuICAgICAgICAgICAgcmV0dXJuIGRlc2M7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIDxGaWx0ZXJEb2NzLz5cbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIG9uRm9jdXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7Zm9jdXM6IHRydWV9KTtcbiAgICB9LFxuICAgIG9uQmx1cjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtmb2N1czogZmFsc2V9KTtcbiAgICB9LFxuICAgIG9uTW91c2VFbnRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHttb3VzZWZvY3VzOiB0cnVlfSk7XG4gICAgfSxcbiAgICBvbk1vdXNlTGVhdmU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7bW91c2Vmb2N1czogZmFsc2V9KTtcbiAgICB9LFxuICAgIG9uS2V5RG93bjogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gdXRpbHMuS2V5LkVTQyB8fCBlLmtleUNvZGUgPT09IHV0aWxzLktleS5FTlRFUikge1xuICAgICAgICAgICAgdGhpcy5ibHVyKCk7XG4gICAgICAgICAgICAvLyBJZiBjbG9zZWQgdXNpbmcgRVNDL0VOVEVSLCBoaWRlIHRoZSB0b29sdGlwLlxuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7bW91c2Vmb2N1czogZmFsc2V9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgYmx1cjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlZnMuaW5wdXQuZ2V0RE9NTm9kZSgpLmJsdXIoKTtcbiAgICB9LFxuICAgIGZvY3VzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucmVmcy5pbnB1dC5nZXRET01Ob2RlKCkuc2VsZWN0KCk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGlzVmFsaWQgPSB0aGlzLmlzVmFsaWQoKTtcbiAgICAgICAgdmFyIGljb24gPSBcImZhIGZhLWZ3IGZhLVwiICsgdGhpcy5wcm9wcy50eXBlO1xuICAgICAgICB2YXIgZ3JvdXBDbGFzc05hbWUgPSBcImZpbHRlci1pbnB1dCBpbnB1dC1ncm91cFwiICsgKGlzVmFsaWQgPyBcIlwiIDogXCIgaGFzLWVycm9yXCIpO1xuXG4gICAgICAgIHZhciBwb3BvdmVyO1xuICAgICAgICBpZiAodGhpcy5zdGF0ZS5mb2N1cyB8fCB0aGlzLnN0YXRlLm1vdXNlZm9jdXMpIHtcbiAgICAgICAgICAgIHBvcG92ZXIgPSAoXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwb3BvdmVyIGJvdHRvbVwiIG9uTW91c2VFbnRlcj17dGhpcy5vbk1vdXNlRW50ZXJ9IG9uTW91c2VMZWF2ZT17dGhpcy5vbk1vdXNlTGVhdmV9PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFycm93XCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicG9wb3Zlci1jb250ZW50XCI+XG4gICAgICAgICAgICAgICAgICAgIHt0aGlzLmdldERlc2MoKX1cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPXtncm91cENsYXNzTmFtZX0+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiaW5wdXQtZ3JvdXAtYWRkb25cIj5cbiAgICAgICAgICAgICAgICAgICAgPGkgY2xhc3NOYW1lPXtpY29ufSBzdHlsZT17e2NvbG9yOiB0aGlzLnByb3BzLmNvbG9yfX0+PC9pPlxuICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBwbGFjZWhvbGRlcj17dGhpcy5wcm9wcy5wbGFjZWhvbGRlcn0gY2xhc3NOYW1lPVwiZm9ybS1jb250cm9sXCJcbiAgICAgICAgICAgICAgICAgICAgcmVmPVwiaW5wdXRcIlxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17dGhpcy5vbkNoYW5nZX1cbiAgICAgICAgICAgICAgICAgICAgb25Gb2N1cz17dGhpcy5vbkZvY3VzfVxuICAgICAgICAgICAgICAgICAgICBvbkJsdXI9e3RoaXMub25CbHVyfVxuICAgICAgICAgICAgICAgICAgICBvbktleURvd249e3RoaXMub25LZXlEb3dufVxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17dGhpcy5zdGF0ZS52YWx1ZX0vPlxuICAgICAgICAgICAgICAgIHtwb3BvdmVyfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cbnZhciBNYWluTWVudSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBtaXhpbnM6IFtjb21tb24uTmF2aWdhdGlvbiwgY29tbW9uLlN0YXRlXSxcbiAgICBzdGF0aWNzOiB7XG4gICAgICAgIHRpdGxlOiBcIlN0YXJ0XCIsXG4gICAgICAgIHJvdXRlOiBcImZsb3dzXCJcbiAgICB9LFxuICAgIG9uRmlsdGVyQ2hhbmdlOiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIHZhciBkID0ge307XG4gICAgICAgIGRbUXVlcnkuRklMVEVSXSA9IHZhbDtcbiAgICAgICAgdGhpcy5zZXRRdWVyeShkKTtcbiAgICB9LFxuICAgIG9uSGlnaGxpZ2h0Q2hhbmdlOiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIHZhciBkID0ge307XG4gICAgICAgIGRbUXVlcnkuSElHSExJR0hUXSA9IHZhbDtcbiAgICAgICAgdGhpcy5zZXRRdWVyeShkKTtcbiAgICB9LFxuICAgIG9uSW50ZXJjZXB0Q2hhbmdlOiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIFNldHRpbmdzQWN0aW9ucy51cGRhdGUoe2ludGVyY2VwdDogdmFsfSk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZpbHRlciA9IHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5GSUxURVJdIHx8IFwiXCI7XG4gICAgICAgIHZhciBoaWdobGlnaHQgPSB0aGlzLmdldFF1ZXJ5KClbUXVlcnkuSElHSExJR0hUXSB8fCBcIlwiO1xuICAgICAgICB2YXIgaW50ZXJjZXB0ID0gdGhpcy5wcm9wcy5zZXR0aW5ncy5pbnRlcmNlcHQgfHwgXCJcIjtcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1lbnUtcm93XCI+XG4gICAgICAgICAgICAgICAgICAgIDxGaWx0ZXJJbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJGaWx0ZXJcIlxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImZpbHRlclwiXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvcj1cImJsYWNrXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtmaWx0ZXJ9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17dGhpcy5vbkZpbHRlckNoYW5nZX0gLz5cbiAgICAgICAgICAgICAgICAgICAgPEZpbHRlcklucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkhpZ2hsaWdodFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwidGFnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPVwiaHNsKDQ4LCAxMDAlLCA1MCUpXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtoaWdobGlnaHR9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17dGhpcy5vbkhpZ2hsaWdodENoYW5nZX0vPlxuICAgICAgICAgICAgICAgICAgICA8RmlsdGVySW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiSW50ZXJjZXB0XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJwYXVzZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvcj1cImhzbCgyMDgsIDU2JSwgNTMlKVwiXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17aW50ZXJjZXB0fVxuICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e3RoaXMub25JbnRlcmNlcHRDaGFuZ2V9Lz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNsZWFyZml4XCI+PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxuXG52YXIgVmlld01lbnUgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgc3RhdGljczoge1xuICAgICAgICB0aXRsZTogXCJWaWV3XCIsXG4gICAgICAgIHJvdXRlOiBcImZsb3dzXCJcbiAgICB9LFxuICAgIG1peGluczogW2NvbW1vbi5OYXZpZ2F0aW9uLCBjb21tb24uU3RhdGVdLFxuICAgIHRvZ2dsZUV2ZW50TG9nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkID0ge307XG5cbiAgICAgICAgaWYgKHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5TSE9XX0VWRU5UTE9HXSkge1xuICAgICAgICAgICAgZFtRdWVyeS5TSE9XX0VWRU5UTE9HXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRbUXVlcnkuU0hPV19FVkVOVExPR10gPSBcInRcIjsgLy8gYW55IG5vbi1mYWxzZSB2YWx1ZSB3aWxsIGRvIGl0LCBrZWVwIGl0IHNob3J0XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldFF1ZXJ5KGQpO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzaG93RXZlbnRMb2cgPSB0aGlzLmdldFF1ZXJ5KClbUXVlcnkuU0hPV19FVkVOVExPR107XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtcImJ0biBcIiArIChzaG93RXZlbnRMb2cgPyBcImJ0bi1wcmltYXJ5XCIgOiBcImJ0bi1kZWZhdWx0XCIpfVxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXt0aGlzLnRvZ2dsZUV2ZW50TG9nfT5cbiAgICAgICAgICAgICAgICAgICAgPGkgY2xhc3NOYW1lPVwiZmEgZmEtZGF0YWJhc2VcIj48L2k+XG4gICAgICAgICAgICAgICAgJm5ic3A7U2hvdyBFdmVudGxvZ1xuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxzcGFuPiA8L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxuXG52YXIgUmVwb3J0c01lbnUgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgc3RhdGljczoge1xuICAgICAgICB0aXRsZTogXCJWaXN1YWxpemF0aW9uXCIsXG4gICAgICAgIHJvdXRlOiBcInJlcG9ydHNcIlxuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiA8ZGl2PlJlcG9ydHMgTWVudTwvZGl2PjtcbiAgICB9XG59KTtcblxudmFyIEZpbGVNZW51ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc2hvd0ZpbGVNZW51OiBmYWxzZVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgaGFuZGxlRmlsZUNsaWNrOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGlmICghdGhpcy5zdGF0ZS5zaG93RmlsZU1lbnUpIHtcbiAgICAgICAgICAgIHZhciBjbG9zZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFN0YXRlKHtzaG93RmlsZU1lbnU6IGZhbHNlfSk7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGNsb3NlKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBjbG9zZSk7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgICAgICAgICAgIHNob3dGaWxlTWVudTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGhhbmRsZU5ld0NsaWNrOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGlmIChjb25maXJtKFwiRGVsZXRlIGFsbCBmbG93cz9cIikpIHtcbiAgICAgICAgICAgIEZsb3dBY3Rpb25zLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGhhbmRsZU9wZW5DbGljazogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBjb25zb2xlLmVycm9yKFwidW5pbXBsZW1lbnRlZDogaGFuZGxlT3BlbkNsaWNrXCIpO1xuICAgIH0sXG4gICAgaGFuZGxlU2F2ZUNsaWNrOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJ1bmltcGxlbWVudGVkOiBoYW5kbGVTYXZlQ2xpY2tcIik7XG4gICAgfSxcbiAgICBoYW5kbGVTaHV0ZG93bkNsaWNrOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJ1bmltcGxlbWVudGVkOiBoYW5kbGVTaHV0ZG93bkNsaWNrXCIpO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmaWxlTWVudUNsYXNzID0gXCJkcm9wZG93biBwdWxsLWxlZnRcIiArICh0aGlzLnN0YXRlLnNob3dGaWxlTWVudSA/IFwiIG9wZW5cIiA6IFwiXCIpO1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17ZmlsZU1lbnVDbGFzc30+XG4gICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBjbGFzc05hbWU9XCJzcGVjaWFsXCIgb25DbGljaz17dGhpcy5oYW5kbGVGaWxlQ2xpY2t9PiBtaXRtcHJveHkgPC9hPlxuICAgICAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9XCJkcm9wZG93bi1tZW51XCIgcm9sZT1cIm1lbnVcIj5cbiAgICAgICAgICAgICAgICAgICAgPGxpPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBvbkNsaWNrPXt0aGlzLmhhbmRsZU5ld0NsaWNrfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1maWxlXCI+PC9pPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE5ld1xuICAgICAgICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgICAgICA8bGkgcm9sZT1cInByZXNlbnRhdGlvblwiIGNsYXNzTmFtZT1cImRpdmlkZXJcIj48L2xpPlxuICAgICAgICAgICAgICAgICAgICA8bGk+XG4gICAgICAgICAgICAgICAgICAgICAgICA8YSBocmVmPVwiaHR0cDovL21pdG0uaXQvXCIgdGFyZ2V0PVwiX2JsYW5rXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGkgY2xhc3NOYW1lPVwiZmEgZmEtZncgZmEtZXh0ZXJuYWwtbGlua1wiPjwvaT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBJbnN0YWxsIENlcnRpZmljYXRlcy4uLlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgIHsvKlxuICAgICAgICAgICAgICAgICA8bGk+XG4gICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgb25DbGljaz17dGhpcy5oYW5kbGVPcGVuQ2xpY2t9PlxuICAgICAgICAgICAgICAgICA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1mb2xkZXItb3BlblwiPjwvaT5cbiAgICAgICAgICAgICAgICAgT3BlblxuICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgIDxsaT5cbiAgICAgICAgICAgICAgICAgPGEgaHJlZj1cIiNcIiBvbkNsaWNrPXt0aGlzLmhhbmRsZVNhdmVDbGlja30+XG4gICAgICAgICAgICAgICAgIDxpIGNsYXNzTmFtZT1cImZhIGZhLWZ3IGZhLXNhdmVcIj48L2k+XG4gICAgICAgICAgICAgICAgIFNhdmVcbiAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgICA8bGkgcm9sZT1cInByZXNlbnRhdGlvblwiIGNsYXNzTmFtZT1cImRpdmlkZXJcIj48L2xpPlxuICAgICAgICAgICAgICAgICA8bGk+XG4gICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgb25DbGljaz17dGhpcy5oYW5kbGVTaHV0ZG93bkNsaWNrfT5cbiAgICAgICAgICAgICAgICAgPGkgY2xhc3NOYW1lPVwiZmEgZmEtZncgZmEtcGx1Z1wiPjwvaT5cbiAgICAgICAgICAgICAgICAgU2h1dGRvd25cbiAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgICAqL31cbiAgICAgICAgICAgICAgICA8L3VsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cblxudmFyIGhlYWRlcl9lbnRyaWVzID0gW01haW5NZW51LCBWaWV3TWVudSAvKiwgUmVwb3J0c01lbnUgKi9dO1xuXG5cbnZhciBIZWFkZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgbWl4aW5zOiBbY29tbW9uLk5hdmlnYXRpb25dLFxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYWN0aXZlOiBoZWFkZXJfZW50cmllc1swXVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgaGFuZGxlQ2xpY2s6IGZ1bmN0aW9uIChhY3RpdmUsIGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB0aGlzLnJlcGxhY2VXaXRoKGFjdGl2ZS5yb3V0ZSk7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe2FjdGl2ZTogYWN0aXZlfSk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGhlYWRlciA9IGhlYWRlcl9lbnRyaWVzLm1hcChmdW5jdGlvbiAoZW50cnksIGkpIHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gUmVhY3QuYWRkb25zLmNsYXNzU2V0KHtcbiAgICAgICAgICAgICAgICBhY3RpdmU6IGVudHJ5ID09IHRoaXMuc3RhdGUuYWN0aXZlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgPGEga2V5PXtpfVxuICAgICAgICAgICAgICAgICAgICBocmVmPVwiI1wiXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xhc3Nlc31cbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17dGhpcy5oYW5kbGVDbGljay5iaW5kKHRoaXMsIGVudHJ5KX1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIHsgZW50cnkudGl0bGV9XG4gICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGhlYWRlcj5cbiAgICAgICAgICAgICAgICA8bmF2IGNsYXNzTmFtZT1cIm5hdi10YWJzIG5hdi10YWJzLWxnXCI+XG4gICAgICAgICAgICAgICAgICAgIDxGaWxlTWVudS8+XG4gICAgICAgICAgICAgICAgICAgIHtoZWFkZXJ9XG4gICAgICAgICAgICAgICAgPC9uYXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtZW51XCI+XG4gICAgICAgICAgICAgICAgICAgIDx0aGlzLnN0YXRlLmFjdGl2ZSBzZXR0aW5ncz17dGhpcy5wcm9wcy5zZXR0aW5nc30vPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9oZWFkZXI+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgSGVhZGVyOiBIZWFkZXJcbn0iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XG5cbnZhciBjb21tb24gPSByZXF1aXJlKFwiLi9jb21tb24uanNcIik7XG52YXIgdG9wdXRpbHMgPSByZXF1aXJlKFwiLi4vdXRpbHMuanNcIik7XG52YXIgdmlld3MgPSByZXF1aXJlKFwiLi4vc3RvcmUvdmlldy5qc1wiKTtcbnZhciBGaWx0ID0gcmVxdWlyZShcIi4uL2ZpbHQvZmlsdC5qc1wiKTtcbkZsb3dUYWJsZSA9IHJlcXVpcmUoXCIuL2Zsb3d0YWJsZS5qc1wiKTtcbnZhciBmbG93ZGV0YWlsID0gcmVxdWlyZShcIi4vZmxvd2RldGFpbC5qc1wiKTtcblxuXG52YXIgTWFpblZpZXcgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgbWl4aW5zOiBbY29tbW9uLk5hdmlnYXRpb24sIGNvbW1vbi5TdGF0ZV0sXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMub25RdWVyeUNoYW5nZShRdWVyeS5GSUxURVIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUudmlldy5yZWNhbGN1bGF0ZSh0aGlzLmdldFZpZXdGaWx0KCksIHRoaXMuZ2V0Vmlld1NvcnQoKSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHRoaXMub25RdWVyeUNoYW5nZShRdWVyeS5ISUdITElHSFQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUudmlldy5yZWNhbGN1bGF0ZSh0aGlzLmdldFZpZXdGaWx0KCksIHRoaXMuZ2V0Vmlld1NvcnQoKSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBmbG93czogW11cbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGdldFZpZXdGaWx0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgZmlsdCA9IEZpbHQucGFyc2UodGhpcy5nZXRRdWVyeSgpW1F1ZXJ5LkZJTFRFUl0gfHwgXCJcIik7XG4gICAgICAgICAgICB2YXIgaGlnaGxpZ2h0U3RyID0gdGhpcy5nZXRRdWVyeSgpW1F1ZXJ5LkhJR0hMSUdIVF07XG4gICAgICAgICAgICB2YXIgaGlnaGxpZ2h0ID0gaGlnaGxpZ2h0U3RyID8gRmlsdC5wYXJzZShoaWdobGlnaHRTdHIpIDogZmFsc2U7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciB3aGVuIHByb2Nlc3NpbmcgZmlsdGVyOiBcIiArIGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGZpbHRlcl9hbmRfaGlnaGxpZ2h0KGZsb3cpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5faGlnaGxpZ2h0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlnaGxpZ2h0ID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9oaWdobGlnaHRbZmxvdy5pZF0gPSBoaWdobGlnaHQgJiYgaGlnaGxpZ2h0KGZsb3cpO1xuICAgICAgICAgICAgcmV0dXJuIGZpbHQoZmxvdyk7XG4gICAgICAgIH07XG4gICAgfSxcbiAgICBnZXRWaWV3U29ydDogZnVuY3Rpb24gKCkge1xuICAgIH0sXG4gICAgY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wczogZnVuY3Rpb24gKG5leHRQcm9wcykge1xuICAgICAgICBpZiAobmV4dFByb3BzLmZsb3dTdG9yZSAhPT0gdGhpcy5wcm9wcy5mbG93U3RvcmUpIHtcbiAgICAgICAgICAgIHRoaXMuY2xvc2VWaWV3KCk7XG4gICAgICAgICAgICB0aGlzLm9wZW5WaWV3KG5leHRQcm9wcy5mbG93U3RvcmUpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBvcGVuVmlldzogZnVuY3Rpb24gKHN0b3JlKSB7XG4gICAgICAgIHZhciB2aWV3ID0gbmV3IHZpZXdzLlN0b3JlVmlldyhzdG9yZSwgdGhpcy5nZXRWaWV3RmlsdCgpLCB0aGlzLmdldFZpZXdTb3J0KCkpO1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHZpZXc6IHZpZXdcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmlldy5hZGRMaXN0ZW5lcihcInJlY2FsY3VsYXRlXCIsIHRoaXMub25SZWNhbGN1bGF0ZSk7XG4gICAgICAgIHZpZXcuYWRkTGlzdGVuZXIoXCJhZGQgdXBkYXRlIHJlbW92ZVwiLCB0aGlzLm9uVXBkYXRlKTtcbiAgICAgICAgdmlldy5hZGRMaXN0ZW5lcihcInJlbW92ZVwiLCB0aGlzLm9uUmVtb3ZlKTtcbiAgICB9LFxuICAgIG9uUmVjYWxjdWxhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5mb3JjZVVwZGF0ZSgpO1xuICAgICAgICB2YXIgc2VsZWN0ZWQgPSB0aGlzLmdldFNlbGVjdGVkKCk7XG4gICAgICAgIGlmIChzZWxlY3RlZCkge1xuICAgICAgICAgICAgdGhpcy5yZWZzLmZsb3dUYWJsZS5zY3JvbGxJbnRvVmlldyhzZWxlY3RlZCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIG9uVXBkYXRlOiBmdW5jdGlvbiAoZmxvdykge1xuICAgICAgICBpZiAoZmxvdy5pZCA9PT0gdGhpcy5nZXRQYXJhbXMoKS5mbG93SWQpIHtcbiAgICAgICAgICAgIHRoaXMuZm9yY2VVcGRhdGUoKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgb25SZW1vdmU6IGZ1bmN0aW9uIChmbG93X2lkLCBpbmRleCkge1xuICAgICAgICBpZiAoZmxvd19pZCA9PT0gdGhpcy5nZXRQYXJhbXMoKS5mbG93SWQpIHtcbiAgICAgICAgICAgIHZhciBmbG93X3RvX3NlbGVjdCA9IHRoaXMuc3RhdGUudmlldy5saXN0W01hdGgubWluKGluZGV4LCB0aGlzLnN0YXRlLnZpZXcubGlzdC5sZW5ndGggLTEpXTtcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0RmxvdyhmbG93X3RvX3NlbGVjdCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGNsb3NlVmlldzogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0YXRlLnZpZXcuY2xvc2UoKTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxNb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLm9wZW5WaWV3KHRoaXMucHJvcHMuZmxvd1N0b3JlKTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuY2xvc2VWaWV3KCk7XG4gICAgfSxcbiAgICBzZWxlY3RGbG93OiBmdW5jdGlvbiAoZmxvdykge1xuICAgICAgICBpZiAoZmxvdykge1xuICAgICAgICAgICAgdGhpcy5yZXBsYWNlV2l0aChcbiAgICAgICAgICAgICAgICBcImZsb3dcIixcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGZsb3dJZDogZmxvdy5pZCxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsVGFiOiB0aGlzLmdldFBhcmFtcygpLmRldGFpbFRhYiB8fCBcInJlcXVlc3RcIlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB0aGlzLnJlZnMuZmxvd1RhYmxlLnNjcm9sbEludG9WaWV3KGZsb3cpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5yZXBsYWNlV2l0aChcImZsb3dzXCIsIHt9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc2VsZWN0Rmxvd1JlbGF0aXZlOiBmdW5jdGlvbiAoc2hpZnQpIHtcbiAgICAgICAgdmFyIGZsb3dzID0gdGhpcy5zdGF0ZS52aWV3Lmxpc3Q7XG4gICAgICAgIHZhciBpbmRleDtcbiAgICAgICAgaWYgKCF0aGlzLmdldFBhcmFtcygpLmZsb3dJZCkge1xuICAgICAgICAgICAgaWYgKHNoaWZ0ID4gMCkge1xuICAgICAgICAgICAgICAgIGluZGV4ID0gZmxvd3MubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW5kZXggPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGN1cnJGbG93SWQgPSB0aGlzLmdldFBhcmFtcygpLmZsb3dJZDtcbiAgICAgICAgICAgIHZhciBpID0gZmxvd3MubGVuZ3RoO1xuICAgICAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgICAgIGlmIChmbG93c1tpXS5pZCA9PT0gY3VyckZsb3dJZCkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGluZGV4ID0gTWF0aC5taW4oXG4gICAgICAgICAgICAgICAgTWF0aC5tYXgoMCwgaW5kZXggKyBzaGlmdCksXG4gICAgICAgICAgICAgICAgZmxvd3MubGVuZ3RoIC0gMSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZWxlY3RGbG93KGZsb3dzW2luZGV4XSk7XG4gICAgfSxcbiAgICBvbktleURvd246IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5nZXRTZWxlY3RlZCgpO1xuICAgICAgICBpZiAoZS5jdHJsS2V5KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoIChlLmtleUNvZGUpIHtcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5Lks6XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5VUDpcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3dSZWxhdGl2ZSgtMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5KOlxuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuRE9XTjpcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3dSZWxhdGl2ZSgrMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5TUEFDRTpcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LlBBR0VfRE9XTjpcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3dSZWxhdGl2ZSgrMTApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuUEFHRV9VUDpcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3dSZWxhdGl2ZSgtMTApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuRU5EOlxuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0Rmxvd1JlbGF0aXZlKCsxZTEwKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkhPTUU6XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RGbG93UmVsYXRpdmUoLTFlMTApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuRVNDOlxuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0RmxvdyhudWxsKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5Lkg6XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5MRUZUOlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlZnMuZmxvd0RldGFpbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWZzLmZsb3dEZXRhaWxzLm5leHRUYWIoLTEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5Lkw6XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5UQUI6XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5SSUdIVDpcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZWZzLmZsb3dEZXRhaWxzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcy5mbG93RGV0YWlscy5uZXh0VGFiKCsxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5DOlxuICAgICAgICAgICAgICAgIGlmIChlLnNoaWZ0S2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLmNsZWFyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuRDpcbiAgICAgICAgICAgICAgICBpZiAoZmxvdykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgRmxvd0FjdGlvbnMuZHVwbGljYXRlKGZsb3cpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgRmxvd0FjdGlvbnMuZGVsZXRlKGZsb3cpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuQTpcbiAgICAgICAgICAgICAgICBpZiAoZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgICAgICAgICBGbG93QWN0aW9ucy5hY2NlcHRfYWxsKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmbG93ICYmIGZsb3cuaW50ZXJjZXB0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgRmxvd0FjdGlvbnMuYWNjZXB0KGZsb3cpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LlI6XG4gICAgICAgICAgICAgICAgaWYgKCFlLnNoaWZ0S2V5ICYmIGZsb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgRmxvd0FjdGlvbnMucmVwbGF5KGZsb3cpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LlY6XG4gICAgICAgICAgICAgICAgaWYoZS5zaGlmdEtleSAmJiBmbG93ICYmIGZsb3cubW9kaWZpZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgRmxvd0FjdGlvbnMucmV2ZXJ0KGZsb3cpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS5kZWJ1ZyhcImtleWRvd25cIiwgZS5rZXlDb2RlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0sXG4gICAgZ2V0U2VsZWN0ZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcHMuZmxvd1N0b3JlLmdldCh0aGlzLmdldFBhcmFtcygpLmZsb3dJZCk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGVjdGVkID0gdGhpcy5nZXRTZWxlY3RlZCgpO1xuXG4gICAgICAgIHZhciBkZXRhaWxzO1xuICAgICAgICBpZiAoc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgIGRldGFpbHMgPSBbXG4gICAgICAgICAgICAgICAgPGNvbW1vbi5TcGxpdHRlciBrZXk9XCJzcGxpdHRlclwiLz4sXG4gICAgICAgICAgICAgICAgPGZsb3dkZXRhaWwuRmxvd0RldGFpbCBrZXk9XCJmbG93RGV0YWlsc1wiIHJlZj1cImZsb3dEZXRhaWxzXCIgZmxvdz17c2VsZWN0ZWR9Lz5cbiAgICAgICAgICAgIF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZXRhaWxzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1haW4tdmlld1wiIG9uS2V5RG93bj17dGhpcy5vbktleURvd259IHRhYkluZGV4PVwiMFwiPlxuICAgICAgICAgICAgICAgIDxGbG93VGFibGUgcmVmPVwiZmxvd1RhYmxlXCJcbiAgICAgICAgICAgICAgICAgICAgdmlldz17dGhpcy5zdGF0ZS52aWV3fVxuICAgICAgICAgICAgICAgICAgICBzZWxlY3RGbG93PXt0aGlzLnNlbGVjdEZsb3d9XG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkPXtzZWxlY3RlZH0gLz5cbiAgICAgICAgICAgICAgICB7ZGV0YWlsc31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1haW5WaWV3O1xuIiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xudmFyIFJlYWN0Um91dGVyID0gcmVxdWlyZShcInJlYWN0LXJvdXRlclwiKTtcbnZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcblxudmFyIGNvbW1vbiA9IHJlcXVpcmUoXCIuL2NvbW1vbi5qc1wiKTtcbnZhciBNYWluVmlldyA9IHJlcXVpcmUoXCIuL21haW52aWV3LmpzXCIpO1xudmFyIEZvb3RlciA9IHJlcXVpcmUoXCIuL2Zvb3Rlci5qc1wiKTtcbnZhciBoZWFkZXIgPSByZXF1aXJlKFwiLi9oZWFkZXIuanNcIik7XG52YXIgRXZlbnRMb2cgPSByZXF1aXJlKFwiLi9ldmVudGxvZy5qc1wiKTtcbnZhciBzdG9yZSA9IHJlcXVpcmUoXCIuLi9zdG9yZS9zdG9yZS5qc1wiKTtcblxuXG4vL1RPRE86IE1vdmUgb3V0IG9mIGhlcmUsIGp1c3QgYSBzdHViLlxudmFyIFJlcG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiA8ZGl2PlJlcG9ydEVkaXRvcjwvZGl2PjtcbiAgICB9XG59KTtcblxuXG52YXIgUHJveHlBcHBNYWluID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIG1peGluczogW2NvbW1vbi5TdGF0ZV0sXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBldmVudFN0b3JlID0gbmV3IHN0b3JlLkV2ZW50TG9nU3RvcmUoKTtcbiAgICAgICAgdmFyIGZsb3dTdG9yZSA9IG5ldyBzdG9yZS5GbG93U3RvcmUoKTtcbiAgICAgICAgdmFyIHNldHRpbmdzID0gbmV3IHN0b3JlLlNldHRpbmdzU3RvcmUoKTtcblxuICAgICAgICAvLyBEZWZhdWx0IFNldHRpbmdzIGJlZm9yZSBmZXRjaFxuICAgICAgICBfLmV4dGVuZChzZXR0aW5ncy5kaWN0LHtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzZXR0aW5nczogc2V0dGluZ3MsXG4gICAgICAgICAgICBmbG93U3RvcmU6IGZsb3dTdG9yZSxcbiAgICAgICAgICAgIGV2ZW50U3RvcmU6IGV2ZW50U3RvcmVcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RhdGUuc2V0dGluZ3MuYWRkTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLm9uU2V0dGluZ3NDaGFuZ2UpO1xuICAgICAgICB3aW5kb3cuYXBwID0gdGhpcztcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RhdGUuc2V0dGluZ3MucmVtb3ZlTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLm9uU2V0dGluZ3NDaGFuZ2UpO1xuICAgIH0sXG4gICAgb25TZXR0aW5nc0NoYW5nZTogZnVuY3Rpb24oKXtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICBzZXR0aW5nczogdGhpcy5zdGF0ZS5zZXR0aW5nc1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHZhciBldmVudGxvZztcbiAgICAgICAgaWYgKHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5TSE9XX0VWRU5UTE9HXSkge1xuICAgICAgICAgICAgZXZlbnRsb2cgPSBbXG4gICAgICAgICAgICAgICAgPGNvbW1vbi5TcGxpdHRlciBrZXk9XCJzcGxpdHRlclwiIGF4aXM9XCJ5XCIvPixcbiAgICAgICAgICAgICAgICA8RXZlbnRMb2cga2V5PVwiZXZlbnRsb2dcIiBldmVudFN0b3JlPXt0aGlzLnN0YXRlLmV2ZW50U3RvcmV9Lz5cbiAgICAgICAgICAgIF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBldmVudGxvZyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdiBpZD1cImNvbnRhaW5lclwiPlxuICAgICAgICAgICAgICAgIDxoZWFkZXIuSGVhZGVyIHNldHRpbmdzPXt0aGlzLnN0YXRlLnNldHRpbmdzLmRpY3R9Lz5cbiAgICAgICAgICAgICAgICA8Um91dGVIYW5kbGVyIHNldHRpbmdzPXt0aGlzLnN0YXRlLnNldHRpbmdzLmRpY3R9IGZsb3dTdG9yZT17dGhpcy5zdGF0ZS5mbG93U3RvcmV9Lz5cbiAgICAgICAgICAgICAgICB7ZXZlbnRsb2d9XG4gICAgICAgICAgICAgICAgPEZvb3RlciBzZXR0aW5ncz17dGhpcy5zdGF0ZS5zZXR0aW5ncy5kaWN0fS8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxuXG52YXIgUm91dGUgPSBSZWFjdFJvdXRlci5Sb3V0ZTtcbnZhciBSb3V0ZUhhbmRsZXIgPSBSZWFjdFJvdXRlci5Sb3V0ZUhhbmRsZXI7XG52YXIgUmVkaXJlY3QgPSBSZWFjdFJvdXRlci5SZWRpcmVjdDtcbnZhciBEZWZhdWx0Um91dGUgPSBSZWFjdFJvdXRlci5EZWZhdWx0Um91dGU7XG52YXIgTm90Rm91bmRSb3V0ZSA9IFJlYWN0Um91dGVyLk5vdEZvdW5kUm91dGU7XG5cblxudmFyIHJvdXRlcyA9IChcbiAgICA8Um91dGUgcGF0aD1cIi9cIiBoYW5kbGVyPXtQcm94eUFwcE1haW59PlxuICAgICAgICA8Um91dGUgbmFtZT1cImZsb3dzXCIgcGF0aD1cImZsb3dzXCIgaGFuZGxlcj17TWFpblZpZXd9Lz5cbiAgICAgICAgPFJvdXRlIG5hbWU9XCJmbG93XCIgcGF0aD1cImZsb3dzLzpmbG93SWQvOmRldGFpbFRhYlwiIGhhbmRsZXI9e01haW5WaWV3fS8+XG4gICAgICAgIDxSb3V0ZSBuYW1lPVwicmVwb3J0c1wiIGhhbmRsZXI9e1JlcG9ydHN9Lz5cbiAgICAgICAgPFJlZGlyZWN0IHBhdGg9XCIvXCIgdG89XCJmbG93c1wiIC8+XG4gICAgPC9Sb3V0ZT5cbik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHJvdXRlczogcm91dGVzXG59O1xuXG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XG5cbnZhciBWaXJ0dWFsU2Nyb2xsTWl4aW4gPSB7XG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGFydDogMCxcbiAgICAgICAgICAgIHN0b3A6IDBcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxNb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMucHJvcHMucm93SGVpZ2h0KSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJWaXJ0dWFsU2Nyb2xsTWl4aW46IE5vIHJvd0hlaWdodCBzcGVjaWZpZWRcIiwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGdldFBsYWNlaG9sZGVyVG9wOiBmdW5jdGlvbiAodG90YWwpIHtcbiAgICAgICAgdmFyIFRhZyA9IHRoaXMucHJvcHMucGxhY2Vob2xkZXJUYWdOYW1lIHx8IFwidHJcIjtcbiAgICAgICAgLy8gV2hlbiBhIGxhcmdlIHRydW5rIG9mIGVsZW1lbnRzIGlzIHJlbW92ZWQgZnJvbSB0aGUgYnV0dG9uLCBzdGFydCBtYXkgYmUgZmFyIG9mZiB0aGUgdmlld3BvcnQuXG4gICAgICAgIC8vIFRvIG1ha2UgdGhpcyBpc3N1ZSBsZXNzIHNldmVyZSwgbGltaXQgdGhlIHRvcCBwbGFjZWhvbGRlciB0byB0aGUgdG90YWwgbnVtYmVyIG9mIHJvd3MuXG4gICAgICAgIHZhciBzdHlsZSA9IHtcbiAgICAgICAgICAgIGhlaWdodDogTWF0aC5taW4odGhpcy5zdGF0ZS5zdGFydCwgdG90YWwpICogdGhpcy5wcm9wcy5yb3dIZWlnaHRcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIHNwYWNlciA9IDxUYWcga2V5PVwicGxhY2Vob2xkZXItdG9wXCIgc3R5bGU9e3N0eWxlfT48L1RhZz47XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhdGUuc3RhcnQgJSAyID09PSAxKSB7XG4gICAgICAgICAgICAvLyBmaXggZXZlbi9vZGQgcm93c1xuICAgICAgICAgICAgcmV0dXJuIFtzcGFjZXIsIDxUYWcga2V5PVwicGxhY2Vob2xkZXItdG9wLTJcIj48L1RhZz5dO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHNwYWNlcjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0UGxhY2Vob2xkZXJCb3R0b206IGZ1bmN0aW9uICh0b3RhbCkge1xuICAgICAgICB2YXIgVGFnID0gdGhpcy5wcm9wcy5wbGFjZWhvbGRlclRhZ05hbWUgfHwgXCJ0clwiO1xuICAgICAgICB2YXIgc3R5bGUgPSB7XG4gICAgICAgICAgICBoZWlnaHQ6IE1hdGgubWF4KDAsIHRvdGFsIC0gdGhpcy5zdGF0ZS5zdG9wKSAqIHRoaXMucHJvcHMucm93SGVpZ2h0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiA8VGFnIGtleT1cInBsYWNlaG9sZGVyLWJvdHRvbVwiIHN0eWxlPXtzdHlsZX0+PC9UYWc+O1xuICAgIH0sXG4gICAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5vblNjcm9sbCgpO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgdGhpcy5vblNjcm9sbCk7XG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsVW5tb3VudDogZnVuY3Rpb24oKXtcbiAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHRoaXMub25TY3JvbGwpO1xuICAgIH0sXG4gICAgb25TY3JvbGw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHZpZXdwb3J0ID0gdGhpcy5nZXRET01Ob2RlKCk7XG4gICAgICAgIHZhciB0b3AgPSB2aWV3cG9ydC5zY3JvbGxUb3A7XG4gICAgICAgIHZhciBoZWlnaHQgPSB2aWV3cG9ydC5vZmZzZXRIZWlnaHQ7XG4gICAgICAgIHZhciBzdGFydCA9IE1hdGguZmxvb3IodG9wIC8gdGhpcy5wcm9wcy5yb3dIZWlnaHQpO1xuICAgICAgICB2YXIgc3RvcCA9IHN0YXJ0ICsgTWF0aC5jZWlsKGhlaWdodCAvICh0aGlzLnByb3BzLnJvd0hlaWdodE1pbiB8fCB0aGlzLnByb3BzLnJvd0hlaWdodCkpO1xuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgICAgICAgc3RhcnQ6IHN0YXJ0LFxuICAgICAgICAgICAgc3RvcDogc3RvcFxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHJlbmRlclJvd3M6IGZ1bmN0aW9uIChlbGVtcykge1xuICAgICAgICB2YXIgcm93cyA9IFtdO1xuICAgICAgICB2YXIgbWF4ID0gTWF0aC5taW4oZWxlbXMubGVuZ3RoLCB0aGlzLnN0YXRlLnN0b3ApO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnN0YXRlLnN0YXJ0OyBpIDwgbWF4OyBpKyspIHtcbiAgICAgICAgICAgIHZhciBlbGVtID0gZWxlbXNbaV07XG4gICAgICAgICAgICByb3dzLnB1c2godGhpcy5yZW5kZXJSb3coZWxlbSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByb3dzO1xuICAgIH0sXG4gICAgc2Nyb2xsUm93SW50b1ZpZXc6IGZ1bmN0aW9uIChpbmRleCwgaGVhZF9oZWlnaHQpIHtcblxuICAgICAgICB2YXIgcm93X3RvcCA9IChpbmRleCAqIHRoaXMucHJvcHMucm93SGVpZ2h0KSArIGhlYWRfaGVpZ2h0O1xuICAgICAgICB2YXIgcm93X2JvdHRvbSA9IHJvd190b3AgKyB0aGlzLnByb3BzLnJvd0hlaWdodDtcblxuICAgICAgICB2YXIgdmlld3BvcnQgPSB0aGlzLmdldERPTU5vZGUoKTtcbiAgICAgICAgdmFyIHZpZXdwb3J0X3RvcCA9IHZpZXdwb3J0LnNjcm9sbFRvcDtcbiAgICAgICAgdmFyIHZpZXdwb3J0X2JvdHRvbSA9IHZpZXdwb3J0X3RvcCArIHZpZXdwb3J0Lm9mZnNldEhlaWdodDtcblxuICAgICAgICAvLyBBY2NvdW50IGZvciBwaW5uZWQgdGhlYWRcbiAgICAgICAgaWYgKHJvd190b3AgLSBoZWFkX2hlaWdodCA8IHZpZXdwb3J0X3RvcCkge1xuICAgICAgICAgICAgdmlld3BvcnQuc2Nyb2xsVG9wID0gcm93X3RvcCAtIGhlYWRfaGVpZ2h0O1xuICAgICAgICB9IGVsc2UgaWYgKHJvd19ib3R0b20gPiB2aWV3cG9ydF9ib3R0b20pIHtcbiAgICAgICAgICAgIHZpZXdwb3J0LnNjcm9sbFRvcCA9IHJvd19ib3R0b20gLSB2aWV3cG9ydC5vZmZzZXRIZWlnaHQ7XG4gICAgICAgIH1cbiAgICB9LFxufTtcblxubW9kdWxlLmV4cG9ydHMgID0gVmlydHVhbFNjcm9sbE1peGluOyIsIlxudmFyIGFjdGlvbnMgPSByZXF1aXJlKFwiLi9hY3Rpb25zLmpzXCIpO1xuXG5mdW5jdGlvbiBDb25uZWN0aW9uKHVybCkge1xuICAgIGlmICh1cmxbMF0gPT09IFwiL1wiKSB7XG4gICAgICAgIHVybCA9IGxvY2F0aW9uLm9yaWdpbi5yZXBsYWNlKFwiaHR0cFwiLCBcIndzXCIpICsgdXJsO1xuICAgIH1cblxuICAgIHZhciB3cyA9IG5ldyBXZWJTb2NrZXQodXJsKTtcbiAgICB3cy5vbm9wZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGFjdGlvbnMuQ29ubmVjdGlvbkFjdGlvbnMub3BlbigpO1xuICAgIH07XG4gICAgd3Mub25tZXNzYWdlID0gZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgdmFyIG0gPSBKU09OLnBhcnNlKG1lc3NhZ2UuZGF0YSk7XG4gICAgICAgIEFwcERpc3BhdGNoZXIuZGlzcGF0Y2hTZXJ2ZXJBY3Rpb24obSk7XG4gICAgfTtcbiAgICB3cy5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBhY3Rpb25zLkNvbm5lY3Rpb25BY3Rpb25zLmVycm9yKCk7XG4gICAgICAgIEV2ZW50TG9nQWN0aW9ucy5hZGRfZXZlbnQoXCJXZWJTb2NrZXQgY29ubmVjdGlvbiBlcnJvci5cIik7XG4gICAgfTtcbiAgICB3cy5vbmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBhY3Rpb25zLkNvbm5lY3Rpb25BY3Rpb25zLmNsb3NlKCk7XG4gICAgICAgIEV2ZW50TG9nQWN0aW9ucy5hZGRfZXZlbnQoXCJXZWJTb2NrZXQgY29ubmVjdGlvbiBjbG9zZWQuXCIpO1xuICAgIH07XG4gICAgcmV0dXJuIHdzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbm5lY3Rpb247IiwiXG52YXIgZmx1eCA9IHJlcXVpcmUoXCJmbHV4XCIpO1xuXG5jb25zdCBQYXlsb2FkU291cmNlcyA9IHtcbiAgICBWSUVXOiBcInZpZXdcIixcbiAgICBTRVJWRVI6IFwic2VydmVyXCJcbn07XG5cblxuQXBwRGlzcGF0Y2hlciA9IG5ldyBmbHV4LkRpc3BhdGNoZXIoKTtcbkFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uID0gZnVuY3Rpb24gKGFjdGlvbikge1xuICAgIGFjdGlvbi5zb3VyY2UgPSBQYXlsb2FkU291cmNlcy5WSUVXO1xuICAgIHRoaXMuZGlzcGF0Y2goYWN0aW9uKTtcbn07XG5BcHBEaXNwYXRjaGVyLmRpc3BhdGNoU2VydmVyQWN0aW9uID0gZnVuY3Rpb24gKGFjdGlvbikge1xuICAgIGFjdGlvbi5zb3VyY2UgPSBQYXlsb2FkU291cmNlcy5TRVJWRVI7XG4gICAgdGhpcy5kaXNwYXRjaChhY3Rpb24pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgQXBwRGlzcGF0Y2hlcjogQXBwRGlzcGF0Y2hlclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcbiAgLypcbiAgICogR2VuZXJhdGVkIGJ5IFBFRy5qcyAwLjguMC5cbiAgICpcbiAgICogaHR0cDovL3BlZ2pzLm1hamRhLmN6L1xuICAgKi9cblxuICBmdW5jdGlvbiBwZWckc3ViY2xhc3MoY2hpbGQsIHBhcmVudCkge1xuICAgIGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfVxuICAgIGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTtcbiAgICBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpO1xuICB9XG5cbiAgZnVuY3Rpb24gU3ludGF4RXJyb3IobWVzc2FnZSwgZXhwZWN0ZWQsIGZvdW5kLCBvZmZzZXQsIGxpbmUsIGNvbHVtbikge1xuICAgIHRoaXMubWVzc2FnZSAgPSBtZXNzYWdlO1xuICAgIHRoaXMuZXhwZWN0ZWQgPSBleHBlY3RlZDtcbiAgICB0aGlzLmZvdW5kICAgID0gZm91bmQ7XG4gICAgdGhpcy5vZmZzZXQgICA9IG9mZnNldDtcbiAgICB0aGlzLmxpbmUgICAgID0gbGluZTtcbiAgICB0aGlzLmNvbHVtbiAgID0gY29sdW1uO1xuXG4gICAgdGhpcy5uYW1lICAgICA9IFwiU3ludGF4RXJyb3JcIjtcbiAgfVxuXG4gIHBlZyRzdWJjbGFzcyhTeW50YXhFcnJvciwgRXJyb3IpO1xuXG4gIGZ1bmN0aW9uIHBhcnNlKGlucHV0KSB7XG4gICAgdmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMSA/IGFyZ3VtZW50c1sxXSA6IHt9LFxuXG4gICAgICAgIHBlZyRGQUlMRUQgPSB7fSxcblxuICAgICAgICBwZWckc3RhcnRSdWxlRnVuY3Rpb25zID0geyBzdGFydDogcGVnJHBhcnNlc3RhcnQgfSxcbiAgICAgICAgcGVnJHN0YXJ0UnVsZUZ1bmN0aW9uICA9IHBlZyRwYXJzZXN0YXJ0LFxuXG4gICAgICAgIHBlZyRjMCA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJmaWx0ZXIgZXhwcmVzc2lvblwiIH0sXG4gICAgICAgIHBlZyRjMSA9IHBlZyRGQUlMRUQsXG4gICAgICAgIHBlZyRjMiA9IGZ1bmN0aW9uKG9yRXhwcikgeyByZXR1cm4gb3JFeHByOyB9LFxuICAgICAgICBwZWckYzMgPSBbXSxcbiAgICAgICAgcGVnJGM0ID0gZnVuY3Rpb24oKSB7cmV0dXJuIHRydWVGaWx0ZXI7IH0sXG4gICAgICAgIHBlZyRjNSA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJ3aGl0ZXNwYWNlXCIgfSxcbiAgICAgICAgcGVnJGM2ID0gL15bIFxcdFxcblxccl0vLFxuICAgICAgICBwZWckYzcgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWyBcXFxcdFxcXFxuXFxcXHJdXCIsIGRlc2NyaXB0aW9uOiBcIlsgXFxcXHRcXFxcblxcXFxyXVwiIH0sXG4gICAgICAgIHBlZyRjOCA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJjb250cm9sIGNoYXJhY3RlclwiIH0sXG4gICAgICAgIHBlZyRjOSA9IC9eW3wmISgpflwiXS8sXG4gICAgICAgIHBlZyRjMTAgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW3wmISgpflxcXCJdXCIsIGRlc2NyaXB0aW9uOiBcIlt8JiEoKX5cXFwiXVwiIH0sXG4gICAgICAgIHBlZyRjMTEgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwib3B0aW9uYWwgd2hpdGVzcGFjZVwiIH0sXG4gICAgICAgIHBlZyRjMTIgPSBcInxcIixcbiAgICAgICAgcGVnJGMxMyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInxcIiwgZGVzY3JpcHRpb246IFwiXFxcInxcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxNCA9IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHsgcmV0dXJuIG9yKGZpcnN0LCBzZWNvbmQpOyB9LFxuICAgICAgICBwZWckYzE1ID0gXCImXCIsXG4gICAgICAgIHBlZyRjMTYgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCImXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCImXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTcgPSBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7IHJldHVybiBhbmQoZmlyc3QsIHNlY29uZCk7IH0sXG4gICAgICAgIHBlZyRjMTggPSBcIiFcIixcbiAgICAgICAgcGVnJGMxOSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIiFcIiwgZGVzY3JpcHRpb246IFwiXFxcIiFcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyMCA9IGZ1bmN0aW9uKGV4cHIpIHsgcmV0dXJuIG5vdChleHByKTsgfSxcbiAgICAgICAgcGVnJGMyMSA9IFwiKFwiLFxuICAgICAgICBwZWckYzIyID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiKFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiKFxcXCJcIiB9LFxuICAgICAgICBwZWckYzIzID0gXCIpXCIsXG4gICAgICAgIHBlZyRjMjQgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIpXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIpXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMjUgPSBmdW5jdGlvbihleHByKSB7IHJldHVybiBiaW5kaW5nKGV4cHIpOyB9LFxuICAgICAgICBwZWckYzI2ID0gXCJ+YVwiLFxuICAgICAgICBwZWckYzI3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifmFcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5hXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMjggPSBmdW5jdGlvbigpIHsgcmV0dXJuIGFzc2V0RmlsdGVyOyB9LFxuICAgICAgICBwZWckYzI5ID0gXCJ+ZVwiLFxuICAgICAgICBwZWckYzMwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifmVcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5lXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMzEgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGVycm9yRmlsdGVyOyB9LFxuICAgICAgICBwZWckYzMyID0gXCJ+cVwiLFxuICAgICAgICBwZWckYzMzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifnFcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5xXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMzQgPSBmdW5jdGlvbigpIHsgcmV0dXJuIG5vUmVzcG9uc2VGaWx0ZXI7IH0sXG4gICAgICAgIHBlZyRjMzUgPSBcIn5zXCIsXG4gICAgICAgIHBlZyRjMzYgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+c1wiLCBkZXNjcmlwdGlvbjogXCJcXFwifnNcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMzNyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gcmVzcG9uc2VGaWx0ZXI7IH0sXG4gICAgICAgIHBlZyRjMzggPSBcInRydWVcIixcbiAgICAgICAgcGVnJGMzOSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInRydWVcIiwgZGVzY3JpcHRpb246IFwiXFxcInRydWVcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM0MCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdHJ1ZUZpbHRlcjsgfSxcbiAgICAgICAgcGVnJGM0MSA9IFwiZmFsc2VcIixcbiAgICAgICAgcGVnJGM0MiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcImZhbHNlXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJmYWxzZVxcXCJcIiB9LFxuICAgICAgICBwZWckYzQzID0gZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZUZpbHRlcjsgfSxcbiAgICAgICAgcGVnJGM0NCA9IFwifmNcIixcbiAgICAgICAgcGVnJGM0NSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5jXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+Y1xcXCJcIiB9LFxuICAgICAgICBwZWckYzQ2ID0gZnVuY3Rpb24ocykgeyByZXR1cm4gcmVzcG9uc2VDb2RlKHMpOyB9LFxuICAgICAgICBwZWckYzQ3ID0gXCJ+ZFwiLFxuICAgICAgICBwZWckYzQ4ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifmRcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5kXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNDkgPSBmdW5jdGlvbihzKSB7IHJldHVybiBkb21haW4ocyk7IH0sXG4gICAgICAgIHBlZyRjNTAgPSBcIn5oXCIsXG4gICAgICAgIHBlZyRjNTEgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+aFwiLCBkZXNjcmlwdGlvbjogXCJcXFwifmhcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM1MiA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIGhlYWRlcihzKTsgfSxcbiAgICAgICAgcGVnJGM1MyA9IFwifmhxXCIsXG4gICAgICAgIHBlZyRjNTQgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+aHFcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5ocVxcXCJcIiB9LFxuICAgICAgICBwZWckYzU1ID0gZnVuY3Rpb24ocykgeyByZXR1cm4gcmVxdWVzdEhlYWRlcihzKTsgfSxcbiAgICAgICAgcGVnJGM1NiA9IFwifmhzXCIsXG4gICAgICAgIHBlZyRjNTcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+aHNcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5oc1xcXCJcIiB9LFxuICAgICAgICBwZWckYzU4ID0gZnVuY3Rpb24ocykgeyByZXR1cm4gcmVzcG9uc2VIZWFkZXIocyk7IH0sXG4gICAgICAgIHBlZyRjNTkgPSBcIn5tXCIsXG4gICAgICAgIHBlZyRjNjAgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+bVwiLCBkZXNjcmlwdGlvbjogXCJcXFwifm1cXFwiXCIgfSxcbiAgICAgICAgcGVnJGM2MSA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIG1ldGhvZChzKTsgfSxcbiAgICAgICAgcGVnJGM2MiA9IFwifnRcIixcbiAgICAgICAgcGVnJGM2MyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn50XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+dFxcXCJcIiB9LFxuICAgICAgICBwZWckYzY0ID0gZnVuY3Rpb24ocykgeyByZXR1cm4gY29udGVudFR5cGUocyk7IH0sXG4gICAgICAgIHBlZyRjNjUgPSBcIn50cVwiLFxuICAgICAgICBwZWckYzY2ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifnRxXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+dHFcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM2NyA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIHJlcXVlc3RDb250ZW50VHlwZShzKTsgfSxcbiAgICAgICAgcGVnJGM2OCA9IFwifnRzXCIsXG4gICAgICAgIHBlZyRjNjkgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+dHNcIiwgZGVzY3JpcHRpb246IFwiXFxcIn50c1xcXCJcIiB9LFxuICAgICAgICBwZWckYzcwID0gZnVuY3Rpb24ocykgeyByZXR1cm4gcmVzcG9uc2VDb250ZW50VHlwZShzKTsgfSxcbiAgICAgICAgcGVnJGM3MSA9IFwifnVcIixcbiAgICAgICAgcGVnJGM3MiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn51XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+dVxcXCJcIiB9LFxuICAgICAgICBwZWckYzczID0gZnVuY3Rpb24ocykgeyByZXR1cm4gdXJsKHMpOyB9LFxuICAgICAgICBwZWckYzc0ID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcImludGVnZXJcIiB9LFxuICAgICAgICBwZWckYzc1ID0gbnVsbCxcbiAgICAgICAgcGVnJGM3NiA9IC9eWydcIl0vLFxuICAgICAgICBwZWckYzc3ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsnXFxcIl1cIiwgZGVzY3JpcHRpb246IFwiWydcXFwiXVwiIH0sXG4gICAgICAgIHBlZyRjNzggPSAvXlswLTldLyxcbiAgICAgICAgcGVnJGM3OSA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbMC05XVwiLCBkZXNjcmlwdGlvbjogXCJbMC05XVwiIH0sXG4gICAgICAgIHBlZyRjODAgPSBmdW5jdGlvbihkaWdpdHMpIHsgcmV0dXJuIHBhcnNlSW50KGRpZ2l0cy5qb2luKFwiXCIpLCAxMCk7IH0sXG4gICAgICAgIHBlZyRjODEgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwic3RyaW5nXCIgfSxcbiAgICAgICAgcGVnJGM4MiA9IFwiXFxcIlwiLFxuICAgICAgICBwZWckYzgzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiXFxcIlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiXFxcXFxcXCJcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM4NCA9IGZ1bmN0aW9uKGNoYXJzKSB7IHJldHVybiBjaGFycy5qb2luKFwiXCIpOyB9LFxuICAgICAgICBwZWckYzg1ID0gXCInXCIsXG4gICAgICAgIHBlZyRjODYgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCInXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCInXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjODcgPSB2b2lkIDAsXG4gICAgICAgIHBlZyRjODggPSAvXltcIlxcXFxdLyxcbiAgICAgICAgcGVnJGM4OSA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbXFxcIlxcXFxcXFxcXVwiLCBkZXNjcmlwdGlvbjogXCJbXFxcIlxcXFxcXFxcXVwiIH0sXG4gICAgICAgIHBlZyRjOTAgPSB7IHR5cGU6IFwiYW55XCIsIGRlc2NyaXB0aW9uOiBcImFueSBjaGFyYWN0ZXJcIiB9LFxuICAgICAgICBwZWckYzkxID0gZnVuY3Rpb24oY2hhcikgeyByZXR1cm4gY2hhcjsgfSxcbiAgICAgICAgcGVnJGM5MiA9IFwiXFxcXFwiLFxuICAgICAgICBwZWckYzkzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiXFxcXFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiXFxcXFxcXFxcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM5NCA9IC9eWydcXFxcXS8sXG4gICAgICAgIHBlZyRjOTUgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWydcXFxcXFxcXF1cIiwgZGVzY3JpcHRpb246IFwiWydcXFxcXFxcXF1cIiB9LFxuICAgICAgICBwZWckYzk2ID0gL15bJ1wiXFxcXF0vLFxuICAgICAgICBwZWckYzk3ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsnXFxcIlxcXFxcXFxcXVwiLCBkZXNjcmlwdGlvbjogXCJbJ1xcXCJcXFxcXFxcXF1cIiB9LFxuICAgICAgICBwZWckYzk4ID0gXCJuXCIsXG4gICAgICAgIHBlZyRjOTkgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJuXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJuXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTAwID0gZnVuY3Rpb24oKSB7IHJldHVybiBcIlxcblwiOyB9LFxuICAgICAgICBwZWckYzEwMSA9IFwiclwiLFxuICAgICAgICBwZWckYzEwMiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInJcIiwgZGVzY3JpcHRpb246IFwiXFxcInJcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMDMgPSBmdW5jdGlvbigpIHsgcmV0dXJuIFwiXFxyXCI7IH0sXG4gICAgICAgIHBlZyRjMTA0ID0gXCJ0XCIsXG4gICAgICAgIHBlZyRjMTA1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwidFwiLCBkZXNjcmlwdGlvbjogXCJcXFwidFxcXCJcIiB9LFxuICAgICAgICBwZWckYzEwNiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJcXHRcIjsgfSxcblxuICAgICAgICBwZWckY3VyclBvcyAgICAgICAgICA9IDAsXG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyAgICAgID0gMCxcbiAgICAgICAgcGVnJGNhY2hlZFBvcyAgICAgICAgPSAwLFxuICAgICAgICBwZWckY2FjaGVkUG9zRGV0YWlscyA9IHsgbGluZTogMSwgY29sdW1uOiAxLCBzZWVuQ1I6IGZhbHNlIH0sXG4gICAgICAgIHBlZyRtYXhGYWlsUG9zICAgICAgID0gMCxcbiAgICAgICAgcGVnJG1heEZhaWxFeHBlY3RlZCAgPSBbXSxcbiAgICAgICAgcGVnJHNpbGVudEZhaWxzICAgICAgPSAwLFxuXG4gICAgICAgIHBlZyRyZXN1bHQ7XG5cbiAgICBpZiAoXCJzdGFydFJ1bGVcIiBpbiBvcHRpb25zKSB7XG4gICAgICBpZiAoIShvcHRpb25zLnN0YXJ0UnVsZSBpbiBwZWckc3RhcnRSdWxlRnVuY3Rpb25zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBzdGFydCBwYXJzaW5nIGZyb20gcnVsZSBcXFwiXCIgKyBvcHRpb25zLnN0YXJ0UnVsZSArIFwiXFxcIi5cIik7XG4gICAgICB9XG5cbiAgICAgIHBlZyRzdGFydFJ1bGVGdW5jdGlvbiA9IHBlZyRzdGFydFJ1bGVGdW5jdGlvbnNbb3B0aW9ucy5zdGFydFJ1bGVdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRleHQoKSB7XG4gICAgICByZXR1cm4gaW5wdXQuc3Vic3RyaW5nKHBlZyRyZXBvcnRlZFBvcywgcGVnJGN1cnJQb3MpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9mZnNldCgpIHtcbiAgICAgIHJldHVybiBwZWckcmVwb3J0ZWRQb3M7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGluZSgpIHtcbiAgICAgIHJldHVybiBwZWckY29tcHV0ZVBvc0RldGFpbHMocGVnJHJlcG9ydGVkUG9zKS5saW5lO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbHVtbigpIHtcbiAgICAgIHJldHVybiBwZWckY29tcHV0ZVBvc0RldGFpbHMocGVnJHJlcG9ydGVkUG9zKS5jb2x1bW47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXhwZWN0ZWQoZGVzY3JpcHRpb24pIHtcbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihcbiAgICAgICAgbnVsbCxcbiAgICAgICAgW3sgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24gfV0sXG4gICAgICAgIHBlZyRyZXBvcnRlZFBvc1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlcnJvcihtZXNzYWdlKSB7XG4gICAgICB0aHJvdyBwZWckYnVpbGRFeGNlcHRpb24obWVzc2FnZSwgbnVsbCwgcGVnJHJlcG9ydGVkUG9zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckY29tcHV0ZVBvc0RldGFpbHMocG9zKSB7XG4gICAgICBmdW5jdGlvbiBhZHZhbmNlKGRldGFpbHMsIHN0YXJ0UG9zLCBlbmRQb3MpIHtcbiAgICAgICAgdmFyIHAsIGNoO1xuXG4gICAgICAgIGZvciAocCA9IHN0YXJ0UG9zOyBwIDwgZW5kUG9zOyBwKyspIHtcbiAgICAgICAgICBjaCA9IGlucHV0LmNoYXJBdChwKTtcbiAgICAgICAgICBpZiAoY2ggPT09IFwiXFxuXCIpIHtcbiAgICAgICAgICAgIGlmICghZGV0YWlscy5zZWVuQ1IpIHsgZGV0YWlscy5saW5lKys7IH1cbiAgICAgICAgICAgIGRldGFpbHMuY29sdW1uID0gMTtcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaCA9PT0gXCJcXHJcIiB8fCBjaCA9PT0gXCJcXHUyMDI4XCIgfHwgY2ggPT09IFwiXFx1MjAyOVwiKSB7XG4gICAgICAgICAgICBkZXRhaWxzLmxpbmUrKztcbiAgICAgICAgICAgIGRldGFpbHMuY29sdW1uID0gMTtcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGV0YWlscy5jb2x1bW4rKztcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwZWckY2FjaGVkUG9zICE9PSBwb3MpIHtcbiAgICAgICAgaWYgKHBlZyRjYWNoZWRQb3MgPiBwb3MpIHtcbiAgICAgICAgICBwZWckY2FjaGVkUG9zID0gMDtcbiAgICAgICAgICBwZWckY2FjaGVkUG9zRGV0YWlscyA9IHsgbGluZTogMSwgY29sdW1uOiAxLCBzZWVuQ1I6IGZhbHNlIH07XG4gICAgICAgIH1cbiAgICAgICAgYWR2YW5jZShwZWckY2FjaGVkUG9zRGV0YWlscywgcGVnJGNhY2hlZFBvcywgcG9zKTtcbiAgICAgICAgcGVnJGNhY2hlZFBvcyA9IHBvcztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBlZyRjYWNoZWRQb3NEZXRhaWxzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRmYWlsKGV4cGVjdGVkKSB7XG4gICAgICBpZiAocGVnJGN1cnJQb3MgPCBwZWckbWF4RmFpbFBvcykgeyByZXR1cm47IH1cblxuICAgICAgaWYgKHBlZyRjdXJyUG9zID4gcGVnJG1heEZhaWxQb3MpIHtcbiAgICAgICAgcGVnJG1heEZhaWxQb3MgPSBwZWckY3VyclBvcztcbiAgICAgICAgcGVnJG1heEZhaWxFeHBlY3RlZCA9IFtdO1xuICAgICAgfVxuXG4gICAgICBwZWckbWF4RmFpbEV4cGVjdGVkLnB1c2goZXhwZWN0ZWQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRidWlsZEV4Y2VwdGlvbihtZXNzYWdlLCBleHBlY3RlZCwgcG9zKSB7XG4gICAgICBmdW5jdGlvbiBjbGVhbnVwRXhwZWN0ZWQoZXhwZWN0ZWQpIHtcbiAgICAgICAgdmFyIGkgPSAxO1xuXG4gICAgICAgIGV4cGVjdGVkLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgIGlmIChhLmRlc2NyaXB0aW9uIDwgYi5kZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYS5kZXNjcmlwdGlvbiA+IGIuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHdoaWxlIChpIDwgZXhwZWN0ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKGV4cGVjdGVkW2kgLSAxXSA9PT0gZXhwZWN0ZWRbaV0pIHtcbiAgICAgICAgICAgIGV4cGVjdGVkLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBidWlsZE1lc3NhZ2UoZXhwZWN0ZWQsIGZvdW5kKSB7XG4gICAgICAgIGZ1bmN0aW9uIHN0cmluZ0VzY2FwZShzKSB7XG4gICAgICAgICAgZnVuY3Rpb24gaGV4KGNoKSB7IHJldHVybiBjaC5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpOyB9XG5cbiAgICAgICAgICByZXR1cm4gc1xuICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFwvZywgICAnXFxcXFxcXFwnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1wiL2csICAgICdcXFxcXCInKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xceDA4L2csICdcXFxcYicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csICAgJ1xcXFx0JylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXG4vZywgICAnXFxcXG4nKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcZi9nLCAgICdcXFxcZicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxyL2csICAgJ1xcXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx4MDAtXFx4MDdcXHgwQlxceDBFXFx4MEZdL2csIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHgwJyArIGhleChjaCk7IH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xceDEwLVxceDFGXFx4ODAtXFx4RkZdL2csICAgIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHgnICArIGhleChjaCk7IH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xcdTAxODAtXFx1MEZGRl0vZywgICAgICAgICBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx1MCcgKyBoZXgoY2gpOyB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHUxMDgwLVxcdUZGRkZdL2csICAgICAgICAgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxcdScgICsgaGV4KGNoKTsgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZXhwZWN0ZWREZXNjcyA9IG5ldyBBcnJheShleHBlY3RlZC5sZW5ndGgpLFxuICAgICAgICAgICAgZXhwZWN0ZWREZXNjLCBmb3VuZERlc2MsIGk7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGV4cGVjdGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZXhwZWN0ZWREZXNjc1tpXSA9IGV4cGVjdGVkW2ldLmRlc2NyaXB0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhwZWN0ZWREZXNjID0gZXhwZWN0ZWQubGVuZ3RoID4gMVxuICAgICAgICAgID8gZXhwZWN0ZWREZXNjcy5zbGljZSgwLCAtMSkuam9pbihcIiwgXCIpXG4gICAgICAgICAgICAgICsgXCIgb3IgXCJcbiAgICAgICAgICAgICAgKyBleHBlY3RlZERlc2NzW2V4cGVjdGVkLmxlbmd0aCAtIDFdXG4gICAgICAgICAgOiBleHBlY3RlZERlc2NzWzBdO1xuXG4gICAgICAgIGZvdW5kRGVzYyA9IGZvdW5kID8gXCJcXFwiXCIgKyBzdHJpbmdFc2NhcGUoZm91bmQpICsgXCJcXFwiXCIgOiBcImVuZCBvZiBpbnB1dFwiO1xuXG4gICAgICAgIHJldHVybiBcIkV4cGVjdGVkIFwiICsgZXhwZWN0ZWREZXNjICsgXCIgYnV0IFwiICsgZm91bmREZXNjICsgXCIgZm91bmQuXCI7XG4gICAgICB9XG5cbiAgICAgIHZhciBwb3NEZXRhaWxzID0gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBvcyksXG4gICAgICAgICAgZm91bmQgICAgICA9IHBvcyA8IGlucHV0Lmxlbmd0aCA/IGlucHV0LmNoYXJBdChwb3MpIDogbnVsbDtcblxuICAgICAgaWYgKGV4cGVjdGVkICE9PSBudWxsKSB7XG4gICAgICAgIGNsZWFudXBFeHBlY3RlZChleHBlY3RlZCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgU3ludGF4RXJyb3IoXG4gICAgICAgIG1lc3NhZ2UgIT09IG51bGwgPyBtZXNzYWdlIDogYnVpbGRNZXNzYWdlKGV4cGVjdGVkLCBmb3VuZCksXG4gICAgICAgIGV4cGVjdGVkLFxuICAgICAgICBmb3VuZCxcbiAgICAgICAgcG9zLFxuICAgICAgICBwb3NEZXRhaWxzLmxpbmUsXG4gICAgICAgIHBvc0RldGFpbHMuY29sdW1uXG4gICAgICApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXN0YXJ0KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VPckV4cHIoKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMihzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMxID0gW107XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM0KCk7XG4gICAgICAgIH1cbiAgICAgICAgczAgPSBzMTtcbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzApOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2V3cygpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgaWYgKHBlZyRjNi50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMwID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzcpOyB9XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1KTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlY2MoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIGlmIChwZWckYzkudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMCk7IH1cbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzgpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VfXygpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczAgPSBbXTtcbiAgICAgIHMxID0gcGVnJHBhcnNld3MoKTtcbiAgICAgIHdoaWxlIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMC5wdXNoKHMxKTtcbiAgICAgICAgczEgPSBwZWckcGFyc2V3cygpO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTEpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VPckV4cHIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlQW5kRXhwcigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMjQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGMxMjtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMyk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VPckV4cHIoKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzE0KHMxLCBzNSk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZUFuZEV4cHIoKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUFuZEV4cHIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlTm90RXhwcigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzOCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzE1O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE2KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZUFuZEV4cHIoKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzE3KHMxLCBzNSk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzMSA9IHBlZyRwYXJzZU5vdEV4cHIoKTtcbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckcGFyc2VBbmRFeHByKCk7XG4gICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGMxNyhzMSwgczMpO1xuICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRwYXJzZU5vdEV4cHIoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTm90RXhwcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzMpIHtcbiAgICAgICAgczEgPSBwZWckYzE4O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTkpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZU5vdEV4cHIoKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzIwKHMzKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckcGFyc2VCaW5kaW5nRXhwcigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQmluZGluZ0V4cHIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDApIHtcbiAgICAgICAgczEgPSBwZWckYzIxO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjIpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZU9yRXhwcigpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDEpIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMjM7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGMyNShzMyk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZUV4cHIoKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUV4cHIoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIHMwID0gcGVnJHBhcnNlTnVsbGFyeUV4cHIoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZVVuYXJ5RXhwcigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTnVsbGFyeUV4cHIoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IHBlZyRwYXJzZUJvb2xlYW5MaXRlcmFsKCk7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMjYpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjMjY7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI3KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMyOCgpO1xuICAgICAgICB9XG4gICAgICAgIHMwID0gczE7XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMjkpIHtcbiAgICAgICAgICAgIHMxID0gcGVnJGMyOTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzMCk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMzMSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzMyKSB7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGMzMjtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzMzKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjMzQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMzUpIHtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMzU7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzM2KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGMzNygpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VCb29sZWFuTGl0ZXJhbCgpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCA0KSA9PT0gcGVnJGMzOCkge1xuICAgICAgICBzMSA9IHBlZyRjMzg7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzOSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzQwKCk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDUpID09PSBwZWckYzQxKSB7XG4gICAgICAgICAgczEgPSBwZWckYzQxO1xuICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0Mik7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjNDMoKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlVW5hcnlFeHByKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjNDQpIHtcbiAgICAgICAgczEgPSBwZWckYzQ0O1xuICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDUpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZUludGVnZXJMaXRlcmFsKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM0NihzMyk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzQ3KSB7XG4gICAgICAgICAgczEgPSBwZWckYzQ3O1xuICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0OCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzQ5KHMzKTtcbiAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGM1MCkge1xuICAgICAgICAgICAgczEgPSBwZWckYzUwO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzUxKTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzUyKHMzKTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDMpID09PSBwZWckYzUzKSB7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGM1MztcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzU0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1NShzMyk7XG4gICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDMpID09PSBwZWckYzU2KSB7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzU2O1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDM7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1Nyk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzU4KHMzKTtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGM1OSkge1xuICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzU5O1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzYwKTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzYxKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzYyKSB7XG4gICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2MjtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzYzKTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2NChzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDMpID09PSBwZWckYzY1KSB7XG4gICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzY1O1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDM7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2Nik7IH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzY3KHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAzKSA9PT0gcGVnJGM2OCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzY4O1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMztcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzY5KTsgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzcwKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzcxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM3MTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzcyKTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM3MyhzMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNzMoczEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VJbnRlZ2VyTGl0ZXJhbCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKHBlZyRjNzYudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3Nyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjNzU7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgaWYgKHBlZyRjNzgudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgIHMzID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzkpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgIGlmIChwZWckYzc4LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczMgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzkpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChwZWckYzc2LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgIHMzID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3Nyk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjNzU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjODAoczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzc0KTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzNCkge1xuICAgICAgICBzMSA9IHBlZyRjODI7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4Myk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRwYXJzZURvdWJsZVN0cmluZ0NoYXIoKTtcbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VEb3VibGVTdHJpbmdDaGFyKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzNCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzgyO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzgzKTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzg0KHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzOSkge1xuICAgICAgICAgIHMxID0gcGVnJGM4NTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODYpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZVNpbmdsZVN0cmluZ0NoYXIoKTtcbiAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgczMgPSBwZWckcGFyc2VTaW5nbGVTdHJpbmdDaGFyKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzOSkge1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjODU7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4Nik7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzg0KHMyKTtcbiAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlY2MoKTtcbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMxID0gcGVnJGM4NztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgICAgIHMxID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVVucXVvdGVkU3RyaW5nQ2hhcigpO1xuICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlVW5xdW90ZWRTdHJpbmdDaGFyKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjODQoczIpO1xuICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzgxKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRG91YmxlU3RyaW5nQ2hhcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgaWYgKHBlZyRjODgudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4OSk7IH1cbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM4NztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgIHMxID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzkxKHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTIpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjOTI7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkzKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlRXNjYXBlU2VxdWVuY2UoKTtcbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzkxKHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlU2luZ2xlU3RyaW5nQ2hhcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgaWYgKHBlZyRjOTQudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5NSk7IH1cbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM4NztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgIHMxID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzkxKHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTIpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjOTI7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkzKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlRXNjYXBlU2VxdWVuY2UoKTtcbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzkxKHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlVW5xdW90ZWRTdHJpbmdDaGFyKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMiA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjODc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICBzMSA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkwKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM5MShzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUVzY2FwZVNlcXVlbmNlKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgaWYgKHBlZyRjOTYudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5Nyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDExMCkge1xuICAgICAgICAgIHMxID0gcGVnJGM5ODtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTkpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzEwMCgpO1xuICAgICAgICB9XG4gICAgICAgIHMwID0gczE7XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTQpIHtcbiAgICAgICAgICAgIHMxID0gcGVnJGMxMDE7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTAyKTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzEwMygpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTE2KSB7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGMxMDQ7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMDUpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGMxMDYoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cblxuICAgIHZhciBmbG93dXRpbHMgPSByZXF1aXJlKFwiLi4vZmxvdy91dGlscy5qc1wiKTtcblxuICAgIGZ1bmN0aW9uIG9yKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgLy8gQWRkIGV4cGxpY2l0IGZ1bmN0aW9uIG5hbWVzIHRvIGVhc2UgZGVidWdnaW5nLlxuICAgICAgICBmdW5jdGlvbiBvckZpbHRlcigpIHtcbiAgICAgICAgICAgIHJldHVybiBmaXJzdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpIHx8IHNlY29uZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgICAgIG9yRmlsdGVyLmRlc2MgPSBmaXJzdC5kZXNjICsgXCIgb3IgXCIgKyBzZWNvbmQuZGVzYztcbiAgICAgICAgcmV0dXJuIG9yRmlsdGVyO1xuICAgIH1cbiAgICBmdW5jdGlvbiBhbmQoZmlyc3QsIHNlY29uZCkge1xuICAgICAgICBmdW5jdGlvbiBhbmRGaWx0ZXIoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmlyc3QuYXBwbHkodGhpcywgYXJndW1lbnRzKSAmJiBzZWNvbmQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgICAgICBhbmRGaWx0ZXIuZGVzYyA9IGZpcnN0LmRlc2MgKyBcIiBhbmQgXCIgKyBzZWNvbmQuZGVzYztcbiAgICAgICAgcmV0dXJuIGFuZEZpbHRlcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gbm90KGV4cHIpIHtcbiAgICAgICAgZnVuY3Rpb24gbm90RmlsdGVyKCkge1xuICAgICAgICAgICAgcmV0dXJuICFleHByLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cbiAgICAgICAgbm90RmlsdGVyLmRlc2MgPSBcIm5vdCBcIiArIGV4cHIuZGVzYztcbiAgICAgICAgcmV0dXJuIG5vdEZpbHRlcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gYmluZGluZyhleHByKSB7XG4gICAgICAgIGZ1bmN0aW9uIGJpbmRpbmdGaWx0ZXIoKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgICAgIGJpbmRpbmdGaWx0ZXIuZGVzYyA9IFwiKFwiICsgZXhwci5kZXNjICsgXCIpXCI7XG4gICAgICAgIHJldHVybiBiaW5kaW5nRmlsdGVyO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0cnVlRmlsdGVyKGZsb3cpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHRydWVGaWx0ZXIuZGVzYyA9IFwidHJ1ZVwiO1xuICAgIGZ1bmN0aW9uIGZhbHNlRmlsdGVyKGZsb3cpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmYWxzZUZpbHRlci5kZXNjID0gXCJmYWxzZVwiO1xuXG4gICAgdmFyIEFTU0VUX1RZUEVTID0gW1xuICAgICAgICBuZXcgUmVnRXhwKFwidGV4dC9qYXZhc2NyaXB0XCIpLFxuICAgICAgICBuZXcgUmVnRXhwKFwiYXBwbGljYXRpb24veC1qYXZhc2NyaXB0XCIpLFxuICAgICAgICBuZXcgUmVnRXhwKFwiYXBwbGljYXRpb24vamF2YXNjcmlwdFwiKSxcbiAgICAgICAgbmV3IFJlZ0V4cChcInRleHQvY3NzXCIpLFxuICAgICAgICBuZXcgUmVnRXhwKFwiaW1hZ2UvLipcIiksXG4gICAgICAgIG5ldyBSZWdFeHAoXCJhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaFwiKVxuICAgIF07XG4gICAgZnVuY3Rpb24gYXNzZXRGaWx0ZXIoZmxvdykge1xuICAgICAgICBpZiAoZmxvdy5yZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIGN0ID0gZmxvd3V0aWxzLlJlc3BvbnNlVXRpbHMuZ2V0Q29udGVudFR5cGUoZmxvdy5yZXNwb25zZSk7XG4gICAgICAgICAgICB2YXIgaSA9IEFTU0VUX1RZUEVTLmxlbmd0aDtcbiAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICBpZiAoQVNTRVRfVFlQRVNbaV0udGVzdChjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYXNzZXRGaWx0ZXIuZGVzYyA9IFwiaXMgYXNzZXRcIjtcbiAgICBmdW5jdGlvbiByZXNwb25zZUNvZGUoY29kZSl7XG4gICAgICAgIGZ1bmN0aW9uIHJlc3BvbnNlQ29kZUZpbHRlcihmbG93KXtcbiAgICAgICAgICAgIHJldHVybiBmbG93LnJlc3BvbnNlICYmIGZsb3cucmVzcG9uc2UuY29kZSA9PT0gY29kZTtcbiAgICAgICAgfVxuICAgICAgICByZXNwb25zZUNvZGVGaWx0ZXIuZGVzYyA9IFwicmVzcC4gY29kZSBpcyBcIiArIGNvZGU7XG4gICAgICAgIHJldHVybiByZXNwb25zZUNvZGVGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRvbWFpbihyZWdleCl7XG4gICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleCwgXCJpXCIpO1xuICAgICAgICBmdW5jdGlvbiBkb21haW5GaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXF1ZXN0ICYmIHJlZ2V4LnRlc3QoZmxvdy5yZXF1ZXN0Lmhvc3QpO1xuICAgICAgICB9XG4gICAgICAgIGRvbWFpbkZpbHRlci5kZXNjID0gXCJkb21haW4gbWF0Y2hlcyBcIiArIHJlZ2V4O1xuICAgICAgICByZXR1cm4gZG9tYWluRmlsdGVyO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlcnJvckZpbHRlcihmbG93KXtcbiAgICAgICAgcmV0dXJuICEhZmxvdy5lcnJvcjtcbiAgICB9XG4gICAgZXJyb3JGaWx0ZXIuZGVzYyA9IFwiaGFzIGVycm9yXCI7XG4gICAgZnVuY3Rpb24gaGVhZGVyKHJlZ2V4KXtcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XG4gICAgICAgIGZ1bmN0aW9uIGhlYWRlckZpbHRlcihmbG93KXtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgKGZsb3cucmVxdWVzdCAmJiBmbG93dXRpbHMuUmVxdWVzdFV0aWxzLm1hdGNoX2hlYWRlcihmbG93LnJlcXVlc3QsIHJlZ2V4KSlcbiAgICAgICAgICAgICAgICB8fFxuICAgICAgICAgICAgICAgIChmbG93LnJlc3BvbnNlICYmIGZsb3d1dGlscy5SZXNwb25zZVV0aWxzLm1hdGNoX2hlYWRlcihmbG93LnJlc3BvbnNlLCByZWdleCkpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGhlYWRlckZpbHRlci5kZXNjID0gXCJoZWFkZXIgbWF0Y2hlcyBcIiArIHJlZ2V4O1xuICAgICAgICByZXR1cm4gaGVhZGVyRmlsdGVyO1xuICAgIH1cbiAgICBmdW5jdGlvbiByZXF1ZXN0SGVhZGVyKHJlZ2V4KXtcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XG4gICAgICAgIGZ1bmN0aW9uIHJlcXVlc3RIZWFkZXJGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gKGZsb3cucmVxdWVzdCAmJiBmbG93dXRpbHMuUmVxdWVzdFV0aWxzLm1hdGNoX2hlYWRlcihmbG93LnJlcXVlc3QsIHJlZ2V4KSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVxdWVzdEhlYWRlckZpbHRlci5kZXNjID0gXCJyZXEuIGhlYWRlciBtYXRjaGVzIFwiICsgcmVnZXg7XG4gICAgICAgIHJldHVybiByZXF1ZXN0SGVhZGVyRmlsdGVyO1xuICAgIH1cbiAgICBmdW5jdGlvbiByZXNwb25zZUhlYWRlcihyZWdleCl7XG4gICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleCwgXCJpXCIpO1xuICAgICAgICBmdW5jdGlvbiByZXNwb25zZUhlYWRlckZpbHRlcihmbG93KXtcbiAgICAgICAgICAgIHJldHVybiAoZmxvdy5yZXNwb25zZSAmJiBmbG93dXRpbHMuUmVzcG9uc2VVdGlscy5tYXRjaF9oZWFkZXIoZmxvdy5yZXNwb25zZSwgcmVnZXgpKTtcbiAgICAgICAgfVxuICAgICAgICByZXNwb25zZUhlYWRlckZpbHRlci5kZXNjID0gXCJyZXNwLiBoZWFkZXIgbWF0Y2hlcyBcIiArIHJlZ2V4O1xuICAgICAgICByZXR1cm4gcmVzcG9uc2VIZWFkZXJGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG1ldGhvZChyZWdleCl7XG4gICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleCwgXCJpXCIpO1xuICAgICAgICBmdW5jdGlvbiBtZXRob2RGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXF1ZXN0ICYmIHJlZ2V4LnRlc3QoZmxvdy5yZXF1ZXN0Lm1ldGhvZCk7XG4gICAgICAgIH1cbiAgICAgICAgbWV0aG9kRmlsdGVyLmRlc2MgPSBcIm1ldGhvZCBtYXRjaGVzIFwiICsgcmVnZXg7XG4gICAgICAgIHJldHVybiBtZXRob2RGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG5vUmVzcG9uc2VGaWx0ZXIoZmxvdyl7XG4gICAgICAgIHJldHVybiBmbG93LnJlcXVlc3QgJiYgIWZsb3cucmVzcG9uc2U7XG4gICAgfVxuICAgIG5vUmVzcG9uc2VGaWx0ZXIuZGVzYyA9IFwiaGFzIG5vIHJlc3BvbnNlXCI7XG4gICAgZnVuY3Rpb24gcmVzcG9uc2VGaWx0ZXIoZmxvdyl7XG4gICAgICAgIHJldHVybiAhIWZsb3cucmVzcG9uc2U7XG4gICAgfVxuICAgIHJlc3BvbnNlRmlsdGVyLmRlc2MgPSBcImhhcyByZXNwb25zZVwiO1xuXG4gICAgZnVuY3Rpb24gY29udGVudFR5cGUocmVnZXgpe1xuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcbiAgICAgICAgZnVuY3Rpb24gY29udGVudFR5cGVGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIChmbG93LnJlcXVlc3QgJiYgcmVnZXgudGVzdChmbG93dXRpbHMuUmVxdWVzdFV0aWxzLmdldENvbnRlbnRUeXBlKGZsb3cucmVxdWVzdCkpKVxuICAgICAgICAgICAgICAgIHx8XG4gICAgICAgICAgICAgICAgKGZsb3cucmVzcG9uc2UgJiYgcmVnZXgudGVzdChmbG93dXRpbHMuUmVzcG9uc2VVdGlscy5nZXRDb250ZW50VHlwZShmbG93LnJlc3BvbnNlKSkpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRlbnRUeXBlRmlsdGVyLmRlc2MgPSBcImNvbnRlbnQgdHlwZSBtYXRjaGVzIFwiICsgcmVnZXg7XG4gICAgICAgIHJldHVybiBjb250ZW50VHlwZUZpbHRlcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gcmVxdWVzdENvbnRlbnRUeXBlKHJlZ2V4KXtcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XG4gICAgICAgIGZ1bmN0aW9uIHJlcXVlc3RDb250ZW50VHlwZUZpbHRlcihmbG93KXtcbiAgICAgICAgICAgIHJldHVybiBmbG93LnJlcXVlc3QgJiYgcmVnZXgudGVzdChmbG93dXRpbHMuUmVxdWVzdFV0aWxzLmdldENvbnRlbnRUeXBlKGZsb3cucmVxdWVzdCkpO1xuICAgICAgICB9XG4gICAgICAgIHJlcXVlc3RDb250ZW50VHlwZUZpbHRlci5kZXNjID0gXCJyZXEuIGNvbnRlbnQgdHlwZSBtYXRjaGVzIFwiICsgcmVnZXg7XG4gICAgICAgIHJldHVybiByZXF1ZXN0Q29udGVudFR5cGVGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlc3BvbnNlQ29udGVudFR5cGUocmVnZXgpe1xuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcbiAgICAgICAgZnVuY3Rpb24gcmVzcG9uc2VDb250ZW50VHlwZUZpbHRlcihmbG93KXtcbiAgICAgICAgICAgIHJldHVybiBmbG93LnJlc3BvbnNlICYmIHJlZ2V4LnRlc3QoZmxvd3V0aWxzLlJlc3BvbnNlVXRpbHMuZ2V0Q29udGVudFR5cGUoZmxvdy5yZXNwb25zZSkpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3BvbnNlQ29udGVudFR5cGVGaWx0ZXIuZGVzYyA9IFwicmVzcC4gY29udGVudCB0eXBlIG1hdGNoZXMgXCIgKyByZWdleDtcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlQ29udGVudFR5cGVGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHVybChyZWdleCl7XG4gICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleCwgXCJpXCIpO1xuICAgICAgICBmdW5jdGlvbiB1cmxGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXF1ZXN0ICYmIHJlZ2V4LnRlc3QoZmxvd3V0aWxzLlJlcXVlc3RVdGlscy5wcmV0dHlfdXJsKGZsb3cucmVxdWVzdCkpO1xuICAgICAgICB9XG4gICAgICAgIHVybEZpbHRlci5kZXNjID0gXCJ1cmwgbWF0Y2hlcyBcIiArIHJlZ2V4O1xuICAgICAgICByZXR1cm4gdXJsRmlsdGVyO1xuICAgIH1cblxuXG4gICAgcGVnJHJlc3VsdCA9IHBlZyRzdGFydFJ1bGVGdW5jdGlvbigpO1xuXG4gICAgaWYgKHBlZyRyZXN1bHQgIT09IHBlZyRGQUlMRUQgJiYgcGVnJGN1cnJQb3MgPT09IGlucHV0Lmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHBlZyRyZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwZWckcmVzdWx0ICE9PSBwZWckRkFJTEVEICYmIHBlZyRjdXJyUG9zIDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgICAgIHBlZyRmYWlsKHsgdHlwZTogXCJlbmRcIiwgZGVzY3JpcHRpb246IFwiZW5kIG9mIGlucHV0XCIgfSk7XG4gICAgICB9XG5cbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihudWxsLCBwZWckbWF4RmFpbEV4cGVjdGVkLCBwZWckbWF4RmFpbFBvcyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBTeW50YXhFcnJvcjogU3ludGF4RXJyb3IsXG4gICAgcGFyc2U6ICAgICAgIHBhcnNlXG4gIH07XG59KSgpOyIsInZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcblxudmFyIF9NZXNzYWdlVXRpbHMgPSB7XG4gICAgZ2V0Q29udGVudFR5cGU6IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldF9maXJzdF9oZWFkZXIobWVzc2FnZSwgL15Db250ZW50LVR5cGUkL2kpO1xuICAgIH0sXG4gICAgZ2V0X2ZpcnN0X2hlYWRlcjogZnVuY3Rpb24gKG1lc3NhZ2UsIHJlZ2V4KSB7XG4gICAgICAgIC8vRklYTUU6IENhY2hlIEludmFsaWRhdGlvbi5cbiAgICAgICAgaWYgKCFtZXNzYWdlLl9oZWFkZXJMb29rdXBzKVxuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1lc3NhZ2UsIFwiX2hlYWRlckxvb2t1cHNcIiwge1xuICAgICAgICAgICAgICAgIHZhbHVlOiB7fSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIGlmICghKHJlZ2V4IGluIG1lc3NhZ2UuX2hlYWRlckxvb2t1cHMpKSB7XG4gICAgICAgICAgICB2YXIgaGVhZGVyO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtZXNzYWdlLmhlYWRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoISFtZXNzYWdlLmhlYWRlcnNbaV1bMF0ubWF0Y2gocmVnZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGhlYWRlciA9IG1lc3NhZ2UuaGVhZGVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWVzc2FnZS5faGVhZGVyTG9va3Vwc1tyZWdleF0gPSBoZWFkZXIgPyBoZWFkZXJbMV0gOiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lc3NhZ2UuX2hlYWRlckxvb2t1cHNbcmVnZXhdO1xuICAgIH0sXG4gICAgbWF0Y2hfaGVhZGVyOiBmdW5jdGlvbiAobWVzc2FnZSwgcmVnZXgpIHtcbiAgICAgICAgdmFyIGhlYWRlcnMgPSBtZXNzYWdlLmhlYWRlcnM7XG4gICAgICAgIHZhciBpID0gaGVhZGVycy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChyZWdleC50ZXN0KGhlYWRlcnNbaV0uam9pbihcIiBcIikpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcnNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG4gICAgaXNQcmludGFibGU6IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0dmFyIHByaW50YWJsZVR5cGVzID0gWyd0ZXh0L3BsYWluJywgXG5cdFx0XHQgICAgICAndGV4dC9qc29uJywgXG5cdFx0XHQgICAgICAnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHQgICAgICAnYXBwbGljYXRpb24veC1qYXZhc2NyaXB0Jyxcblx0XHRcdCAgICAgICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0Jyxcblx0XHRcdCAgICAgICd0ZXh0L2phdmFzY3JpcHQnLFxuXHRcdFx0ICAgICAgJ3RleHQveG1sJyxcblx0XHRcdCAgICAgICd0ZXh0L2h0bWwnLFxuXHRcdFx0ICAgICAgJ3RleHQveGh0bWwnXTtcblx0dmFyIGNvbnRlbnRUeXBlID0gdGhpcy5nZXRDb250ZW50VHlwZShtZXNzYWdlKS5zcGxpdCgnICcpO1xuXHRpZiAocHJpbnRhYmxlVHlwZXMuaW5kZXhPZihjb250ZW50VHlwZSkpIHtcblx0ICAgIHJldHVybiB0cnVlO1xuXHR9IGVsc2Uge1xuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHR9XHRcbiAgICB9XG59O1xuXG52YXIgZGVmYXVsdFBvcnRzID0ge1xuICAgIFwiaHR0cFwiOiA4MCxcbiAgICBcImh0dHBzXCI6IDQ0M1xufTtcblxudmFyIFJlcXVlc3RVdGlscyA9IF8uZXh0ZW5kKF9NZXNzYWdlVXRpbHMsIHtcbiAgICBwcmV0dHlfaG9zdDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcbiAgICAgICAgLy9GSVhNRTogQWRkIGhvc3RoZWFkZXJcbiAgICAgICAgcmV0dXJuIHJlcXVlc3QuaG9zdDtcbiAgICB9LFxuICAgIHByZXR0eV91cmw6IGZ1bmN0aW9uIChyZXF1ZXN0KSB7XG4gICAgICAgIHZhciBwb3J0ID0gXCJcIjtcbiAgICAgICAgaWYgKGRlZmF1bHRQb3J0c1tyZXF1ZXN0LnNjaGVtZV0gIT09IHJlcXVlc3QucG9ydCkge1xuICAgICAgICAgICAgcG9ydCA9IFwiOlwiICsgcmVxdWVzdC5wb3J0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXF1ZXN0LnNjaGVtZSArIFwiOi8vXCIgKyB0aGlzLnByZXR0eV9ob3N0KHJlcXVlc3QpICsgcG9ydCArIHJlcXVlc3QucGF0aDtcbiAgICB9XG59KTtcblxudmFyIFJlc3BvbnNlVXRpbHMgPSBfLmV4dGVuZChfTWVzc2FnZVV0aWxzLCB7fSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgUmVzcG9uc2VVdGlsczogUmVzcG9uc2VVdGlscyxcbiAgICBSZXF1ZXN0VXRpbHM6IFJlcXVlc3RVdGlsc1xuXG59XG4iLCJcbnZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcbnZhciAkID0gcmVxdWlyZShcImpxdWVyeVwiKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoXCIuLi91dGlscy5qc1wiKTtcbnZhciBhY3Rpb25zID0gcmVxdWlyZShcIi4uL2FjdGlvbnMuanNcIik7XG52YXIgZGlzcGF0Y2hlciA9IHJlcXVpcmUoXCIuLi9kaXNwYXRjaGVyLmpzXCIpO1xuXG5cbmZ1bmN0aW9uIExpc3RTdG9yZSgpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnJlc2V0KCk7XG59XG5fLmV4dGVuZChMaXN0U3RvcmUucHJvdG90eXBlLCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gICAgYWRkOiBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICBpZiAoZWxlbS5pZCBpbiB0aGlzLl9wb3NfbWFwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcG9zX21hcFtlbGVtLmlkXSA9IHRoaXMubGlzdC5sZW5ndGg7XG4gICAgICAgIHRoaXMubGlzdC5wdXNoKGVsZW0pO1xuICAgICAgICB0aGlzLmVtaXQoXCJhZGRcIiwgZWxlbSk7XG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChlbGVtKSB7XG4gICAgICAgIGlmICghKGVsZW0uaWQgaW4gdGhpcy5fcG9zX21hcCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxpc3RbdGhpcy5fcG9zX21hcFtlbGVtLmlkXV0gPSBlbGVtO1xuICAgICAgICB0aGlzLmVtaXQoXCJ1cGRhdGVcIiwgZWxlbSk7XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uIChlbGVtX2lkKSB7XG4gICAgICAgIGlmICghKGVsZW1faWQgaW4gdGhpcy5fcG9zX21hcCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxpc3Quc3BsaWNlKHRoaXMuX3Bvc19tYXBbZWxlbV9pZF0sIDEpO1xuICAgICAgICB0aGlzLl9idWlsZF9tYXAoKTtcbiAgICAgICAgdGhpcy5lbWl0KFwicmVtb3ZlXCIsIGVsZW1faWQpO1xuICAgIH0sXG4gICAgcmVzZXQ6IGZ1bmN0aW9uIChlbGVtcykge1xuICAgICAgICB0aGlzLmxpc3QgPSBlbGVtcyB8fCBbXTtcbiAgICAgICAgdGhpcy5fYnVpbGRfbWFwKCk7XG4gICAgICAgIHRoaXMuZW1pdChcInJlY2FsY3VsYXRlXCIpO1xuICAgIH0sXG4gICAgX2J1aWxkX21hcDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLl9wb3NfbWFwID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgZWxlbSA9IHRoaXMubGlzdFtpXTtcbiAgICAgICAgICAgIHRoaXMuX3Bvc19tYXBbZWxlbS5pZF0gPSBpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChlbGVtX2lkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxpc3RbdGhpcy5fcG9zX21hcFtlbGVtX2lkXV07XG4gICAgfSxcbiAgICBpbmRleDogZnVuY3Rpb24gKGVsZW1faWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc19tYXBbZWxlbV9pZF07XG4gICAgfVxufSk7XG5cblxuZnVuY3Rpb24gRGljdFN0b3JlKCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMucmVzZXQoKTtcbn1cbl8uZXh0ZW5kKERpY3RTdG9yZS5wcm90b3R5cGUsIEV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkaWN0KSB7XG4gICAgICAgIF8ubWVyZ2UodGhpcy5kaWN0LCBkaWN0KTtcbiAgICAgICAgdGhpcy5lbWl0KFwicmVjYWxjdWxhdGVcIik7XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKGRpY3QpIHtcbiAgICAgICAgdGhpcy5kaWN0ID0gZGljdCB8fCB7fTtcbiAgICAgICAgdGhpcy5lbWl0KFwicmVjYWxjdWxhdGVcIik7XG4gICAgfVxufSk7XG5cbmZ1bmN0aW9uIExpdmVTdG9yZU1peGluKHR5cGUpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuXG4gICAgdGhpcy5fdXBkYXRlc19iZWZvcmVfZmV0Y2ggPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZmV0Y2h4aHIgPSBmYWxzZTtcblxuICAgIHRoaXMuaGFuZGxlID0gdGhpcy5oYW5kbGUuYmluZCh0aGlzKTtcbiAgICBkaXNwYXRjaGVyLkFwcERpc3BhdGNoZXIucmVnaXN0ZXIodGhpcy5oYW5kbGUpO1xuXG4gICAgLy8gQXZvaWQgZG91YmxlLWZldGNoIG9uIHN0YXJ0dXAuXG4gICAgaWYgKCEod2luZG93LndzICYmIHdpbmRvdy53cy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuQ09OTkVDVElORykpIHtcbiAgICAgICAgdGhpcy5mZXRjaCgpO1xuICAgIH1cbn1cbl8uZXh0ZW5kKExpdmVTdG9yZU1peGluLnByb3RvdHlwZSwge1xuICAgIGhhbmRsZTogZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudC50eXBlID09PSBhY3Rpb25zLkFjdGlvblR5cGVzLkNPTk5FQ1RJT05fT1BFTikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmV0Y2goKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gdGhpcy50eXBlKSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQuY21kID09PSBhY3Rpb25zLlN0b3JlQ21kcy5SRVNFVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZmV0Y2goZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJkZWZlciB1cGRhdGVcIiwgZXZlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoLnB1c2goZXZlbnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzW2V2ZW50LmNtZF0oZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRpc3BhdGNoZXIuQXBwRGlzcGF0Y2hlci51bnJlZ2lzdGVyKHRoaXMuaGFuZGxlKTtcbiAgICB9LFxuICAgIGZldGNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcImZldGNoIFwiICsgdGhpcy50eXBlKTtcbiAgICAgICAgaWYgKHRoaXMuX2ZldGNoeGhyKSB7XG4gICAgICAgICAgICB0aGlzLl9mZXRjaHhoci5hYm9ydCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoID0gW107IC8vIChKUzogZW1wdHkgYXJyYXkgaXMgdHJ1ZSlcbiAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlX2ZldGNoKGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fZmV0Y2h4aHIgPSAkLmdldEpTT04oXCIvXCIgKyB0aGlzLnR5cGUpXG4gICAgICAgICAgICAgICAgLmRvbmUoZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVfZmV0Y2gobWVzc2FnZS5kYXRhKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICAgICAgICAgICAgLmZhaWwoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBFdmVudExvZ0FjdGlvbnMuYWRkX2V2ZW50KFwiQ291bGQgbm90IGZldGNoIFwiICsgdGhpcy50eXBlKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBoYW5kbGVfZmV0Y2g6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2ZldGNoeGhyID0gZmFsc2U7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMudHlwZSArIFwiIGZldGNoZWQuXCIsIHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoKTtcbiAgICAgICAgdGhpcy5yZXNldChkYXRhKTtcbiAgICAgICAgdmFyIHVwZGF0ZXMgPSB0aGlzLl91cGRhdGVzX2JlZm9yZV9mZXRjaDtcbiAgICAgICAgdGhpcy5fdXBkYXRlc19iZWZvcmVfZmV0Y2ggPSBmYWxzZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1cGRhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSh1cGRhdGVzW2ldKTtcbiAgICAgICAgfVxuICAgIH0sXG59KTtcblxuZnVuY3Rpb24gTGl2ZUxpc3RTdG9yZSh0eXBlKSB7XG4gICAgTGlzdFN0b3JlLmNhbGwodGhpcyk7XG4gICAgTGl2ZVN0b3JlTWl4aW4uY2FsbCh0aGlzLCB0eXBlKTtcbn1cbl8uZXh0ZW5kKExpdmVMaXN0U3RvcmUucHJvdG90eXBlLCBMaXN0U3RvcmUucHJvdG90eXBlLCBMaXZlU3RvcmVNaXhpbi5wcm90b3R5cGUpO1xuXG5mdW5jdGlvbiBMaXZlRGljdFN0b3JlKHR5cGUpIHtcbiAgICBEaWN0U3RvcmUuY2FsbCh0aGlzKTtcbiAgICBMaXZlU3RvcmVNaXhpbi5jYWxsKHRoaXMsIHR5cGUpO1xufVxuXy5leHRlbmQoTGl2ZURpY3RTdG9yZS5wcm90b3R5cGUsIERpY3RTdG9yZS5wcm90b3R5cGUsIExpdmVTdG9yZU1peGluLnByb3RvdHlwZSk7XG5cblxuZnVuY3Rpb24gRmxvd1N0b3JlKCkge1xuICAgIHJldHVybiBuZXcgTGl2ZUxpc3RTdG9yZShhY3Rpb25zLkFjdGlvblR5cGVzLkZMT1dfU1RPUkUpO1xufVxuXG5mdW5jdGlvbiBTZXR0aW5nc1N0b3JlKCkge1xuICAgIHJldHVybiBuZXcgTGl2ZURpY3RTdG9yZShhY3Rpb25zLkFjdGlvblR5cGVzLlNFVFRJTkdTX1NUT1JFKTtcbn1cblxuZnVuY3Rpb24gRXZlbnRMb2dTdG9yZSgpIHtcbiAgICBMaXZlTGlzdFN0b3JlLmNhbGwodGhpcywgYWN0aW9ucy5BY3Rpb25UeXBlcy5FVkVOVF9TVE9SRSk7XG59XG5fLmV4dGVuZChFdmVudExvZ1N0b3JlLnByb3RvdHlwZSwgTGl2ZUxpc3RTdG9yZS5wcm90b3R5cGUsIHtcbiAgICBmZXRjaDogZnVuY3Rpb24oKXtcbiAgICAgICAgTGl2ZUxpc3RTdG9yZS5wcm90b3R5cGUuZmV0Y2guYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgICAvLyBNYWtlIHN1cmUgdG8gZGlzcGxheSB1cGRhdGVzIGV2ZW4gaWYgZmV0Y2hpbmcgYWxsIGV2ZW50cyBmYWlsZWQuXG4gICAgICAgIC8vIFRoaXMgd2F5LCB3ZSBjYW4gc2VuZCBcImZldGNoIGZhaWxlZFwiIGxvZyBtZXNzYWdlcyB0byB0aGUgbG9nLlxuICAgICAgICBpZih0aGlzLl9mZXRjaHhocil7XG4gICAgICAgICAgICB0aGlzLl9mZXRjaHhoci5mYWlsKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVfZmV0Y2gobnVsbCk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgRXZlbnRMb2dTdG9yZTogRXZlbnRMb2dTdG9yZSxcbiAgICBTZXR0aW5nc1N0b3JlOiBTZXR0aW5nc1N0b3JlLFxuICAgIEZsb3dTdG9yZTogRmxvd1N0b3JlXG59OyIsIlxudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcblxuXG52YXIgdXRpbHMgPSByZXF1aXJlKFwiLi4vdXRpbHMuanNcIik7XG5cbmZ1bmN0aW9uIFNvcnRCeVN0b3JlT3JkZXIoZWxlbSkge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLmluZGV4KGVsZW0uaWQpO1xufVxuXG52YXIgZGVmYXVsdF9zb3J0ID0gU29ydEJ5U3RvcmVPcmRlcjtcbnZhciBkZWZhdWx0X2ZpbHQgPSBmdW5jdGlvbihlbGVtKXtcbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbmZ1bmN0aW9uIFN0b3JlVmlldyhzdG9yZSwgZmlsdCwgc29ydGZ1bikge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIGZpbHQgPSBmaWx0IHx8IGRlZmF1bHRfZmlsdDtcbiAgICBzb3J0ZnVuID0gc29ydGZ1biB8fCBkZWZhdWx0X3NvcnQ7XG5cbiAgICB0aGlzLnN0b3JlID0gc3RvcmU7XG5cbiAgICB0aGlzLmFkZCA9IHRoaXMuYWRkLmJpbmQodGhpcyk7XG4gICAgdGhpcy51cGRhdGUgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMucmVtb3ZlID0gdGhpcy5yZW1vdmUuYmluZCh0aGlzKTtcbiAgICB0aGlzLnJlY2FsY3VsYXRlID0gdGhpcy5yZWNhbGN1bGF0ZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJhZGRcIiwgdGhpcy5hZGQpO1xuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJ1cGRhdGVcIiwgdGhpcy51cGRhdGUpO1xuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJyZW1vdmVcIiwgdGhpcy5yZW1vdmUpO1xuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLnJlY2FsY3VsYXRlKTtcblxuICAgIHRoaXMucmVjYWxjdWxhdGUoZmlsdCwgc29ydGZ1bik7XG59XG5cbl8uZXh0ZW5kKFN0b3JlVmlldy5wcm90b3R5cGUsIEV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0b3JlLnJlbW92ZUxpc3RlbmVyKFwiYWRkXCIsIHRoaXMuYWRkKTtcbiAgICAgICAgdGhpcy5zdG9yZS5yZW1vdmVMaXN0ZW5lcihcInVwZGF0ZVwiLCB0aGlzLnVwZGF0ZSk7XG4gICAgICAgIHRoaXMuc3RvcmUucmVtb3ZlTGlzdGVuZXIoXCJyZW1vdmVcIiwgdGhpcy5yZW1vdmUpO1xuICAgICAgICB0aGlzLnN0b3JlLnJlbW92ZUxpc3RlbmVyKFwicmVjYWxjdWxhdGVcIiwgdGhpcy5yZWNhbGN1bGF0ZSk7XG4gICAgICAgIH0sXG4gICAgICAgIHJlY2FsY3VsYXRlOiBmdW5jdGlvbiAoZmlsdCwgc29ydGZ1bikge1xuICAgICAgICBpZiAoZmlsdCkge1xuICAgICAgICAgICAgdGhpcy5maWx0ID0gZmlsdC5iaW5kKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzb3J0ZnVuKSB7XG4gICAgICAgICAgICB0aGlzLnNvcnRmdW4gPSBzb3J0ZnVuLmJpbmQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpc3QgPSB0aGlzLnN0b3JlLmxpc3QuZmlsdGVyKHRoaXMuZmlsdCk7XG4gICAgICAgIHRoaXMubGlzdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zb3J0ZnVuKGEpIC0gdGhpcy5zb3J0ZnVuKGIpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB0aGlzLmVtaXQoXCJyZWNhbGN1bGF0ZVwiKTtcbiAgICB9LFxuICAgIGluZGV4OiBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICByZXR1cm4gXy5zb3J0ZWRJbmRleCh0aGlzLmxpc3QsIGVsZW0sIHRoaXMuc29ydGZ1bik7XG4gICAgfSxcbiAgICBhZGQ6IGZ1bmN0aW9uIChlbGVtKSB7XG4gICAgICAgIGlmICh0aGlzLmZpbHQoZWxlbSkpIHtcbiAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLmluZGV4KGVsZW0pO1xuICAgICAgICAgICAgaWYgKGlkeCA9PT0gdGhpcy5saXN0Lmxlbmd0aCkgeyAvL2hhcHBlbnMgb2Z0ZW4sIC5wdXNoIGlzIHdheSBmYXN0ZXIuXG4gICAgICAgICAgICAgICAgdGhpcy5saXN0LnB1c2goZWxlbSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubGlzdC5zcGxpY2UoaWR4LCAwLCBlbGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdChcImFkZFwiLCBlbGVtLCBpZHgpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChlbGVtKSB7XG4gICAgICAgIHZhciBpZHg7XG4gICAgICAgIHZhciBpID0gdGhpcy5saXN0Lmxlbmd0aDtcbiAgICAgICAgLy8gU2VhcmNoIGZyb20gdGhlIGJhY2ssIHdlIHVzdWFsbHkgdXBkYXRlIHRoZSBsYXRlc3QgZW50cmllcy5cbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgaWYgKHRoaXMubGlzdFtpXS5pZCA9PT0gZWxlbS5pZCkge1xuICAgICAgICAgICAgICAgIGlkeCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaWR4ID09PSAtMSkgeyAvL25vdCBjb250YWluZWQgaW4gbGlzdFxuICAgICAgICAgICAgdGhpcy5hZGQoZWxlbSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuZmlsdChlbGVtKSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZWxlbS5pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3J0ZnVuKHRoaXMubGlzdFtpZHhdKSAhPT0gdGhpcy5zb3J0ZnVuKGVsZW0pKSB7IC8vc29ydHBvcyBoYXMgY2hhbmdlZFxuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlKHRoaXMubGlzdFtpZHhdKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZChlbGVtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5saXN0W2lkeF0gPSBlbGVtO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcInVwZGF0ZVwiLCBlbGVtLCBpZHgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uIChlbGVtX2lkKSB7XG4gICAgICAgIHZhciBpZHggPSB0aGlzLmxpc3QubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaWR4LS0pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxpc3RbaWR4XS5pZCA9PT0gZWxlbV9pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMubGlzdC5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoXCJyZW1vdmVcIiwgZWxlbV9pZCwgaWR4KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBTdG9yZVZpZXc6IFN0b3JlVmlld1xufTsiLCJ2YXIgJCA9IHJlcXVpcmUoXCJqcXVlcnlcIik7XG5cblxudmFyIEtleSA9IHtcbiAgICBVUDogMzgsXG4gICAgRE9XTjogNDAsXG4gICAgUEFHRV9VUDogMzMsXG4gICAgUEFHRV9ET1dOOiAzNCxcbiAgICBIT01FOiAzNixcbiAgICBFTkQ6IDM1LFxuICAgIExFRlQ6IDM3LFxuICAgIFJJR0hUOiAzOSxcbiAgICBFTlRFUjogMTMsXG4gICAgRVNDOiAyNyxcbiAgICBUQUI6IDksXG4gICAgU1BBQ0U6IDMyLFxuICAgIEJBQ0tTUEFDRTogOCxcbn07XG4vLyBBZGQgQS1aXG5mb3IgKHZhciBpID0gNjU7IGkgPD0gOTA7IGkrKykge1xuICAgIEtleVtTdHJpbmcuZnJvbUNoYXJDb2RlKGkpXSA9IGk7XG59XG5cblxudmFyIGZvcm1hdFNpemUgPSBmdW5jdGlvbiAoYnl0ZXMpIHtcbiAgICBpZiAoYnl0ZXMgPT09IDApXG4gICAgICAgIHJldHVybiBcIjBcIjtcbiAgICB2YXIgcHJlZml4ID0gW1wiYlwiLCBcImtiXCIsIFwibWJcIiwgXCJnYlwiLCBcInRiXCJdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJlZml4Lmxlbmd0aDsgaSsrKXtcbiAgICAgICAgaWYgKE1hdGgucG93KDEwMjQsIGkgKyAxKSA+IGJ5dGVzKXtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIHZhciBwcmVjaXNpb247XG4gICAgaWYgKGJ5dGVzJU1hdGgucG93KDEwMjQsIGkpID09PSAwKVxuICAgICAgICBwcmVjaXNpb24gPSAwO1xuICAgIGVsc2VcbiAgICAgICAgcHJlY2lzaW9uID0gMTtcbiAgICByZXR1cm4gKGJ5dGVzL01hdGgucG93KDEwMjQsIGkpKS50b0ZpeGVkKHByZWNpc2lvbikgKyBwcmVmaXhbaV07XG59O1xuXG5cbnZhciBmb3JtYXRUaW1lRGVsdGEgPSBmdW5jdGlvbiAobWlsbGlzZWNvbmRzKSB7XG4gICAgdmFyIHRpbWUgPSBtaWxsaXNlY29uZHM7XG4gICAgdmFyIHByZWZpeCA9IFtcIm1zXCIsIFwic1wiLCBcIm1pblwiLCBcImhcIl07XG4gICAgdmFyIGRpdiA9IFsxMDAwLCA2MCwgNjBdO1xuICAgIHZhciBpID0gMDtcbiAgICB3aGlsZSAoTWF0aC5hYnModGltZSkgPj0gZGl2W2ldICYmIGkgPCBkaXYubGVuZ3RoKSB7XG4gICAgICAgIHRpbWUgPSB0aW1lIC8gZGl2W2ldO1xuICAgICAgICBpKys7XG4gICAgfVxuICAgIHJldHVybiBNYXRoLnJvdW5kKHRpbWUpICsgcHJlZml4W2ldO1xufTtcblxuXG52YXIgZm9ybWF0VGltZVN0YW1wID0gZnVuY3Rpb24gKHNlY29uZHMpIHtcbiAgICB2YXIgdHMgPSAobmV3IERhdGUoc2Vjb25kcyAqIDEwMDApKS50b0lTT1N0cmluZygpO1xuICAgIHJldHVybiB0cy5yZXBsYWNlKFwiVFwiLCBcIiBcIikucmVwbGFjZShcIlpcIiwgXCJcIik7XG59O1xuXG5cbmZ1bmN0aW9uIGdldENvb2tpZShuYW1lKSB7XG4gICAgdmFyIHIgPSBkb2N1bWVudC5jb29raWUubWF0Y2goXCJcXFxcYlwiICsgbmFtZSArIFwiPShbXjtdKilcXFxcYlwiKTtcbiAgICByZXR1cm4gciA/IHJbMV0gOiB1bmRlZmluZWQ7XG59XG52YXIgeHNyZiA9ICQucGFyYW0oe194c3JmOiBnZXRDb29raWUoXCJfeHNyZlwiKX0pO1xuXG4vL1Rvcm5hZG8gWFNSRiBQcm90ZWN0aW9uLlxuJC5hamF4UHJlZmlsdGVyKGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgaWYgKFtcInBvc3RcIiwgXCJwdXRcIiwgXCJkZWxldGVcIl0uaW5kZXhPZihvcHRpb25zLnR5cGUudG9Mb3dlckNhc2UoKSkgPj0gMCAmJiBvcHRpb25zLnVybFswXSA9PT0gXCIvXCIpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuZGF0YSkge1xuICAgICAgICAgICAgb3B0aW9ucy5kYXRhICs9IChcIiZcIiArIHhzcmYpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucy5kYXRhID0geHNyZjtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuLy8gTG9nIEFKQVggRXJyb3JzXG4kKGRvY3VtZW50KS5hamF4RXJyb3IoZnVuY3Rpb24gKGV2ZW50LCBqcVhIUiwgYWpheFNldHRpbmdzLCB0aHJvd25FcnJvcikge1xuICAgIHZhciBtZXNzYWdlID0ganFYSFIucmVzcG9uc2VUZXh0O1xuICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSwgYXJndW1lbnRzKTtcbiAgICBFdmVudExvZ0FjdGlvbnMuYWRkX2V2ZW50KHRocm93bkVycm9yICsgXCI6IFwiICsgbWVzc2FnZSk7XG4gICAgd2luZG93LmFsZXJ0KG1lc3NhZ2UpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGZvcm1hdFNpemU6IGZvcm1hdFNpemUsXG4gICAgZm9ybWF0VGltZURlbHRhOiBmb3JtYXRUaW1lRGVsdGEsXG4gICAgZm9ybWF0VGltZVN0YW1wOiBmb3JtYXRUaW1lU3RhbXAsXG4gICAgS2V5OiBLZXlcbn07Il19
