// ../../Library/Caches/deno/npm/registry.npmjs.org/preact/10.26.4/dist/preact.module.js
var n;
var l;
var t;
var u;
var i;
var r;
var o;
var e;
var f;
var c;
var s;
var a;
var h;
var p = {};
var v = [];
var y = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var d = Array.isArray;
function w(n2, l3) {
  for (var t3 in l3) n2[t3] = l3[t3];
  return n2;
}
function g(n2) {
  n2 && n2.parentNode && n2.parentNode.removeChild(n2);
}
function _(l3, t3, u4) {
  var i4, r3, o3, e3 = {};
  for (o3 in t3) "key" == o3 ? i4 = t3[o3] : "ref" == o3 ? r3 = t3[o3] : e3[o3] = t3[o3];
  if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : u4), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
  return m(l3, e3, i4, r3, null);
}
function m(n2, u4, i4, r3, o3) {
  var e3 = {
    type: n2,
    props: u4,
    key: i4,
    ref: r3,
    __k: null,
    __: null,
    __b: 0,
    __e: null,
    __c: null,
    constructor: void 0,
    __v: null == o3 ? ++t : o3,
    __i: -1,
    __u: 0
  };
  return null == o3 && null != l.vnode && l.vnode(e3), e3;
}
function k(n2) {
  return n2.children;
}
function x(n2, l3) {
  this.props = n2, this.context = l3;
}
function S(n2, l3) {
  if (null == l3) return n2.__ ? S(n2.__, n2.__i + 1) : null;
  for (var t3; l3 < n2.__k.length; l3++) if (null != (t3 = n2.__k[l3]) && null != t3.__e) return t3.__e;
  return "function" == typeof n2.type ? S(n2) : null;
}
function C(n2) {
  var l3, t3;
  if (null != (n2 = n2.__) && null != n2.__c) {
    for (n2.__e = n2.__c.base = null, l3 = 0; l3 < n2.__k.length; l3++) if (null != (t3 = n2.__k[l3]) && null != t3.__e) {
      n2.__e = n2.__c.base = t3.__e;
      break;
    }
    return C(n2);
  }
}
function M(n2) {
  (!n2.__d && (n2.__d = true) && i.push(n2) && !$.__r++ || r !== l.debounceRendering) && ((r = l.debounceRendering) || o)($);
}
function $() {
  for (var n2, t3, u4, r3, o3, f4, c3, s3 = 1; i.length; ) i.length > s3 && i.sort(e), n2 = i.shift(), s3 = i.length, n2.__d && (u4 = void 0, o3 = (r3 = (t3 = n2).__v).__e, f4 = [], c3 = [], t3.__P && ((u4 = w({}, r3)).__v = r3.__v + 1, l.vnode && l.vnode(u4), O(t3.__P, u4, r3, t3.__n, t3.__P.namespaceURI, 32 & r3.__u ? [
    o3
  ] : null, f4, null == o3 ? S(r3) : o3, !!(32 & r3.__u), c3), u4.__v = r3.__v, u4.__.__k[u4.__i] = u4, z(f4, u4, c3), u4.__e != o3 && C(u4)));
  $.__r = 0;
}
function I(n2, l3, t3, u4, i4, r3, o3, e3, f4, c3, s3) {
  var a3, h3, y3, d3, w3, g2, _2 = u4 && u4.__k || v, m3 = l3.length;
  for (f4 = P(t3, l3, _2, f4, m3), a3 = 0; a3 < m3; a3++) null != (y3 = t3.__k[a3]) && (h3 = -1 === y3.__i ? p : _2[y3.__i] || p, y3.__i = a3, g2 = O(n2, y3, h3, i4, r3, o3, e3, f4, c3, s3), d3 = y3.__e, y3.ref && h3.ref != y3.ref && (h3.ref && q(h3.ref, null, y3), s3.push(y3.ref, y3.__c || d3, y3)), null == w3 && null != d3 && (w3 = d3), 4 & y3.__u || h3.__k === y3.__k ? f4 = A(y3, f4, n2) : "function" == typeof y3.type && void 0 !== g2 ? f4 = g2 : d3 && (f4 = d3.nextSibling), y3.__u &= -7);
  return t3.__e = w3, f4;
}
function P(n2, l3, t3, u4, i4) {
  var r3, o3, e3, f4, c3, s3 = t3.length, a3 = s3, h3 = 0;
  for (n2.__k = new Array(i4), r3 = 0; r3 < i4; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? (f4 = r3 + h3, (o3 = n2.__k[r3] = "string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? m(null, o3, null, null, null) : d(o3) ? m(k, {
    children: o3
  }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? m(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : o3).__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 !== (c3 = o3.__i = L(o3, t3, f4, a3)) && (a3--, (e3 = t3[c3]) && (e3.__u |= 2)), null == e3 || null === e3.__v ? (-1 == c3 && (i4 > s3 ? h3-- : i4 < s3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h3-- : c3 == f4 + 1 ? h3++ : (c3 > f4 ? h3-- : h3++, o3.__u |= 4))) : n2.__k[r3] = null;
  if (a3) for (r3 = 0; r3 < s3; r3++) null != (e3 = t3[r3]) && 0 == (2 & e3.__u) && (e3.__e == u4 && (u4 = S(e3)), B(e3, e3));
  return u4;
}
function A(n2, l3, t3) {
  var u4, i4;
  if ("function" == typeof n2.type) {
    for (u4 = n2.__k, i4 = 0; u4 && i4 < u4.length; i4++) u4[i4] && (u4[i4].__ = n2, l3 = A(u4[i4], l3, t3));
    return l3;
  }
  n2.__e != l3 && (l3 && n2.type && !t3.contains(l3) && (l3 = S(n2)), t3.insertBefore(n2.__e, l3 || null), l3 = n2.__e);
  do {
    l3 = l3 && l3.nextSibling;
  } while (null != l3 && 8 == l3.nodeType);
  return l3;
}
function L(n2, l3, t3, u4) {
  var i4, r3, o3 = n2.key, e3 = n2.type, f4 = l3[t3];
  if (null === f4 && null == n2.key || f4 && o3 == f4.key && e3 === f4.type && 0 == (2 & f4.__u)) return t3;
  if (u4 > (null != f4 && 0 == (2 & f4.__u) ? 1 : 0)) for (i4 = t3 - 1, r3 = t3 + 1; i4 >= 0 || r3 < l3.length; ) {
    if (i4 >= 0) {
      if ((f4 = l3[i4]) && 0 == (2 & f4.__u) && o3 == f4.key && e3 === f4.type) return i4;
      i4--;
    }
    if (r3 < l3.length) {
      if ((f4 = l3[r3]) && 0 == (2 & f4.__u) && o3 == f4.key && e3 === f4.type) return r3;
      r3++;
    }
  }
  return -1;
}
function T(n2, l3, t3) {
  "-" == l3[0] ? n2.setProperty(l3, null == t3 ? "" : t3) : n2[l3] = null == t3 ? "" : "number" != typeof t3 || y.test(l3) ? t3 : t3 + "px";
}
function j(n2, l3, t3, u4, i4) {
  var r3;
  n: if ("style" == l3) if ("string" == typeof t3) n2.style.cssText = t3;
  else {
    if ("string" == typeof u4 && (n2.style.cssText = u4 = ""), u4) for (l3 in u4) t3 && l3 in t3 || T(n2.style, l3, "");
    if (t3) for (l3 in t3) u4 && t3[l3] === u4[l3] || T(n2.style, l3, t3[l3]);
  }
  else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(f, "$1")), l3 = l3.toLowerCase() in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? l3.toLowerCase().slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + r3] = t3, t3 ? u4 ? t3.t = u4.t : (t3.t = c, n2.addEventListener(l3, r3 ? a : s, r3)) : n2.removeEventListener(l3, r3 ? a : s, r3);
  else {
    if ("http://www.w3.org/2000/svg" == i4) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
      n2[l3] = null == t3 ? "" : t3;
      break n;
    } catch (n3) {
    }
    "function" == typeof t3 || (null == t3 || false === t3 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == t3 ? "" : t3));
  }
}
function F(n2) {
  return function(t3) {
    if (this.l) {
      var u4 = this.l[t3.type + n2];
      if (null == t3.u) t3.u = c++;
      else if (t3.u < u4.t) return;
      return u4(l.event ? l.event(t3) : t3);
    }
  };
}
function O(n2, t3, u4, i4, r3, o3, e3, f4, c3, s3) {
  var a3, h3, p3, v3, y3, _2, m3, b, S2, C3, M2, $2, P2, A3, H, L2, T3, j3 = t3.type;
  if (void 0 !== t3.constructor) return null;
  128 & u4.__u && (c3 = !!(32 & u4.__u), o3 = [
    f4 = t3.__e = u4.__e
  ]), (a3 = l.__b) && a3(t3);
  n: if ("function" == typeof j3) try {
    if (b = t3.props, S2 = "prototype" in j3 && j3.prototype.render, C3 = (a3 = j3.contextType) && i4[a3.__c], M2 = a3 ? C3 ? C3.props.value : a3.__ : i4, u4.__c ? m3 = (h3 = t3.__c = u4.__c).__ = h3.__E : (S2 ? t3.__c = h3 = new j3(b, M2) : (t3.__c = h3 = new x(b, M2), h3.constructor = j3, h3.render = D), C3 && C3.sub(h3), h3.props = b, h3.state || (h3.state = {}), h3.context = M2, h3.__n = i4, p3 = h3.__d = true, h3.__h = [], h3._sb = []), S2 && null == h3.__s && (h3.__s = h3.state), S2 && null != j3.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = w({}, h3.__s)), w(h3.__s, j3.getDerivedStateFromProps(b, h3.__s))), v3 = h3.props, y3 = h3.state, h3.__v = t3, p3) S2 && null == j3.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), S2 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
    else {
      if (S2 && null == j3.getDerivedStateFromProps && b !== v3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(b, M2), !h3.__e && (null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(b, h3.__s, M2) || t3.__v == u4.__v)) {
        for (t3.__v != u4.__v && (h3.props = b, h3.state = h3.__s, h3.__d = false), t3.__e = u4.__e, t3.__k = u4.__k, t3.__k.some(function(n3) {
          n3 && (n3.__ = t3);
        }), $2 = 0; $2 < h3._sb.length; $2++) h3.__h.push(h3._sb[$2]);
        h3._sb = [], h3.__h.length && e3.push(h3);
        break n;
      }
      null != h3.componentWillUpdate && h3.componentWillUpdate(b, h3.__s, M2), S2 && null != h3.componentDidUpdate && h3.__h.push(function() {
        h3.componentDidUpdate(v3, y3, _2);
      });
    }
    if (h3.context = M2, h3.props = b, h3.__P = n2, h3.__e = false, P2 = l.__r, A3 = 0, S2) {
      for (h3.state = h3.__s, h3.__d = false, P2 && P2(t3), a3 = h3.render(h3.props, h3.state, h3.context), H = 0; H < h3._sb.length; H++) h3.__h.push(h3._sb[H]);
      h3._sb = [];
    } else do {
      h3.__d = false, P2 && P2(t3), a3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
    } while (h3.__d && ++A3 < 25);
    h3.state = h3.__s, null != h3.getChildContext && (i4 = w(w({}, i4), h3.getChildContext())), S2 && !p3 && null != h3.getSnapshotBeforeUpdate && (_2 = h3.getSnapshotBeforeUpdate(v3, y3)), L2 = a3, null != a3 && a3.type === k && null == a3.key && (L2 = N(a3.props.children)), f4 = I(n2, d(L2) ? L2 : [
      L2
    ], t3, u4, i4, r3, o3, e3, f4, c3, s3), h3.base = t3.__e, t3.__u &= -161, h3.__h.length && e3.push(h3), m3 && (h3.__E = h3.__ = null);
  } catch (n3) {
    if (t3.__v = null, c3 || null != o3) if (n3.then) {
      for (t3.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
      o3[o3.indexOf(f4)] = null, t3.__e = f4;
    } else for (T3 = o3.length; T3--; ) g(o3[T3]);
    else t3.__e = u4.__e, t3.__k = u4.__k;
    l.__e(n3, t3, u4);
  }
  else null == o3 && t3.__v == u4.__v ? (t3.__k = u4.__k, t3.__e = u4.__e) : f4 = t3.__e = V(u4.__e, t3, u4, i4, r3, o3, e3, c3, s3);
  return (a3 = l.diffed) && a3(t3), 128 & t3.__u ? void 0 : f4;
}
function z(n2, t3, u4) {
  for (var i4 = 0; i4 < u4.length; i4++) q(u4[i4], u4[++i4], u4[++i4]);
  l.__c && l.__c(t3, n2), n2.some(function(t4) {
    try {
      n2 = t4.__h, t4.__h = [], n2.some(function(n3) {
        n3.call(t4);
      });
    } catch (n3) {
      l.__e(n3, t4.__v);
    }
  });
}
function N(n2) {
  return "object" != typeof n2 || null == n2 ? n2 : d(n2) ? n2.map(N) : w({}, n2);
}
function V(t3, u4, i4, r3, o3, e3, f4, c3, s3) {
  var a3, h3, v3, y3, w3, _2, m3, b = i4.props, k3 = u4.props, x2 = u4.type;
  if ("svg" == x2 ? o3 = "http://www.w3.org/2000/svg" : "math" == x2 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
    for (a3 = 0; a3 < e3.length; a3++) if ((w3 = e3[a3]) && "setAttribute" in w3 == !!x2 && (x2 ? w3.localName == x2 : 3 == w3.nodeType)) {
      t3 = w3, e3[a3] = null;
      break;
    }
  }
  if (null == t3) {
    if (null == x2) return document.createTextNode(k3);
    t3 = document.createElementNS(o3, x2, k3.is && k3), c3 && (l.__m && l.__m(u4, e3), c3 = false), e3 = null;
  }
  if (null === x2) b === k3 || c3 && t3.data === k3 || (t3.data = k3);
  else {
    if (e3 = e3 && n.call(t3.childNodes), b = i4.props || p, !c3 && null != e3) for (b = {}, a3 = 0; a3 < t3.attributes.length; a3++) b[(w3 = t3.attributes[a3]).name] = w3.value;
    for (a3 in b) if (w3 = b[a3], "children" == a3) ;
    else if ("dangerouslySetInnerHTML" == a3) v3 = w3;
    else if (!(a3 in k3)) {
      if ("value" == a3 && "defaultValue" in k3 || "checked" == a3 && "defaultChecked" in k3) continue;
      j(t3, a3, null, w3, o3);
    }
    for (a3 in k3) w3 = k3[a3], "children" == a3 ? y3 = w3 : "dangerouslySetInnerHTML" == a3 ? h3 = w3 : "value" == a3 ? _2 = w3 : "checked" == a3 ? m3 = w3 : c3 && "function" != typeof w3 || b[a3] === w3 || j(t3, a3, w3, b[a3], o3);
    if (h3) c3 || v3 && (h3.__html === v3.__html || h3.__html === t3.innerHTML) || (t3.innerHTML = h3.__html), u4.__k = [];
    else if (v3 && (t3.innerHTML = ""), I("template" === u4.type ? t3.content : t3, d(y3) ? y3 : [
      y3
    ], u4, i4, r3, "foreignObject" == x2 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i4.__k && S(i4, 0), c3, s3), null != e3) for (a3 = e3.length; a3--; ) g(e3[a3]);
    c3 || (a3 = "value", "progress" == x2 && null == _2 ? t3.removeAttribute("value") : void 0 !== _2 && (_2 !== t3[a3] || "progress" == x2 && !_2 || "option" == x2 && _2 !== b[a3]) && j(t3, a3, _2, b[a3], o3), a3 = "checked", void 0 !== m3 && m3 !== t3[a3] && j(t3, a3, m3, b[a3], o3));
  }
  return t3;
}
function q(n2, t3, u4) {
  try {
    if ("function" == typeof n2) {
      var i4 = "function" == typeof n2.__u;
      i4 && n2.__u(), i4 && null == t3 || (n2.__u = n2(t3));
    } else n2.current = t3;
  } catch (n3) {
    l.__e(n3, u4);
  }
}
function B(n2, t3, u4) {
  var i4, r3;
  if (l.unmount && l.unmount(n2), (i4 = n2.ref) && (i4.current && i4.current !== n2.__e || q(i4, null, t3)), null != (i4 = n2.__c)) {
    if (i4.componentWillUnmount) try {
      i4.componentWillUnmount();
    } catch (n3) {
      l.__e(n3, t3);
    }
    i4.base = i4.__P = null;
  }
  if (i4 = n2.__k) for (r3 = 0; r3 < i4.length; r3++) i4[r3] && B(i4[r3], t3, u4 || "function" != typeof n2.type);
  u4 || g(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
}
function D(n2, l3, t3) {
  return this.constructor(n2, t3);
}
function E(t3, u4, i4) {
  var r3, o3, e3, f4;
  u4 == document && (u4 = document.documentElement), l.__ && l.__(t3, u4), o3 = (r3 = "function" == typeof i4) ? null : i4 && i4.__k || u4.__k, e3 = [], f4 = [], O(u4, t3 = (!r3 && i4 || u4).__k = _(k, null, [
    t3
  ]), o3 || p, p, u4.namespaceURI, !r3 && i4 ? [
    i4
  ] : o3 ? null : u4.firstChild ? n.call(u4.childNodes) : null, e3, !r3 && i4 ? i4 : o3 ? o3.__e : u4.firstChild, r3, f4), z(e3, t3, f4);
}
n = v.slice, l = {
  __e: function(n2, l3, t3, u4) {
    for (var i4, r3, o3; l3 = l3.__; ) if ((i4 = l3.__c) && !i4.__) try {
      if ((r3 = i4.constructor) && null != r3.getDerivedStateFromError && (i4.setState(r3.getDerivedStateFromError(n2)), o3 = i4.__d), null != i4.componentDidCatch && (i4.componentDidCatch(n2, u4 || {}), o3 = i4.__d), o3) return i4.__E = i4;
    } catch (l4) {
      n2 = l4;
    }
    throw n2;
  }
}, t = 0, u = function(n2) {
  return null != n2 && null == n2.constructor;
}, x.prototype.setState = function(n2, l3) {
  var t3;
  t3 = null != this.__s && this.__s !== this.state ? this.__s : this.__s = w({}, this.state), "function" == typeof n2 && (n2 = n2(w({}, t3), this.props)), n2 && w(t3, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), M(this));
}, x.prototype.forceUpdate = function(n2) {
  this.__v && (this.__e = true, n2 && this.__h.push(n2), M(this));
}, x.prototype.render = k, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
  return n2.__v.__b - l3.__v.__b;
}, $.__r = 0, f = /(PointerCapture)$|Capture$/i, c = 0, s = F(false), a = F(true), h = 0;

