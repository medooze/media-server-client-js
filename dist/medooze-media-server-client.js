(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.MediaServerClient = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (value instanceof ArrayBuffer) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (ArrayBuffer.isView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || string instanceof ArrayBuffer) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":3}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(require,module,exports){
const PeerConnectionClient = require("./PeerConnectionClient.js");
const SemanticSDP = require("semantic-sdp");
const SDPInfo = SemanticSDP.SDPInfo;


class MediaServerClient
{
	constructor(tm)
	{
		//Crete namespace for us
		this.tm = tm;
		this.ns = tm.namespace("medooze::pc");
		
		//LIsten evens
		this.ns.on("event",(event)=>{
			//Check event name
			switch(event.name)
			{
				case "stopped":
					//Stopp us
					this.stop();
					break;
			}
		});
	}
	
	async createManagedPeerConnection(options)
	{
		//Check if running
		if (!this.ns)
			//Error
			throw new Error("MediaServerClient is closed");
		
		//Clone
		const cloned = new Object(options);
		//Add unified plan flag for chrome
		cloned.sdpSemantics = "unified-plan";
		//Create new peer connection
		const pc = new RTCPeerConnection(cloned);

		//Add sendonly transceivers for getting full codec capabilities
		const audio = pc.addTransceiver("audio",{direction: "sendonly"});
		const video = pc.addTransceiver("video",{direction: "sendonly"});
		
		//Hack for firefox to retrieve all the header extensions
		try { await video.sender.setParameters({encodings: [{ rid: "a"},{ rid: "b" , scaleResolutionDownBy: 2.0 }]}); } catch(e) {}
		
		//Create offer
		const offer = await pc.createOffer();
		
		//Parse local info
		const localInfo = SDPInfo.parse(offer.sdp.replace(": send rid=",":send "));
		
		//Set local description
		await pc.setLocalDescription(offer);
		
		//Connect
		const remote = await this.ns.cmd("create",localInfo.plain());
		
		//Get peer connection id
		const id = remote.id;
		//Create namespace for pc
		const pcns = this.tm.namespace("medooze::pc::"+id);
		
		//create new managed pc client
		return new PeerConnectionClient({
			id		: id,
			ns		: pcns,
			pc		: pc,
			remote		: remote,
			localInfo	: localInfo
		});
	}
	
	stop()
	{
		this.ns.close();
		this.ns = null;
	}
}
MediaServerClient.SemanticSDP = SemanticSDP;

module.exports = MediaServerClient;

},{"./PeerConnectionClient.js":6,"semantic-sdp":7}],6:[function(require,module,exports){
const SemanticSDP	= require("semantic-sdp");
const SDPInfo		= SemanticSDP.SDPInfo;
const StreamInfo	= SemanticSDP.StreamInfo;
const TrackInfo		= SemanticSDP.TrackInfo;
const Direction		= SemanticSDP.Direction;

class PeerConnectionClient
{
	constructor(params)
	{
		//Store peer connection
		this.id = params.id;
		this.ns = params.ns;
		this.pc = params.pc;
		this.remote  = params.remote;
		this.localInfo = params.localInfo;
		this.remoteInfo = null;
		this.streams = {};
		this.strictW3C = false;
		
		//the list of pending transceivers 
		this.pending = new Set();
		this.processing = new Set();
		this.renegotiating = false;
		
		//List of tracks to be removed and added
		this.adding = new Set();
		this.removing = new Set();
		
		//Disable all existing transceivers
		for (const transceiver of this.pc.getTransceivers())
		{
			//Disable it
			transceiver.direction = "inactive";
			//Set flag
			transceiver.pending = true;
			//Add to pending
			this.pending.add(transceiver);
		}
		
		//Dummy events
		this.ontrack		= (event) => console.log("ontrack",event);
		this.ontrackended	= (event) => console.log("ontrackended",event);
		this.onstatsended	= (event) => console.log("onstatsended",event);
		
		//Forward events
		this.pc.ontrack		= (event) => { 
			//Store streams from event
			event.transceiver.trackInfo.streams = event.streams; 
			//Set remote ids
			event.remoteStreamId = event.transceiver.streamId;
			event.remoteTrackId  = event.transceiver.trackId;
			try {
				//Re-fire
				this.ontrack(event); 
			} catch (e) {
				console.error(e);
			};
		};
		this.pc.onstatsended	= (event) => {
			try {
				//Relaunch event
				this.onstatsended(event);
			} catch (e) {
				console.error(e);
			} 
		};
		this.pc.onnegotiationneeded = () => this.renegotiate();
		
		//Listen for events
		this.ns.on("event",(event)=> {
			//Get event data
			const data = event.data;
			//Check event name
			switch(event.name)
			{
				case "addedtrack":
				{
					//Add it for later addition
					this.adding.add(data);
					//Reneogitate
					this.renegotiate();
					break;
				}
				case "removedtrack":
				{
					//Add it for later removal
					this.removing.add(data);
					//Renegotiate 
					this.renegotiate();
					break;
				}
				case "stopped" :
					//Stop us
					this.stop();
					break;
			}
		});
		
		//Renegotiate now
		this.renegotiate();
	}
	
	async renegotiate()
	{
		//Detect simulcast-03 used by firefox
		let simulcast03 = false;
		//On chrome negotiation needed is fired multtiple times one per transceiver
		if (this.renegotiating)
			//Nothing to do
			return;
		
		//We are renegotiting, we need the flag as the function is async
		this.renegotiating = true;
		
		//Process addingionts first
		for (const data of this.adding)
		{
			let transceiver;
			//Get track info
			const trackInfo = TrackInfo.expand(data.track);
			//Check if we can reuse a transceiver
			for (let reused of this.pc.getTransceivers())
			{
				//If inactive and  not pending or stopped
				if (reused.receiver.track.kind==trackInfo.getMedia() && reused.direction=="inactive" && !reused.pending && !reused.stopped)
				{
					//reuse
					transceiver = reused;
					//Set new direction
					transceiver.direction = "recvonly";
					//Done
					break;
				}
			}
			//If we can't reuse
			if (!transceiver)
				//Add new recv only transceiver
				transceiver = this.pc.addTransceiver(trackInfo.getMedia(),{
					direction : "recvonly"
				});
			//Get stream
			let stream = this.streams[data.streamId];
			//If not found
			if (!stream)
				//Create new one
				this.streams[data.streamId] = stream = new StreamInfo(data.streamId);
			//Add track info
			stream.addTrack(trackInfo);
			//Store stream and track info
			transceiver.streamId = data.streamId;
			transceiver.trackId = trackInfo.getId();
			transceiver.trackInfo = trackInfo;
			//Set flag
			transceiver.pending = true;
			//To be processed
			this.pending.add(transceiver);
		}
		//Clear new remote track queue
		this.adding.clear();
		
		//Process pending tracks to be removed
		for (let data of this.removing)
		{
			//Get stream and track
			const streamInfo = this.streams[data.streamId]; 
			const trackInfo = streamInfo.getTrack(data.trackId);
			//Get associated mid
			const mid = trackInfo.getMediaId();
			//Look for the transceiver
			for (let transceiver of this.pc.getTransceivers())
			{
				//If the transceiver has been processed
				if (!transceiver.pending && transceiver.mid && transceiver.mid == mid )
				{
					//Deactivate transceiver
					transceiver.direction = "inactive";
					//Remove track
					streamInfo.removeTrack(trackInfo);
					//If this has no more tracks
					if (!streamInfo.getTracks().size)
						//Delete it
						delete (this.streams[transceiver.streamId]);
					try{
						//Launch event
						this.ontrackended(new (RTCTrackEvent || Event)("trackended",{
							receiver	: transceiver.receiver,
							track		: transceiver.receiver.track,
							streams		: trackInfo.streams,
							transceiver	: transceiver,
							remoteStreamId	: streamInfo.getId(),
							remoteTrackId	: trackInfo.getId()
						}));
					} catch (e) {
						console.error(e);
					}
					//Delete stuff
					delete(transceiver.streamId);
					delete(transceiver.trackId);
					delete(transceiver.trackInfo);
					//Delete from pending
					this.removing.delete(data);
					//Done
					break;
				}
			}
		}
		
		//Get the pending transceivers and process them
		const processing = this.pending;
		
		//Create new set, so if a new transceiver is added while renegotiating, it is not lost
		this.pending = new Set();
		
		//Get current transceivers
		const transceivers = this.pc.getTransceivers();
		
		//Skip for first SDP O/A as it is done in the MediaServerClient and firefox will fail
		if (this.pc.signalingState!="have-local-offer")
		{
			//Create offer
			const offer = await this.pc.createOffer();

			//HACK: SDP mungling and codec enforcement
			if (!this.strictW3C)
				//Update offer
				offer.sdp = fixLocalSDP(offer.sdp,transceivers);

			//Set local description
			await this.pc.setLocalDescription(offer);
			
			//HACK: for firefox
			if (!this.strictW3C)
				//Check if we need to convert to simulcast-03 the answer
				simulcast03 = offer.sdp.indexOf(": send rid=")!=-1;

			//HACK: Firefox uses old simulcast so switch back
			const sdp = simulcast03 ? offer.sdp.replace(": send rid=",":send ") : offer.sdp;
			
			//Parse local info 
			this.localInfo = SDPInfo.parse(sdp);
		} else {
			//HACK: for firefox. Check if we need to convert to simulcast-03 the answer
			simulcast03 = (this.pc.pendingLocalDescription || this.pc.currentLocalDescription).sdp.indexOf(": send rid=")!=-1;
		}
		
		//Get remote sdp
		this.remoteInfo = this.localInfo.answer(this.remote);
		
		//For all transceivers
		for (const transceiver of this.pc.getTransceivers())
		{
			//If we have to override the codec
			if (transceiver.codecs && transceiver.mid)
			{
				//Get local media
				const localMedia = this.localInfo.getMediaById(transceiver.mid);
				//Get remote capabilities
				const capabilities = this.remote.capabilities[localMedia.getType()];
				//If got none
				if (!capabilities)
					//Skip
					continue;
				//Clone capabilities for the media
				const cloned = Object.assign({},capabilities);
				//Set codecs
				cloned.codecs = transceiver.codecs;
				//Answer it
				const answer = localMedia.answer(cloned);
				//Replace media
				this.remoteInfo.replaceMedia(answer);
			}
		}
		
		//Procces pending transceivers
		for (let transceiver of processing)
		{
			//Check if it is a local or remote track
			if (transceiver.direction==="sendonly")
			{
				//Get mid
				const mid = transceiver.mid;
				//Get track for it
				const trackInfo = this.localInfo.getTrackByMediaId(mid);
				//signal it
				this.ns.event("addedtrack",{
					streamId	: transceiver.sender.streamId,
					track		: trackInfo.plain()
				});
				//Store in transceiverç
				transceiver.sender.trackInfo = trackInfo;
			} else if (transceiver.direction==="recvonly") {
				//Get mid
				const mid = transceiver.mid;
				//Get track
				const trackInfo = transceiver.trackInfo;
				//Assing
				trackInfo.setMediaId(mid);
			} else if (transceiver.direction==="inactive" &&  transceiver.sender && transceiver.sender.trackInfo) {
				//Get mid
				const mid = transceiver.mid;
				//signal it
				this.ns.event("removedtrack",{
					streamId	: transceiver.sender.streamId,
					trackId		: transceiver.sender.trackInfo.getId()
				});
				//Delete stuff
				delete(transceiver.sender.streamId);
				delete(transceiver.fixSimulcastEncodings);
			}
		}
		
		//Now add all remote streams 
		for (let stream of Object.values(this.streams)) 
		{
			//Clone stream
			const cloned = new StreamInfo(stream.getId());
			//For each track
			for (let [trackId,track] of stream.getTracks())
				//Ensure it has been processed already to avoid having a track without an assigned media id
				if (track.getMediaId())
					//Safe to add it back
					cloned.addTrack(track);
			//Add it
			this.remoteInfo.addStream(cloned);
		}
		
		//Set it
		await this.pc.setRemoteDescription({
			type	: "answer",
			sdp	: simulcast03 ? this.remoteInfo.toString().replace(":recv ",": recv rid=") : this.remoteInfo.toString()
		});
		
		//Procces pending transceivers again
		for (let transceiver of processing)
			//Delete flag
			delete(transceiver.pending);
		
		//We are not renegotiting
		this.renegotiating = false;
		
		//If there are new pending
		if (this.pending.size || this.removing.size || this.adding.size)
			//Renegotiate again
			this.renegotiate();
	}

	getStats(selector)
	{
		return this.pc.getStats(selector);
	}
	
	async addTrack(track,stream,params)
	{
		let transceiver;
		//Flag to force a renegotition
		let force = false;
		//Get send encodings
		const sendEncodings = params && params.encodings || [];
		
		try {
			//Create new transceiver
			transceiver = this.pc.addTransceiver(track,{
				direction	: "sendonly",
				streams		: stream ? [stream] : [],
				sendEncodings	: sendEncodings
			});
		} catch (e) {
			//HACK: old crhome
			if (this.strictW3C)
				//Retrow
				throw e;
			
			//New chrome launch exception when multiple send encofings are used, so create without them and fix them later
			transceiver = this.pc.addTransceiver(track,{
				direction	: "sendonly",
				streams		: stream ? [stream] : []
			});
		}
		
		//Add track to sender
		transceiver.sender.streamId = stream ? stream.id : "-";
		
		//Hack for firefox as it doesn't support enabling simulcast on addTransceiver but on sender.setParameters
		if (!this.strictW3C) try { 
			//If doing simulcast
			if (sendEncodings.length)
				//Set simuclast stuff
				await transceiver.sender.setParameters({encodings: sendEncodings});
			//Force renegotiation as event will have trigger before the event
			force = true;
		} catch(e) {
		}
		
		//HACK: SDP mungling && codec override
		if (!this.strictW3C)
		{
			//Get send params
			const sendParameters = transceiver.sender.getParameters();
			//Check if we need to fix simulcast info
			if ((sendParameters.encodings ? sendParameters.encodings.length : 0 )!==sendEncodings.length)
				//Store number of simulcast streams to add
				transceiver.fixSimulcastEncodings = sendEncodings;
			
		}
		//If we have to override codec
		if (params && params.codecs)
			//Set it on transceicer
			transceiver.codecs = params.codecs;
		
		//Set flag
		transceiver.pending = true;
		//Pending to signal
		this.pending.add(transceiver);
		
		//Enqueue a renegotiation, as 
		if (force)
			//Renegotiate on next tick
			setTimeout(()=>this.renegotiate(),0);
		//Done
		return transceiver.sender;
	}
	
	
	removeTrack(sender)
	{
		//Find transceiver for this
		for (let transceiver of this.pc.getTransceivers())
		{
			//If it is for this sender
			if (transceiver.sender===sender)
			{
				//Set flag
				transceiver.pending = true;
				//Add the transceiver to the pending list
				this.pending.add(transceiver);
			}
		}
		//Remove it 
		this.pc.removeTrack(sender);
	}
	
	stop()
	{	
		//Stop peerconnection
		this.pc.stop();
		//Stop namespace
		this.ns.stop();
		//Null
		this.pc = null;
		this.ns = null;
	}
	
	
}

let ssrcGen = 0;

function getNextSSRC()
{
	return ++ssrcGen;
}

function fixLocalSDP(sdp,transceivers)
{
	//Find first m line
	let ini = sdp.indexOf("\r\nm=");

	//The fixed sdp
	let fixed = sdp.substr(0,ini!==-1 ? ini+2 : ini);

	//Check if each media info has the appropiate simulcast info
	for (const transceiver of transceivers)
	{
		//Find next m line
		let end = sdp.indexOf("\r\nm=",ini+4);
		//Get m line
		let media = sdp.substring(ini+2,end!==-1 ? end+2  : undefined);
		//Move to next
		ini = end;

		//Check if we need to fix the simuclast info
		const fixSimulcastEncodings = transceiver.fixSimulcastEncodings ? transceiver.fixSimulcastEncodings.sort((a,b)=>{ return (b.scaleResolutionDownBy||1) - (a.scaleResolutionDownBy||1);}) : null;

		//Do we need to do sdp mangling?
		if (fixSimulcastEncodings && !fixSimulcastEncodings.inited)
		{
			//OK, chrome way
			const reg1 = RegExp("m=video.*\?a=ssrc:(\\d*) cname:(.+?)\\r\\n","s");
			const reg2 = RegExp("m=video.*\?a=ssrc:(\\d*) mslabel:(.+?)\\r\\n","s");
			const reg3 = RegExp("m=video.*\?a=ssrc:(\\d*) msid:(.+?)\\r\\n","s");
			const reg4 = RegExp("m=video.*\?a=ssrc:(\\d*) label:(.+?)\\r\\n","s");
			//Get ssrc and cname
			let res = reg1.exec(media);
			const ssrc = res[1];
			const cname = res[2];
			//Get other params
			const mslabel = reg2.exec(media)[2];
			const msid = reg3.exec(media)[2];
			const label = reg4.exec(media)[2];
			//Add simulcasts ssrcs
			const num = fixSimulcastEncodings.length-1;
			const ssrcs = [ssrc];

			for (let i=0;i<num;++i)
			{
				//Create new ssrcs
				//TODO: Check no overlap
				const ssrc = getNextSSRC();
				const rtx   = getNextSSRC();
				//Add to ssrc list
				ssrcs.push(ssrc);
				//Add sdp stuff
				media +="a=ssrc-group:FID " + ssrc + " " + rtx + "\r\n" +
					"a=ssrc:" + ssrc + " cname:" + cname + "\r\n" +
					"a=ssrc:" + ssrc + " msid:" + msid + "\r\n" +
					"a=ssrc:" + ssrc + " mslabel:" + mslabel + "\r\n" +
					"a=ssrc:" + ssrc + " label:" + label + "\r\n" +
					"a=ssrc:" + rtx + " cname:" + cname + "\r\n" +
					"a=ssrc:" + rtx + " msid:" + msid + "\r\n" +
					"a=ssrc:" + rtx + " mslabel:" + mslabel + "\r\n" +
					"a=ssrc:" + rtx + " label:" + label + "\r\n";
			}
			//Add SIM group
			media += "a=ssrc-group:SIM " + ssrcs.join(" ") + "\r\n";
			//Simulcast fake lines
			media += "a=simulcast:send " + fixSimulcastEncodings.map(e => e.rid).join(";") +"\r\n";
			//For each encoding
			for (let i=0;i<fixSimulcastEncodings.length;++i)
			{
				//Add RID equivalent
				media += "a=rid:" + fixSimulcastEncodings[i].rid + " send ssrc="+ssrcs[i]+"\r\n";
				//Store ssrc
				fixSimulcastEncodings[i].ssrc = ssrcs[i];
			}
			media += "a=x-google-flag:conference\r\n";
			//Done
			fixSimulcastEncodings.inited = true;
		} else if (fixSimulcastEncodings && !fixSimulcastEncodings.inited) {
			//Simulcast fake lines
			media += "a=simulcast:send " + fixSimulcastEncodings.map(e => e.rid).join(";") +"\r\n";
			//For each encoding
			for (let i=0;i<fixSimulcastEncodings.length;++i)
			{
				//Add RID equivalent
				media += "a=rid:" + fixSimulcastEncodings[i].rid + " send ssrc="+ssrcs[i]+"\r\n";
				//Store 
			}
			media += "a=x-google-flag:conference\r\n";
		} else {
			//Nothing
		}
		//Remove not usedcodecs
		if (transceiver.codecs)
			//For all video codecs
			for (let codec of ["vp8","vp9","h264"])
				//If not allowed
				if (!transceiver.codecs.includes(codec))
					//Remove it
					media = removeCodec(media,codec);
		//Add media to fixed
		fixed += media;
		
		if (fixed.indexOf("\r\n\r\n")!=-1)
			throw fixed;
	}
	
	return fixed;
}

//From : https://gist.github.com/tnoho/948be984f9981b59df43
function removeCodec(orgsdp, codec) 
{
	const internalFunc = function(sdp) 
	{
		const codecre = new RegExp("(a=rtpmap:(\\d*) " + codec + "\/90000\\r\\n)","i");
		const rtpmaps = sdp.match(codecre);
		if (rtpmaps == null || rtpmaps.length <= 2)
			return sdp;

		const rtpmap = rtpmaps[2];
		let modsdp = sdp.replace(codecre, "");

		const rtcpre = new RegExp("(a=rtcp-fb:" + rtpmap + ".*\r\n)", "g");
		modsdp = modsdp.replace(rtcpre, "");
		
		const fmtpre = new RegExp("(a=fmtp:" + rtpmap + ".*\r\n)", "g");
		modsdp = modsdp.replace(fmtpre, "");
		
		const aptpre = new RegExp("(a=fmtp:(\\d*) apt=" + rtpmap + "\\r\\n)");
		const aptmaps = modsdp.match(aptpre);
		let fmtpmap = "";
		if (aptmaps != null && aptmaps.length >= 3) 
		{
			fmtpmap = aptmaps[2];
			modsdp = modsdp.replace(aptpre, "");
		
			const rtppre = new RegExp("(a=rtpmap:" + fmtpmap + ".*\r\n)", "g");
			modsdp = modsdp.replace(rtppre, "");
		}

		const videore = /(m=video.*\r\n)/;
		const videolines = modsdp.match(videore);
		if (videolines != null) 
		{
			//If many m=video are found in SDP, this program doesn"t work.
			const videoline = videolines[0].substring(0, videolines[0].length - 2);
			const videoelem = videoline.split(" ");
			let modvideoline = videoelem[0];
			for (let i = 1; i < videoelem.length; i++) 
			{
				if (videoelem[i] == rtpmap || videoelem[i] == fmtpmap) 
					continue;
				modvideoline += " " + videoelem[i];
			}
			modvideoline += "\r\n";
			modsdp = modsdp.replace(videore, modvideoline);
		}
		return internalFunc(modsdp);
	};
	return internalFunc(orgsdp);
}

module.exports = PeerConnectionClient;

},{"semantic-sdp":7}],7:[function(require,module,exports){
module.exports =
{
	SDPInfo			: require("./lib/SDPInfo"),
	CandidateInfo		: require("./lib/CandidateInfo"),
	CodecInfo		: require("./lib/CodecInfo"),
	DTLSInfo		: require("./lib/DTLSInfo"),
	ICEInfo			: require("./lib/ICEInfo"),
	MediaInfo		: require("./lib/MediaInfo"),
	Setup			: require("./lib/Setup"),
	SourceGroupInfo		: require("./lib/SourceGroupInfo"),
	SourceInfo		: require("./lib/SourceInfo"),
	StreamInfo		: require("./lib/StreamInfo"),
	TrackInfo		: require("./lib/TrackInfo"),
	TrackEncodingInfo       : require("./lib/TrackEncodingInfo"),
	Direction		: require("./lib/Direction")
};
},{"./lib/CandidateInfo":8,"./lib/CodecInfo":9,"./lib/DTLSInfo":10,"./lib/Direction":11,"./lib/ICEInfo":14,"./lib/MediaInfo":15,"./lib/SDPInfo":18,"./lib/Setup":19,"./lib/SourceGroupInfo":22,"./lib/SourceInfo":23,"./lib/StreamInfo":24,"./lib/TrackEncodingInfo":25,"./lib/TrackInfo":26}],8:[function(require,module,exports){
/**
 * ICE candidate information
 * @namespace
 */
 class CandidateInfo {

	/**
	 * CanditateInfo constructor
	 * @constructor
	 * @alias CandidateInfo
	 * @param {String} foundation
	 * @param {Number} componentId
	 * @param {String} transport
	 * @param {Number} priority
	 * @param {String} address
	 * @param {Number} port
	 * @param {String} type
	 * @param {String} relAddr
	 * @param {String} relPort
	 */
	constructor(foundation, componentId, transport, priority, address, port, type, relAddr, relPort) {
		this.foundation		= foundation;
		this.componentId	= componentId;
		this.transport		= transport;
		this.priority		= priority;
		this.address		= address;
		this.port		= port;
		this.type		= type;
		this.relAddr		= relAddr;
		this.relPort		= relPort;
	}
	
	/**
	 * Check if the ice candadate has same info as us
	 * @param {CandidateInfo} candidate - ICE candadate to check against
	 * @returns {Boolean} 
	 */
	equals(candidate) {
		//Check
		return	candidate.foundation	=== this.foundation	&&
			candidate.componentId	=== this.componentId	&&
			candidate.transport	=== this.transport	&&
			candidate.priority	=== this.priority	&&
			candidate.address	=== this.address	&&
			candidate.port		=== this.port		&&
			candidate.type		=== this.type		&&
			candidate.relAddr	=== this.relAddr	&&
			candidate.relPort	=== this.relPort;
	}

	/**
	 * Create a clone of this Candidate info object
	 * @returns {CandidateInfo}
	 */
	clone() {
		//Clone
		return new CandidateInfo(this.foundation,this.componentId,this.transport,this.priority,this.address,this.port,this.type,this.relAddr,this.relPort);
	}

	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		const plain = {
			foundation	: this.foundation,
			componentId	: this.componentId,
			transport	: this.transport,
			priority	: this.priority,
			address		: this.address,
			port		: this.port,
			type		: this.type
		};
		//Add rel addr and port
		if (this.relAddr) plain.relAddr = this.relAddr;
		if (this.relPort) plain.relPort = this.relPort;
		//Return plain object
		return  plain;
	}

	/**
	 * Get the candidate foundation
	 * @returns {String}
	 */
	getFoundation() {
		return this.foundation;
	}

	/**
	 * Get the candidate component id
	 * @returns {Number}
	 */
	getComponentId() {
		return this.componentId;
	}

	/**
	 * Get the candidate transport type
	 * @returns {String}
	 */
	getTransport() {
		return this.transport;
	}

	/**
	 * Get the candidate priority
	 * @returns {Number}
	 */
	getPriority() {
		return this.priority;
	}

	/**
	 * Get the candidate IP address
	 * @returns {String}
	 */
	getAddress() {
		return this.address;
	}

	/**
	 * Get the candidate IP port
	 * @returns {Number}
	 */
	getPort() {
		return this.port;
	}

	/**
	 * Get the candidate type
	 * @returns {String}
	 */
	getType() {
		return this.type;
	}

	/**
	 * Get the candidate related IP address for relfexive candidates
	 * @returns {String}
	 */
	getRelAddr() {
		return this.relAddr;
	}

	/**
	 * Get the candidate related IP port for relfexive candidates
	 * @returns {Number}
	 */
	getRelPort() {
		return this.relPort;
	}

}

/**
 * Expands a plain JSON object containing an CandidateInfo
 * @param {Object} plain JSON object
 * @returns {CandidateInfo} Parsed Candidate info
 */
CandidateInfo.expand = function(plain)
{
	//Create new
	return new CandidateInfo(
		plain.foundation,
		plain.componentId,
		plain.transport,
		plain.priority,
		plain.address,
		plain.port,
		plain.type,
		plain.relAddr,
		plain.relPort
	);
};

module.exports = CandidateInfo;
},{}],9:[function(require,module,exports){
const RTCPFeedbackInfo = require("./RTCPFeedbackInfo");
/**
 * Codec information extracted for RTP payloads
 * @namespace
 */
class CodecInfo {

	/**
	 * @constructor
	 * @alias CodecInfo
	 * @param {String} codec	- Codec name
	 * @param {Number} type		- the payload type number
	 * @param {Object} params	- Format params for codec
	 * @returns {CodecInfo}
	 */
	constructor(codec, type, params) {
		this.codec	= codec;
		this.type	= type;
		this.params	= {};
		this.rtcpfbs	= new Set(); 
		//Add params if any
		if (params) this.addParams(params);
	}

	/**
	 * Create a clone of this Codec info object
	 * @returns {CodecInfo}
	 */
	clone() {
		//Clone
		const cloned =  new CodecInfo(this.codec,this.type,this.params);
		//Set rtx
		if (this.rtx)
			//Set it
			cloned.setRTX(this.rtx);
		//For each rtcp fb parameter
		for (const rtcfb of this.rtcpfbs)
			//Add it
			cloned.addRTCPFeedback(rtcfb.clone());
		//Return cloned one
		return cloned;
	}

	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		//Plain object
		const plain = {
			codec	: this.codec,
			type	: this.type
		};
		//Set rtx
		if (this.rtx)
			//Set it
			plain.rtx = this.rtx;
		//If we have params
		if (this.params.length)
			//Add params
			plain.params = this.params;
		//For each rtcp fb parameter
		for (const rtcfb of this.rtcpfbs)
		{
			//If first
			if (!plain.rtcpfbs) plain.rtcpfbs = [];
			//Add it
			plain.rtcpfbs.push(rtcfb.plain());
		}
		//Done
		return plain;
	}

	/**
	 * Set the RTX payload type number for this codec
	 * @param {Number} rtx
	 */
	setRTX(rtx) {
		this.rtx = rtx;
	}

	/**
	 * Get payload type for codec
	 * @returns {Number}
	 */
	getType() {
		return this.type;
	}

	/**
	 * Set the payload type for codec
	 * @params {Number} type
	 */
	setType(type) {
		this.type = type;
	}

	/**
	 * Get codec name
	 * @returns {String}
	 */
	getCodec() {
		return this.codec;
	}

	/**
	 * Get codec format parameters
	 */
	getParams() {
		return this.params;
	}
	
	/*
	 * Add codec info params
	 * @returns {Object} params
	 */
	addParams(params) {
		for (const k in params)
			this.params[k] = params[k];
	}

	/**
	 * Add codec info param
	 * @param {String} key
	 * @param {String} value
	 */
	addParam(key,value) {
		this.params[key] = value;
	}
	
	/**
	 * Check if codec has requested param
	 * @param {String} key
	 * @returns {Boolean} 
	 */
	hasParam(key) {
		return this.params.hasOwnProperty(key);
	}
	
	/**
	 * Get param
	 * @param {String} key
	 * @param {String} defaultValue default value if param is not found
	 * @returns {Boolean} 
	 */
	getParam(key,defaultValue) {
		return this.hasParam(key) ? this.params[key] : "" + defaultValue;
	}
	
	/**
	 * Check if this codec has an associated RTX payload type
	 * @returns {Number}
	 */
	hasRTX() {
		return this.rtx;
	}

	/**
	 * Get the associated RTX payload type for this codec
	 * @returns {Number}
	 */
	getRTX() {
		return this.rtx;
	}
	
	/**
	 * Add an RTCP feedback parameter to this codec type
	 * @params {RTCPFeedbackInfo} rtcpfb - RTCP feedback info objetc
	 */
	addRTCPFeedback(rtcpfb) {
		this.rtcpfbs.add(rtcpfb);
		
	}
	
	/**
	 * Get all extensions rtcp feedback parameters in this codec info
	 * @returns {Set<RTCPFeedbackInfo>}
	 */
	getRTCPFeedbacks() {
		return this.rtcpfbs;
	}
}

/**
 * Expands a plain JSON object containing an CodecInfo
 * @param {Object} plain JSON object
 * @returns {CodecInfo} Parsed Codec info
 */
CodecInfo.expand = function(plain)
{
	//Create new
	const codecInfo = new CodecInfo(
		plain.codec,
		plain.type,
		plain.params
	);

	//If they have rtx
	if (plain.rtx)
		//Set it
		codecInfo.setRTX(plain.rtx);
	
	//For each rtfpcfb
	for (let i=0; plain.rtcpfbs && i<plain.rtcpfbs.length;++i)
	{
		//Expand rtcp feedback
		const rtcpFeedbackInfo = RTCPFeedbackInfo.expand(plain.rtcpfbs[i]);
		//Push cloned extension
		codecInfo.addRTCPFeedback(rtcpFeedbackInfo);
	}
	
	return codecInfo;
};

/**
 * Create a map of CodecInfo from codec names.
 * Payload type is assigned dinamically
 * @param {Array<String>} names
 * @return Map<String,CodecInfo>
 * @params {Boolean} rtx - Should we add rtx?
 * @param {Array<String>} params - RTCP feedback params
 */
CodecInfo.MapFromNames = function(names,rtx,rtcpfbs)
{
	//The codec map
	const codecs = new Map();

	//Base dyn payload
	let dyn = 96;
	//For each name
	for (let i=0;i<names.length;++i)
	{
		let pt;
		//We can add params to codec names
		const params = names[i].split(";");
		//Get codec name
		const name = params[0].toLowerCase().trim();
		//Check name
		if (name==='pcmu')
			pt = 0;
		else if (name==='pcma')
			pt = 8;
		else
			//Dynamic
			pt = ++dyn;
		//Create new codec
		const codec = new CodecInfo(name,pt);
		//Check if we have to add rtx
		if (rtx && name!=="ulpfec" && name!=="flexfec-03" && name!=="red")
			//Add it
			codec.setRTX(++dyn);
		
		//Append all the  rtcp feedback info
		for (let j=0;rtcpfbs && j<rtcpfbs.length;++j)
			//Add rtcp feednack
			codec.addRTCPFeedback(new RTCPFeedbackInfo(rtcpfbs[j].id, rtcpfbs[j].params));
		//Add params if any
		for (let j=1;j<params.length;++j)
		{
			//Split it
			let param = params[j].split("=");
			//Add it
			codec.addParam(param[0].trim(),param[1].trim());
		}
		//Append
		codecs.set(codec.getCodec().toLowerCase(),codec);
	}
	//Get the map
	return codecs;
};

module.exports = CodecInfo;

},{"./RTCPFeedbackInfo":17}],10:[function(require,module,exports){
const Setup		 = require("./Setup");

/**
 * DTLS peer info
 * @namespace
 */
class DTLSInfo
{
	/**
	 * @constructor
	 * @alias DTLSInfo
	 * @param {Setup} setup		- Setup type
	 * @param {String} hash		- Hash function
	 * @param {String} fingerprint	- Peer fingerprint
	 * @returns {DTLSInfo}
	 */
	constructor(setup,hash,fingerprint)
	{
		//store properties
   		this.setup		= setup;
		this.hash		= hash;
		this.fingerprint	= fingerprint;
	}

	/**
	 * Create a clone of this DTLS info object
	 * @returns {DTLSInfo}
	 */
	clone() {
		//Clone
		return new DTLSInfo(this.setup,this.hash,this.fingerprint);
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		return {
			setup		: Setup.toString (this.setup),
			hash		: this.hash,
			fingerprint	: this.fingerprint
		};
	}

	/**
	 * Get peer fingerprint
	 * @returns {String}
	 */
	getFingerprint() {
		return this.fingerprint;
	}

	/**
	 * Get hash function name
	 * @returns {String}
	 */
	getHash() {
		return this.hash;
	}

	/**
	 * Get connection setup
	 * @returns {Setup}
	 */
	getSetup() {
		return this.setup;
	}

	/**
	 * Set connection setup
	 * @param {Setup} setup
	 */
	setSetup(setup) {
		this.setup = setup;
	}

}

/**
 * Expands a plain JSON object containing an DTLSInfo
 * @param {Object} plain JSON object
 * @returns {DTLSInfo} Parsed DTLS info
 */
DTLSInfo.expand = function(plain)
{
	//Create new
	return new DTLSInfo(
		plain.setup ? Setup.byValue(plain.setup) : Setup.ACTPASS,
		plain.hash,
		plain.fingerprint
	);
};

module.exports = DTLSInfo;
},{"./Setup":19}],11:[function(require,module,exports){
const Enum = require("./Enum");
/**
 * Enum for Direction values.
 * @readonly
 * @enum {number}
 */
const Direction = Enum("SENDRECV","SENDONLY","RECVONLY","INACTIVE");

/**
 * Get Direction by name
 * @memberOf Direction
 * @param {string} direction
 * @returns {Direction}
 */
Direction.byValue = function(direction)
{
	return Direction[direction.toUpperCase()];
};

/**
 * Get Direction name
 * @memberOf Direction
 * @param {Direction} direction
 * @returns {String}
 */
Direction.toString = function(direction)
{
	switch(direction)
	{
		case Direction.SENDRECV:
			return "sendrecv";
		case Direction.SENDONLY:
			return "sendonly";
		case Direction.RECVONLY:
			return "recvonly";
		case Direction.INACTIVE:
			return "inactive";
	}
};

/**
 * Get reverse direction
 * @memberOf Direction
 * @param {Direction} direction
 * @returns {Direction} Reversed direction
 */
Direction.reverse = function(direction)
{
	switch(direction)
	{
		case Direction.SENDRECV:
			return Direction.SENDRECV;
		case Direction.SENDONLY:
			return Direction.RECVONLY;
		case Direction.RECVONLY:
			return Direction.SENDONLY;
		case Direction.INACTIVE:
			return Direction.INACTIVE;
	}
};

module.exports = Direction;
},{"./Enum":13}],12:[function(require,module,exports){
const Enum = require("./Enum");
/**
 * Enum for DirectionWay Way values.
 * @readonly
 * @enum {number}
 */
const DirectionWay = Enum("SEND","RECV");

/**
 * Get Direction Way by name
 * @memberOf DirectionWay
 * @param {string} direction
 * @returns {DirectionWay}
 */
DirectionWay.byValue = function(direction)
{
	return DirectionWay[direction.toUpperCase()];
};

/**
 * Get Direction Way name
 * @memberOf DirectionWay
 * @param {DirectionWay} direction
 * @returns {String}
 */
DirectionWay.toString = function(direction)
{
	switch(direction)
	{
		case DirectionWay.SEND:
			return "send";
		case DirectionWay.RECV:
			return "recv";
	}
};

/**
 * Get reverse direction way
 * @memberOf DirectionWay
 * @param {DirectionWay} direction
 * @returns {DirectionWay} Reversed direction
 */
DirectionWay.reverse = function(direction)
{
	switch(direction)
	{
		case DirectionWay.SEND:
			return DirectionWay.RECV;
		case DirectionWay.RECV:
			return DirectionWay.SEND;
	}
};

module.exports = DirectionWay;
},{"./Enum":13}],13:[function(require,module,exports){

function Enum () {

	var _this = this;

	if (!(this instanceof Enum))
		return new (Function.prototype.bind.apply (Enum, [null].concat (Array.prototype.slice.call (arguments)))) ();
	Array.from (arguments).forEach (function (arg) {
		_this[arg] = Symbol.for("MEDOOZE_SEMANTIC_SDP_"+arg);
	});
}

module.exports = Enum;
},{}],14:[function(require,module,exports){
const randomBytes = require('randombytes');

/**
 * ICE information for a peer
 * @namespace
 */
class ICEInfo
{
	//TODO: ice-options: trickle
	
	/**
	 * @constructor
	 * @alias ICEInfo
	 * @param {String} ufrag	- Peer ICE username framgent
	 * @param {String} pwd		- Peer ICE password
	 * @returns {ICEInfo}
	 */
	constructor(ufrag, pwd) {
		this.ufrag	= ufrag;
		this.pwd	= pwd;
		this.lite	= false;
		this.endOfCandidates = false;
	}

	/**
	 * Create a clone of this Codec info object
	 * @returns {ICEInfo}
	 */
	clone() {
		//Clone
		const cloned =  new ICEInfo(this.ufrag,this.pwd);
		//Set ice lite and end of canddiates
		cloned.setLite (this.lite);
		cloned.setEndOfCandidates (this.endOfCandidates);
		//Return it
		return cloned;
	}

	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		const plain = {
			ufrag	: this.ufrag,
			pwd	: this.pwd
		};
		//Set ice lite and end of canddiates only if true
		if (this.lite) plain.lite = this.lite;
		if (this.endOfCandidates) plain.endOfCandidates = this.endOfCandidates;
		//Return plain object
		return plain;
	}

	/**
	 * Get username fragment
	 * @returns {String} ufrag
	 */
	getUfrag() {
		return this.ufrag;
	}

	/**
	 * Get username password
	 * @returns {String}	password
	 */
	getPwd() {
		return this.pwd;
	}

	/**
	 * Is peer ICE lite
	 * @returns {Boolean}
	 */
	isLite() {
		return this.lite;
	}

	/**
	 * Set peer as ICE lite
	 * @param {boolean} lite
	 */
	setLite(lite) {
		this.lite = lite;
	}

	isEndOfCandidates() {
		return this.endOfCandidates;
	}

	setEndOfCandidates(endOfCandidates) {
		 this.endOfCandidates = endOfCandidates;
	}

}
/**
 * Genereate a new peer ICE info with ramdom values
 * @param {Boolean} lite - Set ICE lite flag
 * @returns {ICEInfo}
 */
ICEInfo.generate = function(lite)
{
	//Create ICE info for media
	const info = new ICEInfo();
	//Create key and pwd bytes
	const frag = randomBytes(8);
	const pwd = randomBytes(24);
	//Create ramdom pwd
	info.ufrag = frag.toString('hex');
	info.pwd   = pwd.toString('hex');
	info.lite  = lite;
	//return it
	return info;
};


/**
 * Expands a plain JSON object containing an ICEInfo
 * @param {Object} plain JSON object
 * @returns {ICEInfo} Parsed ICE info
 */
ICEInfo.expand = function(plain)
{
	//Create new
	const info = new ICEInfo(
		plain.ufrag,
		plain.pwd
	);
	//Set ice lite and end of canddiates
	info.setLite(plain.lite);
	info.setEndOfCandidates(plain.endOfCandidates);
	//return it
	return info;
};

module.exports = ICEInfo;
},{"randombytes":27}],15:[function(require,module,exports){
const CodecInfo		= require ("./CodecInfo");
const RIDInfo		= require ("./RIDInfo");
const SimulcastInfo	= require ("./SimulcastInfo");
const Direction		= require ("./Direction");
const DirectionWay	= require ("./DirectionWay");
const RTCPFeedbackInfo  = require ("./RTCPFeedbackInfo");
/**
 * Media information (relates to a m-line in SDP)
 * @namespace
 */
class MediaInfo {
	/**
	 * @constructor
	 * @alias MediaInfo
	 * @param {String} id	- Media id
	 * @param {String} type	- Media type "audio"|"video"
	 * @returns {MediaInfo}
	 */
	constructor(id, type) {
		this.id		= id;
		this.type	= type;
		this.direction  = Direction.SENDRECV;
		this.extensions = new Map();
		this.codecs	= new Map();
		this.rids	= new Map();
		this.simulcast  = null;
		this.bitrate	= 0;
	}

	/**
	 * Clone MediaInfo object
	 * @returns {MediaInfo} cloned object
	 */
	clone() {
		//Cloned object
		const cloned = new MediaInfo(this.id, this.type);
		//Set direction
		cloned.setDirection(this.direction);
		//Set bitrate
		cloned.setBitrate(this.bitrate);
		//For each codec
		for (const codec of this.codecs.values())
			//Push cloned stream
			cloned.addCodec(codec.clone());
		//For each extension
		for (const [id,name] of this.extensions.entries())
			//Push cloned extension
			cloned.addExtension(id,name);
		//For each rid
		for (const rid of this.rids.values())
			//Push cloned extension
			cloned.addRID(rid.clone());
		//If it has simulcast stream info
		if (this.simulcast)
			//The simulcast info
			cloned.setSimulcast(this.simulcast.clone());
		//Return cloned object
		return cloned;
	}

	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		//Cloned object
		const plain = {
			id		: this.id,
			type		: this.type,
			direction	: Direction.toString (this.direction),
			codecs		: []
		};
		//Check bitrate
		if (this.bitrate)
			//Add it
			plain.bitrate = this.bitrate;
		//For each codec
		for (const codec of this.codecs.values())
			//Push plain codec
			plain.codecs.push(codec.plain());

		//For each extension
		for (const [id,name] of this.extensions.entries())
		{
			//if first
			if (!plain.extensions) plain.extensions = {};
			//Push extension
			plain.extensions[id] = name;
		}
		//For each rids
		for (const rid of this.rids.values())
		{
			//if first
			if (!plain.rids) plain.rids = [];
			//Push extension
			plain.rids.push(rid.plain());
		}
		//If it has simulcast stream info
		if (this.simulcast)
			//The simulcast info
			plain.simulcast = this.simulcast.plain();
		//Return cloned object
		return plain;
	}

	/**
	 * Get media type "audio"|"video"
	 * @returns {String}
	 */
	getType() {
		return this.type;
	}

	/**
	 * Get id (msid) for the media info
	 * @returns {String}
	 */
	getId() {
		return this.id;
	}
	
	/**
	 * Set id (msid) for the media info
	 * @param {String} id
	 */
	setId(id) {
		this.id = id;
	}

	/**
	 * Add rtp header extension support
	 * @param {Number} id
	 * @param {String} name
	 */
	addExtension(id, name) {
		this.extensions.set(id, name);
	}

	/**
	 * Add rid information
	 * @param {RIDInfo} ridInfo
	 */
	addRID(ridInfo) {
		this.rids.set(ridInfo.getId(), ridInfo);
	}

	/**
	 * Add Codec support information
	 * @param {CodecInfo} codecInfo - Codec info object
	 */
	addCodec(codecInfo) {
		this.codecs.set(codecInfo.getType(), codecInfo);
	}

	/**
	 * Set codec map
	 * @param {Map<Number,CodecInfo> codecs - Map of codec info objecs
	 */
	setCodecs(codecs) {
		this.codecs = codecs;
	}
	
	/**
	 * Get codec for payload type number
	 * @param {Number} type - Payload type number
	 * @returns {CodecInfo} codec info object
	 */
	getCodecForType(type) {
		return this.codecs.get(type);
	}

	/**
	 * Get codec by codec name
	 * @param {String} codec - Codec name (eg: "vp8")
	 * @returns {CodecInfo}
	 */
	getCodec(codec) {
		for (const info of this.codecs.values())
			if (info.getCodec().toLowerCase()===codec.toLowerCase())
				return info;
		return null;
	}

	/**
	 * Check if this media has information for this codec
	 * @param {String} codec - Codec name
	 * @returns {Boolean}
	 */
	hasCodec(codec) {
		return this.getCodec(codec)!==null;
	}

	/**
	 * Get all codecs in this media
	 * @returns {Map<Number,CodecInfo>}
	 */
	getCodecs() {
		return this.codecs;
	}

	/**
	 * Check if any of the codecs on the media description supports rtx
	 * @returns {Boolean}
	 */
	hasRTX() {
		//Check all codecs
		for (const info of this.codecs.values())
			//Check if it has rtx
			if (info.hasRTX())
				//At least one found
				return true;
		//Not found
		return false;
	}
	
	/**
	 * Get all extensions registered in  this media info
	 * @returns {Map<Number,String>}
	 */
	getExtensions() {
		return this.extensions;
	}

	/**
	 * Get all rids registered in  this media info
	 * @returns {Map<String,RIDInfo>}
	 */
	getRIDs() {
		return this.rids;
	}

	/**
	 * Get rid info for id
	 * @param {String} id - rid value to get info for
	 * @returns {RIDInfo}
	 */
	getRID(id) {
		return this.rids.get(id);
	}

	/**
	 * Returns maximum bitrate for this media
	 * @returns {Number}
	 */
	getBitrate() {
		return this.bitrate;
	}

	/**
	 * Set maximum bitrate for this media
	 * @param {Number} bitrate
	 */
	setBitrate(bitrate) {
		this.bitrate = bitrate;
	}

	/**
	 * Get media direction
	 * @returns {Direction}
	 */
	getDirection() {
		return this.direction;
	}

	/**
	 * Set media direction
	 * @param {Direction} direction
	 */
	setDirection(direction) {
		this.direction = direction;
	}


	/**
	 * Helper usefull for creating media info answers.
	 * - Will reverse the direction
	 * - For each supported codec, it will change the payload type to match the offer and append it to the answer
	 * - For each supported extension, it will append the ones present on the offer with the id offered
	 * @param {Object} supported - Supported codecs and extensions to be included on answer
	 * @param {Map<String,CodecInfo>} supported.codecs - List of strings with the supported codec names
	 * @param {Set<String>} supported.extensions - List of strings with the supported codec names
	 * @param {Boolean] supported.simulcast - Simulcast is enabled
	 * @param {Array<String>} supported.rtcpfbs - Supported RTCP feedback params
	 * @return {MediaInfo}
	 */
	answer(supported)
	{
		//Create new media
		const answer = new MediaInfo(this.id, this.type);

		if (supported)
		{
			//Set reverse direction
			answer.setDirection(Direction.reverse(this.direction));

			//If we have supported codecs
			if (supported.codecs)
			{
				let supportedCodecs;
				
				//If we are set an array of names
				if (Array.isArray(supported.codecs))
					//Generate set
					supportedCodecs = CodecInfo.MapFromNames(supported.codecs,supported.rtx,supported.rtcpfbs);
				else
					//It is a set
					supportedCodecs = supported.codecs;
				
				//For each codec on offer
				for (let codec of this.codecs.values())
				{
					//If that codec is supported
					if (supportedCodecs.has(codec.getCodec().toLowerCase()))
					{
						//Get supported code
						const supported = supportedCodecs.get(codec.getCodec().toLowerCase());
						//If it is h264, check packetization mode
						if (supported.getCodec()==="h264" && supported.hasParam("packetization-mode") && supported.getParam("packetization-mode")!=codec.getParam("packetization-mode","0"))
							//Ignore
							continue;
						//If it is h264, check profile-level-id
						if (supported.getCodec()==="h264" && supported.hasParam("profile-level-id") && codec.hasParam("profile-level-id") && supported.getParam("profile-level-id")!=codec.getParam("profile-level-id"))
							continue;
						//Clone codec
						const cloned = supported.clone();
						//Change payload type number
						cloned.setType(codec.getType());
						//If we had rtx
						if (cloned.hasRTX())
							//Change payload type also
							cloned.setRTX(codec.getRTX());
						//Clone also config
						cloned.addParams(codec.getParams());
						//Add to answer
						answer.addCodec(cloned);
					}
				}
			}

			//Get extension set
			const extensions = new Set(supported.extensions);
			//Add audio extensions
			for (let [id,uri] of this.extensions)
				//If is supported
				if (extensions.has(uri))
					//Add to answer
					answer.addExtension(id, uri);

			//If simulcast is enabled
			if (supported.simulcast && this.simulcast)
			{
				//Create anser
				const simulcast = new SimulcastInfo();
				//Get send streams
				const send = this.simulcast.getSimulcastStreams(DirectionWay.SEND);
				//If it had
				if (send)
					//for each one
					for (let i=0; i<send.length; ++i)
					{
						var alternatives = [];
						//Clone streams
						for (let j=0; j<send[i].length; ++j)
							//Clone it and add to alternative streams
							alternatives.push(send[i][j].clone());
						//Add alternatives in reverse order
						simulcast.addSimulcastAlternativeStreams(DirectionWay.RECV,alternatives);
					}

				//Get recv streams
				const recv = this.simulcast.getSimulcastStreams(DirectionWay.RECV);
				//If it had
				if (recv)
					//for each one
					for (let i=0; i<recv.length; ++i)
					{
						var alternatives = [];
						//Clone streams
						for (let j=0; j<recv[i].length; ++j)
							//Clone it and add to alternative streams
							alternatives.push(recv[i][j].clone());
						//Add alternatives in reverse order
						simulcast.addSimulcastAlternativeStreams(DirectionWay.SEND,alternatives);
					}

				//Add rids
				//For each rid
				for (const rid of this.rids.values())
				{
					//TODO: check if formats is in supported list
					//CLone rid
					const reversed = rid.clone();
					//Reverse direction
					reversed.setDirection(DirectionWay.reverse(rid.getDirection()));
					//Push cloned extension
					answer.addRID(reversed);
				}

				//Add it to answer
				answer.setSimulcast(simulcast);
			}
		} else {
			//Inactive
			answer.setDirection(Direction.INACTIVE);
		}
		//Add it to answer
		return answer;
	}

	/**
	 * Get Simulcast info
	 * @returns {SimulcastInfo}
	 */
	getSimulcast() {
		return this.simulcast;
	}

	/**
	 * Set stream simulcast info
	 * @param {SimulcastInfo} simulcast - Simulcast stream info
	 */
	setSimulcast(simulcast) {
		this.simulcast = simulcast;
	}
}

/**
* Helper factory for creating media info objects.
* @param {String} - Media type
* @param {Object} supported - Supported media capabilities to be included on media info
* @param {Map<String,CodecInfo> | Array<String>} supported.codecs - Map or codecInfo or list of strings with the supported codec names
* @param {boolean] rtx - If rtx is supported for codecs (only needed if passing codec names instead of CodecInfo)
* @param {Object] rtcpbfs 
* @param {Array<String>} supported.extensions - List of strings with the supported codec names
* @return {MediaInfo}
*/
MediaInfo.create = function(type,supported)
{
       //Create new media
       const mediaInfo = new MediaInfo(type,type);

       if (supported)
       {
		//If we have supported codecs
		if (supported.codecs)
		{
			//If we are set an array of names
			if (Array.isArray(supported.codecs))
			{
				//Add all codecs
				mediaInfo.setCodecs(CodecInfo.MapFromNames(supported.codecs,supported.rtx,supported.rtcpfbs));
			 } else {
				 //Add codecs
				 mediaInfo.setCodecs(supported.codecs);
			 }
		 }
		//Add extensions
		for (let id = 0; supported.extensions && id<supported.extensions.length; ++id)
			//Add to answer
			mediaInfo.addExtension(id, supported.extensions[id]);
       } else {
	       //Inactive
	       mediaInfo.setDirection(Direction.INACTIVE);
       }
       //Add it to answer
       return mediaInfo;
};

/**
 * Expands a plain JSON object containing an MediaInfo
 * @param {Object} plain JSON object
 * @returns {MediaInfo} Parsed Media info
 */
MediaInfo.expand = function(plain)
{
	//Create new
	const mediaInfo = new MediaInfo(plain.id, plain.type);

	//Set direction
	if (plain.direction)
		mediaInfo.setDirection(Direction.byValue(plain.direction));
	//Set bitrate
	mediaInfo.setBitrate(plain.bitrate);

	//For each extension
	for (let id in plain.extensions)
		//Push cloned extension
		mediaInfo.addExtension(id,plain.extensions[id]);

	//For each codec
	for (let i=0; plain.codecs && i<plain.codecs.length;++i)
	{
		//Parse codec
		const codecInfo = CodecInfo.expand(plain.codecs[i]);
		//If ok
		if (codecInfo)
			//Push cloned stream
			mediaInfo.addCodec(codecInfo);
	}
	//For each rid
	for (let i=0; plain.rids && i<plain.rids.length;++i)
	{
		//Parse codec
		const ridInfo = RIDInfo.expand(plain.rids[i]);
		//Push cloned extension
		mediaInfo.addRID(ridInfo);
	}

	//If it has simulcast stream info
	if (plain.simulcast)
		//The simulcast info
		mediaInfo.setSimulcast(SimulcastInfo.expand(plain.simulcast));

	//Done
	return mediaInfo;
};

module.exports = MediaInfo;

},{"./CodecInfo":9,"./Direction":11,"./DirectionWay":12,"./RIDInfo":16,"./RTCPFeedbackInfo":17,"./SimulcastInfo":20}],16:[function(require,module,exports){
const DirectionWay		 = require("./DirectionWay");

/**
 * RID info
 * @namespace
 */
class RIDInfo
{
	/**
	 * @constructor
	 * @alias DTLSInfo
	 * @param {String} id		- rid value
	 * @param {DirectionWay} direction	- direction
	 * @returns {RIDInfo}
	 */
	constructor(id,direction)
	{
		//store properties
   		this.id		= id;
		this.direction	= direction;
		this.formats	= [];
		this.params	= new Map();
	}

	/**
	 * Create a clone of this RID info object
	 * @returns {RIDInfo}
	 */
	clone() {
		//Clone
		var cloned = new RIDInfo(this.id,this.direction);
		//Add formats and formats
		cloned.setFormats(this.formats);
		cloned.setParams(this.params);
		//return cloned object
		return cloned;
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		var plain =  {
			id		: this.id,
			direction	: DirectionWay.toString(this.direction)
		};
		//Add formats
		if (this.formats)
			plain.formats = this.formats;
		//Add params
		for (var [id,param] of this.params.entries())
		{
			//If first
			if (!plain.params) plain.params = {};
			//Add it
			plain.params[id] = param;
		}
		//Return plain object
		return plain;
	}

	/**
	 * Get the rid id value
	 * @returns {String}
	 */
	getId() {
		return this.id;
	}

	/**
	 * Get rid direction
	 * @returns {DirectionWay}
	 */
	getDirection() {
		return this.direction;
	}

	/**
	 * Set direction setup
	 * @param {DirectionWay} direction
	 */
	setDirection(direction) {
		this.direction = direction;
	}

	/**
	 * Get pt formats for rid
	 * @returns {Array.Number}
	 */
	getFormats() {
		return this.formats;
	}

	/**
	 * Set pt formats for rid
	 * @param {Array} formats
	 */
	setFormats(formats) {
		this.formats = [];
		//Populte
		for (let i=0; i<formats.length; ++i)
			this.formats.push(parseInt(formats[i]));
	}

	/**
	 * Get the rid params
	 * @returns {Map<String,String>} The params map
	 */
	getParams() {
		return this.params;
	}

	/**
	 * Set the rid params
	 * @param {Map<String,String>} params - rid params map
	 */
	setParams(params) {
		this.params = new Map(params);
	}

	/**
	 * Add an rid param
	 * @param {String} id
	 * @param {String} param
	 */
	addParam(id,param) {
		this.params.set(id,param);
	}

	/**
	 * Get rid direction
	 * @returns {DirectionWay}
	 */
	getDirection() {
		return this.direction;
	}

	/**
	 * Set direction setup
	 * @param {DirectionWay} direction
	 */
	setDirection(direction) {
		this.direction = direction;
	}


}

/**
 * Expands a plain JSON object containing an RIDInfo
 * @param {Object} plain JSON object
 * @returns {RIDInfo} Parsed RID info
 */
RIDInfo.expand = function(plain)
{
	//Create new
	const ridInfo = new RIDInfo(
		plain.id,
		DirectionWay.byValue(plain.direction)
	);

	//Add params
	for (let id in plain.params)
		ridInfo.addParam(id,plain.params[id]);

	//Add formats
	if (plain.formats)
		ridInfo.setFormats(plain.formats);

	//Done
	return ridInfo;
};

module.exports = RIDInfo;
},{"./DirectionWay":12}],17:[function(require,module,exports){
/**
 * RTCP Feedback parameter
 * @namespace
 */
class RTCPFeedbackInfo
{
	/**
	 * @constructor
	 * @alias RTCPFeedbackInfo
	 * @param {String} id		- RTCP feedback id
	 * @param {Array<String>} params - RTCP feedback params
	 * @returns {RTCPFeedbackInfo}
	 */
	constructor(id, params) {
		this.id	= id;
		this.params = params || [];
	}
	
	/**
	 * Create a clone of this RTCPFeedbackParameter info object
	 * @returns {RTCPFeedbackInfo}
	 */
	clone() {
		//Return cloned one
		return new RTCPFeedbackInfo(this.id,this.params);
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		if (this.params.length)
			return {
				id	: this.id,
				params	: this.params
			};
		else 
			return {
				id	: this.id
			};
	}
	
	/**
	 * Get id fo the rtcp feedback parameter
	 * @returns {String}
	 */
	getId() {
		return this.id;
	}
	
	/**
	 * Get codec  rtcp feedback parameters
	 * @returns {Array<String>} parameters
	 */
	getParams() {
		return this.params;
	}
}

/**
 * Expands a plain JSON object containing an CodecInfo
 * @param {Object} plain JSON object
 * @returns {CodecInfo} Parsed Codec info
 */
RTCPFeedbackInfo.expand = function(plain)
{
	//Create new
	return new RTCPFeedbackInfo(
		plain.id,
		plain.params
	);
};

module.exports = RTCPFeedbackInfo;
},{}],18:[function(require,module,exports){
const SDPTransform	 = require("sdp-transform");

const CandidateInfo	 = require("./CandidateInfo");
const CodecInfo		 = require("./CodecInfo");
const RTCPFeedbackInfo	 = require("./RTCPFeedbackInfo");
const DTLSInfo		 = require("./DTLSInfo");
const ICEInfo		 = require("./ICEInfo");
const MediaInfo		 = require("./MediaInfo");
const Setup		 = require("./Setup");
const Direction		 = require("./Direction");
const DirectionWay	 = require("./DirectionWay");
const SourceGroupInfo	 = require("./SourceGroupInfo");
const SourceInfo	 = require("./SourceInfo");
const StreamInfo	 = require("./StreamInfo");
const TrackInfo		 = require("./TrackInfo");
const TrackEncodingInfo	 = require("./TrackEncodingInfo");
const SimulcastInfo	 = require("./SimulcastInfo");
const SimulcastStreamInfo= require("./SimulcastStreamInfo");
const RIDInfo		 = require("./RIDInfo");

/**
 * SDP semantic info object
 *	This object represent the minimal information of an WebRTC SDP in a semantic hierarchy
 * @namespace
 */
class SDPInfo
{
	/**
	 * @constructor
	 * @alias SDPInfo
	 * @param {Number} version SDP version attribute
	 */
	constructor(version)
	{
		this.version		= version || 1;
		this.streams		= new Map();
		this.medias		= new Array(); //Array as we need to keep order
		this.candidates		= new Array(); //Array as we need to keep order
		this.ice		= null;
		this.dtls		= null;
	}

	/**
	 * Clone SDPinfo object
	 * @returns {SDPInfo} cloned object
	 */
	clone() {
		//Cloned object
		const cloned = new SDPInfo(this.version);
		//For each media
		for (let i=0;i<this.medias.length;++i)
			//Push cloned
			cloned.addMedia(this.medias[i].clone());
		//For each stream
		for (const stream of this.streams.values())
			//Push cloned stream
			cloned.addStream(stream.clone());
		//For each candiadte
		for (let i=0;i<this.candidates.length;++i)
			//Push cloned candidate
			cloned.addCandidate(this.candidates[i].clone());
		//Clone ICE and DLTS
		cloned.setICE(this.ice.clone());
		cloned.setDTLS(this.dtls.clone());
		//Return cloned object
		return cloned;
	}

	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		//Cloned object
		const plain = {
			version		: this.version,
			streams		: [],
			medias		: [],
			candidates	: []
		};
		//For each media
		for (let i=0;i<this.medias.length;++i)
			//Push plain
			plain.medias.push(this.medias[i].plain());
		//For each stream
		for (const stream of this.streams.values())
			//Push cloned stream
			plain.streams.push(stream.plain());
		//For each candiadte
		for (let i=0;i<this.candidates.length;++i)
			//Push cloned candidate
			plain.candidates.push(this.candidates[i].plain());
		//Add ICE and DLTS
		plain.ice = this.ice && this.ice.plain();
		plain.dtls = this.dtls && this.dtls.plain();
		//Return plain object
		return plain;
	}
	
	/**
	 * Returns an unified plan version of the SDP info
	 * @returns {SDPInfo} Unified version
	 */
	unify()
	{
		//Cloned object
		const cloned = new SDPInfo(this.version);
		//For each media
		for (let i=0;i<this.medias.length;++i)
			//Push cloned
			cloned.addMedia(this.medias[i].clone());
		//Get audio and video medias
		const medias = {
			audio : cloned.getMediasByType("audio"),
			video : cloned.getMediasByType("video")
		};
		
		//For each stream
		for (const stream of this.streams.values())
		{
			//Clone stream
			const clonedStream = stream.clone();
			//For each track
			for (const clonedTrack of clonedStream.getTracks().values())
			{
				//Get first free media
				let clonedMedia = medias[clonedTrack.getMedia()].pop();
				//If we don't have a free media
				if (!clonedMedia)
				{
					//Get associated media on us
					const media = this.getMedia(clonedTrack.getMedia());
					//Clone it
					clonedMedia = media.clone();
					//Set the mid to the stream id
					clonedMedia.setId(clonedTrack.getId());
					//Add media
					cloned.addMedia(clonedMedia);
				}
				//Set track media id
				clonedTrack.setMediaId(clonedMedia.getId());
			}
			//Push cloned stream
			cloned.addStream(clonedStream);
		}
		//For each candiadte
		for (let i=0;i<this.candidates.length;++i)
			//Push cloned candidate
			cloned.addCandidate(this.candidates[i].clone());
		//Clone ICE and DLTS
		cloned.setICE(this.ice.clone());
		cloned.setDTLS(this.dtls.clone());
		//Return cloned object
		return cloned;
		
	}

	/**
	 * Set SDP version
	 * @param {Number} version
	 */
	setVersion(version)
	{
		this.version = version;
	}

	/**
	 * Add a new media description information to this sdp info
	 * @param {MediaInfo} media
	 */
	addMedia(media)
	{
		//Store media
		this.medias.push(media);
	}

	/**
	 * Get first media description info associated to the media type
	 * @param {String} type - Media type ('audio'|'video')
	 * @returns {MediaInfo} or null if not found
	 */
	getMedia(type)
	{
		for (let i in this.medias)
		{
			let media = this.medias[i];
			if (media.getType().toLowerCase()===type.toLowerCase())
				return media;
		}
		return null;
	}

	/**
	 * Get all media description info associated to the media type
	 * @param {String} type - Media type ('audio'|'video')
	 * @returns {Array<MediaInfo>} or null if not found
	 */
	getMediasByType(type)
	{
		var medias = [];
		for (let i in this.medias)
		{
			let media = this.medias[i];
			if (media.getType().toLowerCase()===type.toLowerCase())
				medias.push(media);
		}
		return medias;
	}

	/**
	 * Get media description info associated by media Ide
	 * @param {String} msid - Media type ('audio'|'video')
	 * @returns {MediaInfo} or null if not found
	 */
	getMediaById(msid)
	{
		//For each media
		for (let i in this.medias)
		{
			//The media
			let media = this.medias[i];
			//Check if the same id
			if (media.getId().toLowerCase()===msid.toLowerCase())
				//Found
				return media;
		}
		//Not found
		return null;
	}
	
	/**
	 * Replace media with same id with the new one
	 * @param {MediaInfo} media - The new media
	 * @returns {boolean} true if the media was replaced, false if not found
	 */
	replaceMedia(media)
	{
		//For each media
		for (let i in this.medias)
		{
			//If it has the same id
			if (this.medias[i].getId()==media.getId())
			{
				//Change it
				this.medias[i] = media;
				//Found
				return true;
			}
		}
		//Not found
		return false;
	}

	/**
	 * Return all media description information
	 * @returns {Array<MediaInfo>}
	 */
	getMedias()
	{
		return this.medias;
	}

	/**
	 * Return SDP version attribute
	 * @returns {Number}
	 */
	getVersion()
	{
		return this.version;
	}

	/**
	 * Get DTLS info for the transport bundle
	 * @returns {DTLSInfo} DTLS info object
	 */
	getDTLS() {
		return this.dtls;
	}

	/**
	 * Set DTLS info object for the transport bundle
	 * @param {DTLSInfo}  dtlsInfo - DTLS info object
	 */
	setDTLS(dtlsInfo) {
		this.dtls = dtlsInfo;
	}

	/**
	 * Get the ICE info object for the transport bundle
	 * @returns {ICEInfo} ICE info object
	 */
	getICE() {
		return this.ice;
	}

	/**
	 * Set ICE info object for the transport bundle
	 * @param {ICEInfo} iceInfo - ICE info object
	 */
	setICE(iceInfo) {
		this.ice = iceInfo;
	}

	/**
	 * Add ICE candidate for transport
	 * @param {CandidateInfo} candidate - ICE candidate
	 */
	addCandidate(candidate) {
		//For each one
		for (let i=0;i<this.candidates.length;++i)
			//Check it is not already there
			if (this.candidates[i].equals(candidate))
				//Skip it
				return;
			
		//Check there is no same candidate
		this.candidates.push(candidate);
	}

	/**
	 * Add ICE candidates for transport
	 * @param {Array<{CandidateInfo>} candidates - ICE candidates
	 */
	addCandidates(candidates) {
		//For each one
		for (let i=0;i<candidates.length;++i)
			//Add candidate
			this.addCandidate(candidates[i]);
	}

	/**
	 * Get all ICE candidates for this transport
	 * @returns {Array<CandidateInfo>}
	 */
	getCandidates() {
		return this.candidates;
	}

	/**
	 * Get announced stream
	 * @param {String} id
	 * @returns {StreamInfo}
	 */
	getStream(id)
	{
		return this.streams.get(id);
	}

	/**
	 * Get all announced stream
	 * @returns {Array<StreamInfo>}
	 */
	getStreams()
	{
		return this.streams;
	}

	/**
	 * Get first announced stream
	 * @returns {StreamInfo}
	 */
	getFirstStream()
	{
		for (let stream of this.streams.values())
			return stream;
		return null;
	}

	/**
	 * Announce a new stream in SDP
	 * @param {StreamInfo} stream
	 */
	addStream(stream)
	{
		this.streams.set(stream.getId(), stream);
	}

	/**
	 * Remove an announced stream from SDP
	 * @param {StreamInfo} stream
	 * @returns {boolean}
	 */
	removeStream(stream)
	{
		return this.streams.delete(stream.getId());
	}
	
	/**
	 * Remove all streams
	 */
	removeAllStreams()
	{
		this.streams.clear();
	}
	
	/**
	 * 
	 * @param {String} mid Media Id
	 * @returns {TrackInfo| Track info
	 */
	getTrackByMediaId(mid)
	{
		for (let stream of this.streams.values())
			for (let [trackId,track] of stream.getTracks())
				if (track.getMediaId()==mid)
					return track;
		return null;
	}
	
	/**
	 * 
	 * @param {String} mid Media Id
	 * @returns {TrackInfo| Streaminfo
	 */
	getStreamByMediaId(mid)
	{
		for (let stream of this.streams.values())
			for (let [trackId,track] of stream.getTracks())
				if (track.getMediaId()==mid)
					return stream;
		return null;
	}
	
	
	/**
	 * Create answer to this SDP
	 * @param {Object} params		- Parameters to create ansser
	 * @param {ICEInfo} params.ice		- ICE info object
	 * @param {DTLSInfo} params.dtls	- DTLS info object
	 * @params{Array<CandidateInfo> params.candidates - Array of Ice candidates
	 * @param {Map<String,DTLSInfo} params.capabilites - Capabilities for each media type
	 * @returns {SDPInfo} answer
	 */
	answer(params) {
		//Create local SDP info
		const answer = new SDPInfo();

		//Add ice 
		if (params.ice)
		{
			if (params.ice instanceof ICEInfo)
				answer.setICE(params.ice.clone());
			else
				answer.setICE(ICEInfo.expand(params.ice));
		}
		//Add dtls
		if (params.dtls)
		{
			if (params.dtls instanceof DTLSInfo)
				answer.setDTLS(params.dtls);
			else
				answer.setDTLS(DTLSInfo.expand(params.dtls));
		}

		//Add candidates to media info
		for (let i = 0; params.candidates && i<params.candidates.length; ++i)
			if (params.candidates[i] instanceof CandidateInfo)
				answer.addCandidate(params.candidates[i].clone());
			else
				answer.addCandidate(CandidateInfo.expand(params.candidates[i]));

		//For each offered media
		for (let i in this.medias)
		{
			//Our media
			const media = this.medias[i];
			//The supported capabilities
			const supported = params && params.capabilities && params.capabilities[media.getType()];
			//Anser it
			answer.addMedia(media.answer(supported));
		}
		//Done
		return answer;
	}
	
	/**
	 * Convert to an SDP string
	 * @returns {String}
	 */
	toString()
	{
		//Create base SDP for transform
		let sdp =  {
			version : 0,
			media : []
		};

		//Set version
		sdp.version = 0;
		//Set origin
		sdp.origin =  {
			username	: "-",
			sessionId	: (new Date()).getTime(),
			sessionVersion	: this.version,
			netType		: "IN",
			ipVer		: 4,
			address		: "127.0.0.1"
		};

		//Set name
		sdp.name = "semantic-sdp";

		//Set connection info
		sdp.connection =  { version: 4, ip: '0.0.0.0' };
		//Set time
		sdp.timing = { start: 0, stop: 0 };

		//Check if it is ice lite
		if (this.getICE().isLite())
			//Add ice lite attribute
			sdp.icelite = "ice-lite";

		//Enable msids
		sdp.msidSemantic = { semantic : "WMS", token: "*"};
		//Create groups
		sdp.groups = [];

		//Bundle
		let bundle = {type : "BUNDLE", mids: []};

		//For each media
		for (let i in this.medias)
		{
			//Get media
			let media = this.medias[i];

			//Create new meida description with default values
			let  md = {
				type		: media.getType(),
				port		: 9,
				protocol	: 'UDP/TLS/RTP/SAVPF',
				fmtp		: [],
				rtp		: [],
				rtcpFb		: [],
				ext		: [],
				bandwidth	: [],
				candidates	: [],
				ssrcGroups	: [],
				ssrcs		: [],
				rids		: []
			};

			//Send and receive
			md.direction = Direction.toString(media.getDirection());

			//Enable rtcp muxing
			md.rtcpMux = "rtcp-mux";

			//Enable rtcp reduced size
			md.rtcpRsize = "rtcp-rsize";

			//Enable x-google-flag
			//md.addAttribute("x-google-flag","conference");

			//Set media id semantiv
			md.mid = media.getId();

			//Add to bundle
			bundle.mids.push(media.getId());

			//If present
			if (media.getBitrate()>0)
				//Add attribute
				md.bandwidth.push({
					type: "AS",
					limit: media.getBitrate()
				});

			//Get media candidates
			let candidates = this.getCandidates();
			//For each candidate
			for (let j=0; j<candidates.length; ++j)
			{
				//Get candidates
				let candidate = candidates[j];
				//Add host candidate for RTP
				md.candidates.push(
					{
						foundation	: candidate.getFoundation(),
						component	: candidate.getComponentId(),
						transport	: candidate.getTransport(),
						priority	: candidate.getPriority(),
						ip		: candidate.getAddress(),
						port		: candidate.getPort(),
						type		: candidate.getType(),
						raddr		: candidate.getRelAddr(),
						rport		: candidate.getRelPort()
					});
			}

			//Set ICE credentials
			md.iceUfrag = this.getICE().getUfrag();
			md.icePwd   = this.getICE().getPwd();

			//Add fingerprint attribute
			md.fingerprint = {
				type : this.getDTLS().getHash(),
				hash :  this.getDTLS().getFingerprint()
			};

			//Add setup atttribute
			md.setup = Setup.toString(this.getDTLS().getSetup());

			//for each codec one
			for(let codec of media.getCodecs().values())
			{
				//Only for video
				if ("video" === media.getType().toLowerCase())
				{
					//Add rtmpmap
					md.rtp.push({
						payload	: codec.getType(),
						codec	: codec.getCodec().toUpperCase(),
						rate	: 90000
					});
				} else {
					//Check codec
					if ("opus" === codec.getCodec().toLowerCase())
						//Add rtmpmap
						md.rtp.push({
							payload	: codec.getType(),
							codec	: codec.getCodec(),
							rate	: 48000,
							encoding: 2
						});
					else
						//Add rtmpmap
						md.rtp.push({
							payload	: codec.getType(),
							codec	: codec.getCodec(),
							rate	: 8000
						});
				}
				//For each rtcp fb
				for (const rtcpfb of codec.getRTCPFeedbacks())
					//Add it
					md.rtcpFb.push({ payload:  codec.getType(), type: rtcpfb.getId() , subtype: rtcpfb.getParams().join(" ")});

				//If it has rtx
				if (codec.hasRTX())
				{
					//Add it also
					md.rtp.push({
						payload	: codec.getRTX(),
						codec	: "rtx",
						rate	: 90000
					});
					//Add apt
					md.fmtp.push({
						payload	: codec.getRTX(),
						config  : "apt="+codec.getType()
					});
				}
				//Get codec params
				const params = codec.getParams();

				//If it has params
				if (Object.keys(params).length)
				{
					//Create ftmp attribute
					const fmtp = {
						payload : codec.getType(),
						config  : ""
					};

					//Add params
					for (const k in params)
					{
						//Add separator
						if (fmtp.config.length)
							fmtp.config += ";";
						//If key+val
						if (params.hasOwnProperty(k))
							//Add config
							fmtp.config += k + "=" + params[k];
						else
							//Add config
							fmtp.config += k;
					}
					//Add it
					md.fmtp.push(fmtp);
				}
			}
			//Create the payload array
			const payloads = [];

			//For each codec
			for (let j=0; j<md.rtp.length; ++j)
				//Push payload type
				payloads.push(md.rtp[j].payload);

			//Set it on description
			md.payloads = payloads.join(" ");

			//For each extension
			for (let [id,uri] of media.getExtensions().entries())
				//Add new extension attribute
				md.ext.push({
					value : id,
					uri   : uri
				});

			//Process rids now
			for (let ridInfo of media.getRIDs().values())
			{
				//Create object
				let rid = {
					id		: ridInfo.getId(),
					direction	: DirectionWay.toString (ridInfo.getDirection()),
					params		: ""
				};
				//Check if it has formats
				if (ridInfo.getFormats().length)
					rid.params = "pt=" +ridInfo.getFormats().join(',');
				//For each format
				for (let [key,val] of ridInfo.getParams().entries())
					//Add it
					rid.params += (rid.params.length ? ";" : "") + key + "=" +val;

				//Push back
				md.rids.push(rid);
			}

			//Get simulcast info
			const simulcast = media.getSimulcast();
			//If it has simulcast info
			if (simulcast)
			{
				let index = 1;
				//Create simulcast attribute
				md.simulcast = {};
				//Get send streams
				const send = simulcast.getSimulcastStreams(DirectionWay.SEND);
				const recv = simulcast.getSimulcastStreams(DirectionWay.RECV);

				//Check if we have send streams
				if (send && send.length)
				{
					let list = "";
					//Create list
					for (let j=0;j<send.length;++j)
					{
						//Create list
						let alternatives = "";
						//For each alternative
						for (let k=0;k<send[j].length;++k)
							//Add it
							alternatives += (alternatives.length ? "," : "") + (send[j][k].isPaused() ? "~" : "") + send[j][k].getId();
						//Add stream alternatives
						list += (list.length ? ";" : "") + alternatives;
					}
					//Set attributes
					md.simulcast["dir" +index] = "send";
					md.simulcast["list"+index] = list;
					//Inc index
					index++;
				}

				//Check if we have rec sreams
				if (recv && recv.length)
				{
					let list = [];
					//Create list
					for (let j=0;j<recv.length;++j)
					{
						//Create list
						let alternatives = "";
						//For each alternative
						for (let k=0;k<recv[j].length;++k)
							//Add it
							alternatives += (alternatives.length ? "," : "") + (recv[j][k].isPaused() ? "~" : "") + recv[j][k].getId();
						//Add stream alternatives
						list += (list.length ? ";" : "") + alternatives;
					}
					//Set attributes
					md.simulcast["dir" +index] = "recv";
					md.simulcast["list"+index] = list;
					//Inc index
					index++;
				}
			}

			//add media description
			sdp.media.push(md);
		}

		//Process streams now
		for (let stream of this.streams.values())
		{
			//For each track
			for (let track of stream.getTracks().values())
			{
				//Get media
				for (let i in sdp.media)
				{
					//Get media description
					let md = sdp.media[i];

					//Check if it is unified or plan B
					if (track.getMediaId())
					{
						//Unified, check if it is bounded to an specific line
						if ( track.getMediaId()==md.mid)
						{
							//Get groups
							let groups = track.getSourceGroups()

							//For each group
							for (let j in groups)
							{
								//Get group
								let group = groups[j];

								//Add ssrc group
								md.ssrcGroups.push({
									semantics	: group.getSemantics(),
									ssrcs		: group.getSSRCs().join(" ")
								});
							}

							//Get ssrcs for that group
							let ssrcs = track.getSSRCs();

							//for each one
							for (let j in ssrcs)
							{
								//Add ssrc info
								md.ssrcs.push({
									id		: ssrcs[j],
									attribute	: "cname",
									value		: stream.getId()
								});
								md.ssrcs.push({
									id		: ssrcs[j],
									attribute	: "msid",
									value		: stream.getId() + " " + track.getId()
								});
							}
							//Add msid
							md.msid = stream.getId() + " " + track.getId();
							//Done
							break;
						}
					}
					//Plan B, check if it is same type
					else  if (md.type.toLowerCase() === track.getMedia().toLowerCase())
					{
						//Get groups
						let groups = track.getSourceGroups()

						//For each group
						for (let j in groups)
						{
							//Get group
							let group = groups[j];

							//Add ssrc group
							md.ssrcGroups.push({
								semantics	: group.getSemantics(),
								ssrcs		: group.getSSRCs().join(" ")
							});
						}

						//Get ssrcs for that group
						let ssrcs = track.getSSRCs();

						//for each one
						for (let j in ssrcs)
						{
							//Add ssrc info
							md.ssrcs.push({
								id		: ssrcs[j],
								attribute	: "cname",
								value		: stream.getId()
							});
							md.ssrcs.push({
								id		: ssrcs[j],
								attribute	: "msid",
								value		: stream.getId() + " " + track.getId()
							});
						}
						//Done
						break;
					}
				}
			}
		}

		//Compress
		bundle.mids = bundle.mids.join(" ");

		//Add bundle
		sdp.groups.push(bundle);

		//Convert to string
		return SDPTransform.write(sdp);
	}
}
/**
* Create sdp based on the following info
* @param {Object} params		- Parameters to create ansser
* @param {ICEInfo|Object} params.ice		- ICE info object
* @param {DTLSInfo|Object} params.dtls	- DTLS info object
* @params{Array<CandidateInfo> params.candidates - Array of Ice candidates
* @param {Map<String,DTLSInfo} params.capabilites - Capabilities for each media type
* @returns {SDPInfo} answer
*/
SDPInfo.create = function(params) 
{
	//Create local SDP info
	const sdp = new SDPInfo();

	//Add ice 
	if (params.ice)
	{
		if (params.ice instanceof ICEInfo)
			sdp.setICE(params.ice.clone());
		else
			sdp.setICE(ICEInfo.expand(params.ice));
	}
	//Add dtls
	if (params.dtls)
	{
		if (params.dtls instanceof DTLSInfo)
			sdp.setDTLS(params.dtls);
		else
			sdp.setDTLS(DTLSInfo.expand(params.dtls));
	}

	//Add candidates to media info
	for (let i = 0; params.candidates && i<params.candidates.length; ++i)
		if (params.candidates[i] instanceof CandidateInfo)
			sdp.addCandidate(params.candidates[i].clone());
		else
			sdp.addCandidate(CandidateInfo.expand(params.candidates[i]));

	//Fix dynamic payload types for bundle
	let dyn = 96;
	
	//For each supported media type
	for (let i in params.capabilities)
	{
		//Create media
		const media = MediaInfo.create(i,params.capabilities[i]);
		
		//For each codec
		for (const [codecId,codec] of media.getCodecs())
		{
			//Check if it is dynamic
			if (codec.getType()>=96)
				//Update it
				codec.setType(dyn++);
			//If it has rtx
			if (codec.getRTX())
				//Update it too
				codec.setRTX(dyn++);
			
		}
		
		//Create info object and add media
		sdp.addMedia(media);
	}
	
	//Done
	return sdp;
};
	
/**
 * Expands a plain JSON object containing an SDP INFO
 * @param {Object} plain JSON object
 * @returns {SDPInfo} Parsed SDP info
 */
SDPInfo.expand = function(plain)
{
	//Create sdp info object
	const sdpInfo = new SDPInfo(plain.version);

	//For each media
	for (let i=0;plain.medias && i<plain.medias.length;++i)
	{
		//Expand media
		const mediaInfo = MediaInfo.expand(plain.medias[i]);
		//If ok
		if (mediaInfo)
			//Push it
			sdpInfo.addMedia(mediaInfo);
	}
	//For each stream
	for (let i=0;plain.streams && i<plain.streams.length;++i)
	{
		//Expand stream
		const streamInfo = StreamInfo.expand(plain.streams[i]);
		//If ok
		if (streamInfo)
			//Push it
			sdpInfo.addStream(streamInfo);
	}

	//For each candiadte
	for (let i=0;plain.candidates && i<plain.candidates.length;++i)
	{
		//Expand candidate info
		const candidateInfo = CandidateInfo.expand(plain.candidates[i]);
		//If ok
		if (candidateInfo)
			//Push it
			sdpInfo.addCandidate(candidateInfo);
	}
	//Add ICE and DLTS
	if (plain.ice)
		sdpInfo.setICE(ICEInfo.expand(plain.ice));
	if (plain.dtls)
		sdpInfo.setDTLS(DTLSInfo.expand(plain.dtls));
	//Return expanded object
	return sdpInfo;
};

/**
 * Process an SDP string and convert it to a semantic SDP info
 * @deprecated Use SDPInfo.parse instead
 * @param {String} string SDP
 * @returns {SDPInfo} Parsed SDP info
 */
SDPInfo.process = function(string)
{
	return SDPInfo.parse(string);
};

/**
 * Parses an SDP string and convert it to a semantic SDP info
 * @param {String} string SDP
 * @returns {SDPInfo} Parsed SDP info
 */
SDPInfo.parse = function(string)
{
	//Parse SDP
	const sdp = SDPTransform.parse(string);
	
 	//Create sdp info object
	const sdpInfo = new SDPInfo();

	//Set version
	sdpInfo.setVersion(sdp.version);

	//For each media description
	for (let i in sdp.media)
	{
		//Get media description
		const md = sdp.media[i];

		//Get media type
		const media = md.type;

		//And media id
		const mid = md.mid.toString();

		//Create media info
		const mediaInfo = new MediaInfo(mid,media);

		//Get ICE info
		const ufrag = md.iceUfrag;
		const pwd = md.icePwd;

		//Create iceInfo
		sdpInfo.setICE(new ICEInfo(ufrag,pwd));
		
		//Check cnadidates
		for (let j=0; md.candidates && j<md.candidates.length; ++j)
		{
			//Get candidate
			const candidate = md.candidates[j];
			//Create new candidate
			const candidateInfo = new  CandidateInfo(
				candidate.foundation,
				candidate.component,
				candidate.transport,
				candidate.priority,
				candidate.ip,
				candidate.port,
				candidate.type,
				candidate.raddr,
				candidate.rport
			);
			//Add it
			sdpInfo.addCandidate(candidateInfo);
		}

		//Check media fingerprint attribute or the global one
		const fingerprintAttr = md.fingerprint || sdp.fingerprint;

		//Get remote fingerprint and hash function
		const remoteHash        = fingerprintAttr.type;
		const remoteFingerprint = fingerprintAttr.hash;

		//Set deault setup
		let setup = Setup.ACTPASS;

		//Check setup attribute
		if (md.setup)
			//Set it
			setup = Setup.byValue(md.setup);

		//Create new DTLS info
		sdpInfo.setDTLS(new DTLSInfo(setup,remoteHash,remoteFingerprint));

		//Media direction
		let direction = Direction.SENDRECV;

		//Check setup attribute
		if (md.direction)
			//Set it
			direction = Direction.byValue(md.direction);

		//Set direction
		mediaInfo.setDirection(direction);

		//Store RTX apts so we can associate them later
		const apts = new Map();

		//For each format
		for (let j in md.rtp)
		{
			//Get format
			const fmt = md.rtp[j];

			//Get codec and type
			const type  = fmt.payload;
			const codec = fmt.codec;

			//If it is RED or ULPFEC
			if ("RED" === codec.toUpperCase() || "ULPFEC" === codec.toUpperCase())
				//FUCK YOU!!!
				continue;

			//Get format parameters
			let params = {};

			//Does it has config
			for (let k in md.fmtp)
			{
				//Get format
				const fmtp = md.fmtp[k];

				//If it is this one
				if (fmtp.payload === type)
				{
					//Get list parameters
					const list = fmtp.config.split(";");
					//Parse them
					for(let k in list)
					{
						//Parse param
						const param = list[k].split("=");
						//Append param
						params[param[0].trim()] = (param[1] || "").trim();
					}
				}
			}
			//If it is RTX
			if ("RTX" === codec.toUpperCase())
				//Store atp
				apts.set(parseInt(params.apt),type);
			else
				//Create codec
				mediaInfo.addCodec(new CodecInfo(codec,type,params));
		}

		//Set the rtx
		for (let apt of apts.entries())
		{
			//Get codec
			const codecInfo = mediaInfo.getCodecForType(apt[0]);
			//IF it was not red
			if (codecInfo)
				//Set rtx codec
				codecInfo.setRTX(apt[1]);
		}
		
		//Set rtcpfs
		for (let j=0; md.rtcpFb && j<md.rtcpFb.length;++j)
		{
			//Get codec
			const codecInfo = mediaInfo.getCodecForType(md.rtcpFb[j].payload);
			//IF found
			if (codecInfo)
			{
				//Get params
				const id = md.rtcpFb[j].type;
				const params = md.rtcpFb[j].subtype ? md.rtcpFb[j].subtype.split(" ") : null;
				//Set rtx codec
				codecInfo.addRTCPFeedback( new RTCPFeedbackInfo(id, params));
			}
		}

		//Get extmap atrributes
		const extmaps = md.ext;
		//For each one
		for (let j in extmaps)
		{
			//Get map
			const extmap = extmaps[j];
			//Add it
			mediaInfo.addExtension(extmap.value,extmap.uri);
		}

		//Get rid atrributes
		const rids = md.rids;
		//For each one
		for (let j in rids)
		{
			//Get map
			const rid = rids[j];
			//Crate info
			const ridInfo = new RIDInfo(rid.id,DirectionWay.byValue(rid.direction));
			//Create format info and param map
			let formats = [];
			const params = new Map();
			//If it has params
			if (rid.params)
			{
				//Process formats and params
				const list = SDPTransform.parseParams(rid.params);
				//For each rid param
				for (let k in list)
					//Check type
					if (k==='pt')
						//Get formats
						formats = list[k].split(',');
					else
						//Add it to params
						params.set(k,list[k]);
				//Add formats and params
				ridInfo.setFormats(formats);
				ridInfo.setParams(params);
			}
			//Add rid info
			mediaInfo.addRID(ridInfo);
		}

		//Get sending encodings
		const encodings = [];

		//Check if it has simulcast info
		if (md.simulcast)
		{
			//Create simulcast object
			const simulcast = new SimulcastInfo();

			//Check dir1 attr
			if (md.simulcast.dir1)
			{
				//Get direction
				const direction = DirectionWay.byValue (md.simulcast.dir1);
				//Parse simulcast streamlist
				const list = SDPTransform.parseSimulcastStreamList(md.simulcast.list1);
				//for each alternative stream set
				for (let j=0; j<list.length; ++j)
				{
					//Create the list of alternatie streams
					const alternatives = [];
					//For each alternative
					for (let k=0; k<list[j].length; ++k)
						//Push new alternative stream
						alternatives.push(new SimulcastStreamInfo(list[j][k].scid, list[j][k].paused));
					//Add alternative
					simulcast.addSimulcastAlternativeStreams(direction, alternatives);
				}
			}
			//Check dir2 attr
			if (md.simulcast.dir2)
			{
				//Get direction
				const direction = DirectionWay.byValue (md.simulcast.dir2);
				//Parse simulcast streamlist
				const list = SDPTransform.parseSimulcastStreamList(md.simulcast.list2);
				//for each alternative stream set
				for (let j=0; j<list.length; ++j)
				{
					//Create the list of alternatie streams
					const alternatives = [];
					//For each alternative
					for (let k=0; k<list[j].length; ++k)
						//Push new alternative stream
						alternatives.push(new SimulcastStreamInfo(list[j][k].scid, list[j][k].paused));
					//Add alternative
					simulcast.addSimulcastAlternativeStreams(direction, alternatives);
				}
			}

			//For all sending encodings
			for (let streams of simulcast.getSimulcastStreams(DirectionWay.SEND))
			{
				//Create encoding alternatives
				const alternatives = [];
				//for all rid info
				for (let j=0; j<streams.length; j++)
				{
					//Create new encoding
					const encoding = new TrackEncodingInfo(streams[j].getId(),streams[j].isPaused());
					//Get the rid info for that
					const ridInfo = mediaInfo.getRID(encoding.getId());
					//If found
					if (ridInfo)
					{
						//Get associated payloads, jic
						const formats = ridInfo.getFormats();
						//If it had formats associated
						for (let k=0; formats && k<formats.length; ++k)
						{
							//Get codec info
							const codecInfo = mediaInfo.getCodecForType(formats[k]);
							//If found
							if (codecInfo)
								//Set into encoding
								encoding.addCodec(codecInfo);
						}
						//Add them
						encoding.setParams(ridInfo.getParams());
						//Push it
						alternatives.push(encoding);
					}
				}
				//If any
				if (alternatives.length)
					//Add it
					encodings.push(alternatives);
			}

			//Add it
			mediaInfo.setSimulcast(simulcast);
		}

		//Temporal source list
		const sources = new Map();
		
		//Doubel check
		if (md.ssrcs)
		{
			//Get all ssrcs
			for (let j in md.ssrcs)
			{
				//Get attribute
				let ssrcAttr = md.ssrcs[j];
				//Get data
				let ssrc  = ssrcAttr.id;
				let key   = ssrcAttr.attribute;
				let value = ssrcAttr.value;
				//Try to get it
				let source = sources.get(ssrc);
				//If we dont have ssrc yet
				if (!source)
				{
					//Create one
					source = new SourceInfo(ssrc);
					//Add it
					sources.set(source.getSSRC(),source);
				}
				//Check key
				if ("cname" === key.toLowerCase())
				{
					//Set it
					source.setCName(value);
				} else if ("msid" === key.toLowerCase()) {
					//Split
					let ids = value.split(" ");
					//Get stream and track ids
					let streamId = ids[0];
					let trackId  = ids[1];
					//Set ids
					source.setStreamId(streamId);
					source.setTrackId(trackId);
					//Get stream
					let stream = sdpInfo.getStream(streamId);
					//Check if the media stream exists
					if (!stream)
					{
						//Create one
						stream = new StreamInfo(streamId);
						//Append
						sdpInfo.addStream(stream);
					}
					//Get track
					let track = stream.getTrack(trackId);
					//If not found
					if (!track)
					{
						//Create track
						track = new TrackInfo(media,trackId);
						//Set the media id
						track.setMediaId(mid);
						//Set simulcast encodings (if any)
						track.setEncodings(encodings);
						//Append to stream
						stream.addTrack(track);
					}
					//Add ssrc
					track.addSSRC(ssrc);
					//We have found msid
					msid = streamId;
				}
			}
		}
		
		//Check if ther is a global msid
		if (md.msid)
		{
			//Split
			let ids = md.msid.split(" ");
			//Get stream and track ids
			let streamId = ids[0];
			let trackId  = ids[1];

			//Get stream
			let stream = sdpInfo.getStream(streamId);
			//Check if the media stream exists
			if (!stream)
			{
				//Create one
				stream = new StreamInfo(streamId);
				//Append
				sdpInfo.addStream(stream);
			}
			//Get track
			let track = stream.getTrack(trackId);
			//If not found
			if (!track)
			{
				//Create track
				track = new TrackInfo(media,trackId);
				//Set the media id
				track.setMediaId(mid);
				//Set encodings (if any)
				track.setEncodings(encodings);
				//Append to stream
				stream.addTrack(track);
			}

			//For each ssrc
			for (let [ssrc,source] of sources.entries())
			{
				//If it was not overrideng
				if (!source.getStreamId())
				{
					//Set ids
					source.setStreamId(streamId);
					source.setTrackId(trackId);
					//Add ssrc
					track.addSSRC(ssrc);
				}
			}
		}
		
		//Check if we need we are in unified plan
		for (let [ssrc,source] of sources.entries())
		{
			//If it was assigned to any stream
			if (!source.getStreamId())
			{
				//Get stream from cname and track from media mid
				let streamId = source.getCName();
				let trackId  = mid;
				//Set ids
				source.setStreamId(streamId);
				source.setTrackId(trackId);
				//Get stream
				let stream = sdpInfo.getStream(streamId);
				//Check if the media stream exists
				if (!stream)
				{
					//Create one
					stream = new StreamInfo(streamId);
					//Append
					sdpInfo.addStream(stream);
				}
				//Get track
				let track = stream.getTrack(trackId);
				//If not found
				if (!track)
				{
					//Create track
					track = new TrackInfo(media,trackId);
					//Set the media id
					track.setMediaId(mid);
					//Set simulcast encodings (if any)
					track.setEncodings(encodings);
					//Append to stream
					stream.addTrack(track);
				}
				//Add ssrc
				track.addSSRC(ssrc);
			}
		}

		//Double check
		if (md.ssrcGroups)
		{
			//Get all groups
			for (let j in md.ssrcGroups)
			{
				//Get ssrc group info
				let ssrcGroupAttr = md.ssrcGroups[j];

				//Get ssrcs
				let ssrcs = ssrcGroupAttr.ssrcs.split(" ");

				//Create new group
				let group = new SourceGroupInfo(ssrcGroupAttr.semantics,ssrcs);

				//Get media track for ssrc
				let source = sources.get(parseInt(ssrcs[0]));
				//Add group to track
				sdpInfo
				    .getStream(source.getStreamId())
				    .getTrack(source.getTrackId())
				    .addSourceGroup(group);
			}
		}
		//Append media
		sdpInfo.addMedia(mediaInfo);
	}
	return sdpInfo;
};

module.exports = SDPInfo;

},{"./CandidateInfo":8,"./CodecInfo":9,"./DTLSInfo":10,"./Direction":11,"./DirectionWay":12,"./ICEInfo":14,"./MediaInfo":15,"./RIDInfo":16,"./RTCPFeedbackInfo":17,"./Setup":19,"./SimulcastInfo":20,"./SimulcastStreamInfo":21,"./SourceGroupInfo":22,"./SourceInfo":23,"./StreamInfo":24,"./TrackEncodingInfo":25,"./TrackInfo":26,"sdp-transform":29}],19:[function(require,module,exports){
const Enum = require("./Enum");
/**
 * Enum for Setup values.
 * @readonly
 * @enum {number}
 */
const Setup = Enum("ACTIVE","PASSIVE","ACTPASS","INACTIVE");

/**
 * Get Setup by name
 * @memberOf Setup
 * @param {string} setup
 * @returns {Setup}
 */
Setup.byValue = function(setup)
{
	//Check if it is already a symbol
	switch(setup)
	{
		case Setup.ACTIVE:
		case Setup.PASSIVE:
		case Setup.ACTPASS:
		case Setup.INACTIVE:
			return setup;
	}
	//Convert from string
	return Setup[setup.toUpperCase()];
};

/**
 * Get Setup name
 * @memberOf Setup
 * @param {Setup} setup
 * @returns {String}
 */
Setup.toString = function(setup)
{
	switch(setup)
	{
		case Setup.ACTIVE:
			return "active";
		case Setup.PASSIVE:
			return "passive";
		case Setup.ACTPASS:
			return "actpass";
		case Setup.INACTIVE:
			return "inactive";
	}
};

/**
 * Get reverse Setup
 * @memberOf Setup
 * @param {Setup} setup
 * @returns {Setup}
 */
Setup.reverse = function(setup)
{
	switch(setup)
	{
		case Setup.ACTIVE:
			return Setup.PASSIVE;
		case Setup.PASSIVE:
			return Setup.ACTIVE;
		case Setup.ACTPASS:
			return Setup.PASSIVE;
		case Setup.INACTIVE:
			return Setup.INACTIVE;
	}
};

module.exports = Setup;
},{"./Enum":13}],20:[function(require,module,exports){
const SimulcastStreamInfo	= require("./SimulcastStreamInfo");
const DirectionWay		= require("./DirectionWay");
/**
 * Simulcast information
 * @namespace
 */
class SimulcastInfo
{
	/**
	 * @constructor
	 * @alias SimulcastInfo
	 * @returns {SimulcastInfo}
	 */
	constructor() {
		this.send	= [];
		this.recv	= [];
	}

	/**
	 * Create a clone of this track info object
	 * @returns {SimulcastInfo}
	 */
	clone() {
		//Clone
		const cloned =  new SimulcastInfo();
		//For each sending streams
		for (let i=0;i<this.send.length;++i)
		{
			let alternatives = [];
			//For each alternative
			for (let j=0;i<this.send[j].length;++i)
				//Add sream info
				alternatives.push(this.send[i][j].clone());
			//Push it
			cloned.addSimulcastAlternativeStreams(DirectionWay.SEND,alternatives);
		}
		//For each receiving streams
		for (let i=0;i<this.recv.length;++i)
		{
			let alternatives = [];
			//For each alternative
			for (let j=0;i<this.recv[j].length;++i)
				//Add sream info
				alternatives.push(this.recv[i][j].clone());
			//Push it
			cloned.addSimulcastAlternativeStreams(DirectionWay.RECV,alternatives);
		}
		//Return it
		return cloned;
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		const plain = {
			send : [],
			recv : []
		};
		//For each sending streams
		for (let i=0;i<this.send.length;++i)
		{
			let alternatives = [];
			//For each alternative
			for (let j=0;j<this.send[i].length;++j)
				//Add sream info
				alternatives.push(this.send[i][j].plain());
			//Push it
			plain.send.push(alternatives);
		}
		//For each receiving streams
		for (let i=0;i<this.recv.length;++i)
		{
			let alternatives = [];
			//For each alternative
			for (let j=0;j<this.recv[i].length;++j)
				//Add sream info
				alternatives.push(this.recv[i][j].plain());
			//Push it
			plain.recv.push(alternatives);
		}
		//Return it
		return plain;
	}

	/**
	 * Add a simulcast alternative streams for the specific direction
	 * @param {DirectionWay} direction - Which direction you want the streams for
	 * @param {Array<SimulcastStreamInfo>} streams - Stream info of all the alternatives
	 */
	addSimulcastAlternativeStreams(direction,streams) {
		if (direction===DirectionWay.SEND)
			return this.send.push(streams);
		else
			return this.recv.push(streams);
	}

	/**
	 * Add a single simulcast stream for the specific direction
	 * @param {DirectionWay} direction - Which direction you want the streams for
	 * @param {Array<SimulcastStreamInfo>} stream - Stream info of all the alternatives
	 */
	addSimulcastStream(direction,stream) {
		if (direction===DirectionWay.SEND)
			//Push an array of single stream
			return this.send.push([stream]);
		else
			//Push an array of single stream
			return this.recv.push([stream]);
	}

	/**
	 * Get all simulcast streams by direction
	 * @param {DirectionWay} direction - Which direction you want the streams for
	 * @returns {Array<Array<SimulcastStreamInfo>>}
	 */
	getSimulcastStreams(direction) {
		if (direction===DirectionWay.SEND)
			return this.send;
		else
			return this.recv;
	}
}

/**
 * Expands a plain JSON object containing an SimulcastInfo
 * @param {Object} plain JSON object
 * @returns {SimulcastInfo} Parsed Simulcast info
 */
SimulcastInfo.expand = function(plain)
{
	//Create new
	const simulcastInfo = new SimulcastInfo();

	//For each sending streams
	for (let i=0;i<plain.send.length;++i)
	{
		let alternatives = [];
		//For each alternative
		for (let j=0;j<plain.send[i].length;++j)
			//Add sream info
			alternatives.push(SimulcastStreamInfo.expand(plain.send[i][j]));
		//Push it
		simulcastInfo.addSimulcastAlternativeStreams(DirectionWay.SEND, alternatives);
	}
	//For each receiving streams
	for (let i=0;i<plain.recv.length;++i)
	{
		let alternatives = [];
		//For each alternative
		for (let j=0;j<plain.recv[i].length;++j)
			//Add sream info
			alternatives.push(SimulcastStreamInfo.expand(plain.recv[i][j]));
		//Push it
		simulcastInfo.addSimulcastAlternativeStreams(DirectionWay.RECV, alternatives);
	}

	//Done
	return simulcastInfo;
};

module.exports = SimulcastInfo;
},{"./DirectionWay":12,"./SimulcastStreamInfo":21}],21:[function(require,module,exports){

/**
 * Simulcast streams info
 * @namespace
 */
class SimulcastStreamInfo {
	/**
	 * @constructor
	 * @alias SimulcastStreamInfo
	 * @param {String} id		- rid for this simulcast stream
	 * @param {Boolean} paused	- If this stream is initially paused
	 * @returns {SimulcastStreamInfo}
	 */
	 constructor(id,paused) {
		this.paused = paused;
		this.id = id;
	}

	/**
	 * Create a clone of this simulcast stream info object
	 * @returns {SimulcastStreamInfo}
	 */
	clone() {
		//Clone
		return  new SimulcastStreamInfo(this.id, this.paused);
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		return {
			id	: this.id,
			paused	: this.paused
		};
	}

	/**
	 * Is the stream paused
	 * @returns {Boolean}
	 */
	isPaused() {
		return this.paused;
	}

	/**
	 * Get rid in this stream
	 * @returns {String}
	 */
	getId() {
		return this.id;
	}
}

/**
 * Expands a plain JSON object containing an SimulcastStreamInfo
 * @param {Object} plain JSON object
 * @returns {SimulcastStreamInfo} Parsed SimulcastStream info
 */
SimulcastStreamInfo.expand = function(plain)
{
	//Create new
	return new SimulcastStreamInfo(
		plain.id,
		plain.paused
	);
};

module.exports = SimulcastStreamInfo;
},{}],22:[function(require,module,exports){

/**
 * Group of SSRCS info
 * @namespace
 */
class SourceGroupInfo {
	/**
	 * @constructor
	 * @alias SourceGroupInfo
	 * @alias SourceGroupInfo
	 * @param {String} semantics	- Group semantics
	 * @param {Array<Number>} ssrcs	- SSRC list
	 * @returns {SourceGroupInfo}
	 */
	 constructor(semantics, ssrcs) {
		this.semantics = semantics;
		this.ssrcs = [];
		//Populte
		for (let i=0; i<ssrcs.length; ++i)
			this.ssrcs.push(parseInt(ssrcs[i]));
	}

	/**
	 * Create a clone of this source group info object
	 * @returns {SourceGroupInfo}
	 */
	clone() {
		//Clone
		return  new SourceGroupInfo(this.semantics,this.ssrcs);
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		const plain = {
			semantics	: this.semantics,
			ssrcs		: []
		};
		//Gor each ssrc
		for (let i=0;i<this.ssrcs.length;++i)
			//Add ssrc
			plain.ssrcs.push(this.ssrcs[i]);
		//Return it
		return plain;
	}

	/**
	 * Get group semantics
	 * @returns {String}
	 */
	getSemantics() {
		return this.semantics;
	}

	/**
	 * Get list of ssrcs from this group
	 * @returns {Array<Number>}
	 */
	getSSRCs() {
		return this.ssrcs;
	}
}

/**
 * Expands a plain JSON object containing an SourceGroupInfo
 * @param {Object} plain JSON object
 * @returns {SourceGroupInfo} Parsed SourceGroup info
 */
SourceGroupInfo.expand = function(plain)
{
	//Create new
	return new SourceGroupInfo(
		plain.semantics,
		plain.ssrcs
	);
};

module.exports = SourceGroupInfo;
},{}],23:[function(require,module,exports){
/**
 * Strem Source information
 * @namespace
 */
class SourceInfo {
	/**
	 * @constructor
	 * @alias SourceInfo
	 * @param {Number} ssrc
	 * @returns {SourceInfo}
	 */
	constructor(ssrc) {
		this.ssrc = ssrc;
	}

	/**
	 * Create a clone of this source info object
	 * @returns {SourceInfo}
	 */
	clone() {
		//Clone
		const clone = new SourceInfo(this.ssrc);
		//Set properties
		clone.setCName(this.cname);
		clone.setStreamId(this.streamId);
		clone.setTrackId(this.trackId);
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		const plain = {
			ssrc	: this.ssrc
		};
		//Set properties
		if (this.cname)		plain.cname = this.cname;
		if (this.streamId)	plain.streamId = this.streamId;
		if (this.trackId)	plain.trackid = this.trackId;
		//return plain object
		return plain;
	}
	/**
	 * Get source CName
	 * @returns {String}
	 */
	getCName() {
		return this.cname;
	}

	/**
	 * Set source CName
	 * @param {String} cname
	 */
	setCName(cname) {
		this.cname = cname;
	}

	/**
	 * Get associated stream id
	 * @returns {Number}
	 */
	getStreamId() {
		return this.streamId;
	}

	/**
	 * Set associated stream id for this ssrc
	 * @param {String} streamId
	 */
	setStreamId(streamId) {
		this.streamId = streamId;
	}

	/**
	 * Get associated track id
	 * @returns {Number}
	 */
	getTrackId() {
		return this.trackId;
	}

	/**
	 * Set associated track id for this ssrc
	 * @param {String} trackId
	 */
	setTrackId(trackId) {
		this.trackId = trackId;
	}

	/**
	 * Get ssrc from source
	 * @returns {Number}
	 */
	getSSRC() {
		return this.ssrc;
	}

}

/**
 * Expands a plain JSON object containing an SourceInfo
 * @param {Object} plain JSON object
 * @returns {SourceInfo} Parsed Source info
 */
SourceInfo.expand = function(plain)
{
	//create new
	const sourceInfo = new SourceInfo(plain.ssrc);
	//Set properties
	sourceInfo.setCName(plain.cname);
	sourceInfo.setStreamId(plain.streamId);
	sourceInfo.setTrackId(plain.trackId);

	//Done
	return sourceInfo;
};


module.exports = SourceInfo;
},{}],24:[function(require,module,exports){
const TrackInfo = require("./TrackInfo");
/**
 * Media Stream information
 * @namespace
 */
class StreamInfo {

	/**
	 * @constructor
	 * @alias StreamInfo
	 * @param {String} id
	 * @returns {StreamInfo}
	 */
	constructor(id) {
		this.id = id;
		this.tracks = new Map();
	}

	/**
	 * Create a clone of this stream info object
	 * @returns {StreamInfo}
	 */
	clone() {
		//Clone
		const cloned = new StreamInfo(this.id);
		//For each track
		for (const track of this.tracks.values())
			//Add track
			cloned.addTrack(track.clone());
		//Return cloned object
		return cloned;
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		const plain = {
			id	: this.id,
			tracks	: []
		};
		//For each track
		for (const track of this.tracks.values())
			//Add track
			plain.tracks.push(track.plain());
		//return plain object
		return plain;

	}
	/**
	 * Get the media stream id
	 * @returns {String}
	 */
	getId() {
		return this.id;
	}

	/**
	 * Add media track
	 * @param {TrackInfo} track
	 */
	addTrack(track) {
		this.tracks.set(track.getId(),track);
	}

	/*
	 * Remove a media track from stream
	 * @param {TrackInfo} trackInfo - Info object from the track
	 * @returns {TrackInfo} if the track was present on track map or not
	 */
	removeTrack(track) {
		return this.tracks.delete(track.getId());
	}
	
	/*
	 * Remove a media track from stream
	 * @param {Sring} trackId - Id of the track to remote
	 * @returns {TrackInfo} if the track was present on track map or not
	 */
	removeTrackById(trackId) {
		return this.tracks.delete(trackId);
	}
	/**
	 * Get firs track for the media type
	 * @param {String} media - Media type "audio"|"video"
	 * @returns {TrackInfo}
	 */
	getFirstTrack(media) {
		for(let track of this.tracks.values())
		{
			if (track.getMedia().toLowerCase()===media.toLowerCase())
				return track;
		}
		return null;
	}

	/**
	 * Get all tracks from the media stream
	 * @returns {Map.TrackInfo}
	 */
	getTracks() {
		return this.tracks;
	}

	/**
	 * Remove all tracks from media sream
	 */
	removeAllTracks() {
		this.tracks.clear();
	}

	/**
	 * Get track by id
	 * @param {String} trackId
	 * @returns {TrackInfo}
	 */
	getTrack(trackId) {
		return this.tracks.get(trackId);
	}
}

/**
 * Expands a plain JSON object containing an StreamInfo
 * @param {Object} plain JSON object
 * @returns {StreamInfo} Parsed Stream info
 */
StreamInfo.expand = function(plain)
{
	//Create new
	const streamInfo = new StreamInfo(
		plain.id,
		plain.paused
	);

	//For each track
	for (let i=0; i<plain.tracks.length; ++i)
	{
		//Expand track info
		const trackInfo = TrackInfo.expand(plain.tracks[i]);
		//Check
		if (trackInfo)
			//Add track
			streamInfo.addTrack(trackInfo);
	}

	//Done
	return streamInfo;
};

module.exports = StreamInfo;

},{"./TrackInfo":26}],25:[function(require,module,exports){
const CodecInfo = require("./CodecInfo");
/**
 * Simulcast encoding layer information for track
 * @namespace
 */
class TrackEncodingInfo
{
	/**
	 * @constructor
	 * @alias DTLSInfo
	 * @param {String} id		- rid value
	 * @returns {TrackEncodingInfo}
	 */
	constructor(id,paused)
	{
		//store properties
   		this.id		= id;
		this.paused	= paused;
		this.codecs	= new Map();
		this.params	= new Map();
	}

	/**
	 * Create a clone of this RID info object
	 * @returns {TrackEncodingInfo}
	 */
	clone() {
		//Clone
		var cloned = new TrackEncodingInfo(this.id,this.paused);
		//For each codec
		for(let codec of this.codecs.values())
			//Add cloned
			cloned.addCodec(codec.clone());
		//Add params
		cloned.setParams(this.params);
		//return cloned object
		return cloned;
	}

	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		var plain =  {
			id		: this.id,
			paused		: this.paused,
			codecs		: {},
			params		: {}
		};
		//Add coces
		for (var [id,codec] of this.codecs.entries())
			//Add it
			plain.codecs[id] = codec.plain();
		//Add params
		for (var [id,param] of this.params.entries())
			//Add it
			plain.params[id] = param;
		//Return plain object
		return plain;
	}

	/**
	 * Get the rid id value
	 * @returns {String}
	 */
	getId() {
		return this.id;
	}


	/**
	 * Get codec information for this encoding (if any)
	 * @returns {Map<String,CodecInfo>}
	 */
	getCodecs() {
		return this.codecs;
	}

	/**
	 * Add codec info
	 * @param {CodecInfo} codec - Codec Info
	 */
	addCodec(codec) {
		//Put it
		this.codecs.set(codec.getType(),codec);
	}

	/**
	 * Get the rid params
	 * @returns {Map<String,String>} The params map
	 */
	getParams() {
		return this.params;
	}

	/**
	 * Set the rid params
	 * @param {Map<String,String>} params - rid params map
	 */
	setParams(params) {
		this.params = new Map(params);
	}

	/**
	 * Add an rid param
	 * @param {String} id
	 * @param {String} param
	 */
	addParam(id,param) {
		this.params.set(id,param);
	}

	/**
	 * Is the stream paused
	 * @returns {Boolean}
	 */
	isPaused() {
		return this.paused;
	}
}

/**
 * Expands a plain JSON object containing an TrackEncodingInfo
 * @param {Object} plain JSON object
 * @returns {TrackEncodingInfo} Parsed TrackEncoding info
 */
TrackEncodingInfo.expand = function(plain)
{
	//Create new
	const trackEncodingInfo = new TrackEncodingInfo(
		plain.id,
		plain.paused
	);
	//For each codec
	for(let id in plain.codecs)
		//Add cloned
		trackEncodingInfo.addCodec(CodecInfo.expand(plain.codecs[id]));
	//Add params
	for (let id in plain.params)
		trackEncodingInfo.addParam(id,plain.params[id]);

	//Done
	return trackEncodingInfo;
};

module.exports = TrackEncodingInfo;
},{"./CodecInfo":9}],26:[function(require,module,exports){
const SourceGroupInfo	= require("./SourceGroupInfo");
const TrackEncodingInfo = require("./TrackEncodingInfo");
/**
 * Media Track information
 * @namespace
 */
class TrackInfo
{
	/**
	 * @constructor
	 * @alias TrackInfo
	 * @param {String} media	- Media type "audio"|"video"
	 * @param {String} id		- Track id
	 * @returns {TrackInfo}
	 */
	constructor(media,id) {
		this.media	= media;
		this.id		= id;
		this.ssrcs	= [];
		this.groups	= [];
		this.encodings  = [];
	}

	/**
	 * Create a clone of this track info object
	 * @returns {TrackInfo}
	 */
	clone() {
		//Clone
		const cloned =  new TrackInfo(this.media,this.id);
		//Check mediaId
		if (this.mediaId)
			//Set it
			cloned.setMediaId(this.mediaId);
		//Gor each ssrc
		for (let i=0;i<this.ssrcs.length;++i)
			//Add ssrc
			cloned.addSSRC(this.ssrcs[i]);
		//For each group
		for (let i=0;i<this.groups.length;++i)
			//Clone and add grou
			cloned.addSourceGroup(this.groups[i].clone());
		//For each encoding
		for (let i=0;i<this.encodings.length;++i)
		{
			const alternatives = [];
			//For each alternative
			for (let j=0;j<this.encodings[i].length;++j)
				//Append it
				alternatives.push(this.encodings[i][j].clone());
			//Clone and add grou
			cloned.addAlternativeEncodings(alternatives);
		}
		//Return it
		return cloned;
	}


	/**
	 * Return a plain javascript object which can be converted to JSON
	 * @returns {Object} Plain javascript object
	 */
	plain() {
		const plain = {
			media		: this.media,
			id		: this.id,
			ssrcs		: [],
		};
		//Check mediaId
		if (this.mediaId)
			//Set it
			plain.mediaId = this.mediaId;
		//Gor each ssrc
		for (let i=0;i<this.ssrcs.length;++i)
			//Add ssrc
			plain.ssrcs.push(this.ssrcs[i]);
		//For each group
		for (let i=0;i<this.groups.length;++i)
		{
			//If first
			if (!plain.groups) plain.groups = [];
			//Clone and add grou
			plain.groups.push(this.groups[i].plain());
		}
		//For each encoding
		for (let i=0;i<this.encodings.length;++i)
		{
			const alternatives = [];
			//For each alternative
			for (let j=0; j<this.encodings[i].length;++j)
				//Append it
				alternatives.push(this.encodings[i][j].plain());
			//If we have any
			if (alternatives.length)
			{
				//If first
				if (!plain.encodings) plain.encodings = [];
				//Clone and add grou
				plain.encodings.push(alternatives);
			}
		}
		//Return it
		return plain;
	}

	/**
	 * Get media type
	 * @returns {String} - "audio"|"video"
	 */
	getMedia() {
		return this.media;
	}

	/**
	 * Set the media line id this track belongs to. Set to null for first media line of the media type
	 * @param {String} mediaId		- MediaInfo id
	 */
	setMediaId(mediaId) {
		this.mediaId = mediaId;
	}

	/**
	 * Returns the MediaInfo id this track belongs two (unified) or undefined if indiferent (plan B)
	 * @returns {String}
	 */
	getMediaId() {
		return this.mediaId;
	}

	/**
	 * Get track id
	 * @returns {String}
	 */
	getId() {
		return this.id;
	}

	/**
	 * Add ssrc for this track
	 * @param {Number} ssrc
	 */
	addSSRC(ssrc) {
		this.ssrcs.push(ssrc);
	}

	/**
	 * Get all
	 * @returns {Array}
	 */
	getSSRCs() {
		return this.ssrcs;
	}

	/**
	 * Add source group to track
	 * @param {SourceGroupInfo} group
	 */
	addSourceGroup(group) {
		this.groups.push(group);
	}

	/**
	 * Get the source group fot the desired type
	 * @param {String} schematics - Group type
	 * @returns {SourceGroupInfo}
	 */
	getSourceGroup(schematics) {
		for (let i in this.groups)
		{
			let group = this.groups[i];
			if (group.getSemantics().toLowerCase()===schematics.toLowerCase())
				return group;
		}
		return null;
	}

	/**
	 * Get all source groups for this track
	 * @returns {Array<SourceGroupInfo>}
	 */
	getSourceGroups() {
		return this.groups;
	}

	/**
	 * Check if track has a group for this type
	 * @param {String} schematics
	 * @returns {Boolean}
	 */
	hasSourceGroup(schematics) {
		for (let i in this.groups)
		{
			let group = this.groups[i];
			if (group.getSemantics().toLowerCase()===schematics.toLowerCase())
				return true;
		}
		return false;
	}

	/**
	 * Get simulcast encoding information for this track (if any)
	 * @returns {Array<Array<TrackEncodingInfo>>}
	 */
	getEncodings() {
		return this.encodings;
	}

	/**
	 * Add simulcast encoding information for this track
	 * @param {TrackEncodingInfo} encoding - Simulcast encoding info
	 */
	addEncoding(encoding) {
		//Put it
		this.encodings.push([encoding]);
	}
	
	/**
	 * Add simulcast encoding information for this track
	 * @param {Array<TrackEncodingInfo>} alternatives - Simulcast encoding info
	 */
	addAlternativeEncodings(alternatives) {
		//Put it
		this.encodings.push(alternatives);
	}

	/**
	 * Add simulcast encoding information for this track
	 * @param {Array<Array<TrackEncodingInfo>>} encodings - Simulcast encoding info
	 */
	setEncodings(encodings) {
		//Put it
		//TODO: Clone?
		this.encodings = encodings;
	}
}

/**
 * Expands a plain JSON object containing an TrackInfo
 * @param {Object} plain JSON object
 * @returns {TrackInfo} Parsed Track info
 */
TrackInfo.expand = function(plain)
{
	//Create new
	const trackInfo =  new TrackInfo(plain.media,plain.id);
	//Check mediaId
	if (plain.mediaId)
		//Set it
		trackInfo.setMediaId(plain.mediaId);
	//Gor each ssrc
	for (let i=0;plain.ssrcs && i<plain.ssrcs.length;++i)
		//Add ssrc
		trackInfo.addSSRC(plain.ssrcs[i]);
	//For each group
	for (let i=0;plain.groups && i<plain.groups.length;++i)
		//Clone and add grou
		trackInfo.addSourceGroup(SourceGroupInfo.expand(plain.groups[i]));
	//For each encoding
	for (let i=0;plain.encodings && i<plain.encodings.length;++i)
	{
		const alternatives = [];
		//For each alternative
		for (let j=0; j<plain.encodings[i].length;++j)
			//Append it
			alternatives.push(TrackEncodingInfo.expand(plain.encodings[i][j]));
		//Clone and add grou
		trackInfo.addAlternativeEncodings(alternatives);
	}
	//Return it
	return trackInfo;
};

module.exports = TrackInfo;

},{"./SourceGroupInfo":22,"./TrackEncodingInfo":25}],27:[function(require,module,exports){
(function (process,global,Buffer){
'use strict'

function oldBrowser () {
  throw new Error('secure random number generation not supported by this browser\nuse chrome, FireFox or Internet Explorer 11')
}

var crypto = global.crypto || global.msCrypto

if (crypto && crypto.getRandomValues) {
  module.exports = randomBytes
} else {
  module.exports = oldBrowser
}

function randomBytes (size, cb) {
  // phantomjs needs to throw
  if (size > 65536) throw new Error('requested too many random bytes')
  // in case browserify  isn't using the Uint8Array version
  var rawBytes = new global.Uint8Array(size)

  // This will not work in older browsers.
  // See https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
  if (size > 0) {  // getRandomValues fails on IE if size == 0
    crypto.getRandomValues(rawBytes)
  }
  // phantomjs doesn't like a buffer being passed here
  var bytes = new Buffer(rawBytes.buffer)

  if (typeof cb === 'function') {
    return process.nextTick(function () {
      cb(null, bytes)
    })
  }

  return bytes
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"_process":4,"buffer":2}],28:[function(require,module,exports){
var grammar = module.exports = {
  v: [{
    name: 'version',
    reg: /^(\d*)$/
  }],
  o: [{ //o=- 20518 0 IN IP4 203.0.113.1
    // NB: sessionId will be a String in most cases because it is huge
    name: 'origin',
    reg: /^(\S*) (\d*) (\d*) (\S*) IP(\d) (\S*)/,
    names: ['username', 'sessionId', 'sessionVersion', 'netType', 'ipVer', 'address'],
    format: '%s %s %d %s IP%d %s'
  }],
  // default parsing of these only (though some of these feel outdated)
  s: [{ name: 'name' }],
  i: [{ name: 'description' }],
  u: [{ name: 'uri' }],
  e: [{ name: 'email' }],
  p: [{ name: 'phone' }],
  z: [{ name: 'timezones' }], // TODO: this one can actually be parsed properly..
  r: [{ name: 'repeats' }],   // TODO: this one can also be parsed properly
  //k: [{}], // outdated thing ignored
  t: [{ //t=0 0
    name: 'timing',
    reg: /^(\d*) (\d*)/,
    names: ['start', 'stop'],
    format: '%d %d'
  }],
  c: [{ //c=IN IP4 10.47.197.26
    name: 'connection',
    reg: /^IN IP(\d) (\S*)/,
    names: ['version', 'ip'],
    format: 'IN IP%d %s'
  }],
  b: [{ //b=AS:4000
    push: 'bandwidth',
    reg: /^(TIAS|AS|CT|RR|RS):(\d*)/,
    names: ['type', 'limit'],
    format: '%s:%s'
  }],
  m: [{ //m=video 51744 RTP/AVP 126 97 98 34 31
    // NB: special - pushes to session
    // TODO: rtp/fmtp should be filtered by the payloads found here?
    reg: /^(\w*) (\d*) ([\w\/]*)(?: (.*))?/,
    names: ['type', 'port', 'protocol', 'payloads'],
    format: '%s %d %s %s'
  }],
  a: [
    { //a=rtpmap:110 opus/48000/2
      push: 'rtp',
      reg: /^rtpmap:(\d*) ([\w\-\.]*)(?:\s*\/(\d*)(?:\s*\/(\S*))?)?/,
      names: ['payload', 'codec', 'rate', 'encoding'],
      format: function (o) {
        return (o.encoding) ?
          'rtpmap:%d %s/%s/%s':
          o.rate ?
          'rtpmap:%d %s/%s':
          'rtpmap:%d %s';
      }
    },
    { //a=fmtp:108 profile-level-id=24;object=23;bitrate=64000
      //a=fmtp:111 minptime=10; useinbandfec=1
      push: 'fmtp',
      reg: /^fmtp:(\d*) ([\S| ]*)/,
      names: ['payload', 'config'],
      format: 'fmtp:%d %s'
    },
    { //a=control:streamid=0
      name: 'control',
      reg: /^control:(.*)/,
      format: 'control:%s'
    },
    { //a=rtcp:65179 IN IP4 193.84.77.194
      name: 'rtcp',
      reg: /^rtcp:(\d*)(?: (\S*) IP(\d) (\S*))?/,
      names: ['port', 'netType', 'ipVer', 'address'],
      format: function (o) {
        return (o.address != null) ?
          'rtcp:%d %s IP%d %s':
          'rtcp:%d';
      }
    },
    { //a=rtcp-fb:98 trr-int 100
      push: 'rtcpFbTrrInt',
      reg: /^rtcp-fb:(\*|\d*) trr-int (\d*)/,
      names: ['payload', 'value'],
      format: 'rtcp-fb:%d trr-int %d'
    },
    { //a=rtcp-fb:98 nack rpsi
      push: 'rtcpFb',
      reg: /^rtcp-fb:(\*|\d*) ([\w-_]*)(?: ([\w-_]*))?/,
      names: ['payload', 'type', 'subtype'],
      format: function (o) {
        return (o.subtype != null) ?
          'rtcp-fb:%s %s %s':
          'rtcp-fb:%s %s';
      }
    },
    { //a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
      //a=extmap:1/recvonly URI-gps-string
      push: 'ext',
      reg: /^extmap:(\d+)(?:\/(\w+))? (\S*)(?: (\S*))?/,
      names: ['value', 'direction', 'uri', 'config'],
      format: function (o) {
        return 'extmap:%d' + (o.direction ? '/%s' : '%v') + ' %s' + (o.config ? ' %s' : '');
      }
    },
    { //a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:PS1uQCVeeCFCanVmcjkpPywjNWhcYD0mXXtxaVBR|2^20|1:32
      push: 'crypto',
      reg: /^crypto:(\d*) ([\w_]*) (\S*)(?: (\S*))?/,
      names: ['id', 'suite', 'config', 'sessionConfig'],
      format: function (o) {
        return (o.sessionConfig != null) ?
          'crypto:%d %s %s %s':
          'crypto:%d %s %s';
      }
    },
    { //a=setup:actpass
      name: 'setup',
      reg: /^setup:(\w*)/,
      format: 'setup:%s'
    },
    { //a=mid:1
      name: 'mid',
      reg: /^mid:([^\s]*)/,
      format: 'mid:%s'
    },
    { //a=msid:0c8b064d-d807-43b4-b434-f92a889d8587 98178685-d409-46e0-8e16-7ef0db0db64a
      name: 'msid',
      reg: /^msid:(.*)/,
      format: 'msid:%s'
    },
    { //a=ptime:20
      name: 'ptime',
      reg: /^ptime:(\d*)/,
      format: 'ptime:%d'
    },
    { //a=maxptime:60
      name: 'maxptime',
      reg: /^maxptime:(\d*)/,
      format: 'maxptime:%d'
    },
    { //a=sendrecv
      name: 'direction',
      reg: /^(sendrecv|recvonly|sendonly|inactive)/
    },
    { //a=ice-lite
      name: 'icelite',
      reg: /^(ice-lite)/
    },
    { //a=ice-ufrag:F7gI
      name: 'iceUfrag',
      reg: /^ice-ufrag:(\S*)/,
      format: 'ice-ufrag:%s'
    },
    { //a=ice-pwd:x9cml/YzichV2+XlhiMu8g
      name: 'icePwd',
      reg: /^ice-pwd:(\S*)/,
      format: 'ice-pwd:%s'
    },
    { //a=fingerprint:SHA-1 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33
      name: 'fingerprint',
      reg: /^fingerprint:(\S*) (\S*)/,
      names: ['type', 'hash'],
      format: 'fingerprint:%s %s'
    },
    { //a=candidate:0 1 UDP 2113667327 203.0.113.1 54400 typ host
      //a=candidate:1162875081 1 udp 2113937151 192.168.34.75 60017 typ host generation 0 network-id 3 network-cost 10
      //a=candidate:3289912957 2 udp 1845501695 193.84.77.194 60017 typ srflx raddr 192.168.34.75 rport 60017 generation 0 network-id 3 network-cost 10
      //a=candidate:229815620 1 tcp 1518280447 192.168.150.19 60017 typ host tcptype active generation 0 network-id 3 network-cost 10
      //a=candidate:3289912957 2 tcp 1845501695 193.84.77.194 60017 typ srflx raddr 192.168.34.75 rport 60017 tcptype passive generation 0 network-id 3 network-cost 10
      push:'candidates',
      reg: /^candidate:(\S*) (\d*) (\S*) (\d*) (\S*) (\d*) typ (\S*)(?: raddr (\S*) rport (\d*))?(?: tcptype (\S*))?(?: generation (\d*))?(?: network-id (\d*))?(?: network-cost (\d*))?/,
      names: ['foundation', 'component', 'transport', 'priority', 'ip', 'port', 'type', 'raddr', 'rport', 'tcptype', 'generation', 'network-id', 'network-cost'],
      format: function (o) {
        var str = 'candidate:%s %d %s %d %s %d typ %s';

        str += (o.raddr != null) ? ' raddr %s rport %d' : '%v%v';

        // NB: candidate has three optional chunks, so %void middles one if it's missing
        str += (o.tcptype != null) ? ' tcptype %s' : '%v';

        if (o.generation != null) {
          str += ' generation %d';
        }

        str += (o['network-id'] != null) ? ' network-id %d' : '%v';
        str += (o['network-cost'] != null) ? ' network-cost %d' : '%v';
        return str;
      }
    },
    { //a=end-of-candidates (keep after the candidates line for readability)
      name: 'endOfCandidates',
      reg: /^(end-of-candidates)/
    },
    { //a=remote-candidates:1 203.0.113.1 54400 2 203.0.113.1 54401 ...
      name: 'remoteCandidates',
      reg: /^remote-candidates:(.*)/,
      format: 'remote-candidates:%s'
    },
    { //a=ice-options:google-ice
      name: 'iceOptions',
      reg: /^ice-options:(\S*)/,
      format: 'ice-options:%s'
    },
    { //a=ssrc:2566107569 cname:t9YU8M1UxTF8Y1A1
      push: 'ssrcs',
      reg: /^ssrc:(\d*) ([\w_]*)(?::(.*))?/,
      names: ['id', 'attribute', 'value'],
      format: function (o) {
        var str = 'ssrc:%d';
        if (o.attribute != null) {
          str += ' %s';
          if (o.value != null) {
            str += ':%s';
          }
        }
        return str;
      }
    },
    { //a=ssrc-group:FEC 1 2
      //a=ssrc-group:FEC-FR 3004364195 1080772241
      push: 'ssrcGroups',
      // token-char = %x21 / %x23-27 / %x2A-2B / %x2D-2E / %x30-39 / %x41-5A / %x5E-7E
      reg: /^ssrc-group:([\x21\x23\x24\x25\x26\x27\x2A\x2B\x2D\x2E\w]*) (.*)/,
      names: ['semantics', 'ssrcs'],
      format: 'ssrc-group:%s %s'
    },
    { //a=msid-semantic: WMS Jvlam5X3SX1OP6pn20zWogvaKJz5Hjf9OnlV
      name: 'msidSemantic',
      reg: /^msid-semantic:\s?(\w*) (\S*)/,
      names: ['semantic', 'token'],
      format: 'msid-semantic: %s %s' // space after ':' is not accidental
    },
    { //a=group:BUNDLE audio video
      push: 'groups',
      reg: /^group:(\w*) (.*)/,
      names: ['type', 'mids'],
      format: 'group:%s %s'
    },
    { //a=rtcp-mux
      name: 'rtcpMux',
      reg: /^(rtcp-mux)/
    },
    { //a=rtcp-rsize
      name: 'rtcpRsize',
      reg: /^(rtcp-rsize)/
    },
    { //a=sctpmap:5000 webrtc-datachannel 1024
      name: 'sctpmap',
      reg: /^sctpmap:([\w_\/]*) (\S*)(?: (\S*))?/,
      names: ['sctpmapNumber', 'app', 'maxMessageSize'],
      format: function (o) {
        return (o.maxMessageSize != null) ?
          'sctpmap:%s %s %s' :
          'sctpmap:%s %s';
      }
    },
    { //a=x-google-flag:conference
      name: 'xGoogleFlag',
      reg: /^x-google-flag:([^\s]*)/,
      format: 'x-google-flag:%s'
    },
    { //a=rid:1 send max-width=1280;max-height=720;max-fps=30;depend=0
      push: 'rids',
      reg: /^rid:([\d\w]+) (\w+)(?: ([\S| ]*))?/,
      names: ['id', 'direction', 'params'],
      format: function (o) {
        return (o.params) ? 'rid:%s %s %s' : 'rid:%s %s';
      }
    },
    { //a=imageattr:97 send [x=800,y=640,sar=1.1,q=0.6] [x=480,y=320] recv [x=330,y=250]
      //a=imageattr:* send [x=800,y=640] recv *
      //a=imageattr:100 recv [x=320,y=240]
      push: 'imageattrs',
      reg: new RegExp(
        //a=imageattr:97
        '^imageattr:(\\d+|\\*)' +
        //send [x=800,y=640,sar=1.1,q=0.6] [x=480,y=320]
        '[\\s\\t]+(send|recv)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*)' +
        //recv [x=330,y=250]
        '(?:[\\s\\t]+(recv|send)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*))?'
      ),
      names: ['pt', 'dir1', 'attrs1', 'dir2', 'attrs2'],
      format: function (o) {
        return 'imageattr:%s %s %s' + (o.dir2 ? ' %s %s' : '');
      }
    },
    { //a=simulcast:send 1,2,3;~4,~5 recv 6;~7,~8
      //a=simulcast:recv 1;4,5 send 6;7
      name: 'simulcast',
      reg: new RegExp(
        //a=simulcast:
        '^simulcast:' +
        //send 1,2,3;~4,~5
        '(send|recv) ([a-zA-Z0-9\\-_~;,]+)' +
        //space + recv 6;~7,~8
        '(?:\\s?(send|recv) ([a-zA-Z0-9\\-_~;,]+))?' +
        //end
        '$'
      ),
      names: ['dir1', 'list1', 'dir2', 'list2'],
      format: function (o) {
        return 'simulcast:%s %s' + (o.dir2 ? ' %s %s' : '');
      }
    },
    { //Old simulcast draft 03 (implemented by Firefox)
      //  https://tools.ietf.org/html/draft-ietf-mmusic-sdp-simulcast-03
      //a=simulcast: recv pt=97;98 send pt=97
      //a=simulcast: send rid=5;6;7 paused=6,7
      name: 'simulcast_03',
      reg: /^simulcast:[\s\t]+([\S+\s\t]+)$/,
      names: ['value'],
      format: 'simulcast: %s'
    },
    {
      //a=framerate:25
      //a=framerate:29.97
      name: 'framerate',
      reg: /^framerate:(\d+(?:$|\.\d+))/,
      format: 'framerate:%s'
    },
    { // any a= that we don't understand is kepts verbatim on media.invalid
      push: 'invalid',
      names: ['value']
    }
  ]
};

// set sensible defaults to avoid polluting the grammar with boring details
Object.keys(grammar).forEach(function (key) {
  var objs = grammar[key];
  objs.forEach(function (obj) {
    if (!obj.reg) {
      obj.reg = /(.*)/;
    }
    if (!obj.format) {
      obj.format = '%s';
    }
  });
});

},{}],29:[function(require,module,exports){
var parser = require('./parser');
var writer = require('./writer');

exports.write = writer;
exports.parse = parser.parse;
exports.parseFmtpConfig = parser.parseFmtpConfig;
exports.parseParams = parser.parseParams;
exports.parsePayloads = parser.parsePayloads;
exports.parseRemoteCandidates = parser.parseRemoteCandidates;
exports.parseImageAttributes = parser.parseImageAttributes;
exports.parseSimulcastStreamList = parser.parseSimulcastStreamList;

},{"./parser":30,"./writer":31}],30:[function(require,module,exports){
var toIntIfInt = function (v) {
  return String(Number(v)) === v ? Number(v) : v;
};

var attachProperties = function (match, location, names, rawName) {
  if (rawName && !names) {
    location[rawName] = toIntIfInt(match[1]);
  }
  else {
    for (var i = 0; i < names.length; i += 1) {
      if (match[i+1] != null) {
        location[names[i]] = toIntIfInt(match[i+1]);
      }
    }
  }
};

var parseReg = function (obj, location, content) {
  var needsBlank = obj.name && obj.names;
  if (obj.push && !location[obj.push]) {
    location[obj.push] = [];
  }
  else if (needsBlank && !location[obj.name]) {
    location[obj.name] = {};
  }
  var keyLocation = obj.push ?
    {} :  // blank object that will be pushed
    needsBlank ? location[obj.name] : location; // otherwise, named location or root

  attachProperties(content.match(obj.reg), keyLocation, obj.names, obj.name);

  if (obj.push) {
    location[obj.push].push(keyLocation);
  }
};

var grammar = require('./grammar');
var validLine = RegExp.prototype.test.bind(/^([a-z])=(.*)/);

exports.parse = function (sdp) {
  var session = {}
    , media = []
    , location = session; // points at where properties go under (one of the above)

  // parse lines we understand
  sdp.split(/(\r\n|\r|\n)/).filter(validLine).forEach(function (l) {
    var type = l[0];
    var content = l.slice(2);
    if (type === 'm') {
      media.push({rtp: [], fmtp: []});
      location = media[media.length-1]; // point at latest media line
    }

    for (var j = 0; j < (grammar[type] || []).length; j += 1) {
      var obj = grammar[type][j];
      if (obj.reg.test(content)) {
        return parseReg(obj, location, content);
      }
    }
  });

  session.media = media; // link it up
  return session;
};

var paramReducer = function (acc, expr) {
  var s = expr.split(/=(.+)/, 2);
  if (s.length === 2) {
    acc[s[0]] = toIntIfInt(s[1]);
  }
  return acc;
};

exports.parseParams = function (str) {
  return str.split(/\;\s?/).reduce(paramReducer, {});
};

// For backward compatibility - alias will be removed in 3.0.0
exports.parseFmtpConfig = exports.parseParams;

exports.parsePayloads = function (str) {
  return str.split(' ').map(Number);
};

exports.parseRemoteCandidates = function (str) {
  var candidates = [];
  var parts = str.split(' ').map(toIntIfInt);
  for (var i = 0; i < parts.length; i += 3) {
    candidates.push({
      component: parts[i],
      ip: parts[i + 1],
      port: parts[i + 2]
    });
  }
  return candidates;
};

exports.parseImageAttributes = function (str) {
  return str.split(' ').map(function (item) {
    return item.substring(1, item.length-1).split(',').reduce(paramReducer, {});
  });
};

exports.parseSimulcastStreamList = function (str) {
  return str.split(';').map(function (stream) {
    return stream.split(',').map(function (format) {
      var scid, paused = false;

      if (format[0] !== '~') {
        scid = toIntIfInt(format);
      } else {
        scid = toIntIfInt(format.substring(1, format.length));
        paused = true;
      }

      return {
        scid: scid,
        paused: paused
      };
    });
  });
};

},{"./grammar":28}],31:[function(require,module,exports){
var grammar = require('./grammar');

// customized util.format - discards excess arguments and can void middle ones
var formatRegExp = /%[sdv%]/g;
var format = function (formatStr) {
  var i = 1;
  var args = arguments;
  var len = args.length;
  return formatStr.replace(formatRegExp, function (x) {
    if (i >= len) {
      return x; // missing argument
    }
    var arg = args[i];
    i += 1;
    switch (x) {
    case '%%':
      return '%';
    case '%s':
      return String(arg);
    case '%d':
      return Number(arg);
    case '%v':
      return '';
    }
  });
  // NB: we discard excess arguments - they are typically undefined from makeLine
};

var makeLine = function (type, obj, location) {
  var str = obj.format instanceof Function ?
    (obj.format(obj.push ? location : location[obj.name])) :
    obj.format;

  var args = [type + '=' + str];
  if (obj.names) {
    for (var i = 0; i < obj.names.length; i += 1) {
      var n = obj.names[i];
      if (obj.name) {
        args.push(location[obj.name][n]);
      }
      else { // for mLine and push attributes
        args.push(location[obj.names[i]]);
      }
    }
  }
  else {
    args.push(location[obj.name]);
  }
  return format.apply(null, args);
};

// RFC specified order
// TODO: extend this with all the rest
var defaultOuterOrder = [
  'v', 'o', 's', 'i',
  'u', 'e', 'p', 'c',
  'b', 't', 'r', 'z', 'a'
];
var defaultInnerOrder = ['i', 'c', 'b', 'a'];


module.exports = function (session, opts) {
  opts = opts || {};
  // ensure certain properties exist
  if (session.version == null) {
    session.version = 0; // 'v=0' must be there (only defined version atm)
  }
  if (session.name == null) {
    session.name = ' '; // 's= ' must be there if no meaningful name set
  }
  session.media.forEach(function (mLine) {
    if (mLine.payloads == null) {
      mLine.payloads = '';
    }
  });

  var outerOrder = opts.outerOrder || defaultOuterOrder;
  var innerOrder = opts.innerOrder || defaultInnerOrder;
  var sdp = [];

  // loop through outerOrder for matching properties on session
  outerOrder.forEach(function (type) {
    grammar[type].forEach(function (obj) {
      if (obj.name in session && session[obj.name] != null) {
        sdp.push(makeLine(type, obj, session));
      }
      else if (obj.push in session && session[obj.push] != null) {
        session[obj.push].forEach(function (el) {
          sdp.push(makeLine(type, obj, el));
        });
      }
    });
  });

  // then for each media line, follow the innerOrder
  session.media.forEach(function (mLine) {
    sdp.push(makeLine('m', grammar.m[0], mLine));

    innerOrder.forEach(function (type) {
      grammar[type].forEach(function (obj) {
        if (obj.name in mLine && mLine[obj.name] != null) {
          sdp.push(makeLine(type, obj, mLine));
        }
        else if (obj.push in mLine && mLine[obj.push] != null) {
          mLine[obj.push].forEach(function (el) {
            sdp.push(makeLine(type, obj, el));
          });
        }
      });
    });
  });

  return sdp.join('\r\n') + '\r\n';
};

},{"./grammar":28}]},{},[5])(5)
});