// ../../Library/Caches/deno/npm/registry.npmjs.org/preact/10.26.4/jsx-runtime/dist/jsxRuntime.module.js
var f2 = 0;
var i2 = Array.isArray;
function u2(e3, t3, n2, o3, i4, u4) {
  t3 || (t3 = {});
  var a3, c3, p3 = t3;
  if ("ref" in p3) for (c3 in p3 = {}, t3) "ref" == c3 ? a3 = t3[c3] : p3[c3] = t3[c3];
  var l3 = {
    type: e3,
    props: p3,
    key: n2,
    ref: a3,
    __k: null,
    __: null,
    __b: 0,
    __e: null,
    __c: null,
    constructor: void 0,
    __v: --f2,
    __i: -1,
    __u: 0,
    __source: i4,
    __self: u4
  };
  if ("function" == typeof e3 && (a3 = e3.defaultProps)) for (c3 in a3) void 0 === p3[c3] && (p3[c3] = a3[c3]);
  return l.vnode && l.vnode(l3), l3;
}

// ../../Library/Caches/deno/npm/registry.npmjs.org/preact/10.26.4/hooks/dist/hooks.module.js
var t2;
var r2;
var u3;
var i3;
var o2 = 0;
var f3 = [];
var c2 = l;
var e2 = c2.__b;
var a2 = c2.__r;
var v2 = c2.diffed;
var l2 = c2.__c;
var m2 = c2.unmount;
var s2 = c2.__;
function p2(n2, t3) {
  c2.__h && c2.__h(r2, n2, o2 || t3), o2 = 0;
  var u4 = r2.__H || (r2.__H = {
    __: [],
    __h: []
  });
  return n2 >= u4.__.length && u4.__.push({}), u4.__[n2];
}
function d2(n2) {
  return o2 = 1, h2(D2, n2);
}
function h2(n2, u4, i4) {
  var o3 = p2(t2++, 2);
  if (o3.t = n2, !o3.__c && (o3.__ = [
    i4 ? i4(u4) : D2(void 0, u4),
    function(n3) {
      var t3 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t3, n3);
      t3 !== r3 && (o3.__N = [
        r3,
        o3.__[1]
      ], o3.__c.setState({}));
    }
  ], o3.__c = r2, !r2.__f)) {
    var f4 = function(n3, t3, r3) {
      if (!o3.__c.__H) return true;
      var u5 = o3.__c.__H.__.filter(function(n4) {
        return !!n4.__c;
      });
      if (u5.every(function(n4) {
        return !n4.__N;
      })) return !c3 || c3.call(this, n3, t3, r3);
      var i5 = o3.__c.props !== n3;
      return u5.forEach(function(n4) {
        if (n4.__N) {
          var t4 = n4.__[0];
          n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i5 = true);
        }
      }), c3 && c3.call(this, n3, t3, r3) || i5;
    };
    r2.__f = true;
    var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
    r2.componentWillUpdate = function(n3, t3, r3) {
      if (this.__e) {
        var u5 = c3;
        c3 = void 0, f4(n3, t3, r3), c3 = u5;
      }
      e3 && e3.call(this, n3, t3, r3);
    }, r2.shouldComponentUpdate = f4;
  }
  return o3.__N || o3.__;
}
function y2(n2, u4) {
  var i4 = p2(t2++, 3);
  !c2.__s && C2(i4.__H, u4) && (i4.__ = n2, i4.u = u4, r2.__H.__h.push(i4));
}
function A2(n2) {
  return o2 = 5, T2(function() {
    return {
      current: n2
    };
  }, []);
}
function T2(n2, r3) {
  var u4 = p2(t2++, 7);
  return C2(u4.__H, r3) && (u4.__ = n2(), u4.__H = r3, u4.__h = n2), u4.__;
}
function q2(n2, t3) {
  return o2 = 8, T2(function() {
    return n2;
  }, t3);
}
function j2() {
  for (var n2; n2 = f3.shift(); ) if (n2.__P && n2.__H) try {
    n2.__H.__h.forEach(z2), n2.__H.__h.forEach(B2), n2.__H.__h = [];
  } catch (t3) {
    n2.__H.__h = [], c2.__e(t3, n2.__v);
  }
}
c2.__b = function(n2) {
  r2 = null, e2 && e2(n2);
}, c2.__ = function(n2, t3) {
  n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), s2 && s2(n2, t3);
}, c2.__r = function(n2) {
  a2 && a2(n2), t2 = 0;
  var i4 = (r2 = n2.__c).__H;
  i4 && (u3 === r2 ? (i4.__h = [], r2.__h = [], i4.__.forEach(function(n3) {
    n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
  })) : (i4.__h.forEach(z2), i4.__h.forEach(B2), i4.__h = [], t2 = 0)), u3 = r2;
}, c2.diffed = function(n2) {
  v2 && v2(n2);
  var t3 = n2.__c;
  t3 && t3.__H && (t3.__H.__h.length && (1 !== f3.push(t3) && i3 === c2.requestAnimationFrame || ((i3 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.forEach(function(n3) {
    n3.u && (n3.__H = n3.u), n3.u = void 0;
  })), u3 = r2 = null;
}, c2.__c = function(n2, t3) {
  t3.some(function(n3) {
    try {
      n3.__h.forEach(z2), n3.__h = n3.__h.filter(function(n4) {
        return !n4.__ || B2(n4);
      });
    } catch (r3) {
      t3.some(function(n4) {
        n4.__h && (n4.__h = []);
      }), t3 = [], c2.__e(r3, n3.__v);
    }
  }), l2 && l2(n2, t3);
}, c2.unmount = function(n2) {
  m2 && m2(n2);
  var t3, r3 = n2.__c;
  r3 && r3.__H && (r3.__H.__.forEach(function(n3) {
    try {
      z2(n3);
    } catch (n4) {
      t3 = n4;
    }
  }), r3.__H = void 0, t3 && c2.__e(t3, r3.__v));
};
var k2 = "function" == typeof requestAnimationFrame;
function w2(n2) {
  var t3, r3 = function() {
    clearTimeout(u4), k2 && cancelAnimationFrame(t3), setTimeout(n2);
  }, u4 = setTimeout(r3, 100);
  k2 && (t3 = requestAnimationFrame(r3));
}
function z2(n2) {
  var t3 = r2, u4 = n2.__c;
  "function" == typeof u4 && (n2.__c = void 0, u4()), r2 = t3;
}
function B2(n2) {
  var t3 = r2;
  n2.__c = n2.__(), r2 = t3;
}
function C2(n2, t3) {
  return !n2 || n2.length !== t3.length || t3.some(function(t4, r3) {
    return t4 !== n2[r3];
  });
}
function D2(n2, t3) {
  return "function" == typeof t3 ? t3(n2) : t3;
}

// src/dashboard/api.ts
function countMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const out = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === "number") out[key] = count;
  }
  return out;
}
function parseStats(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid stats response");
  }
  const raw = value;
  const stats = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (key === "series") continue;
    const counts = countMap(entry);
    if (counts) stats[key] = counts;
    else if (key === "site" && typeof entry === "string") stats.site = entry;
  }
  if (raw.series !== void 0) {
    if (!Array.isArray(raw.series)) throw new Error("invalid series response");
    stats.series = raw.series.map((row) => {
      if (!Array.isArray(row) || row.length !== 6 || typeof row[0] !== "string" || row.slice(1).some((item) => typeof item !== "number")) throw new Error("invalid series row");
      return row;
    });
  }
  return stats;
}
function parseSites(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item;
    return typeof row.id === "string" ? [
      {
        id: row.id,
        host: typeof row.host === "string" ? row.host : void 0
      }
    ] : [];
  });
}

// src/dashboard/csv.ts
var CSV_DIMS = [
  "path",
  "host",
  "ref_group",
  "ref",
  "browser",
  "os",
  "device",
  "country",
  "lang",
  "tz",
  "hour",
  "viewport",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "event",
  "event_target",
  "hi",
  "app_os",
  "app_os_version",
  "app_tz_offset",
  "app_tz",
  "app_version",
  "app_device",
  "bot",
  "bot_kind",
  "app",
  "dowhour"
];
function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function csv(data) {
  const rows = [
    [
      "dim",
      "value",
      "count"
    ]
  ];
  for (const dimension of CSV_DIMS) {
    const counts = data[dimension];
    for (const [value, count] of Object.entries(counts ?? {})) {
      rows.push([
        dimension,
        value,
        count
      ]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

// src/dashboard/dates.ts
var LAUNCH = "2026-06-23";
function iso(date) {
  return date.toISOString().slice(0, 10);
}
function addDays(day, days2) {
  const date = /* @__PURE__ */ new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days2);
  return iso(date);
}
function clampFrom(from) {
  return from < LAUNCH ? LAUNCH : from;
}
function periodRange(period, today) {
  const now = /* @__PURE__ */ new Date(`${today}T00:00:00Z`);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  let from = today;
  let to = today;
  switch (period) {
    case "7d":
      from = addDays(today, -6);
      break;
    case "14d":
      from = addDays(today, -13);
      break;
    case "30d":
      from = addDays(today, -29);
      break;
    case "thisMonth":
      from = iso(new Date(Date.UTC(year, month, 1)));
      break;
    case "lastMonth":
      from = iso(new Date(Date.UTC(year, month - 1, 1)));
      to = iso(new Date(Date.UTC(year, month, 0)));
      break;
    case "thisYear":
      from = iso(new Date(Date.UTC(year, 0, 1)));
      break;
    case "lastYear":
      from = iso(new Date(Date.UTC(year - 1, 0, 1)));
      to = iso(new Date(Date.UTC(year - 1, 11, 31)));
      break;
    case "all":
      from = LAUNCH;
      break;
  }
  from = clampFrom(from);
  return {
    from,
    to: to < from ? from : to
  };
}
function priorRange({ from, to }) {
  const days2 = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const priorTo = addDays(from, -1);
  return {
    from: addDays(priorTo, -(days2 - 1)),
    to: priorTo
  };
}
var formatRange = ({ from, to }) => from === to ? from : `${from} \u2192 ${to}`;

// src/dashboard/hooks/use-persisted-state.ts
function usePersistedState(key, initial) {
  const [value, setValue] = d2(() => localStorage.getItem(key) ?? initial);
  const set = (next) => {
    localStorage.setItem(key, next);
    setValue(next);
  };
  return [
    value,
    set
  ];
}

// src/dashboard/hooks/use-stats.ts
function useStats(token, site, range) {
  const [result, setResult] = d2({
    state: "idle",
    data: null,
    prior: null,
    error: null
  });
  const controller = A2(null);
  const load = q2(async () => {
    controller.current?.abort();
    if (!site.trim()) {
      setResult({
        state: "empty",
        data: null,
        prior: null,
        error: null
      });
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setResult((old) => ({
      ...old,
      state: "loading",
      error: null
    }));
    const request = (value, series = false) => fetch(`/stats?${new URLSearchParams({
      site: site.trim(),
      from: value.from,
      to: value.to,
      ...series ? {
        series: "1"
      } : {}
    })}`, {
      headers: {
        authorization: `Bearer ${token}`
      },
      signal: active.signal
    });
    try {
      const response = await request(range, true);
      if (response.status === 401) {
        setResult({
          state: "unauthorized",
          data: null,
          prior: null,
          error: null
        });
        return;
      }
      if (!response.ok) throw new Error(`/stats returned ${response.status}`);
      const data = parseStats(await response.json());
      let prior = null;
      const priorPeriod = priorRange(range);
      if (priorPeriod.to >= LAUNCH) {
        try {
          const priorResponse = await request({
            from: clampFrom(priorPeriod.from),
            to: priorPeriod.to
          });
          if (priorResponse.ok) prior = parseStats(await priorResponse.json());
        } catch (error) {
          if (error.name === "AbortError") throw error;
        }
      }
      if (!active.signal.aborted) {
        setResult({
          state: "ready",
          data,
          prior,
          error: null
        });
      }
    } catch (error) {
      if (!active.signal.aborted) {
        setResult({
          state: "error",
          data: null,
          prior: null,
          error: String(error)
        });
      }
    }
  }, [
    token,
    site,
    range.from,
    range.to
  ]);
  y2(() => {
    load();
    return () => controller.current?.abort();
  }, [
    load
  ]);
  return {
    ...result,
    load
  };
}

// src/dashboard/components/breakdown-grid.tsx
var dimensions = [
  "path",
  "country",
  "app_tz",
  "tz",
  "host",
  "ref_group",
  "ref",
  "browser",
  "os",
  "device",
  "lang",
  "hour",
  "viewport",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "event",
  "event_target",
  "hi",
  "app_os",
  "app_os_version",
  "app_tz_offset",
  "app_version",
  "app_device"
];
var bots = [
  "bot",
  "bot_kind"
];
var top = 10;
function BreakdownGrid({ data, showBots, search, onOffset, onCountry, onTimezone }) {
  const [expanded, setExpanded] = d2(/* @__PURE__ */ new Set());
  const [cards, setCards] = d2(true);
  const query = search.trim().toLowerCase();
  const groups = T2(() => [
    ...dimensions,
    ...showBots ? bots : []
  ].flatMap((dimension) => {
    const counts = data[dimension];
    const values = Object.entries(counts ?? {}).sort((left, right) => right[1] - left[1]).filter(([value]) => !query || value.toLowerCase().includes(query));
    return values.length ? [
      {
        dimension,
        values,
        total: values.reduce((sum, [, count]) => sum + count, 0)
      }
    ] : [];
  }), [
    data,
    showBots,
    query
  ]);
  return /* @__PURE__ */ u2(k, {
    children: [
      /* @__PURE__ */ u2("div", {
        class: "breakdownViews",
        role: "group",
        "aria-label": "Breakdown view",
        children: [
          /* @__PURE__ */ u2("button", {
            type: "button",
            id: "viewCards",
            "aria-pressed": cards,
            onClick: () => setCards(true),
            children: "Cards"
          }),
          /* @__PURE__ */ u2("button", {
            type: "button",
            id: "viewBars",
            "aria-pressed": !cards,
            onClick: () => setCards(false),
            children: "Original bars"
          })
        ]
      }),
      /* @__PURE__ */ u2("div", {
        id: "breakdowns",
        class: cards ? "cards" : "",
        children: groups.length ? [
          groups.filter(({ dimension }) => [
            "path",
            "country",
            "app_tz",
            "tz"
          ].includes(dimension)),
          groups.filter(({ dimension }) => ![
            "path",
            "country",
            "app_tz",
            "tz"
          ].includes(dimension))
        ].map((section, index) => /* @__PURE__ */ u2("div", {
          class: index === 0 ? "bdPriority" : "bdRemaining",
          children: section.map(({ dimension, values, total }) => {
            const open = expanded.has(dimension) || !!query;
            const max = values[0][1];
            const visible = open ? values : values.slice(0, top);
            return /* @__PURE__ */ u2("div", {
              class: "bdGroup",
              children: [
                /* @__PURE__ */ u2("div", {
                  class: "dim",
                  children: [
                    dimension,
                    dimension === "country" && /* @__PURE__ */ u2("button", {
                      class: "mapButton",
                      type: "button",
                      "aria-label": "Show country traffic on map",
                      onClick: onCountry,
                      children: "\u{1F310}"
                    }),
                    (dimension === "tz" || dimension === "app_tz") && /* @__PURE__ */ u2("button", {
                      class: "mapButton",
                      type: "button",
                      "aria-label": dimension === "app_tz" ? "Show app timezone traffic on map" : "Show timezone traffic on map",
                      onClick: () => onTimezone(dimension),
                      children: "\u{1F310}"
                    })
                  ]
                }),
                visible.map(([value, count]) => /* @__PURE__ */ u2("div", {
                  class: "barRow",
                  tabindex: dimension === "app_tz_offset" ? 0 : void 0,
                  role: dimension === "app_tz_offset" ? "button" : void 0,
                  onClick: () => dimension === "app_tz_offset" && onOffset(value),
                  onKeyDown: (event) => {
                    if (dimension === "app_tz_offset" && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onOffset(value);
                    }
                  },
                  children: [
                    /* @__PURE__ */ u2("div", {
                      class: "barFill",
                      style: {
                        width: `${Math.round(count / max * 100)}%`
                      }
                    }),
                    /* @__PURE__ */ u2("span", {
                      class: "barLabel",
                      children: value
                    }),
                    /* @__PURE__ */ u2("span", {
                      class: "barCount",
                      children: [
                        count,
                        /* @__PURE__ */ u2("span", {
                          class: "barPct",
                          children: [
                            Math.round(count / total * 100),
                            "%"
                          ]
                        })
                      ]
                    })
                  ]
                })),
                values.length > top && !query && /* @__PURE__ */ u2("button", {
                  class: "bdMore",
                  type: "button",
                  onClick: () => setExpanded((old) => {
                    const next = new Set(old);
                    next.has(dimension) ? next.delete(dimension) : next.add(dimension);
                    return next;
                  }),
                  children: open ? `\u2212 show top ${top}` : `+ show all ${values.length}`
                })
              ]
            });
          })
        })) : /* @__PURE__ */ u2("p", {
          class: "hint",
          children: [
            "no data for this range \u2014 see ",
            /* @__PURE__ */ u2("a", {
              href: "/help",
              children: "help"
            })
          ]
        })
      })
    ]
  });
}

// src/dashboard/metrics.ts
var dimTotal = (counts) => Object.values(counts ?? {}).reduce((total, count) => total + count, 0);
function metrics(data) {
  const pageviews = data.pv?._ ?? 0;
  const visitors = data.uv?._ ?? 0;
  const sessions = data.sessions?._ ?? 0;
  const bounce = data.bounce?._ ?? 0;
  const bouncePercent = sessions ? bounce / sessions * 100 : 0;
  const bounceShown = Number(bouncePercent.toFixed(0));
  const human = pageviews ? dimTotal(data.hi) / pageviews * 100 : 0;
  return {
    pageviews: {
      value: String(pageviews),
      numeric: pageviews
    },
    visitors: {
      value: String(visitors),
      numeric: visitors
    },
    sessions: {
      value: String(sessions),
      numeric: sessions
    },
    viewsPerVisit: {
      value: (visitors ? pageviews / visitors : 0).toFixed(1),
      numeric: visitors ? pageviews / visitors : 0
    },
    bounce: {
      value: `${bounceShown}%`,
      numeric: bouncePercent
    },
    engagement: {
      value: `${sessions ? 100 - bounceShown : 0}%`,
      numeric: sessions ? 100 - bouncePercent : 0
    },
    human: {
      value: `${human.toFixed(0)}%`,
      numeric: human
    },
    bots: {
      value: String(dimTotal(data.bot)),
      numeric: dimTotal(data.bot)
    },
    apps: {
      value: String(dimTotal(data.app)),
      numeric: dimTotal(data.app)
    }
  };
}
function delta(current, previous) {
  if (!previous) return {
    text: "\u2014",
    className: "flat"
  };
  const percent = (current - previous) / previous * 100;
  return {
    text: `${percent > 0 ? "\u25B2" : percent < 0 ? "\u25BC" : "\u2013"} ${Math.abs(percent).toFixed(0)}%`,
    className: percent > 0 ? "up" : percent < 0 ? "down" : "flat"
  };
}
var heatmapColor = (value, max) => {
  const steps = [
    "#1f4854",
    "#2b6b7c",
    "#3a92a6",
    "#5db2c4",
    "#88c0d0"
  ];
  if (!value) return "#0e1116";
  return steps[Math.min(steps.length - 1, Math.floor(Math.sqrt(value / max) * steps.length))];
};

// src/dashboard/components/heatmap.tsx
var days = [
  [
    1,
    "Mon"
  ],
  [
    2,
    "Tue"
  ],
  [
    3,
    "Wed"
  ],
  [
    4,
    "Thu"
  ],
  [
    5,
    "Fri"
  ],
  [
    6,
    "Sat"
  ],
  [
    0,
    "Sun"
  ]
];
function Heatmap({ data }) {
  if (!data || !Object.keys(data).length) {
    return /* @__PURE__ */ u2("p", {
      class: "hint",
      children: "no day\xD7hour data for this range yet"
    });
  }
  const max = Math.max(...Object.values(data));
  return /* @__PURE__ */ u2(k, {
    children: [
      /* @__PURE__ */ u2("div", {
        class: "hmGrid",
        children: [
          /* @__PURE__ */ u2("div", {
            class: "hmHead"
          }),
          Array.from({
            length: 24
          }, (_2, hour) => /* @__PURE__ */ u2("div", {
            class: "hmHead",
            children: hour % 3 === 0 ? String(hour).padStart(2, "0") : ""
          })),
          days.flatMap(([day, label]) => [
            /* @__PURE__ */ u2("div", {
              class: "hmRowLabel",
              children: label
            }, `${day}-label`),
            ...Array.from({
              length: 24
            }, (_2, hour) => {
              const count = data[`${day}-${String(hour).padStart(2, "0")}`] ?? 0;
              return /* @__PURE__ */ u2("div", {
                class: "hmCell",
                style: {
                  background: heatmapColor(count, max)
                },
                title: `${label} ${String(hour).padStart(2, "0")}:00 UTC \xB7 ${count} views`
              }, `${day}-${hour}`);
            })
          ])
        ]
      }),
      /* @__PURE__ */ u2("div", {
        class: "hmLegend",
        children: [
          /* @__PURE__ */ u2("span", {
            children: "none"
          }),
          /* @__PURE__ */ u2("span", {
            class: "hmSwatch hmCell",
            style: {
              background: "#0e1116"
            }
          }),
          /* @__PURE__ */ u2("span", {
            children: "1"
          }),
          /* @__PURE__ */ u2("span", {
            children: [
              max,
              " views / hour (UTC)"
            ]
          })
        ]
      })
    ]
  });
}

// src/dashboard/components/kpi-grid.tsx
var tiles = [
  [
    "pageviews",
    "pageviews"
  ],
  [
    "visitors",
    "unique visitors"
  ],
  [
    "sessions",
    "sessions"
  ],
  [
    "viewsPerVisit",
    "views / visit"
  ],
  [
    "bounce",
    "bounce rate"
  ],
  [
    "engagement",
    "engagement rate"
  ],
  [
    "human",
    "human interaction"
  ]
];
function KpiGrid({ data, prior, showBots }) {
  const current = metrics(data);
  const before = prior ? metrics(prior) : null;
  const rows = [
    ...tiles,
    ...showBots ? [
      [
        "bots",
        "bot visits"
      ]
    ] : [],
    ...current.apps.numeric || before?.apps.numeric ? [
      [
        "apps",
        "app pings"
      ]
    ] : []
  ];
  return /* @__PURE__ */ u2("div", {
    class: "kpiRow",
    children: rows.map(([id, label]) => {
      const change = before ? delta(current[id].numeric, before[id].numeric) : {
        text: "\u2014",
        className: "flat"
      };
      return /* @__PURE__ */ u2("div", {
        class: `kpiTile${id === "bots" ? " bot" : ""}`,
        children: [
          /* @__PURE__ */ u2("div", {
            class: "kpiVal",
            children: current[id].value
          }),
          /* @__PURE__ */ u2("div", {
            class: "kpiLabel",
            children: label
          }),
          /* @__PURE__ */ u2("div", {
            class: `kpiDelta ${change.className}`,
            children: change.text
          })
        ]
      });
    })
  });
}

// src/dashboard/components/map-dialogs.tsx
var maps = null;
var loadMaps = () => {
  const url = new URL("/timezone-globe.js", globalThis.location.origin).href;
  return maps ??= import(url);
};
var sortedRows = (counts) => Object.entries(counts ?? {}).sort((left, right) => right[1] - left[1]);
var countryNames = new Intl.DisplayNames([
  "en"
], {
  type: "region"
});
var zooms = [
  [
    "world",
    "World",
    "0 0 360 180"
  ],
  [
    "north-america",
    "North America",
    "0 0 150 75"
  ],
  [
    "south-america",
    "South America",
    "75 70 110 55"
  ],
  [
    "europe",
    "Europe",
    "140 5 100 50"
  ],
  [
    "asia",
    "Asia",
    "220 0 145 72.5"
  ],
  [
    "africa",
    "Africa",
    "125 35 140 70"
  ],
  [
    "oceania",
    "Oceania",
    "230 60 120 60"
  ]
];
var config = (kind) => kind === "country" ? {
  dot: "data-country-dot",
  pointer: ".countryPointer",
  highlight: "countryHighlight",
  arrow: "countryArrow"
} : {
  dot: "data-timezone-dot",
  pointer: ".timezoneMapPointer",
  highlight: "timezoneMapHighlight",
  arrow: "timezoneMapArrow"
};
function clearPointer(root2, kind) {
  const item = config(kind);
  root2.querySelector(item.pointer)?.replaceChildren();
  root2.querySelectorAll(`[${item.dot}]`).forEach((circle) => {
    circle.classList.remove(item.highlight);
    circle.style.removeProperty("stroke-width");
  });
}
function showPointer(root2, kind, value) {
  const item = config(kind);
  const circle = [
    ...root2.querySelectorAll(`[${item.dot}]`)
  ].find((candidate) => candidate.getAttribute(item.dot) === value);
  const pointer = root2.querySelector(item.pointer);
  const map = root2.querySelector("svg");
  if (!circle || !pointer || !map) return;
  clearPointer(root2, kind);
  circle.classList.add(item.highlight);
  const scale = 360 / Number(map.viewBox.baseVal.width);
  circle.style.strokeWidth = String(2.5 / scale);
  const x2 = Number(circle.getAttribute("cx"));
  const y3 = Number(circle.getAttribute("cy"));
  const startX = x2 < 48 ? x2 + 44 / scale : x2 - 44 / scale;
  const startY = y3 < 36 ? y3 + 38 / scale : y3 - 34 / scale;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${startX} ${startY} L ${x2} ${y3}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#eceff4");
  path.setAttribute("stroke-width", String(2 / scale));
  path.setAttribute("marker-end", `url(#${item.arrow})`);
  pointer.replaceChildren(path);
}
function setZoom(root2, id) {
  const zoom = zooms.find(([zoomId]) => zoomId === id);
  const map = root2.querySelector("svg");
  if (!zoom || !map) return;
  map.setAttribute("viewBox", zoom[2]);
  clearPointer(root2, root2.matches("#countryModal") ? "country" : "timezone");
  const scale = 360 / Number(zoom[2].split(" ")[2]);
  const world = zoom[0] === "world";
  map.querySelectorAll("[data-country-dot], [data-timezone-dot]").forEach((dot) => {
    const base = Number(dot.dataset.baseRadius ?? dot.getAttribute("r"));
    dot.dataset.baseRadius = String(base);
    dot.setAttribute("r", String(world ? base : base * 0.8 / scale));
  });
  map.querySelectorAll("text").forEach((label) => {
    const base = Number(label.dataset.baseFontSize ?? label.getAttribute("font-size"));
    label.dataset.baseFontSize = String(base);
    label.setAttribute("font-size", String(world ? base : base * 0.8 / scale));
  });
  root2.querySelectorAll("[data-map-zoom]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mapZoom === id)));
}
function Dialog({ id, title, children, close }) {
  const ref = A2(null);
  y2(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return /* @__PURE__ */ u2("dialog", {
    id,
    ref,
    "aria-labelledby": `${id}Title`,
    onClose: close,
    onClick: (event) => {
      const target = event.target;
      const zoom = target.closest("[data-map-zoom]");
      if (zoom && zoom.dataset.mapZoom) {
        setZoom(ref.current, zoom.dataset.mapZoom);
        return;
      }
      if (event.target === ref.current) ref.current?.close();
    },
    children: [
      /* @__PURE__ */ u2("div", {
        class: "timezoneModalHead",
        children: [
          /* @__PURE__ */ u2("h2", {
            id: `${id}Title`,
            children: title
          }),
          /* @__PURE__ */ u2("form", {
            method: "dialog",
            children: /* @__PURE__ */ u2("button", {
              type: "submit",
              "aria-label": `Close ${title}`,
              children: "\u2715"
            })
          })
        ]
      }),
      children
    ]
  });
}
function ZoomControls() {
  return /* @__PURE__ */ u2("div", {
    class: "mapZoom",
    role: "group",
    "aria-label": "Map region",
    children: zooms.map(([id, label], index) => /* @__PURE__ */ u2("button", {
      type: "button",
      "data-map-zoom": id,
      "aria-pressed": index === 0,
      children: label
    }, id))
  });
}
function MapMarkup({ html }) {
  return /* @__PURE__ */ u2("div", {
    dangerouslySetInnerHTML: {
      __html: html
    }
  });
}
function MapDialogs({ country, timezone, offset, close }) {
  const [map, setMap] = d2(null);
  y2(() => {
    if (country || timezone || offset) loadMaps().then(setMap).catch(close);
  }, [
    country,
    timezone,
    offset,
    close
  ]);
  if (!map) return null;
  if (offset) {
    const now = /* @__PURE__ */ new Date();
    const zones = Intl.supportedValuesOf("timeZone").filter((zone) => new Intl.DateTimeFormat("en", {
      timeZone: zone,
      timeZoneName: "longOffset"
    }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value.replace("GMT", "UTC").replace(/^UTC$/, "UTC+00:00") === offset);
    return /* @__PURE__ */ u2(Dialog, {
      id: "timezoneModal",
      title: `${offset} \xB7 timezone details`,
      close,
      children: [
        /* @__PURE__ */ u2("p", {
          class: "hint",
          children: "Current offsets today. Offset alone cannot identify timezone. DST changes matches."
        }),
        /* @__PURE__ */ u2("div", {
          class: "timezoneModalBody",
          children: [
            /* @__PURE__ */ u2("div", {
              children: [
                /* @__PURE__ */ u2(MapMarkup, {
                  html: map.timezoneGlobe(zones)
                }),
                /* @__PURE__ */ u2("p", {
                  class: "hint",
                  children: "Gold dots: matching timezone locations."
                })
              ]
            }),
            /* @__PURE__ */ u2("div", {
              class: "timezoneList",
              children: [
                /* @__PURE__ */ u2("h3", {
                  children: [
                    zones.length,
                    " matching timezones"
                  ]
                }),
                /* @__PURE__ */ u2("ul", {
                  children: zones.map((zone) => /* @__PURE__ */ u2("li", {
                    children: zone
                  }, zone))
                })
              ]
            })
          ]
        })
      ]
    });
  }
  if (country) {
    const data = sortedRows(country);
    const total = data.reduce((sum, [, count]) => sum + count, 0);
    return /* @__PURE__ */ u2(Dialog, {
      id: "countryModal",
      title: "Country traffic",
      close,
      children: /* @__PURE__ */ u2("div", {
        class: "countryModalBody",
        children: [
          /* @__PURE__ */ u2("div", {
            children: [
              /* @__PURE__ */ u2(ZoomControls, {}),
              /* @__PURE__ */ u2(MapMarkup, {
                html: map.countryMap(data)
              }),
              /* @__PURE__ */ u2("p", {
                class: "hint",
                children: "Dot size and color show traffic count."
              })
            ]
          }),
          /* @__PURE__ */ u2("div", {
            class: "timezoneList",
            children: [
              /* @__PURE__ */ u2("h3", {
                children: [
                  total,
                  " visits across ",
                  data.length,
                  " countries"
                ]
              }),
              /* @__PURE__ */ u2("ul", {
                children: data.map(([code, count]) => /* @__PURE__ */ u2("li", {
                  class: "countryListItem",
                  "data-country": code,
                  title: countryNames.of(code) ?? code,
                  "aria-label": `${countryNames.of(code) ?? code}: ${count}`,
                  onPointerOver: (event) => showPointer(event.currentTarget.closest("dialog"), "country", code),
                  onPointerOut: (event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      clearPointer(event.currentTarget.closest("dialog"), "country");
                    }
                  },
                  children: [
                    code,
                    ": ",
                    count
                  ]
                }, code))
              })
            ]
          })
        ]
      })
    });
  }
  if (timezone) {
    const data = sortedRows(timezone);
    const total = data.reduce((sum, [, count]) => sum + count, 0);
    return /* @__PURE__ */ u2(Dialog, {
      id: "timezoneMapModal",
      title: "Timezone traffic",
      close,
      children: /* @__PURE__ */ u2("div", {
        class: "timezoneMapModalBody",
        children: [
          /* @__PURE__ */ u2("div", {
            children: [
              /* @__PURE__ */ u2(ZoomControls, {}),
              /* @__PURE__ */ u2(MapMarkup, {
                html: map.timezoneMap(data)
              }),
              /* @__PURE__ */ u2("p", {
                class: "hint",
                children: "Dot size and color show traffic count."
              })
            ]
          }),
          /* @__PURE__ */ u2("div", {
            class: "timezoneList",
            children: [
              /* @__PURE__ */ u2("h3", {
                children: [
                  total,
                  " visits across ",
                  data.length,
                  " timezones"
                ]
              }),
              /* @__PURE__ */ u2("ul", {
                children: data.map(([zone, count]) => /* @__PURE__ */ u2("li", {
                  class: "timezoneMapListItem",
                  "data-timezone": zone,
                  title: zone,
                  onPointerOver: (event) => showPointer(event.currentTarget.closest("dialog"), "timezone", zone),
                  onPointerOut: (event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      clearPointer(event.currentTarget.closest("dialog"), "timezone");
                    }
                  },
                  children: [
                    zone,
                    ": ",
                    count
                  ]
                }, zone))
              })
            ]
          })
        ]
      })
    });
  }
  return null;
}

// src/dashboard/components/toolbar.tsx
var periods = [
  [
    "today",
    "Today"
  ],
  [
    "7d",
    "Last 7 days"
  ],
  [
    "14d",
    "Last 14 days"
  ],
  [
    "30d",
    "Last 30 days"
  ],
  [
    "thisMonth",
    "This month"
  ],
  [
    "lastMonth",
    "Last month"
  ],
  [
    "thisYear",
    "This year"
  ],
  [
    "lastYear",
    "Last year"
  ],
  [
    "all",
    "All time"
  ]
];
function Toolbar(props) {
  return /* @__PURE__ */ u2(k, {
    children: [
      /* @__PURE__ */ u2("div", {
        class: "toolbar",
        children: [
          /* @__PURE__ */ u2("input", {
            id: "token",
            type: "password",
            value: props.token,
            placeholder: "token",
            "aria-label": "Token",
            autocomplete: "off",
            onInput: (event) => props.onToken(event.currentTarget.value)
          }),
          /* @__PURE__ */ u2("label", {
            class: "tokenReveal",
            children: [
              /* @__PURE__ */ u2("input", {
                id: "showToken",
                type: "checkbox",
                "aria-controls": "token",
                onChange: (event) => {
                  const token = document.getElementById("token");
                  token.type = event.currentTarget.checked ? "text" : "password";
                }
              }),
              " ",
              "Show token"
            ]
          }),
          /* @__PURE__ */ u2("input", {
            id: "site",
            list: "siteList",
            value: props.site,
            placeholder: "site id",
            autocomplete: "off",
            onInput: (event) => props.onSite(event.currentTarget.value)
          }),
          /* @__PURE__ */ u2("datalist", {
            id: "siteList",
            children: props.sites.map((site) => /* @__PURE__ */ u2("option", {
              value: site.id,
              children: site.host ?? site.id
            }))
          }),
          /* @__PURE__ */ u2("label", {
            class: "toggle",
            for: "showBots",
            children: [
              /* @__PURE__ */ u2("input", {
                type: "checkbox",
                id: "showBots",
                checked: props.showBots,
                onChange: (event) => props.onBots(event.currentTarget.checked)
              }),
              " ",
              "bots"
            ]
          }),
          /* @__PURE__ */ u2("input", {
            id: "day",
            type: "date",
            value: props.day,
            min: props.launch,
            max: props.today,
            title: "single day \u2014 overrides period buttons",
            onChange: (event) => props.onDay(event.currentTarget.value)
          }),
          /* @__PURE__ */ u2("button", {
            id: "load",
            type: "button",
            class: "alt",
            onClick: props.onLoad,
            children: "Load"
          }),
          /* @__PURE__ */ u2("details", {
            class: "moreActions",
            id: "moreActions",
            children: [
              /* @__PURE__ */ u2("summary", {
                "aria-label": "More actions",
                children: "\u22EF"
              }),
              /* @__PURE__ */ u2("div", {
                id: "actionsDropdown",
                children: /* @__PURE__ */ u2("button", {
                  id: "exportCsv",
                  type: "button",
                  onClick: props.onExport,
                  children: "Export CSV"
                })
              })
            ]
          })
        ]
      }),
      /* @__PURE__ */ u2("div", {
        class: "periods",
        id: "periods",
        children: periods.map(([value, label]) => /* @__PURE__ */ u2("button", {
          type: "button",
          class: props.period === value ? "active" : "",
          "aria-pressed": props.period === value,
          onClick: () => props.onPeriod(value),
          children: label
        }))
      })
    ]
  });
}

// src/dashboard/components/traffic-chart.tsx
var loader = null;
function loadUplot() {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/vendor/uPlot.min.css";
    document.head.append(css);
    const script = document.createElement("script");
    script.src = "/vendor/uPlot.iife.min.js";
    script.onload = () => {
      const candidate = globalThis.uPlot;
      candidate ? resolve(candidate) : reject(new Error("uPlot unavailable"));
    };
    script.onerror = () => reject(new Error("failed to load uPlot"));
    document.head.append(script);
  });
  return loader;
}
function TrafficChart({ series, showBots }) {
  const target = A2(null);
  const chart = A2(null);
  const [failed, setFailed] = d2(false);
  y2(() => {
    let live = true;
    const element = target.current;
    if (!element || !series.length) return;
    loadUplot().then((Uplot) => {
      if (!live) return;
      const points = {
        show: series.length < 60
      };
      const app = series.map((row) => row[5]);
      const bots2 = series.map((row) => row[4]);
      const showApp = app.some((count) => count > 0);
      chart.current?.destroy();
      chart.current = new Uplot({
        width: element.parentElement?.clientWidth || 300,
        height: 180,
        padding: [
          10,
          10,
          0,
          0
        ],
        legend: {
          show: true
        },
        cursor: {
          show: true
        },
        scales: {
          x: {
            time: true
          }
        },
        axes: [
          {
            stroke: "#6b7684",
            grid: {
              stroke: "#20262f"
            },
            ticks: {
              stroke: "#20262f"
            }
          },
          {
            stroke: "#6b7684",
            grid: {
              stroke: "#20262f"
            },
            ticks: {
              stroke: "#20262f"
            }
          }
        ],
        series: [
          {},
          {
            label: "pageviews",
            stroke: "#88c0d0",
            width: 2,
            fill: "rgba(136,192,208,0.15)",
            points
          },
          {
            label: "unique visitors",
            stroke: "#a3be8c",
            width: 2,
            points
          },
          {
            label: "sessions",
            stroke: "#ebcb8b",
            width: 2,
            points
          },
          ...showBots ? [
            {
              label: "bots",
              stroke: "#d08770",
              width: 1,
              dash: [
                4,
                4
              ],
              points
            }
          ] : [],
          ...showApp ? [
            {
              label: "app pings",
              stroke: "#b48ead",
              width: 2,
              points
            }
          ] : []
        ]
      }, [
        series.map((row) => Date.parse(`${row[0]}T00:00:00Z`) / 1e3),
        series.map((row) => row[1]),
        series.map((row) => row[2]),
        series.map((row) => row[3]),
        ...showBots ? [
          bots2
        ] : [],
        ...showApp ? [
          app
        ] : []
      ], element);
    }).catch(() => setFailed(true));
    return () => {
      live = false;
      chart.current?.destroy();
      chart.current = null;
    };
  }, [
    series,
    showBots
  ]);
  y2(() => {
    const resize = () => chart.current?.setSize({
      width: target.current?.parentElement?.clientWidth || 300,
      height: 180
    });
    globalThis.addEventListener("resize", resize);
    return () => globalThis.removeEventListener("resize", resize);
  }, []);
  return failed ? /* @__PURE__ */ u2("p", {
    class: "hint",
    children: "chart unavailable (uPlot failed to load \u2014 check /vendor/)"
  }) : /* @__PURE__ */ u2("div", {
    id: "chart",
    ref: target
  });
}

// src/dashboard/app.tsx
function App() {
  const [token, setToken] = usePersistedState("da_token", "devtoken");
  const [site, setSite] = usePersistedState("da_site", "");
  const [showBots, setShowBots] = d2(() => localStorage.getItem("docs-analytics.showBots") === "1");
  const [period, setPeriod] = d2("7d");
  const [day, setDay] = d2("");
  const [sites, setSites] = d2([]);
  const [sitesLoading, setSitesLoading] = d2(true);
  const [pageLoading, setPageLoading] = d2(() => document.readyState !== "complete");
  const [search, setSearch] = d2("");
  const [dialog, setDialog] = d2(null);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const range = T2(() => day ? {
    from: day,
    to: day
  } : periodRange(period ?? "7d", today), [
    day,
    period,
    today
  ]);
  const stats = useStats(token, site, range);
  const loading = pageLoading || sitesLoading || stats.state === "idle" || stats.state === "loading";
  y2(() => {
    const loaded = () => setPageLoading(false);
    if (document.readyState === "complete") loaded();
    else globalThis.addEventListener("load", loaded);
    return () => globalThis.removeEventListener("load", loaded);
  }, []);
  y2(() => {
    const progress = document.getElementById("loadProgress");
    if (progress) {
      progress.hidden = !loading;
      progress.setAttribute("aria-label", pageLoading ? "Loading page" : "Fetching data");
    }
    document.getElementById("app")?.setAttribute("aria-busy", String(loading));
  }, [
    loading,
    pageLoading
  ]);
  y2(() => {
    const controller = new AbortController();
    setSitesLoading(true);
    fetch("/sites", {
      headers: {
        authorization: `Bearer ${token}`
      },
      signal: controller.signal
    }).then((response) => response.ok ? response.json() : []).then((value) => {
      if (!controller.signal.aborted) setSites(parseSites(value));
    }).catch(() => {
    }).finally(() => {
      if (!controller.signal.aborted) setSitesLoading(false);
    });
    return () => controller.abort();
  }, [
    token
  ]);
  const exportCsv = () => {
    if (!stats.data) return;
    const url = URL.createObjectURL(new Blob([
      csv(stats.data)
    ], {
      type: "text/csv"
    }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stats-${site.trim() || "site"}-${range.from}_${range.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const status = stats.state === "empty" ? /* @__PURE__ */ u2(k, {
    children: [
      "pick a site first \u2014 ",
      /* @__PURE__ */ u2("a", {
        href: "/help",
        children: "help"
      })
    ]
  }) : stats.state === "loading" ? "loading\u2026" : stats.state === "unauthorized" ? "401 unauthorized \u2014 check token" : stats.state === "error" ? stats.error : stats.state === "ready" ? `loaded ${formatRange(range)}` : "";
  return /* @__PURE__ */ u2(k, {
    children: [
      /* @__PURE__ */ u2("div", {
        class: "head",
        children: [
          /* @__PURE__ */ u2("h1", {
            children: "analytics"
          }),
          /* @__PURE__ */ u2("span", {
            class: "links",
            children: /* @__PURE__ */ u2("a", {
              href: "/help",
              children: "help & setup"
            })
          })
        ]
      }),
      /* @__PURE__ */ u2("section", {
        children: [
          /* @__PURE__ */ u2(Toolbar, {
            token,
            site,
            sites,
            showBots,
            day,
            period,
            launch: LAUNCH,
            today,
            onToken: setToken,
            onSite: setSite,
            onBots: (value) => {
              localStorage.setItem("docs-analytics.showBots", value ? "1" : "0");
              setShowBots(value);
            },
            onDay: (value) => {
              setDay(value);
              setPeriod(value ? null : "7d");
            },
            onPeriod: (value) => {
              setDay("");
              setPeriod(value);
            },
            onLoad: stats.load,
            onExport: exportCsv
          }),
          /* @__PURE__ */ u2("div", {
            class: `msg ${stats.state === "error" || stats.state === "unauthorized" ? "err" : stats.state === "ready" ? "ok" : ""}`,
            id: "loadMsg",
            children: status
          }),
          stats.data && /* @__PURE__ */ u2("div", {
            id: "analytics",
            children: [
              /* @__PURE__ */ u2(KpiGrid, {
                data: stats.data,
                prior: stats.prior,
                showBots
              }),
              /* @__PURE__ */ u2("div", {
                class: "rangeLabel",
                id: "rangeLabel",
                children: [
                  site.trim(),
                  " \xB7 ",
                  formatRange(range)
                ]
              }),
              /* @__PURE__ */ u2("div", {
                class: "chartsRow",
                children: [
                  /* @__PURE__ */ u2("details", {
                    id: "chartPanel",
                    open: true,
                    children: [
                      /* @__PURE__ */ u2("summary", {
                        children: "Traffic over time"
                      }),
                      /* @__PURE__ */ u2("div", {
                        id: "chartWrap",
                        children: /* @__PURE__ */ u2(TrafficChart, {
                          series: stats.data.series ?? [],
                          showBots
                        })
                      })
                    ]
                  }),
                  /* @__PURE__ */ u2("details", {
                    id: "heatmapPanel",
                    open: true,
                    children: [
                      /* @__PURE__ */ u2("summary", {
                        children: "day \xD7 hour (UTC)"
                      }),
                      /* @__PURE__ */ u2("div", {
                        id: "heatmapWrap",
                        children: /* @__PURE__ */ u2(Heatmap, {
                          data: stats.data.dowhour
                        })
                      })
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ u2("input", {
                id: "search",
                class: "search",
                placeholder: "Filter breakdowns\u2026",
                value: search,
                onInput: (event) => setSearch(event.currentTarget.value)
              }),
              /* @__PURE__ */ u2(BreakdownGrid, {
                data: stats.data,
                showBots,
                search,
                onOffset: setDialog,
                onCountry: () => setDialog("country"),
                onTimezone: (dimension) => setDialog(dimension === "tz" ? "timezone" : "app_tz")
              })
            ]
          })
        ]
      }),
      /* @__PURE__ */ u2(MapDialogs, {
        country: dialog === "country" ? stats.data?.country : void 0,
        timezone: dialog === "timezone" ? stats.data?.tz : dialog === "app_tz" ? stats.data?.app_tz : void 0,
        offset: dialog && dialog !== "country" && dialog !== "timezone" && dialog !== "app_tz" ? dialog : null,
        close: () => setDialog(null)
      })
    ]
  });
}

// src/dashboard/main.tsx
var root = document.getElementById("app");
if (!root) throw new Error("missing dashboard root");
E(/* @__PURE__ */ u2(App, {}), root);
