#!/usr/bin/env node
import {
  BaseRepository,
  PlanVerifier,
  TaskModel,
  __commonJS,
  __toESM,
  buildUpdateQuery,
  generateId,
  hasColumn,
  normalizeError,
  validateTransition,
  withTransaction
} from "../chunk-VPBWN2NJ.js";

// node_modules/picomatch/lib/constants.js
var require_constants = __commonJS({
  "node_modules/picomatch/lib/constants.js"(exports, module) {
    "use strict";
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var SEP = "/";
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR,
      SEP
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
      SEP: "\\"
    };
    var POSIX_REGEX_SOURCE = {
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module.exports = {
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        __proto__: null,
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// node_modules/picomatch/lib/utils.js
var require_utils = __commonJS({
  "node_modules/picomatch/lib/utils.js"(exports) {
    "use strict";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports.isWindows = () => {
      if (typeof navigator !== "undefined" && navigator.platform) {
        const platform = navigator.platform.toLowerCase();
        return platform === "win32" || platform === "windows";
      }
      if (typeof process !== "undefined" && process.platform) {
        return process.platform === "win32";
      }
      return false;
    };
    exports.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports.removePrefix = (input, state = {}) => {
      let output2 = input;
      if (output2.startsWith("./")) {
        output2 = output2.slice(2);
        state.prefix = "./";
      }
      return output2;
    };
    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output2 = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output2 = `(?:^(?!${output2}).*$)`;
      }
      return output2;
    };
    exports.basename = (path10, { windows } = {}) => {
      const segs = path10.split(windows ? /[\\/]/ : "/");
      const last = segs[segs.length - 1];
      if (last === "") {
        return segs[segs.length - 2];
      }
      return last;
    };
  }
});

// node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "node_modules/picomatch/lib/scan.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== "") {
            parts.push(value);
          }
          prevIndex = i;
        }
        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);
          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module.exports = scan;
  }
});

// node_modules/picomatch/lib/parse.js
var require_parse = __commonJS({
  "node_modules/picomatch/lib/parse.js"(exports, module) {
    "use strict";
    var constants2 = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants2;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var parse3 = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const PLATFORM_CHARS = constants2.globChars(opts.windows);
      const EXTGLOB_CHARS = constants2.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.output = (prev.output || prev.value) + tok.value;
          prev.value += tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        const output2 = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output: output2 });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        let output2 = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output2 = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse3(rest, { ...options, fastpaths: false }).output;
            output2 = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output: output2 });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output2 = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output2 = output2.replace(/\\/g, "");
          } else {
            output2 = output2.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output2 === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output2, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix = POSIX_REGEX_SOURCE[rest2];
                if (posix) {
                  prev.value = pre + posix;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output2 = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output2 = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output2 = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output: output2 });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output2 = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output2 = "|";
          }
          push({ type: "comma", value, output: output2 });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output2 = value;
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output2 = `\\${value}`;
            }
            push({ type: "text", value, output: output2 });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse3.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants2.globChars(opts.windows);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output2 = utils.removePrefix(input, state);
      let source = create(output2);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module.exports = parse3;
  }
});

// node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "node_modules/picomatch/lib/picomatch.js"(exports, module) {
    "use strict";
    var scan = require_scan();
    var parse3 = require_parse();
    var utils = require_utils();
    var constants2 = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch2 = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch2(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix = opts.windows;
      const regex = isState ? picomatch2.compileRe(glob, options) : picomatch2.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch2(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output: output2 } = picomatch2.test(input, regex, options, { glob, posix });
        const result = { glob, state, regex, posix, input, output: output2, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch2.test = (input, regex, options, { glob, posix } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output2 = match && format ? format(input) : input;
      if (match === false) {
        output2 = format ? format(input) : input;
        match = output2 === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch2.matchBase(input, regex, options, posix);
        } else {
          match = regex.exec(output2);
        }
      }
      return { isMatch: Boolean(match), match, output: output2 };
    };
    picomatch2.matchBase = (input, glob, options) => {
      const regex = glob instanceof RegExp ? glob : picomatch2.makeRe(glob, options);
      return regex.test(utils.basename(input));
    };
    picomatch2.isMatch = (str, patterns, options) => picomatch2(patterns, options)(str);
    picomatch2.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch2.parse(p, options));
      return parse3(pattern, { ...options, fastpaths: false });
    };
    picomatch2.scan = (input, options) => scan(input, options);
    picomatch2.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch2.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch2.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse3.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse3(input, options);
      }
      return picomatch2.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch2.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch2.constants = constants2;
    module.exports = picomatch2;
  }
});

// node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "node_modules/picomatch/index.js"(exports, module) {
    "use strict";
    var pico = require_picomatch();
    var utils = require_utils();
    function picomatch2(glob, options, returnState = false) {
      if (options && (options.windows === null || options.windows === void 0)) {
        options = { ...options, windows: utils.isWindows() };
      }
      return pico(glob, options, returnState);
    }
    Object.assign(picomatch2, pico);
    module.exports = picomatch2;
  }
});

// src/cli/index.ts
import { Command } from "commander";
import { createRequire as createRequire2 } from "module";

// src/cli/formatters.ts
var FILLED = "\u2588";
var EMPTY = "\u2591";
function formatProgressBar(pct, width = 20) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 100 * width);
  const empty = width - filled;
  return `${FILLED.repeat(filled)}${EMPTY.repeat(empty)} ${Math.round(clamped)}%`;
}
function formatDashboard(overview, alerts) {
  const lines = [];
  if (overview.plans.length === 0) {
    lines.push("No active plans.");
  } else {
    const boxWidth = 55;
    const inner = boxWidth - 2;
    lines.push(`\u250C\u2500 Active Plans ${"\u2500".repeat(inner - 14)}\u2510`);
    lines.push(`\u2502${" ".repeat(inner)}\u2502`);
    overview.plans.forEach((plan, index) => {
      const num = numCircle(index + 1);
      const bar = formatProgressBar(plan.progress_pct, 12);
      const titleLine = `  ${num} ${plan.title}`;
      const gap = inner - titleLine.length - bar.length - 2;
      const paddedTitle = `${titleLine}${" ".repeat(Math.max(1, gap))}${bar}  `;
      lines.push(`\u2502${padRight(paddedTitle, inner)}\u2502`);
      const todoCount = plan.total_tasks - plan.done_tasks - plan.active_tasks - plan.blocked_tasks;
      const countsLine = `    done ${plan.done_tasks} \xB7 active ${plan.active_tasks} \xB7 blocked ${plan.blocked_tasks} \xB7 todo ${todoCount}`;
      lines.push(`\u2502${padRight(countsLine, inner)}\u2502`);
      lines.push(`\u2502${" ".repeat(inner)}\u2502`);
    });
    lines.push(`\u2514${"\u2500".repeat(inner)}\u2518`);
  }
  if (overview.backlog && overview.backlog.open > 0) {
    lines.push("");
    const bp = overview.backlog.by_priority;
    const priParts = [];
    if (bp.critical > 0) priParts.push(`critical: ${bp.critical}`);
    if (bp.high > 0) priParts.push(`high: ${bp.high}`);
    if (bp.medium > 0) priParts.push(`medium: ${bp.medium}`);
    if (bp.low > 0) priParts.push(`low: ${bp.low}`);
    lines.push(`Backlog: ${overview.backlog.open} open / ${overview.backlog.total} total  (${priParts.join(" \xB7 ")})`);
    if (overview.backlog.top_items.length > 0) {
      for (const item of overview.backlog.top_items) {
        const cat = item.category ? ` (${item.category})` : "";
        lines.push(`  [${item.priority}] ${item.title}${cat} \u2014 \u2192 /vs-plan \uC2B9\uACA9 | /vs-ideate`);
      }
      if (overview.backlog.open > overview.backlog.top_items.length) {
        const remaining = overview.backlog.open - overview.backlog.top_items.length;
        lines.push(`  ... \uC678 ${remaining}\uAC1C \u2192 /vs-backlog\uC5D0\uC11C \uC804\uCCB4 \uD655\uC778`);
      }
    }
  }
  if (alerts.length > 0) {
    lines.push("\u26A0 Alerts:");
    for (const alert of alerts) {
      lines.push(`  - [${alert.type}] ${alert.message}`);
    }
  }
  return lines.join("\n");
}
function numCircle(n) {
  const circles = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464", "\u2465", "\u2466", "\u2467", "\u2468", "\u2469"];
  return circles[n - 1] ?? `(${n})`;
}
function padRight(str, len) {
  if (str.length >= len) return str.slice(0, len);
  return str + " ".repeat(len - str.length);
}
function formatStats(velocity, estimate, timeline) {
  const lines = [];
  lines.push(
    `Velocity: ${velocity.daily.toFixed(1)} tasks/day (${velocity.total_completed} completed in last 7 days)`
  );
  if (estimate) {
    lines.push(`Remaining: ${estimate.remaining_tasks} tasks`);
    if (estimate.estimated_days !== null && estimate.estimated_date !== null) {
      lines.push(`Estimated: ~${estimate.estimated_days} days (${estimate.estimated_date})`);
    } else {
      lines.push("Estimated: unknown (no velocity)");
    }
  }
  if (timeline && timeline.length > 0) {
    lines.push("");
    lines.push("Timeline:");
    const maxTasks = Math.max(...timeline.map((e) => e.tasks_completed));
    const maxBarWidth = 10;
    for (const entry of timeline) {
      const datePart = entry.date.slice(5).replace("-", "/");
      const barWidth = maxTasks > 0 ? Math.max(1, Math.round(entry.tasks_completed / maxTasks * maxBarWidth)) : 1;
      const bar = FILLED.repeat(barWidth);
      const label = entry.tasks_completed === 1 ? "1 task" : `${entry.tasks_completed} tasks`;
      lines.push(`  ${datePart}  ${bar}  ${label}`);
    }
  }
  return lines.join("\n");
}
function formatHistory(events) {
  if (events.length === 0) {
    return "No history found.";
  }
  const lines = ["History:"];
  for (const event of events) {
    const dt = event.created_at.replace("T", " ").slice(0, 16);
    const oldPart = event.old_value ?? "";
    const newPart = event.new_value ?? "";
    let detail = "";
    if (oldPart && newPart) {
      detail = ` ${oldPart} \u2192 ${newPart}`;
    } else if (newPart) {
      detail = ` \u2192 ${newPart}`;
    } else if (oldPart) {
      detail = ` ${oldPart}`;
    }
    lines.push(
      `  ${dt}  ${event.entity_type}    ${event.event_type}  ${detail}`.trimEnd()
    );
  }
  return lines.join("\n");
}
var STATUS_ICONS = {
  done: "[x]",
  in_progress: "[>]",
  blocked: "[!]",
  todo: "[ ]",
  skipped: "[-]"
};
function formatPlanTree(plan, tasks) {
  const lines = [];
  const totalTasks = countTasks(tasks);
  const doneTasks = countTasksByStatus(tasks, ["done", "skipped"]);
  const pct = totalTasks === 0 ? 0 : Math.round(doneTasks / totalTasks * 100);
  lines.push(`${plan.title} (${plan.status})${" ".repeat(5)}${pct}%`);
  if (plan.running_summary) {
    lines.push(`Running Summary: ${plan.running_summary.split("\n")[0]}...`);
  }
  for (let i = 0; i < tasks.length; i++) {
    const isLast = i === tasks.length - 1;
    renderNode(tasks[i], "", isLast, lines);
  }
  return lines.join("\n");
}
function renderNode(node, prefix, isLast, lines) {
  const connector = isLast ? "\u2514\u2500" : "\u251C\u2500";
  const icon = STATUS_ICONS[node.status];
  lines.push(`${prefix}${connector} ${icon} ${node.title}${" ".repeat(4)}${node.status}`);
  const childPrefix = prefix + (isLast ? "   " : "\u2502  ");
  for (let i = 0; i < node.children.length; i++) {
    const childIsLast = i === node.children.length - 1;
    renderNode(node.children[i], childPrefix, childIsLast, lines);
  }
}
function countTasks(nodes) {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countTasks(node.children);
  }
  return count;
}
function countTasksByStatus(nodes, statuses) {
  let count = 0;
  for (const node of nodes) {
    if (statuses.includes(node.status)) count++;
    count += countTasksByStatus(node.children, statuses);
  }
  return count;
}
function formatPlanList(plans) {
  if (plans.length === 0) return "No plans found.";
  const lines = [];
  const header = `${padRight("ID", 14)}${padRight("Title", 26)}${padRight("Status", 12)}Created`;
  lines.push(header);
  for (const plan of plans) {
    const created = plan.created_at?.split("T")[0] ?? "unknown";
    lines.push(
      `${padRight(plan.id, 14)}${padRight(plan.title, 26)}${padRight(plan.status, 12)}${created}`
    );
  }
  return lines.join("\n");
}
function formatErrorSearchResults(entries) {
  if (entries.length === 0) return "No errors found.";
  const lines = [];
  const header = `${padRight("ID", 16)}${padRight("Severity", 12)}${padRight("Status", 12)}${padRight("Occ", 6)}Title`;
  lines.push(header);
  for (const entry of entries) {
    lines.push(
      `${padRight(entry.id, 16)}${padRight(entry.severity, 12)}${padRight(entry.status, 12)}${padRight(String(entry.occurrences), 6)}${entry.title}`
    );
  }
  return lines.join("\n");
}
function formatErrorDetail(entry) {
  const tagsStr = entry.tags.length > 0 ? entry.tags.join(", ") : "(none)";
  const lines = [
    `ID:          ${entry.id}`,
    `Title:       ${entry.title}`,
    `Severity:    ${entry.severity}`,
    `Tags:        ${tagsStr}`,
    `Status:      ${entry.status}`,
    `Occurrences: ${entry.occurrences}`,
    `First seen:  ${entry.first_seen}`,
    `Last seen:   ${entry.last_seen}`
  ];
  if (entry.content && entry.content.trim().length > 0) {
    lines.push("");
    lines.push(entry.content.trim());
  }
  return lines.join("\n");
}
function formatErrorKBStats(stats) {
  const lines = [];
  lines.push(`Total: ${stats.total}`);
  lines.push("");
  lines.push("By Severity:");
  lines.push(`  critical: ${stats.by_severity.critical}`);
  lines.push(`  high:     ${stats.by_severity.high}`);
  lines.push(`  medium:   ${stats.by_severity.medium}`);
  lines.push(`  low:      ${stats.by_severity.low}`);
  lines.push("");
  lines.push("By Status:");
  lines.push(`  open:      ${stats.by_status.open}`);
  lines.push(`  resolved:  ${stats.by_status.resolved}`);
  lines.push(`  recurring: ${stats.by_status.recurring}`);
  lines.push(`  wontfix:   ${stats.by_status.wontfix}`);
  if (stats.top_recurring.length > 0) {
    lines.push("");
    lines.push("Top Recurring:");
    for (const entry of stats.top_recurring) {
      lines.push(`  ${entry.title} (${entry.occurrences}x)`);
    }
  }
  return lines.join("\n");
}
function formatSkillUsage(skillStats) {
  if (skillStats.length === 0) return "";
  const lines = [];
  lines.push("Recent Skill Usage:");
  for (let i = 0; i < skillStats.length; i++) {
    const s = skillStats[i];
    const label = s.count === 1 ? "1 time" : `${s.count} times`;
    lines.push(`  ${numCircle(i + 1)} ${s.skill_name} (${label})`);
  }
  return lines.join("\n");
}
var PRIORITY_ICONS = {
  critical: "!!!!",
  high: "!!! ",
  medium: "!!  ",
  low: "!   "
};
var STATUS_LABELS = {
  open: "open",
  planned: "planned",
  done: "done",
  dropped: "dropped"
};
function formatBacklogList(items) {
  if (items.length === 0) return "No backlog items found.";
  const lines = [];
  const header = `${padRight("ID", 14)}${padRight("Pri", 6)}${padRight("Category", 12)}${padRight("Status", 10)}Title`;
  lines.push(header);
  for (const item of items) {
    const pri = PRIORITY_ICONS[item.priority] ?? "    ";
    const cat = padRight(item.category ?? "-", 12);
    const status = padRight(STATUS_LABELS[item.status] ?? item.status, 10);
    lines.push(`${padRight(item.id, 14)}${padRight(pri, 6)}${cat}${status}${item.title}`);
  }
  return lines.join("\n");
}
function formatBacklogDetail(item) {
  const tags = item.tags ? JSON.parse(item.tags).join(", ") : "(none)";
  const lines = [
    `ID:          ${item.id}`,
    `Title:       ${item.title}`,
    `Priority:    ${item.priority}`,
    `Category:    ${item.category ?? "-"}`,
    `Tags:        ${tags}`,
    `Complexity:  ${item.complexity_hint ?? "-"}`,
    `Source:      ${item.source ?? "-"}`,
    `Status:      ${item.status}`,
    `Plan:        ${item.plan_id ?? "-"}`,
    `Created:     ${item.created_at}`,
    `Updated:     ${item.updated_at}`
  ];
  if (item.description) {
    lines.push("");
    lines.push(item.description);
  }
  return lines.join("\n");
}
function formatBacklogStats(stats) {
  const lines = [];
  lines.push(`Total: ${stats.total}`);
  lines.push("");
  lines.push("By Priority:");
  lines.push(`  critical: ${stats.by_priority.critical}`);
  lines.push(`  high:     ${stats.by_priority.high}`);
  lines.push(`  medium:   ${stats.by_priority.medium}`);
  lines.push(`  low:      ${stats.by_priority.low}`);
  lines.push("");
  lines.push("By Status:");
  lines.push(`  open:     ${stats.by_status.open}`);
  lines.push(`  planned:  ${stats.by_status.planned}`);
  lines.push(`  done:     ${stats.by_status.done}`);
  lines.push(`  dropped:  ${stats.by_status.dropped}`);
  if (Object.keys(stats.by_category).length > 0) {
    lines.push("");
    lines.push("By Category:");
    for (const [cat, count] of Object.entries(stats.by_category)) {
      lines.push(`  ${padRight(cat + ":", 16)}${count}`);
    }
  }
  return lines.join("\n");
}
function formatBacklogBoard(items) {
  if (items.length === 0) return "No backlog items found.";
  const groups = {};
  for (const item of items) {
    const cat = item.category ?? "uncategorized";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  const lines = [];
  const categories = Object.keys(groups).sort();
  const colWidth = 30;
  lines.push(categories.map((c) => padRight(`[${c}]`, colWidth)).join("  "));
  lines.push(categories.map(() => "-".repeat(colWidth)).join("  "));
  const maxRows = Math.max(...categories.map((c) => groups[c].length));
  for (let row = 0; row < maxRows; row++) {
    const cols = [];
    for (const cat of categories) {
      const item = groups[cat][row];
      if (item) {
        const pri = PRIORITY_ICONS[item.priority] ?? "    ";
        const label = `${pri.trim()} ${item.title}`;
        cols.push(padRight(label.length > colWidth ? label.slice(0, colWidth - 1) + ">" : label, colWidth));
      } else {
        cols.push(" ".repeat(colWidth));
      }
    }
    lines.push(cols.join("  "));
  }
  return lines.join("\n");
}
function formatImportPreview(result) {
  const lines = [];
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      lines.push(`Error: ${err}`);
    }
    if (result.items.length === 0) return lines.join("\n");
    lines.push("");
  }
  lines.push(`Import preview (${result.source_prefix}): ${result.items.length} items`);
  lines.push("");
  if (result.items.length === 0) {
    lines.push("No items to import.");
    return lines.join("\n");
  }
  const header = `${padRight("#", 4)}${padRight("Priority", 10)}${padRight("Category", 12)}Title`;
  lines.push(header);
  for (let i = 0; i < result.items.length; i++) {
    const item = result.items[i];
    const pri = padRight(item.priority ?? "medium", 10);
    const cat = padRight(item.category ?? "-", 12);
    lines.push(`${padRight(String(i + 1), 4)}${pri}${cat}${item.title}`);
  }
  return lines.join("\n");
}
function formatRuleList(rules) {
  if (rules.length === 0) return "No rules found.";
  const lines = rules.map(
    (r) => `[${r.status}] [${r.enforcement}] ${r.id} | ${r.category} | ${r.title} (prevented: ${r.prevented})`
  );
  return lines.join("\n");
}
function formatRuleDetail(rule) {
  const lines = [
    `ID:          ${rule.id}`,
    `Title:       ${rule.title}`,
    `Category:    ${rule.category}`,
    `Status:      ${rule.status}`,
    `Enforcement: ${rule.enforcement}`,
    `Escalated:   ${rule.escalated_at ?? "-"}`,
    `Occurrences: ${rule.occurrences}`,
    `Prevented:   ${rule.prevented}`,
    `Rule path:   ${rule.rule_path}`,
    `Created:     ${rule.created_at}`,
    `Last triggered: ${rule.last_triggered_at ?? "-"}`
  ];
  return lines.join("\n");
}
function formatEscalationStatus(candidates) {
  if (candidates.length === 0) return "No escalation candidates found.";
  const lines = ["HARD \uC2B9\uACA9 \uC608\uC815 \uADDC\uCE59:", ""];
  for (const c of candidates) {
    lines.push(`  ${c.id} | ${c.title} (occurrences: ${c.occurrences}, ${c.days_since_creation}\uC77C \uACBD\uACFC)`);
  }
  return lines.join("\n");
}

// src/core/db/connection.ts
import Database from "better-sqlite3";
import { existsSync, statSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
var _db = null;
function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    const gitPath = resolve(dir, ".git");
    if (existsSync(gitPath)) {
      const stat = statSync(gitPath);
      if (stat.isFile()) {
        const content = readFileSync(gitPath, "utf-8").trim();
        const match = content.match(/^gitdir:\s*(.+)/);
        if (match) {
          const absGitDir = resolve(dir, match[1]);
          return absGitDir.replace(/[/\\]\.git[/\\]worktrees[/\\].*$/, "");
        }
      }
      return dir;
    }
    dir = dirname(dir);
  }
  return startDir;
}
function detectGitContext() {
  try {
    const raw = execSync("git rev-parse --abbrev-ref HEAD --git-dir", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const lines = raw.split("\n");
    const branch = lines[0];
    const gitDir = lines[1] ?? "";
    const isWorktree = gitDir.includes("/worktrees/");
    let worktreeName = null;
    if (isWorktree) {
      const match = gitDir.match(/\/worktrees\/([^/]+)$/);
      worktreeName = match ? match[1] : null;
    }
    return {
      branch: branch === "HEAD" ? null : branch,
      worktreeName,
      isWorktree
    };
  } catch (e) {
    console.error("[connection] Git root detection failed:", e instanceof Error ? e.message : e);
    return { branch: null, worktreeName: null, isWorktree: false };
  }
}
function resolveDbPath() {
  if (process.env.VIBESPEC_DB_PATH) {
    return process.env.VIBESPEC_DB_PATH;
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.env.PROJECT_DIR;
  if (projectDir) {
    return resolve(findProjectRoot(projectDir), "vibespec.db");
  }
  const root = findProjectRoot(process.cwd());
  return resolve(root, "vibespec.db");
}
function getDb(dbPath) {
  if (_db) return _db;
  const path10 = dbPath ?? resolveDbPath();
  _db = new Database(path10);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}
function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
var _closing = false;
function handleShutdown() {
  if (_closing) return;
  _closing = true;
  closeDb();
  process.exit(0);
}
process.on("SIGTERM", handleShutdown);
process.on("SIGINT", handleShutdown);

// src/core/engine/embeddings.ts
import { createRequire } from "module";
var require2 = createRequire(import.meta.url);
var pipelineInstance = null;
function loadVec(db) {
  try {
    const sqliteVec = require2("sqlite-vec");
    sqliteVec.load(db);
    return true;
  } catch {
    return false;
  }
}
async function initModel() {
  if (pipelineInstance) return;
  const { pipeline } = await import("@xenova/transformers");
  pipelineInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
}
async function generateEmbedding(text) {
  if (!pipelineInstance) {
    await initModel();
  }
  const output2 = await pipelineInstance(text, { pooling: "mean", normalize: true });
  return new Float32Array(output2.data.slice(0, 384));
}
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// src/core/db/schema.ts
var PLAN_PROGRESS_VIEW_SQL = `
  SELECT
    p.id, p.title, p.status, p.branch, p.worktree_name,
    COUNT(t.id) AS total_tasks,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS active_tasks,
    SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_tasks,
    ROUND(SUM(CASE WHEN t.status = 'done' THEN 1.0 ELSE 0 END) / MAX(COUNT(t.id), 1) * 100) AS progress_pct
  FROM plans p LEFT JOIN tasks t ON t.plan_id = p.id
  WHERE p.status IN ('active', 'draft')
  GROUP BY p.id
`;
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL CHECK(status IN ('draft','active','approved','completed','archived')) DEFAULT 'draft',
      summary     TEXT,
      spec        TEXT,
      branch      TEXT,
      worktree_name TEXT,
      qa_overrides TEXT,
      running_summary TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY,
      plan_id     TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      parent_id   TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL CHECK(status IN ('todo','in_progress','done','blocked','skipped')) DEFAULT 'todo',
      depth       INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      spec        TEXT,
      acceptance  TEXT,
      depends_on  TEXT,
      allowed_files TEXT,
      forbidden_patterns TEXT,
      shadow_result TEXT CHECK(shadow_result IN ('clean', 'warning', 'alert')),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      session_id  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS context_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id     TEXT REFERENCES plans(id),
      session_id  TEXT,
      summary     TEXT NOT NULL,
      last_task_id TEXT REFERENCES tasks(id),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIEW IF NOT EXISTS plan_progress AS ${PLAN_PROGRESS_VIEW_SQL};

    CREATE TABLE IF NOT EXISTS task_metrics (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id         TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
      plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      duration_min    REAL,
      final_status    TEXT NOT NULL,
      block_reason    TEXT,
      impl_status     TEXT,
      test_count      INTEGER,
      files_changed   INTEGER,
      has_concerns    BOOLEAN DEFAULT 0,
      changed_files_detail TEXT,
      scope_violations TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIEW IF NOT EXISTS plan_metrics AS
    SELECT
      p.id,
      p.title,
      p.status,
      COUNT(tm.id) AS recorded_tasks,
      ROUND(AVG(tm.duration_min), 2) AS avg_duration_min,
      SUM(CASE WHEN tm.final_status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count,
      SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done_count,
      SUM(CASE WHEN tm.has_concerns = 1 THEN 1 ELSE 0 END) AS concern_count,
      ROUND(
        SUM(CASE WHEN tm.final_status = 'done' THEN 1.0 ELSE 0 END)
        / MAX(COUNT(tm.id), 1) * 100
      ) AS success_rate
    FROM plans p
    JOIN task_metrics tm ON tm.plan_id = p.id
    WHERE p.status IN ('completed', 'archived')
    GROUP BY p.id;

    CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_context_log_plan ON context_log(plan_id);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_plan_id ON task_metrics(plan_id);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_task_id ON task_metrics(task_id);

    CREATE TABLE IF NOT EXISTS skill_usage (
      id          TEXT PRIMARY KEY,
      skill_name  TEXT NOT NULL,
      plan_id     TEXT REFERENCES plans(id),
      session_id  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_skill_usage_name ON skill_usage(skill_name);
    CREATE INDEX IF NOT EXISTS idx_skill_usage_created ON skill_usage(created_at);

    CREATE TABLE IF NOT EXISTS vs_config (
      "key"   TEXT PRIMARY KEY,
      "value" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backlog_items (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      description      TEXT,
      priority         TEXT NOT NULL CHECK(priority IN ('critical','high','medium','low')) DEFAULT 'medium',
      category         TEXT CHECK(category IN ('feature','bugfix','refactor','chore','idea')),
      tags             TEXT,
      complexity_hint  TEXT CHECK(complexity_hint IN ('simple','moderate','complex')),
      source           TEXT,
      status           TEXT NOT NULL CHECK(status IN ('open','planned','done','dropped')) DEFAULT 'open',
      plan_id          TEXT REFERENCES plans(id) ON DELETE SET NULL,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_backlog_status ON backlog_items(status);
    CREATE INDEX IF NOT EXISTS idx_backlog_priority ON backlog_items(priority);
    CREATE INDEX IF NOT EXISTS idx_backlog_plan ON backlog_items(plan_id);

    CREATE TABLE IF NOT EXISTS agent_handoffs (
      id            TEXT PRIMARY KEY,
      task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      plan_id       TEXT REFERENCES plans(id) ON DELETE CASCADE,
      agent_type    TEXT NOT NULL,
      attempt       INTEGER NOT NULL DEFAULT 1,
      input_hash    TEXT,
      verdict       TEXT,
      summary       TEXT,
      report_path   TEXT,
      changed_files TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_agent_handoffs_task ON agent_handoffs(task_id);
    CREATE INDEX IF NOT EXISTS idx_agent_handoffs_plan ON agent_handoffs(plan_id);

    CREATE TABLE IF NOT EXISTS wave_gates (
      id              TEXT PRIMARY KEY,
      plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      wave_number     INTEGER NOT NULL,
      task_ids        TEXT NOT NULL,
      verdict         TEXT NOT NULL CHECK(verdict IN ('GREEN', 'YELLOW', 'RED')),
      summary         TEXT,
      findings_count  INTEGER DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_wave_gates_plan ON wave_gates(plan_id);

    CREATE TABLE IF NOT EXISTS plan_revisions (
      id              TEXT PRIMARY KEY,
      plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      trigger_type    TEXT NOT NULL CHECK(trigger_type IN (
        'assumption_violation', 'scope_explosion',
        'design_flaw', 'complexity_exceeded', 'dependency_shift'
      )),
      trigger_source  TEXT,
      description     TEXT NOT NULL,
      changes         TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'proposed'
        CHECK(status IN ('proposed', 'approved', 'rejected')),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan ON plan_revisions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_plan_revisions_status ON plan_revisions(status);
  `);
  applyMigrations(db);
}
function applyMigrations(db) {
  const version = db.pragma("user_version", { simple: true });
  if (version < 1) {
    if (!hasColumn(db, "plans", "branch")) {
      db.exec("ALTER TABLE plans ADD COLUMN branch TEXT");
    }
    if (!hasColumn(db, "plans", "worktree_name")) {
      db.exec("ALTER TABLE plans ADD COLUMN worktree_name TEXT");
    }
    db.exec("DROP VIEW IF EXISTS plan_progress");
    db.exec(`CREATE VIEW plan_progress AS ${PLAN_PROGRESS_VIEW_SQL}`);
    db.pragma("user_version = 1");
  }
  if (version < 2) {
    if (!hasColumn(db, "tasks", "depends_on")) {
      db.exec("ALTER TABLE tasks ADD COLUMN depends_on TEXT");
    }
    db.pragma("user_version = 2");
  }
  if (version < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS skill_usage (
        id          TEXT PRIMARY KEY,
        skill_name  TEXT NOT NULL,
        plan_id     TEXT REFERENCES plans(id),
        session_id  TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_skill_usage_name ON skill_usage(skill_name);
      CREATE INDEX IF NOT EXISTS idx_skill_usage_created ON skill_usage(created_at);
    `);
    db.pragma("user_version = 3");
  }
  if (version < 4) {
    if (!hasColumn(db, "tasks", "allowed_files")) {
      db.exec("ALTER TABLE tasks ADD COLUMN allowed_files TEXT");
    }
    if (!hasColumn(db, "tasks", "forbidden_patterns")) {
      db.exec("ALTER TABLE tasks ADD COLUMN forbidden_patterns TEXT");
    }
    db.pragma("user_version = 4");
  }
  if (version < 5) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_metrics'").all();
    if (tables.length > 0) {
      if (!hasColumn(db, "task_metrics", "changed_files_detail")) {
        db.exec("ALTER TABLE task_metrics ADD COLUMN changed_files_detail TEXT");
      }
      if (!hasColumn(db, "task_metrics", "scope_violations")) {
        db.exec("ALTER TABLE task_metrics ADD COLUMN scope_violations TEXT");
      }
    }
    db.pragma("user_version = 5");
  }
  if (version < 6) {
    db.pragma("foreign_keys = OFF");
    db.exec(`DROP VIEW IF EXISTS plan_progress`);
    db.exec(`DROP VIEW IF EXISTS plan_metrics`);
    db.exec(`
      CREATE TABLE plans_new (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        status      TEXT NOT NULL CHECK(status IN ('draft','active','approved','completed','archived')) DEFAULT 'draft',
        summary     TEXT,
        spec        TEXT,
        branch      TEXT,
        worktree_name TEXT,
        qa_overrides TEXT,
        running_summary TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
      INSERT INTO plans_new (id, title, status, summary, spec, branch, worktree_name, created_at, completed_at)
        SELECT id, title, status, summary, spec, branch, worktree_name, created_at, completed_at FROM plans;
      DROP TABLE plans;
      ALTER TABLE plans_new RENAME TO plans;
    `);
    db.pragma("foreign_keys = ON");
    db.exec(`CREATE VIEW plan_progress AS ${PLAN_PROGRESS_VIEW_SQL}`);
    db.exec(`
      CREATE VIEW plan_metrics AS
      SELECT
        p.id, p.title, p.status,
        COUNT(tm.id) AS recorded_tasks,
        ROUND(AVG(tm.duration_min), 2) AS avg_duration_min,
        SUM(CASE WHEN tm.final_status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count,
        SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done_count,
        SUM(CASE WHEN tm.has_concerns = 1 THEN 1 ELSE 0 END) AS concern_count,
        ROUND(SUM(CASE WHEN tm.final_status = 'done' THEN 1.0 ELSE 0 END) / MAX(COUNT(tm.id), 1) * 100) AS success_rate
      FROM plans p JOIN task_metrics tm ON tm.plan_id = p.id
      WHERE p.status IN ('completed', 'archived')
      GROUP BY p.id
    `);
    db.pragma("user_version = 6");
  }
  if (version < 7) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS self_improve_rules (
        id                TEXT PRIMARY KEY,
        error_kb_id       TEXT,
        title             TEXT NOT NULL,
        category          TEXT NOT NULL,
        rule_type         TEXT NOT NULL DEFAULT 'preventive' CHECK(rule_type IN ('preventive', 'procedural')),
        rule_path         TEXT NOT NULL,
        occurrences       INTEGER DEFAULT 0,
        prevented         INTEGER DEFAULT 0,
        status            TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
        created_at        TEXT DEFAULT (datetime('now')),
        last_triggered_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_self_improve_rules_status ON self_improve_rules(status);
      CREATE INDEX IF NOT EXISTS idx_self_improve_rules_category ON self_improve_rules(category);
      CREATE INDEX IF NOT EXISTS idx_self_improve_rules_kb_id ON self_improve_rules(error_kb_id);
    `);
    db.pragma("user_version = 7");
  }
  if (version < 8) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS qa_runs (
        id                TEXT PRIMARY KEY,
        plan_id           TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        "trigger"         TEXT NOT NULL CHECK("trigger" IN ('manual', 'auto', 'milestone', 'post_merge')),
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
        summary           TEXT,
        total_scenarios   INTEGER DEFAULT 0,
        passed_scenarios  INTEGER DEFAULT 0,
        failed_scenarios  INTEGER DEFAULT 0,
        risk_score        REAL DEFAULT 0,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at      DATETIME
      );

      CREATE TABLE IF NOT EXISTS qa_scenarios (
        id                TEXT PRIMARY KEY,
        run_id            TEXT NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
        category          TEXT NOT NULL CHECK(category IN ('functional', 'integration', 'flow', 'regression', 'edge_case', 'acceptance', 'security')),
        title             TEXT NOT NULL,
        description       TEXT NOT NULL,
        priority          TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
        related_tasks     TEXT,
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'pass', 'fail', 'skip', 'warn')) DEFAULT 'pending',
        agent             TEXT,
        evidence          TEXT,
        source            TEXT NOT NULL DEFAULT 'final' CHECK(source IN ('seed', 'shadow', 'wave', 'final', 'manual')),
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS qa_findings (
        id                TEXT PRIMARY KEY,
        run_id            TEXT NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
        scenario_id       TEXT REFERENCES qa_scenarios(id) ON DELETE SET NULL,
        severity          TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
        category          TEXT NOT NULL CHECK(category IN ('bug', 'regression', 'missing_feature', 'inconsistency', 'performance', 'security', 'ux_issue', 'spec_gap')),
        title             TEXT NOT NULL,
        description       TEXT NOT NULL,
        affected_files    TEXT,
        related_task_id   TEXT REFERENCES tasks(id),
        fix_suggestion    TEXT,
        status            TEXT NOT NULL CHECK(status IN ('open', 'planned', 'fixed', 'wontfix', 'duplicate')) DEFAULT 'open',
        fix_plan_id       TEXT REFERENCES plans(id),
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE VIEW IF NOT EXISTS qa_run_summary AS
      SELECT
        qr.id,
        qr.plan_id,
        qr.status,
        qr.risk_score,
        qr.created_at,
        COUNT(DISTINCT qs.id) AS total_scenarios,
        SUM(CASE WHEN qs.status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN qs.status = 'fail' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN qs.status = 'warn' THEN 1 ELSE 0 END) AS warned,
        COUNT(DISTINCT qf.id) AS total_findings,
        SUM(CASE WHEN qf.severity = 'critical' THEN 1 ELSE 0 END) AS critical_findings,
        SUM(CASE WHEN qf.severity = 'high' THEN 1 ELSE 0 END) AS high_findings
      FROM qa_runs qr
      LEFT JOIN qa_scenarios qs ON qs.run_id = qr.id
      LEFT JOIN qa_findings qf ON qf.run_id = qr.id
      GROUP BY qr.id;

      CREATE INDEX IF NOT EXISTS idx_qa_runs_plan ON qa_runs(plan_id);
      CREATE INDEX IF NOT EXISTS idx_qa_scenarios_run ON qa_scenarios(run_id);
      CREATE INDEX IF NOT EXISTS idx_qa_scenarios_status ON qa_scenarios(status);
      CREATE INDEX IF NOT EXISTS idx_qa_findings_run ON qa_findings(run_id);
      CREATE INDEX IF NOT EXISTS idx_qa_findings_severity ON qa_findings(severity);
      CREATE INDEX IF NOT EXISTS idx_qa_findings_status ON qa_findings(status);
    `);
    db.pragma("user_version = 8");
  }
  if (version < 9) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS backlog_items (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        description      TEXT,
        priority         TEXT NOT NULL CHECK(priority IN ('critical','high','medium','low')) DEFAULT 'medium',
        category         TEXT CHECK(category IN ('feature','bugfix','refactor','chore','idea')),
        tags             TEXT,
        complexity_hint  TEXT CHECK(complexity_hint IN ('simple','moderate','complex')),
        source           TEXT,
        status           TEXT NOT NULL CHECK(status IN ('open','planned','done','dropped')) DEFAULT 'open',
        plan_id          TEXT REFERENCES plans(id) ON DELETE SET NULL,
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_backlog_status ON backlog_items(status);
      CREATE INDEX IF NOT EXISTS idx_backlog_priority ON backlog_items(priority);
      CREATE INDEX IF NOT EXISTS idx_backlog_plan ON backlog_items(plan_id);
    `);
    db.pragma("user_version = 9");
  }
  if (version < 10) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS merge_reports (
        id              TEXT PRIMARY KEY,
        plan_id         TEXT REFERENCES plans(id),
        commit_hash     TEXT NOT NULL,
        source_branch   TEXT NOT NULL,
        target_branch   TEXT NOT NULL,
        changes_summary TEXT NOT NULL,
        review_checklist TEXT NOT NULL,
        conflict_log    TEXT,
        ai_judgments    TEXT,
        verification    TEXT NOT NULL,
        task_ids        TEXT,
        report_path     TEXT NOT NULL,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        pr_number       INTEGER,
        pr_url          TEXT,
        merge_method    TEXT,
        closed_issues   TEXT,
        auto_resolved_files TEXT,
        conflict_levels TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_merge_reports_plan ON merge_reports(plan_id);
      CREATE INDEX IF NOT EXISTS idx_merge_reports_commit ON merge_reports(commit_hash);
    `);
    db.pragma("user_version = 10");
  }
  if (version < 11) {
    if (!hasColumn(db, "self_improve_rules", "enforcement")) {
      db.exec("ALTER TABLE self_improve_rules ADD COLUMN enforcement TEXT DEFAULT 'SOFT' CHECK(enforcement IN ('SOFT', 'HARD'))");
    }
    if (!hasColumn(db, "self_improve_rules", "escalated_at")) {
      db.exec("ALTER TABLE self_improve_rules ADD COLUMN escalated_at TEXT");
    }
    db.pragma("user_version = 11");
  }
  if (version < 12) {
    const vecLoaded = loadVec(db);
    if (vecLoaded) {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_errors USING vec0(embedding float[384]);
        CREATE TABLE IF NOT EXISTS error_embeddings (
          error_id TEXT PRIMARY KEY,
          vec_rowid INTEGER NOT NULL,
          model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_error_embeddings_vec ON error_embeddings(vec_rowid);
      `);
    }
    db.pragma("user_version = 12");
  }
  if (version < 13) {
    db.pragma("foreign_keys = OFF");
    db.exec("DROP VIEW IF EXISTS qa_run_summary");
    db.exec("DROP VIEW IF EXISTS plan_progress");
    db.exec("DROP VIEW IF EXISTS plan_metrics");
    db.exec(`
      CREATE TABLE qa_scenarios_new (
        id                TEXT PRIMARY KEY,
        run_id            TEXT NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
        category          TEXT NOT NULL CHECK(category IN ('functional', 'integration', 'flow', 'regression', 'edge_case', 'acceptance', 'security')),
        title             TEXT NOT NULL,
        description       TEXT NOT NULL,
        priority          TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
        related_tasks     TEXT,
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'pass', 'fail', 'skip', 'warn')) DEFAULT 'pending',
        agent             TEXT,
        evidence          TEXT,
        source            TEXT NOT NULL DEFAULT 'final' CHECK(source IN ('seed', 'shadow', 'wave', 'final', 'manual')),
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO qa_scenarios_new (id, run_id, category, title, description, priority, related_tasks, status, agent, evidence, created_at)
        SELECT id, run_id, category, title, description, priority, related_tasks, status, agent, evidence, created_at FROM qa_scenarios;
      DROP TABLE qa_scenarios;
      ALTER TABLE qa_scenarios_new RENAME TO qa_scenarios;
    `);
    db.exec(`
      CREATE TABLE qa_runs_new (
        id                TEXT PRIMARY KEY,
        plan_id           TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        "trigger"         TEXT NOT NULL CHECK("trigger" IN ('manual', 'auto', 'milestone', 'post_merge')),
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
        summary           TEXT,
        total_scenarios   INTEGER DEFAULT 0,
        passed_scenarios  INTEGER DEFAULT 0,
        failed_scenarios  INTEGER DEFAULT 0,
        risk_score        REAL DEFAULT 0,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at      DATETIME
      );
      INSERT INTO qa_runs_new SELECT * FROM qa_runs;
      DROP TABLE qa_runs;
      ALTER TABLE qa_runs_new RENAME TO qa_runs;
    `);
    db.pragma("foreign_keys = ON");
    db.exec(`
      CREATE VIEW IF NOT EXISTS qa_run_summary AS
      SELECT
        qr.id,
        qr.plan_id,
        qr.status,
        qr.risk_score,
        qr.created_at,
        COUNT(DISTINCT qs.id) AS total_scenarios,
        SUM(CASE WHEN qs.status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN qs.status = 'fail' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN qs.status = 'warn' THEN 1 ELSE 0 END) AS warned,
        COUNT(DISTINCT qf.id) AS total_findings,
        SUM(CASE WHEN qf.severity = 'critical' THEN 1 ELSE 0 END) AS critical_findings,
        SUM(CASE WHEN qf.severity = 'high' THEN 1 ELSE 0 END) AS high_findings
      FROM qa_runs qr
      LEFT JOIN qa_scenarios qs ON qs.run_id = qr.id
      LEFT JOIN qa_findings qf ON qf.run_id = qr.id
      GROUP BY qr.id
    `);
    db.exec(`CREATE VIEW IF NOT EXISTS plan_progress AS ${PLAN_PROGRESS_VIEW_SQL}`);
    const hasTM = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_metrics'").get();
    if (hasTM) {
      db.exec(`
        CREATE VIEW IF NOT EXISTS plan_metrics AS
        SELECT
          p.id, p.title, p.status,
          COUNT(tm.id) AS recorded_tasks,
          ROUND(AVG(tm.duration_min), 2) AS avg_duration_min,
          SUM(CASE WHEN tm.final_status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count,
          SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done_count,
          SUM(CASE WHEN tm.has_concerns = 1 THEN 1 ELSE 0 END) AS concern_count,
          ROUND(SUM(CASE WHEN tm.final_status = 'done' THEN 1.0 ELSE 0 END) / MAX(COUNT(tm.id), 1) * 100) AS success_rate
        FROM plans p JOIN task_metrics tm ON tm.plan_id = p.id
        WHERE p.status IN ('completed', 'archived')
        GROUP BY p.id
      `);
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_qa_runs_plan ON qa_runs(plan_id);
      CREATE INDEX IF NOT EXISTS idx_qa_scenarios_run ON qa_scenarios(run_id);
      CREATE INDEX IF NOT EXISTS idx_qa_scenarios_status ON qa_scenarios(status);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_handoffs (
        id            TEXT PRIMARY KEY,
        task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        plan_id       TEXT REFERENCES plans(id) ON DELETE CASCADE,
        agent_type    TEXT NOT NULL,
        attempt       INTEGER NOT NULL DEFAULT 1,
        input_hash    TEXT,
        verdict       TEXT,
        summary       TEXT,
        report_path   TEXT,
        changed_files TEXT,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_agent_handoffs_task ON agent_handoffs(task_id);
      CREATE INDEX IF NOT EXISTS idx_agent_handoffs_plan ON agent_handoffs(plan_id);

      CREATE TABLE IF NOT EXISTS wave_gates (
        id              TEXT PRIMARY KEY,
        plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        wave_number     INTEGER NOT NULL,
        task_ids        TEXT NOT NULL,
        verdict         TEXT NOT NULL CHECK(verdict IN ('GREEN', 'YELLOW', 'RED')),
        summary         TEXT,
        findings_count  INTEGER DEFAULT 0,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_wave_gates_plan ON wave_gates(plan_id);

      CREATE TABLE IF NOT EXISTS plan_revisions (
        id              TEXT PRIMARY KEY,
        plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        trigger_type    TEXT NOT NULL CHECK(trigger_type IN (
          'assumption_violation', 'scope_explosion',
          'design_flaw', 'complexity_exceeded', 'dependency_shift'
        )),
        trigger_source  TEXT,
        description     TEXT NOT NULL,
        changes         TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'proposed'
          CHECK(status IN ('proposed', 'approved', 'rejected')),
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan ON plan_revisions(plan_id);
      CREATE INDEX IF NOT EXISTS idx_plan_revisions_status ON plan_revisions(status);
    `);
    if (!hasColumn(db, "plans", "qa_overrides")) {
      db.exec("ALTER TABLE plans ADD COLUMN qa_overrides TEXT");
    }
    if (!hasColumn(db, "tasks", "shadow_result")) {
      db.exec("ALTER TABLE tasks ADD COLUMN shadow_result TEXT CHECK(shadow_result IN ('clean', 'warning', 'alert'))");
    }
    db.pragma("user_version = 13");
  }
  if (version < 14) {
    if (!hasColumn(db, "plans", "running_summary")) {
      db.exec("ALTER TABLE plans ADD COLUMN running_summary TEXT");
    }
    const hasSIR = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='self_improve_rules'").get();
    if (hasSIR && !hasColumn(db, "self_improve_rules", "rule_type")) {
      db.exec("ALTER TABLE self_improve_rules ADD COLUMN rule_type TEXT NOT NULL DEFAULT 'preventive' CHECK(rule_type IN ('preventive', 'procedural'))");
    }
    db.pragma("user_version = 14");
  }
  if (version < 15) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS gc_scans (
        id               TEXT PRIMARY KEY,
        scan_type        TEXT NOT NULL CHECK(scan_type IN ('full', 'incremental')),
        started_at       TEXT NOT NULL,
        completed_at     TEXT,
        files_scanned    INTEGER DEFAULT 0,
        findings_count   INTEGER DEFAULT 0,
        auto_fixed_count INTEGER DEFAULT 0,
        status           TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')) DEFAULT 'running'
      );

      CREATE TABLE IF NOT EXISTS gc_findings (
        id               TEXT PRIMARY KEY,
        scan_id          TEXT NOT NULL REFERENCES gc_scans(id) ON DELETE CASCADE,
        category         TEXT NOT NULL CHECK(category IN ('DEAD_CODE', 'RULE_VIOLATION', 'POLICY_VIOLATION', 'REFACTOR_CANDIDATE')),
        severity         TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
        safety_level     TEXT NOT NULL CHECK(safety_level IN ('SAFE', 'RISKY')),
        file_path        TEXT NOT NULL,
        line_start       INTEGER NOT NULL,
        line_end         INTEGER NOT NULL,
        rule_source      TEXT NOT NULL CHECK(rule_source IN ('SELF_IMPROVE', 'POLICY', 'ARCHITECTURE', 'BUILTIN')),
        rule_id          TEXT,
        description      TEXT NOT NULL,
        suggested_fix    TEXT,
        status           TEXT NOT NULL CHECK(status IN ('detected', 'auto_fixed', 'approved', 'dismissed', 'reverted')) DEFAULT 'detected',
        resolved_at      TEXT
      );

      CREATE TABLE IF NOT EXISTS gc_changes (
        id               TEXT PRIMARY KEY,
        finding_id       TEXT NOT NULL REFERENCES gc_findings(id) ON DELETE CASCADE,
        commit_sha       TEXT NOT NULL,
        file_path        TEXT NOT NULL,
        diff_content     TEXT NOT NULL,
        rollback_cmd     TEXT NOT NULL,
        created_at       TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_gc_scans_status ON gc_scans(status);
      CREATE INDEX IF NOT EXISTS idx_gc_findings_scan ON gc_findings(scan_id);
      CREATE INDEX IF NOT EXISTS idx_gc_findings_category ON gc_findings(category);
      CREATE INDEX IF NOT EXISTS idx_gc_findings_status ON gc_findings(status);
      CREATE INDEX IF NOT EXISTS idx_gc_findings_severity ON gc_findings(severity);
      CREATE INDEX IF NOT EXISTS idx_gc_changes_finding ON gc_changes(finding_id);
    `);
    db.pragma("user_version = 15");
  }
  if (version < 16) {
    if (!hasColumn(db, "merge_reports", "pr_number")) {
      db.exec("ALTER TABLE merge_reports ADD COLUMN pr_number INTEGER");
    }
    if (!hasColumn(db, "merge_reports", "pr_url")) {
      db.exec("ALTER TABLE merge_reports ADD COLUMN pr_url TEXT");
    }
    if (!hasColumn(db, "merge_reports", "merge_method")) {
      db.exec("ALTER TABLE merge_reports ADD COLUMN merge_method TEXT");
    }
    if (!hasColumn(db, "merge_reports", "closed_issues")) {
      db.exec("ALTER TABLE merge_reports ADD COLUMN closed_issues TEXT");
    }
    if (!hasColumn(db, "merge_reports", "auto_resolved_files")) {
      db.exec("ALTER TABLE merge_reports ADD COLUMN auto_resolved_files TEXT");
    }
    if (!hasColumn(db, "merge_reports", "conflict_levels")) {
      db.exec("ALTER TABLE merge_reports ADD COLUMN conflict_levels TEXT");
    }
    db.pragma("user_version = 16");
  }
  if (version < 17) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS artifact_cleanups (
        id                TEXT PRIMARY KEY,
        trigger           TEXT NOT NULL,
        started_at        TEXT NOT NULL,
        completed_at      TEXT,
        handoffs_removed  INTEGER DEFAULT 0,
        reports_removed   INTEGER DEFAULT 0,
        rules_archived    INTEGER DEFAULT 0,
        rules_conflicts   INTEGER DEFAULT 0,
        empty_dirs_removed INTEGER DEFAULT 0,
        dry_run           INTEGER DEFAULT 0,
        summary           TEXT
      );
    `);
    db.pragma("user_version = 17");
  }
}

// src/core/engine/dashboard.ts
var DashboardEngine = class {
  db;
  skillUsageModel;
  constructor(db, skillUsageModel) {
    this.db = db;
    this.skillUsageModel = skillUsageModel;
  }
  getSkillUsageSummary(days = 7) {
    if (!this.skillUsageModel) return [];
    return this.skillUsageModel.getStats(days).slice(0, 5);
  }
  getOverview() {
    const plans = this.db.prepare("SELECT * FROM plan_progress").all();
    const active_count = plans.filter((p) => p.status === "active").length;
    const total_tasks = plans.reduce((sum, p) => sum + p.total_tasks, 0);
    const done_tasks = plans.reduce((sum, p) => sum + p.done_tasks, 0);
    const backlog = this.getBacklogSummary();
    return { plans, active_count, total_tasks, done_tasks, backlog };
  }
  getBacklogSummary() {
    try {
      const rows = this.db.prepare(
        `SELECT priority, COUNT(*) AS count
           FROM backlog_items
           WHERE status = 'open'
           GROUP BY priority`
      ).all();
      const by_priority = { critical: 0, high: 0, medium: 0, low: 0 };
      let open = 0;
      for (const row of rows) {
        if (row.priority in by_priority) {
          by_priority[row.priority] = row.count;
        }
        open += row.count;
      }
      const totalRow = this.db.prepare("SELECT COUNT(*) AS total FROM backlog_items").get();
      const top_items = this.db.prepare(
        `SELECT * FROM backlog_items
           WHERE status = 'open'
           ORDER BY CASE priority
             WHEN 'critical' THEN 0
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             WHEN 'low' THEN 3
           END, created_at DESC
           LIMIT 5`
      ).all();
      return { total: totalRow.total, open, by_priority, top_items };
    } catch (e) {
      console.error("[dashboard] backlog query failed:", e instanceof Error ? e.message : e);
      return { total: 0, open: 0, by_priority: { critical: 0, high: 0, medium: 0, low: 0 }, top_items: [] };
    }
  }
  getPlanSummary(planId) {
    const row = this.db.prepare("SELECT * FROM plan_progress WHERE id = ?").get(planId);
    return row ?? null;
  }
  getQASummary(planId) {
    try {
      const row = this.db.prepare(
        `SELECT * FROM qa_run_summary
           WHERE plan_id = ?
           ORDER BY created_at DESC LIMIT 1`
      ).get(planId);
      return row ?? null;
    } catch (e) {
      console.error("[dashboard] QA run query failed:", e instanceof Error ? e.message : e);
      return null;
    }
  }
  getOpenFindings(planId) {
    try {
      const rows = this.db.prepare(
        `SELECT qf.severity, COUNT(*) AS count
           FROM qa_findings qf
           JOIN qa_runs qr ON qr.id = qf.run_id
           WHERE qr.plan_id = ? AND qf.status = 'open'
           GROUP BY qf.severity`
      ).all(planId);
      const result = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const row of rows) {
        if (row.severity in result) {
          result[row.severity] = row.count;
        }
      }
      return result;
    } catch (e) {
      console.error("[dashboard] alert counts query failed:", e instanceof Error ? e.message : e);
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }
  }
};

// src/core/engine/alerts.ts
var AlertsEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  getAlerts() {
    const alerts = [];
    const progress = this.getAllPlanProgress();
    for (const task of this.getStaleTasks()) {
      alerts.push({
        type: "stale",
        entity_type: "task",
        entity_id: task.id,
        message: `Task "${task.title}" has been in progress for ${task.days_stale} days with no activity`
      });
    }
    for (const plan of progress.filter((p) => p.blocked_tasks > 0)) {
      alerts.push({
        type: "blocked",
        entity_type: "plan",
        entity_id: plan.id,
        message: `Plan "${plan.title}" has ${plan.blocked_tasks} blocked task(s)`
      });
    }
    for (const plan of progress.filter((p) => p.progress_pct === 100 && p.status === "active")) {
      alerts.push({
        type: "completable",
        entity_type: "plan",
        entity_id: plan.id,
        message: `Plan "${plan.title}" has all tasks done and can be completed`
      });
    }
    for (const plan of this.getForgottenPlans()) {
      alerts.push({
        type: "forgotten",
        entity_type: "plan",
        entity_id: plan.id,
        message: `Plan "${plan.title}" has had no activity for ${plan.days_inactive} days`
      });
    }
    alerts.push(...this.getQAAlerts(progress));
    alerts.push(...this.getBacklogAlerts());
    return alerts;
  }
  getQAAlerts(progress) {
    const qaAlerts = [];
    if (progress.length === 0) return qaAlerts;
    try {
      const planMap = new Map(progress.map((p) => [p.id, p]));
      const highRiskRuns = this.db.prepare(
        `SELECT plan_id, risk_score FROM qa_runs
         WHERE status = 'completed' AND risk_score >= 0.5
         AND created_at = (SELECT MAX(created_at) FROM qa_runs qr2 WHERE qr2.plan_id = qa_runs.plan_id AND qr2.status = 'completed')
         GROUP BY plan_id`
      ).all();
      for (const row of highRiskRuns) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: "qa_risk_high",
            entity_type: "plan",
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"\uC758 QA \uB9AC\uC2A4\uD06C\uAC00 \uB192\uC2B5\uB2C8\uB2E4 (risk: ${row.risk_score.toFixed(2)})`
          });
        }
      }
      const openFindings = this.db.prepare(
        `SELECT qr.plan_id, COUNT(*) AS count FROM qa_findings qf
         JOIN qa_runs qr ON qr.id = qf.run_id
         WHERE qf.status = 'open' AND qf.severity IN ('critical', 'high')
         GROUP BY qr.plan_id`
      ).all();
      for (const row of openFindings) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: "qa_findings_open",
            entity_type: "plan",
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"\uC5D0 \uBBF8\uD574\uACB0 critical/high QA \uC774\uC288\uAC00 ${row.count}\uAC74 \uC788\uC2B5\uB2C8\uB2E4`
          });
        }
      }
      const staleRuns = this.db.prepare(
        `SELECT plan_id, CAST(JULIANDAY('now') - JULIANDAY(MAX(created_at)) AS INTEGER) AS days_since
         FROM qa_runs WHERE status = 'completed'
         GROUP BY plan_id
         HAVING days_since > 7`
      ).all();
      for (const row of staleRuns) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: "qa_stale",
            entity_type: "plan",
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"\uC758 \uB9C8\uC9C0\uB9C9 QA\uAC00 ${row.days_since}\uC77C \uC804\uC785\uB2C8\uB2E4`
          });
        }
      }
      const blockedFixPlans = this.db.prepare(
        `SELECT DISTINCT qr.plan_id, COUNT(t.id) AS blocked_count
         FROM qa_findings qf
         JOIN qa_runs qr ON qr.id = qf.run_id
         JOIN tasks t ON t.plan_id = qf.fix_plan_id AND t.status = 'blocked'
         WHERE qf.fix_plan_id IS NOT NULL
         GROUP BY qr.plan_id`
      ).all();
      for (const row of blockedFixPlans) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: "qa_fix_blocked",
            entity_type: "plan",
            entity_id: row.plan_id,
            message: `QA \uC218\uC815 \uD50C\uB79C\uC5D0 \uCC28\uB2E8\uB41C \uD0DC\uC2A4\uD06C\uAC00 ${row.blocked_count}\uAC74 \uC788\uC2B5\uB2C8\uB2E4`
          });
        }
      }
    } catch {
    }
    return qaAlerts;
  }
  getAllPlanProgress() {
    return this.db.prepare("SELECT * FROM plan_progress").all();
  }
  getStaleTasks(thresholdDays = 3) {
    return this.db.prepare(
      `SELECT t.*, CAST(JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) AS INTEGER) AS days_stale
         FROM tasks t
         JOIN events e ON e.entity_id = t.id
         WHERE t.status = 'in_progress'
         GROUP BY t.id
         HAVING JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) > ?`
    ).all(thresholdDays);
  }
  getBlockedPlans() {
    return this.db.prepare("SELECT * FROM plan_progress WHERE blocked_tasks > 0").all();
  }
  getCompletablePlans() {
    return this.db.prepare(
      "SELECT * FROM plan_progress WHERE progress_pct = 100 AND status = 'active'"
    ).all();
  }
  getBacklogAlerts() {
    const alerts = [];
    try {
      const staleItems = this.db.prepare(
        `SELECT id, title, CAST(JULIANDAY('now') - JULIANDAY(created_at) AS INTEGER) AS days_old
         FROM backlog_items
         WHERE status = 'open'
         AND JULIANDAY('now') - JULIANDAY(created_at) > 7`
      ).all();
      for (const item of staleItems) {
        alerts.push({
          type: "backlog_stale",
          entity_type: "backlog",
          entity_id: item.id,
          message: `\uBC31\uB85C\uADF8 "${item.title}"\uC774 ${item.days_old}\uC77C\uAC04 \uBBF8\uCC98\uB9AC \uC0C1\uD0DC\uC785\uB2C8\uB2E4`
        });
      }
      const criticalItems = this.db.prepare(
        `SELECT id, title FROM backlog_items
         WHERE status = 'open' AND priority = 'critical'`
      ).all();
      for (const item of criticalItems) {
        alerts.push({
          type: "backlog_critical",
          entity_type: "backlog",
          entity_id: item.id,
          message: `\uBC31\uB85C\uADF8 "${item.title}"\uC774 critical \uC6B0\uC120\uC21C\uC704\uB85C \uBBF8\uCC98\uB9AC \uC0C1\uD0DC\uC785\uB2C8\uB2E4`
        });
      }
    } catch {
    }
    return alerts;
  }
  getForgottenPlans(thresholdDays = 7) {
    return this.db.prepare(
      `SELECT p.*, CAST(JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) AS INTEGER) AS days_inactive
         FROM plans p
         JOIN events e ON (
           e.entity_id = p.id
           OR e.entity_id IN (SELECT id FROM tasks WHERE plan_id = p.id)
         )
         WHERE p.status = 'active'
         GROUP BY p.id
         HAVING JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) > ?`
    ).all(thresholdDays);
  }
};

// src/core/engine/stats.ts
var StatsEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  getVelocity(planId, days = 7) {
    const cutoff = /* @__PURE__ */ new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    let query;
    const params = [];
    if (planId) {
      query = `
        SELECT COUNT(*) AS total_completed
        FROM events e
        JOIN tasks t ON e.entity_id = t.id
        WHERE e.event_type = 'status_changed'
          AND JSON_EXTRACT(e.new_value, '$.status') = 'done'
          AND DATE(e.created_at) >= ?
          AND t.plan_id = ?
      `;
      params.push(cutoffStr, planId);
    } else {
      query = `
        SELECT COUNT(*) AS total_completed
        FROM events
        WHERE event_type = 'status_changed'
          AND JSON_EXTRACT(new_value, '$.status') = 'done'
          AND DATE(created_at) >= ?
      `;
      params.push(cutoffStr);
    }
    const row = this.db.prepare(query).get(...params);
    const total_completed = row.total_completed;
    const daily = total_completed / days;
    return { daily, total_completed };
  }
  getEstimatedCompletion(planId) {
    const remainingRow = this.db.prepare(
      `SELECT COUNT(*) AS remaining
         FROM tasks
         WHERE plan_id = ?
           AND status NOT IN ('done', 'skipped')`
    ).get(planId);
    const remaining_tasks = remainingRow.remaining;
    const { daily: velocity } = this.getVelocity(planId);
    if (velocity === 0) {
      return {
        remaining_tasks,
        velocity,
        estimated_days: null,
        estimated_date: null
      };
    }
    const estimated_days = Math.ceil(remaining_tasks / velocity);
    const estimatedDate = /* @__PURE__ */ new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimated_days);
    const estimated_date = estimatedDate.toISOString().split("T")[0];
    return {
      remaining_tasks,
      velocity,
      estimated_days,
      estimated_date
    };
  }
  getTimeline(planId) {
    let query;
    const params = [];
    if (planId) {
      query = `
        SELECT DATE(e.created_at) AS date, COUNT(*) AS tasks_completed
        FROM events e
        JOIN tasks t ON e.entity_id = t.id
        WHERE e.event_type = 'status_changed'
          AND JSON_EXTRACT(e.new_value, '$.status') = 'done'
          AND t.plan_id = ?
        GROUP BY DATE(e.created_at)
        ORDER BY DATE(e.created_at)
      `;
      params.push(planId);
    } else {
      query = `
        SELECT DATE(created_at) AS date, COUNT(*) AS tasks_completed
        FROM events
        WHERE event_type = 'status_changed'
          AND JSON_EXTRACT(new_value, '$.status') = 'done'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;
    }
    const rows = this.db.prepare(query).all(...params);
    let cumulative = 0;
    return rows.map((row) => {
      cumulative += row.tasks_completed;
      return {
        date: row.date,
        tasks_completed: row.tasks_completed,
        cumulative
      };
    });
  }
};

// src/core/engine/insights.ts
var InsightsEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  getBlockedPatterns() {
    const rows = this.db.prepare(
      `SELECT
           COALESCE(block_reason, 'unspecified') AS reason,
           COUNT(*) AS count
         FROM task_metrics
         WHERE final_status = 'blocked'
         GROUP BY reason
         ORDER BY count DESC`
    ).all();
    if (rows.length === 0) return [];
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return rows.map((r) => ({
      reason: r.reason,
      count: r.count,
      pct: Math.round(r.count / total * 100)
    }));
  }
  getDurationStats() {
    const statsRow = this.db.prepare(
      `SELECT
           ROUND(AVG(duration_min), 1) AS avg_min,
           COUNT(*) AS sample_count
         FROM task_metrics
         WHERE duration_min IS NOT NULL`
    ).get();
    const sampleCount = statsRow.sample_count;
    if (sampleCount === 0) {
      return { avg_min: 0, median_min: 0, sample_count: 0 };
    }
    const avgMin = statsRow.avg_min ?? 0;
    let medianMin;
    if (sampleCount % 2 === 1) {
      const offset = Math.floor(sampleCount / 2);
      const row = this.db.prepare(
        `SELECT duration_min
           FROM task_metrics
           WHERE duration_min IS NOT NULL
           ORDER BY duration_min
           LIMIT 1 OFFSET ?`
      ).get(offset);
      medianMin = row.duration_min;
    } else {
      const offset = sampleCount / 2 - 1;
      const rows = this.db.prepare(
        `SELECT duration_min
           FROM task_metrics
           WHERE duration_min IS NOT NULL
           ORDER BY duration_min
           LIMIT 2 OFFSET ?`
      ).all(offset);
      medianMin = (rows[0].duration_min + rows[1].duration_min) / 2;
    }
    return { avg_min: avgMin, median_min: medianMin, sample_count: sampleCount };
  }
  getSuccessRates() {
    const overallRow = this.db.prepare(
      `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN final_status = 'done' THEN 1 ELSE 0 END) AS done
         FROM task_metrics
         WHERE final_status IN ('done', 'blocked', 'skipped')`
    ).get();
    const overall = overallRow.total > 0 ? Math.round(overallRow.done / overallRow.total * 100) : 0;
    const byPlanRows = this.db.prepare(
      `SELECT
           p.title,
           COUNT(*) AS count,
           SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done
         FROM task_metrics tm
         JOIN plans p ON p.id = tm.plan_id
         WHERE tm.final_status IN ('done', 'blocked', 'skipped')
         GROUP BY tm.plan_id`
    ).all();
    const by_plan = byPlanRows.map((r) => ({
      title: r.title,
      rate: Math.round(r.done / r.count * 100),
      count: r.count
    }));
    return { overall, by_plan };
  }
  getRecommendations() {
    const totalRow = this.db.prepare("SELECT COUNT(*) AS total FROM task_metrics").get();
    if (totalRow.total < 5) return [];
    const recommendations = [];
    const total = totalRow.total;
    const blockedRow = this.db.prepare("SELECT COUNT(*) AS blocked FROM task_metrics WHERE final_status = 'blocked'").get();
    const blockedPct = Math.round(blockedRow.blocked / total * 100);
    if (blockedPct >= 30) {
      recommendations.push(
        `Blocked \uD0DC\uC2A4\uD06C \uBE44\uC728\uC774 ${blockedPct}%\uB85C \uB192\uC2B5\uB2C8\uB2E4. \uD0DC\uC2A4\uD06C \uBD84\uD574\uB97C \uB354 \uC138\uBD84\uD654\uD558\uAC70\uB098 \uC758\uC874\uC131\uC744 \uC0AC\uC804\uC5D0 \uD655\uC778\uD558\uC138\uC694.`
      );
    }
    const durationRow = this.db.prepare(
      `SELECT ROUND(AVG(duration_min), 1) AS avg_min
         FROM task_metrics
         WHERE duration_min IS NOT NULL`
    ).get();
    if (durationRow.avg_min !== null && durationRow.avg_min > 60) {
      recommendations.push(
        `\uD3C9\uADE0 \uD0DC\uC2A4\uD06C \uC18C\uC694 \uC2DC\uAC04\uC774 ${durationRow.avg_min}\uBD84\uC785\uB2C8\uB2E4. \uD0DC\uC2A4\uD06C\uB97C \uB354 \uC791\uC740 \uB2E8\uC704\uB85C \uBD84\uD574\uD558\uB294 \uAC83\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.`
      );
    }
    const concernsRow = this.db.prepare("SELECT SUM(CASE WHEN has_concerns = 1 THEN 1 ELSE 0 END) AS concerns FROM task_metrics").get();
    const concernsPct = Math.round(concernsRow.concerns / total * 100);
    if (concernsPct >= 50) {
      recommendations.push(
        `\uAD6C\uD604 \uC6B0\uB824\uC0AC\uD56D\uC774 ${concernsPct}%\uC758 \uD0DC\uC2A4\uD06C\uC5D0\uC11C \uBC1C\uACAC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC2A4\uD399 \uBA85\uD655\uD654\uAC00 \uD544\uC694\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`
      );
    }
    return recommendations;
  }
  getConfidenceLevel() {
    const row = this.db.prepare("SELECT COUNT(*) AS total FROM task_metrics").get();
    if (row.total < 5) return "low";
    if (row.total < 20) return "medium";
    return "high";
  }
};

// src/core/models/event.ts
var EventModel = class extends BaseRepository {
  constructor(db) {
    super(db, "events");
  }
  record(optsOrEntityType, entityId, eventType, oldValue, newValue, sessionId) {
    let opts;
    if (typeof optsOrEntityType === "object") {
      opts = optsOrEntityType;
    } else {
      opts = {
        entityType: optsOrEntityType,
        entityId,
        eventType,
        oldValue,
        newValue,
        sessionId
      };
    }
    const stmt = this.db.prepare(
      `INSERT INTO events (entity_type, entity_id, event_type, old_value, new_value, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      opts.entityType,
      opts.entityId,
      opts.eventType,
      opts.oldValue ?? null,
      opts.newValue ?? null,
      opts.sessionId ?? null
    );
    return this.db.prepare(`SELECT * FROM events WHERE id = ?`).get(result.lastInsertRowid);
  }
  getByEntity(entityType, entityId) {
    const stmt = this.db.prepare(
      `SELECT * FROM events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC, id ASC`
    );
    return stmt.all(entityType, entityId);
  }
  getBySession(sessionId) {
    const stmt = this.db.prepare(
      `SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC, id ASC`
    );
    return stmt.all(sessionId);
  }
  getRecent(limit = 20) {
    const stmt = this.db.prepare(
      `SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT ?`
    );
    return stmt.all(limit);
  }
};

// src/core/models/plan.ts
var PLAN_TRANSITIONS = {
  draft: ["active"],
  active: ["approved", "completed", "archived"],
  approved: ["completed", "archived"],
  completed: ["archived"],
  archived: []
};
var PlanModel = class extends BaseRepository {
  events;
  handoffs;
  constructor(db, events, handoffs) {
    super(db, "plans");
    this.events = events;
    this.handoffs = handoffs;
  }
  requireById(id) {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    return plan;
  }
  create(title, spec, summary) {
    const id = generateId();
    const ctx = detectGitContext();
    this.db.prepare(
      `INSERT INTO plans (id, title, status, spec, summary, branch, worktree_name) VALUES (?, ?, 'draft', ?, ?, ?, ?)`
    ).run(id, title, spec ?? null, summary ?? null, ctx.branch, ctx.worktreeName);
    const plan = this.requireById(id);
    this.events?.record("plan", plan.id, "created", null, JSON.stringify({ title, status: "draft", branch: ctx.branch }));
    return plan;
  }
  list(filter) {
    const conditions = [];
    const params = [];
    if (filter?.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter?.branch) {
      conditions.push("branch = ?");
      params.push(filter.branch);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.prepare(`SELECT * FROM plans ${where} ORDER BY created_at DESC`).all(...params);
  }
  appendRunningSummary(id, taskSummary) {
    const plan = this.requireById(id);
    let newSummary;
    if (plan.running_summary === null || plan.running_summary === void 0) {
      newSummary = taskSummary;
    } else {
      newSummary = plan.running_summary + "\n\n" + taskSummary;
    }
    const blocks = newSummary.split("\n\n");
    const tBlockIndices = [];
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].trimStart().startsWith("### T-")) {
        tBlockIndices.push(i);
      }
    }
    if (tBlockIndices.length > 10) {
      const oldestIdx = tBlockIndices[0];
      const firstLine = blocks[oldestIdx].split("\n")[0];
      blocks[oldestIdx] = firstLine;
      newSummary = blocks.join("\n\n");
    }
    this.db.prepare("UPDATE plans SET running_summary = ? WHERE id = ?").run(newSummary, id);
    this.events?.record(
      "plan",
      id,
      "updated",
      JSON.stringify({ running_summary: plan.running_summary }),
      JSON.stringify({ running_summary: newSummary })
    );
    return this.requireById(id);
  }
  updateRunningSummary(id, summary) {
    try {
      const plan = this.requireById(id);
      this.db.prepare("UPDATE plans SET running_summary = ? WHERE id = ?").run(summary, id);
      this.events?.record("plan", id, "updated", JSON.stringify({ running_summary: plan.running_summary }), JSON.stringify({ running_summary: summary }));
      return this.requireById(id);
    } catch (err) {
      console.error(`[updateRunningSummary] failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
  update(id, fields) {
    const plan = this.requireById(id);
    const query = buildUpdateQuery("plans", id, fields);
    if (!query) return plan;
    const oldFields = {};
    const newFields = {};
    for (const key of Object.keys(fields)) {
      if (fields[key] !== void 0) {
        oldFields[key] = plan[key];
        newFields[key] = fields[key];
      }
    }
    this.db.prepare(query.sql).run(...query.params);
    this.events?.record("plan", id, "updated", JSON.stringify(oldFields), JSON.stringify(newFields));
    return this.requireById(id);
  }
  transitionStatus(id, newStatus, eventType, guard, extra, opts) {
    const plan = this.requireById(id);
    if (plan.status === newStatus) return plan;
    validateTransition(PLAN_TRANSITIONS, plan.status, newStatus, opts);
    if (guard) guard(plan);
    const oldStatus = plan.status;
    withTransaction(this.db, () => {
      const sql = extra ? `UPDATE plans SET status = ?, ${extra} WHERE id = ?` : `UPDATE plans SET status = ? WHERE id = ?`;
      this.db.prepare(sql).run(newStatus, id);
      this.events?.record(
        "plan",
        id,
        eventType,
        JSON.stringify({ status: oldStatus }),
        JSON.stringify({ status: newStatus })
      );
    });
    if ((newStatus === "completed" || newStatus === "archived") && this.handoffs) {
      try {
        this.handoffs.cleanByPlan(id);
      } catch {
      }
    }
    return this.requireById(id);
  }
  activate(id, opts) {
    return this.transitionStatus(id, "active", "activated", void 0, void 0, opts);
  }
  complete(id, opts) {
    return this.transitionStatus(id, "completed", "completed", void 0, "completed_at = CURRENT_TIMESTAMP", opts);
  }
  approve(id, opts) {
    return this.transitionStatus(id, "approved", "approved", void 0, void 0, opts);
  }
  archive(id, opts) {
    return this.transitionStatus(id, "archived", "archived", void 0, void 0, opts);
  }
  delete(id) {
    const plan = this.requireById(id);
    if (plan.status !== "draft") {
      throw new Error(`Only draft plans can be deleted. Current status: ${plan.status}`);
    }
    withTransaction(this.db, () => {
      this.db.prepare("DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE plan_id = ?)").run(id);
      this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(id);
      this.db.prepare("DELETE FROM tasks WHERE plan_id = ?").run(id);
      this.db.prepare("DELETE FROM plans WHERE id = ?").run(id);
    });
  }
};

// src/core/models/task-metrics.ts
var TaskMetricsModel = class extends BaseRepository {
  constructor(db) {
    super(db, "task_metrics");
  }
  record(taskId, planId, finalStatus, metrics) {
    const durationMin = this.calculateDuration(taskId);
    const blockReason = this.extractBlockReason(taskId, finalStatus);
    this.db.prepare(
      `INSERT OR REPLACE INTO task_metrics
         (task_id, plan_id, duration_min, final_status, block_reason, impl_status, test_count, files_changed, has_concerns, changed_files_detail, scope_violations)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      taskId,
      planId,
      durationMin,
      finalStatus,
      blockReason,
      metrics?.impl_status ?? null,
      metrics?.test_count ?? null,
      metrics?.files_changed ?? null,
      metrics?.has_concerns ? 1 : 0,
      metrics?.changed_files_detail ?? null,
      metrics?.scope_violations ?? null
    );
    return this.getByTask(taskId);
  }
  getByTask(taskId) {
    const row = this.db.prepare("SELECT * FROM task_metrics WHERE task_id = ?").get(taskId);
    return row ?? null;
  }
  getByPlan(planId) {
    return this.db.prepare("SELECT * FROM task_metrics WHERE plan_id = ? ORDER BY created_at ASC").all(planId);
  }
  calculateDuration(taskId) {
    const row = this.db.prepare(
      `SELECT created_at FROM events
         WHERE entity_type = 'task'
           AND entity_id = ?
           AND event_type = 'status_changed'
           AND JSON_EXTRACT(new_value, '$.status') = 'in_progress'
         ORDER BY created_at DESC
         LIMIT 1`
    ).get(taskId);
    if (!row) return null;
    const startTime = new Date(row.created_at).getTime();
    const now = Date.now();
    const diffMin = (now - startTime) / (1e3 * 60);
    return Math.round(diffMin * 100) / 100;
  }
  extractBlockReason(taskId, finalStatus) {
    const row = this.db.prepare(
      `SELECT new_value FROM events
         WHERE entity_type = 'task'
           AND entity_id = ?
           AND event_type = 'blocked_reason'
         ORDER BY created_at DESC
         LIMIT 1`
    ).get(taskId);
    if (row?.new_value) {
      try {
        const parsed = JSON.parse(row.new_value);
        if (parsed.reason) return parsed.reason;
      } catch {
      }
    }
    if (finalStatus === "blocked") return "unspecified";
    return null;
  }
};

// src/core/models/skill-usage.ts
var SkillUsageModel = class extends BaseRepository {
  constructor(db) {
    super(db, "skill_usage");
  }
  record(skillName, opts) {
    const id = generateId();
    const planId = opts?.planId ?? null;
    const sessionId = opts?.sessionId ?? null;
    const createdAt = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
    this.db.prepare(
      `INSERT INTO skill_usage (id, skill_name, plan_id, session_id, created_at)
         VALUES (?, ?, ?, ?, ?)`
    ).run(id, skillName, planId, sessionId, createdAt);
    return { id, skill_name: skillName, plan_id: planId, session_id: sessionId, created_at: createdAt };
  }
  getStats(days) {
    const base = `SELECT skill_name, COUNT(*) as count, MAX(created_at) as last_used FROM skill_usage`;
    const suffix = `GROUP BY skill_name ORDER BY count DESC`;
    if (days !== void 0) {
      return this.db.prepare(`${base} WHERE created_at >= datetime('now', '-' || ? || ' days') ${suffix}`).all(days);
    }
    return this.db.prepare(`${base} ${suffix}`).all();
  }
  getRecentUsage(limit) {
    return this.db.prepare(
      `SELECT * FROM skill_usage
         ORDER BY created_at DESC
         LIMIT ?`
    ).all(limit ?? 20);
  }
};

// src/core/models/qa-run.ts
var QARunModel = class extends BaseRepository {
  constructor(db) {
    super(db, "qa_runs");
  }
  create(planId, trigger) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_runs (id, plan_id, "trigger") VALUES (?, ?, ?)`
    ).run(id, planId, trigger);
    return this.get(id);
  }
  get(id) {
    return this.getById(id);
  }
  list(planId) {
    if (planId) {
      return this.db.prepare(
        `SELECT * FROM qa_runs WHERE plan_id = ? ORDER BY created_at DESC`
      ).all(planId);
    }
    return this.db.prepare(
      `SELECT * FROM qa_runs ORDER BY created_at DESC`
    ).all();
  }
  updateStatus(id, status, summary) {
    this.db.prepare(
      `UPDATE qa_runs SET status = ?, summary = ?,
       completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = ?`
    ).run(status, summary ?? null, status, id);
    return this.get(id);
  }
  updateScores(id, total, passed, failed, riskScore) {
    this.db.prepare(
      `UPDATE qa_runs SET total_scenarios = ?, passed_scenarios = ?, failed_scenarios = ?, risk_score = ? WHERE id = ?`
    ).run(total, passed, failed, riskScore, id);
  }
  getLatestByPlan(planId) {
    const row = this.db.prepare(
      `SELECT * FROM qa_runs WHERE plan_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(planId);
    return row ?? null;
  }
  getSummary(id) {
    const row = this.db.prepare(
      `SELECT * FROM qa_run_summary WHERE id = ?`
    ).get(id);
    return row ?? null;
  }
};

// src/core/models/qa-scenario.ts
var QAScenarioModel = class extends BaseRepository {
  constructor(db) {
    super(db, "qa_scenarios");
  }
  create(runId, data) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_scenarios (id, run_id, category, title, description, priority, related_tasks, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, runId, data.category, data.title, data.description, data.priority, data.related_tasks ?? null, data.source ?? "final");
    return this.get(id);
  }
  bulkCreate(runId, scenarios) {
    const insert = this.db.prepare(
      `INSERT INTO qa_scenarios (id, run_id, category, title, description, priority, related_tasks, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const ids = [];
    const tx = this.db.transaction(() => {
      for (const s of scenarios) {
        const id = generateId();
        insert.run(id, runId, s.category, s.title, s.description, s.priority, s.related_tasks ?? null, s.source ?? "final");
        ids.push(id);
      }
    });
    tx();
    return ids.map((id) => this.get(id));
  }
  get(id) {
    return this.getById(id);
  }
  listByRun(runId, filters) {
    const conditions = ["run_id = ?"];
    const params = [runId];
    if (filters?.category) {
      conditions.push("category = ?");
      params.push(filters.category);
    }
    if (filters?.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.agent) {
      conditions.push("agent = ?");
      params.push(filters.agent);
    }
    if (filters?.source) {
      conditions.push("source = ?");
      params.push(filters.source);
    }
    const where = conditions.join(" AND ");
    return this.db.prepare(
      `SELECT * FROM qa_scenarios WHERE ${where} ORDER BY created_at ASC`
    ).all(...params);
  }
  updateStatus(id, status, evidence) {
    if (evidence !== void 0) {
      this.db.prepare(
        `UPDATE qa_scenarios SET status = ?, evidence = ? WHERE id = ?`
      ).run(status, evidence, id);
    } else {
      this.db.prepare(
        `UPDATE qa_scenarios SET status = ? WHERE id = ?`
      ).run(status, id);
    }
  }
  listByPlan(planId, filters) {
    const conditions = ["r.plan_id = ?"];
    const params = [planId];
    if (filters?.source) {
      conditions.push("s.source = ?");
      params.push(filters.source);
    }
    if (filters?.category) {
      conditions.push("s.category = ?");
      params.push(filters.category);
    }
    if (filters?.status) {
      conditions.push("s.status = ?");
      params.push(filters.status);
    }
    if (filters?.taskId) {
      conditions.push("(s.related_tasks LIKE ? OR s.related_tasks = ?)");
      params.push(`%"${filters.taskId}"%`, filters.taskId);
    }
    const where = conditions.join(" AND ");
    return this.db.prepare(
      `SELECT s.* FROM qa_scenarios s
       INNER JOIN qa_runs r ON s.run_id = r.id
       WHERE ${where}
       ORDER BY s.created_at ASC`
    ).all(...params);
  }
  listByPlanSource(planId, source) {
    return this.listByPlan(planId, { source });
  }
  getStatsByRun(runId) {
    return this.db.prepare(
      `SELECT
        category,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) AS failed
      FROM qa_scenarios
      WHERE run_id = ?
      GROUP BY category`
    ).all(runId);
  }
};

// src/core/models/qa-finding.ts
var QAFindingModel = class extends BaseRepository {
  constructor(db) {
    super(db, "qa_findings");
  }
  create(runId, data) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_findings (id, run_id, scenario_id, severity, category, title, description, affected_files, related_task_id, fix_suggestion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      runId,
      data.scenario_id ?? null,
      data.severity,
      data.category,
      data.title,
      data.description,
      data.affected_files ?? null,
      data.related_task_id ?? null,
      data.fix_suggestion ?? null
    );
    return this.get(id);
  }
  get(id) {
    return this.getById(id);
  }
  list(filters) {
    const conditions = [];
    const params = [];
    if (filters?.runId) {
      conditions.push("run_id = ?");
      params.push(filters.runId);
    }
    if (filters?.severity) {
      conditions.push("severity = ?");
      params.push(filters.severity);
    }
    if (filters?.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.category) {
      conditions.push("category = ?");
      params.push(filters.category);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.prepare(
      `SELECT * FROM qa_findings ${where} ORDER BY created_at DESC`
    ).all(...params);
  }
  updateStatus(id, status, fixPlanId) {
    this.db.prepare(
      `UPDATE qa_findings SET status = ?,
       fix_plan_id = CASE WHEN ? IS NOT NULL THEN ? ELSE fix_plan_id END
       WHERE id = ?`
    ).run(status, fixPlanId ?? null, fixPlanId ?? null, id);
  }
  getOpenByPlan(planId) {
    return this.db.prepare(
      `SELECT qf.* FROM qa_findings qf
       JOIN qa_runs qr ON qr.id = qf.run_id
       WHERE qr.plan_id = ? AND qf.status = 'open'
       ORDER BY qf.created_at DESC`
    ).all(planId);
  }
  getStatsByRun(runId) {
    return this.db.prepare(
      `SELECT severity, COUNT(*) AS count
       FROM qa_findings
       WHERE run_id = ?
       GROUP BY severity`
    ).all(runId);
  }
};

// src/core/models/backlog.ts
var BacklogModel = class extends BaseRepository {
  events;
  constructor(db, events) {
    super(db, "backlog_items");
    this.events = events;
  }
  create(item) {
    const id = generateId();
    const tags = item.tags ? JSON.stringify(item.tags) : null;
    this.db.prepare(`
      INSERT INTO backlog_items (id, title, description, priority, category, tags, complexity_hint, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.title,
      item.description ?? null,
      item.priority ?? "medium",
      item.category ?? null,
      tags,
      item.complexity_hint ?? null,
      item.source ?? null
    );
    const created = this.requireById(id);
    this.events?.record("backlog", id, "created", null, JSON.stringify({ title: item.title }));
    return created;
  }
  requireById(id) {
    const item = this.getById(id);
    if (!item) throw new Error(`Backlog item not found: ${id}`);
    return item;
  }
  findByTitle(title, status) {
    const statusFilter = status ? "AND status = ?" : "";
    const params = status ? [title, status] : [title];
    const row = this.db.prepare(
      `SELECT * FROM backlog_items WHERE title = ? ${statusFilter}`
    ).get(...params);
    return row ?? null;
  }
  list(filter) {
    const conditions = [];
    const params = [];
    if (filter?.status) {
      conditions.push("b.status = ?");
      params.push(filter.status);
    }
    if (filter?.priority) {
      conditions.push("b.priority = ?");
      params.push(filter.priority);
    }
    if (filter?.category) {
      conditions.push("b.category = ?");
      params.push(filter.category);
    }
    let sql;
    if (filter?.tag) {
      conditions.push("EXISTS (SELECT 1 FROM json_each(b.tags) WHERE json_each.value = ?)");
      params.push(filter.tag);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const priorityOrder = "CASE b.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END";
    sql = `SELECT b.* FROM backlog_items b ${where} ORDER BY ${priorityOrder}, b.created_at DESC`;
    return this.db.prepare(sql).all(...params);
  }
  update(id, fields) {
    const item = this.requireById(id);
    const dbFields = { ...fields, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    const query = buildUpdateQuery("backlog_items", id, dbFields);
    if (!query) return item;
    const oldFields = {};
    const newFields = {};
    for (const key of Object.keys(fields)) {
      if (fields[key] !== void 0) {
        oldFields[key] = item[key];
        newFields[key] = fields[key];
      }
    }
    this.db.prepare(query.sql).run(...query.params);
    if (fields.status && fields.status !== item.status) {
      this.events?.record("backlog", id, "status_changed", JSON.stringify({ status: item.status }), JSON.stringify({ status: fields.status }));
    } else {
      this.events?.record("backlog", id, "updated", JSON.stringify(oldFields), JSON.stringify(newFields));
    }
    return this.requireById(id);
  }
  promote(id, planId) {
    const item = this.requireById(id);
    if (item.status !== "open") {
      throw new Error(`Only open backlog items can be promoted. Current status: ${item.status}`);
    }
    this.db.prepare(
      "UPDATE backlog_items SET status = ?, plan_id = ?, updated_at = ? WHERE id = ?"
    ).run("planned", planId, (/* @__PURE__ */ new Date()).toISOString(), id);
    this.events?.record(
      "backlog",
      id,
      "status_changed",
      JSON.stringify({ status: "open" }),
      JSON.stringify({ status: "planned", plan_id: planId })
    );
    return this.requireById(id);
  }
  delete(id) {
    this.requireById(id);
    this.db.prepare("DELETE FROM events WHERE entity_type = ? AND entity_id = ?").run("backlog", id);
    this.db.prepare("DELETE FROM backlog_items WHERE id = ?").run(id);
  }
  getStats() {
    const items = this.db.prepare("SELECT priority, category, status FROM backlog_items").all();
    const stats = {
      total: items.length,
      by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
      by_category: {},
      by_status: { open: 0, planned: 0, done: 0, dropped: 0 }
    };
    for (const item of items) {
      stats.by_priority[item.priority]++;
      stats.by_status[item.status]++;
      const cat = item.category ?? "uncategorized";
      stats.by_category[cat] = (stats.by_category[cat] ?? 0) + 1;
    }
    return stats;
  }
};

// src/core/models/merge-report.ts
function rowToReport(row) {
  return {
    id: row.id,
    plan_id: row.plan_id,
    commit_hash: row.commit_hash,
    source_branch: row.source_branch,
    target_branch: row.target_branch,
    changes_summary: JSON.parse(row.changes_summary),
    review_checklist: JSON.parse(row.review_checklist),
    conflict_log: row.conflict_log ? JSON.parse(row.conflict_log) : null,
    ai_judgments: row.ai_judgments ? JSON.parse(row.ai_judgments) : null,
    verification: JSON.parse(row.verification),
    task_ids: row.task_ids ? JSON.parse(row.task_ids) : null,
    report_path: row.report_path,
    created_at: row.created_at,
    pr_number: row.pr_number ?? null,
    pr_url: row.pr_url ?? null,
    merge_method: row.merge_method ?? null,
    closed_issues: row.closed_issues ? JSON.parse(row.closed_issues) : null,
    auto_resolved_files: row.auto_resolved_files ? JSON.parse(row.auto_resolved_files) : null,
    conflict_levels: row.conflict_levels ? JSON.parse(row.conflict_levels) : null
  };
}
var MergeReportModel = class extends BaseRepository {
  constructor(db) {
    super(db, "merge_reports");
  }
  create(data) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO merge_reports (id, plan_id, commit_hash, source_branch, target_branch,
        changes_summary, review_checklist, conflict_log, ai_judgments, verification, task_ids, report_path,
        pr_number, pr_url, merge_method, closed_issues, auto_resolved_files, conflict_levels)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.plan_id ?? null,
      data.commit_hash,
      data.source_branch,
      data.target_branch,
      JSON.stringify(data.changes_summary),
      JSON.stringify(data.review_checklist),
      data.conflict_log ? JSON.stringify(data.conflict_log) : null,
      data.ai_judgments ? JSON.stringify(data.ai_judgments) : null,
      JSON.stringify(data.verification),
      data.task_ids ? JSON.stringify(data.task_ids) : null,
      data.report_path,
      data.pr_number ?? null,
      data.pr_url ?? null,
      data.merge_method ?? null,
      data.closed_issues ? JSON.stringify(data.closed_issues) : null,
      data.auto_resolved_files ? JSON.stringify(data.auto_resolved_files) : null,
      data.conflict_levels ? JSON.stringify(data.conflict_levels) : null
    );
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare(
      `SELECT * FROM merge_reports WHERE id = ?`
    ).get(id);
    return row ? rowToReport(row) : null;
  }
  getByCommit(hash) {
    const row = this.db.prepare(
      `SELECT * FROM merge_reports WHERE commit_hash = ? ORDER BY created_at DESC LIMIT 1`
    ).get(hash);
    return row ? rowToReport(row) : null;
  }
  getByPlan(planId) {
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports WHERE plan_id = ? ORDER BY created_at DESC`
    ).all(planId);
    return rows.map(rowToReport);
  }
  getLatest(limit = 5) {
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports ORDER BY created_at DESC LIMIT ?`
    ).all(limit);
    return rows.map(rowToReport);
  }
  list(opts) {
    if (opts?.planId) {
      const rows2 = this.db.prepare(
        `SELECT * FROM merge_reports WHERE plan_id = ? ORDER BY created_at DESC LIMIT ?`
      ).all(opts.planId, opts.limit ?? 100);
      return rows2.map(rowToReport);
    }
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports ORDER BY created_at DESC LIMIT ?`
    ).all(opts?.limit ?? 100);
    return rows.map(rowToReport);
  }
};

// src/core/models/agent-handoff.ts
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, writeFileSync, rmSync } from "fs";
import { join } from "path";
var DEFAULT_HANDOFF_DIR = join(process.cwd(), ".claude", "handoff");
var AgentHandoffModel = class {
  db;
  baseDir;
  constructor(db, baseDir) {
    this.db = db;
    this.baseDir = baseDir ?? DEFAULT_HANDOFF_DIR;
  }
  create(taskId, planId, agentType, attempt, verdict, summary, reportPath, changedFiles, inputHash) {
    const existing = this.db.prepare(
      `SELECT id FROM agent_handoffs WHERE task_id = ? AND agent_type = ? AND attempt = ?`
    ).get(taskId, agentType, attempt);
    if (existing) {
      throw new Error(`Duplicate handoff: task=${taskId}, agent=${agentType}, attempt=${attempt}`);
    }
    const id = generateId();
    this.db.prepare(
      `INSERT INTO agent_handoffs (id, task_id, plan_id, agent_type, attempt, verdict, summary, report_path, changed_files, input_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, taskId, planId, agentType, attempt, verdict, summary, reportPath ?? null, changedFiles ?? null, inputHash ?? null);
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare(`SELECT * FROM agent_handoffs WHERE id = ?`).get(id);
    return row ?? null;
  }
  getByTask(taskId, agentType, attempt) {
    const conditions = ["task_id = ?"];
    const params = [taskId];
    if (agentType) {
      conditions.push("agent_type = ?");
      params.push(agentType);
    }
    if (attempt !== void 0) {
      conditions.push("attempt = ?");
      params.push(attempt);
    }
    return this.db.prepare(
      `SELECT * FROM agent_handoffs WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`
    ).all(...params);
  }
  list(planId, taskId) {
    const conditions = [];
    const params = [];
    if (planId) {
      conditions.push("plan_id = ?");
      params.push(planId);
    }
    if (taskId) {
      conditions.push("task_id = ?");
      params.push(taskId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.prepare(
      `SELECT * FROM agent_handoffs ${where} ORDER BY created_at DESC`
    ).all(...params);
  }
  cleanByPlan(planId) {
    const handoffs = this.list(planId);
    const taskIds = new Set(handoffs.map((h) => h.task_id).filter(Boolean));
    this.db.prepare(`DELETE FROM agent_handoffs WHERE plan_id = ?`).run(planId);
    for (const tid of taskIds) {
      const taskDir = join(this.baseDir, tid);
      if (existsSync2(taskDir)) {
        rmSync(taskDir, { recursive: true, force: true });
      }
    }
  }
  writeHandoffReport(taskId, agentType, attempt, data) {
    const taskDir = join(this.baseDir, taskId);
    if (!existsSync2(taskDir)) {
      mkdirSync(taskDir, { recursive: true });
    }
    const filePath = join(taskDir, `${agentType}_${attempt}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return filePath;
  }
  readHandoffReport(taskId, agentType, attempt) {
    const filePath = join(this.baseDir, taskId, `${agentType}_${attempt}.json`);
    if (!existsSync2(filePath)) {
      return null;
    }
    return JSON.parse(readFileSync2(filePath, "utf-8"));
  }
  cleanHandoffFiles(planId) {
    const handoffs = this.list(planId);
    const taskIds = new Set(handoffs.map((h) => h.task_id).filter(Boolean));
    for (const tid of taskIds) {
      const taskDir = join(this.baseDir, tid);
      if (existsSync2(taskDir)) {
        rmSync(taskDir, { recursive: true, force: true });
      }
    }
  }
};

// src/core/models/wave-gate.ts
var WaveGateModel = class extends BaseRepository {
  constructor(db) {
    super(db, "wave_gates");
  }
  create(planId, waveNumber, taskIds, verdict, summary, findingsCount) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO wave_gates (id, plan_id, wave_number, task_ids, verdict, summary, findings_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, planId, waveNumber, JSON.stringify(taskIds), verdict, summary ?? null, findingsCount ?? 0);
    return this.getById(id);
  }
  /** @deprecated Use getById() instead */
  get(id) {
    return this.getById(id);
  }
  listByPlan(planId) {
    return this.db.prepare(
      "SELECT * FROM wave_gates WHERE plan_id = ? ORDER BY wave_number ASC"
    ).all(planId);
  }
};

// src/core/models/plan-revision.ts
var PlanRevisionModel = class extends BaseRepository {
  constructor(db) {
    super(db, "plan_revisions");
  }
  create(planId, triggerType, triggerSource, description, changes) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO plan_revisions (id, plan_id, trigger_type, trigger_source, description, changes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, planId, triggerType, triggerSource, description, changes);
    return this.getById(id);
  }
  /** @deprecated Use getById() instead */
  get(id) {
    return this.getById(id);
  }
  listByPlan(planId) {
    return this.db.prepare(
      "SELECT * FROM plan_revisions WHERE plan_id = ? ORDER BY created_at DESC"
    ).all(planId);
  }
  updateStatus(id, status) {
    return this.update(id, { status });
  }
};

// src/core/models/context-log.ts
var ContextLogModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(input) {
    const stmt = this.db.prepare(
      `INSERT INTO context_log (plan_id, session_id, summary, last_task_id)
       VALUES (?, ?, ?, ?)`
    );
    const result = stmt.run(
      input.plan_id ?? null,
      input.session_id ?? null,
      input.summary,
      input.last_task_id ?? null
    );
    return this.db.prepare("SELECT * FROM context_log WHERE id = ?").get(result.lastInsertRowid);
  }
  getById(id) {
    const row = this.db.prepare("SELECT * FROM context_log WHERE id = ?").get(id);
    return row ?? null;
  }
  search(tag) {
    return this.db.prepare("SELECT * FROM context_log WHERE summary LIKE ? ORDER BY created_at DESC").all(`%${tag}%`);
  }
  list(limit = 50) {
    return this.db.prepare("SELECT * FROM context_log ORDER BY created_at DESC LIMIT ?").all(limit);
  }
};

// src/core/engine/retry.ts
import { z } from "zod";

// src/core/engine/error-kb.ts
import * as fs from "fs";
import * as path from "path";
var VALID_SEVERITIES = /* @__PURE__ */ new Set(["critical", "high", "medium", "low"]);
var VALID_STATUSES = /* @__PURE__ */ new Set(["open", "resolved", "recurring", "wontfix"]);
var VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
function parseFrontmatter(raw) {
  const defaultMeta = {
    title: "",
    severity: "medium",
    tags: [],
    status: "open",
    occurrences: 0,
    first_seen: "",
    last_seen: ""
  };
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: defaultMeta, body: raw };
  }
  const yamlBlock = match[1];
  const body = match[2];
  const meta = { ...defaultMeta };
  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key === "title") {
      meta.title = value;
    } else if (key === "severity") {
      if (VALID_SEVERITIES.has(value)) meta.severity = value;
    } else if (key === "status") {
      if (VALID_STATUSES.has(value)) meta.status = value;
    } else if (key === "occurrences") {
      meta.occurrences = parseInt(value, 10) || 0;
    } else if (key === "first_seen") {
      meta.first_seen = value;
    } else if (key === "last_seen") {
      meta.last_seen = value;
    } else if (key === "tags") {
      const bracketMatch = value.match(/^\[(.*)\]$/);
      if (bracketMatch) {
        meta.tags = bracketMatch[1].split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      } else if (value === "" || value === "[]") {
        meta.tags = [];
      }
    }
  }
  return { meta, body };
}
function serializeFrontmatter(meta) {
  const tagsStr = meta.tags.length > 0 ? `[${meta.tags.join(", ")}]` : "[]";
  const lines = [
    "---",
    `title: ${meta.title}`,
    `severity: ${meta.severity}`,
    `tags: ${tagsStr}`,
    `status: ${meta.status}`,
    `occurrences: ${meta.occurrences}`,
    `first_seen: ${meta.first_seen}`,
    `last_seen: ${meta.last_seen}`,
    "---"
  ];
  return lines.join("\n");
}
var ErrorKBEngine = class {
  kbRoot;
  errorsDir;
  /** In-memory embedding cache: errorId -> Float32Array */
  embeddingCache = /* @__PURE__ */ new Map();
  constructor(projectRoot) {
    this.kbRoot = path.join(projectRoot, ".claude", "error-kb");
    this.errorsDir = path.join(this.kbRoot, "errors");
    fs.mkdirSync(this.errorsDir, { recursive: true });
  }
  resolveFilePath(id) {
    if (!VALID_ID_PATTERN.test(id)) return null;
    return path.join(this.errorsDir, `${id}.md`);
  }
  add(newEntry) {
    const id = generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const meta = {
      title: newEntry.title,
      severity: newEntry.severity,
      tags: newEntry.tags,
      status: "open",
      occurrences: 1,
      first_seen: now,
      last_seen: now
    };
    let body = "\n";
    if (newEntry.cause) {
      body += `## Cause

${newEntry.cause}

`;
    }
    if (newEntry.solution) {
      body += `## Solution

${newEntry.solution}

`;
    }
    const content = serializeFrontmatter(meta) + "\n" + body;
    const filePath = path.join(this.errorsDir, `${id}.md`);
    fs.writeFileSync(filePath, content, "utf-8");
    this.updateIndex();
    return this.toErrorEntry(id, meta, body);
  }
  show(id) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    return this.toErrorEntry(id, meta, body);
  }
  search(query, opts) {
    const files = this.listErrorFiles();
    const results = [];
    for (const file of files) {
      const id = path.basename(file, ".md");
      const entry = this.show(id);
      if (!entry) continue;
      if (opts?.tags && opts.tags.length > 0) {
        const hasMatchingTag = opts.tags.some((t) => entry.tags.includes(t));
        if (!hasMatchingTag) continue;
      }
      if (opts?.severity && entry.severity !== opts.severity) {
        continue;
      }
      if (query && query.length > 0) {
        const searchable = `${entry.title} ${entry.content}`.toLowerCase();
        if (!searchable.includes(query.toLowerCase())) {
          continue;
        }
      }
      results.push(entry);
    }
    return results;
  }
  delete(id) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    this.updateIndex();
    return true;
  }
  update(id, patch) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    if (patch.severity !== void 0) meta.severity = patch.severity;
    if (patch.status !== void 0) meta.status = patch.status;
    if (patch.occurrences !== void 0) meta.occurrences = patch.occurrences;
    if (patch.last_seen !== void 0) meta.last_seen = patch.last_seen;
    if (patch.tags !== void 0) meta.tags = patch.tags;
    const content = serializeFrontmatter(meta) + "\n" + body;
    fs.writeFileSync(filePath, content, "utf-8");
    this.updateIndex();
  }
  recordOccurrence(id, context) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    meta.occurrences += 1;
    meta.last_seen = (/* @__PURE__ */ new Date()).toISOString();
    let updatedBody = body;
    const historyEntry = `- ${meta.last_seen}: ${context}`;
    const historyIdx = updatedBody.lastIndexOf("## History");
    if (historyIdx !== -1) {
      const headerEnd = updatedBody.indexOf("\n", historyIdx);
      if (headerEnd !== -1) {
        updatedBody = updatedBody.slice(0, headerEnd + 1) + historyEntry + "\n" + updatedBody.slice(headerEnd + 1);
      }
    } else {
      updatedBody = updatedBody.trimEnd() + "\n\n## History\n" + historyEntry + "\n";
    }
    const content = serializeFrontmatter(meta) + "\n" + updatedBody;
    fs.writeFileSync(filePath, content, "utf-8");
    this.updateIndex();
  }
  getStats() {
    const files = this.listErrorFiles();
    const stats = {
      total: 0,
      by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
      by_status: { open: 0, resolved: 0, recurring: 0, wontfix: 0 },
      top_recurring: []
    };
    const entries = [];
    for (const file of files) {
      const id = path.basename(file, ".md");
      const raw = fs.readFileSync(file, "utf-8");
      const { meta } = parseFrontmatter(raw);
      stats.total++;
      stats.by_severity[meta.severity]++;
      stats.by_status[meta.status]++;
      entries.push({ id, title: meta.title, occurrences: meta.occurrences });
    }
    stats.top_recurring = entries.sort((a, b) => b.occurrences - a.occurrences).slice(0, 10);
    return stats;
  }
  /**
   * Generate embedding text from an error entry's key fields.
   */
  entryToText(entry) {
    return `${entry.title} ${entry.content || ""}`.trim();
  }
  /**
   * Semantic search: generate embedding for query and compare against cached embeddings.
   * Returns results sorted by similarity (descending).
   */
  async searchSemantic(query, limit = 10) {
    if (this.embeddingCache.size === 0) return [];
    const queryEmbedding = await generateEmbedding(query);
    const results = [];
    for (const [id, embedding] of this.embeddingCache) {
      const entry = this.show(id);
      if (!entry) continue;
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      results.push({ entry, similarity });
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }
  /**
   * Hybrid search: run text search + semantic search in parallel,
   * merge results using Reciprocal Rank Fusion (RRF).
   */
  async searchHybrid(query, opts) {
    const [textResults, semanticResults] = await Promise.all([
      Promise.resolve(this.search(query, opts)),
      this.searchSemantic(query)
    ]);
    const k = 60;
    const scoreMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < textResults.length; i++) {
      const entry = textResults[i];
      const rrfScore = 1 / (k + i + 1);
      scoreMap.set(entry.id, { entry, score: rrfScore });
    }
    for (let i = 0; i < semanticResults.length; i++) {
      const { entry } = semanticResults[i];
      const rrfScore = 1 / (k + i + 1);
      const existing = scoreMap.get(entry.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(entry.id, { entry, score: rrfScore });
      }
    }
    const merged = Array.from(scoreMap.values());
    merged.sort((a, b) => b.score - a.score);
    return merged.map(({ entry, score }) => ({ entry, similarity: score }));
  }
  /**
   * Initialize embeddings for all existing error entries.
   * Skips entries that already have embeddings in cache.
   */
  async initEmbeddings() {
    const files = this.listErrorFiles();
    let indexed = 0;
    let skipped = 0;
    for (const file of files) {
      const id = path.basename(file, ".md");
      if (this.embeddingCache.has(id)) {
        skipped++;
        continue;
      }
      const entry = this.show(id);
      if (!entry) continue;
      const text = this.entryToText(entry);
      const embedding = await generateEmbedding(text);
      this.embeddingCache.set(id, embedding);
      indexed++;
    }
    return { indexed, skipped };
  }
  /**
   * Find potential duplicate entries based on embedding similarity.
   * Returns entries with similarity >= 0.85.
   */
  async findDuplicates(newEntry) {
    if (this.embeddingCache.size === 0) return [];
    const text = `${newEntry.title} ${newEntry.cause || ""} ${newEntry.solution || ""}`.trim();
    const queryEmbedding = await generateEmbedding(text);
    const results = [];
    for (const [id, embedding] of this.embeddingCache) {
      const entry = this.show(id);
      if (!entry) continue;
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      if (similarity >= 0.85) {
        results.push({ entry, similarity });
      }
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results;
  }
  /**
   * Add a new error entry with duplicate detection.
   * Returns the entry plus an optional duplicate warning.
   */
  async addWithDuplicateCheck(newEntry) {
    const duplicates = await this.findDuplicates(newEntry);
    const entry = this.add(newEntry);
    const text = this.entryToText(entry);
    const embedding = await generateEmbedding(text);
    this.embeddingCache.set(entry.id, embedding);
    const result = { entry };
    if (duplicates.length > 0) {
      const titles = duplicates.map((d) => `"${d.entry.title}" (similarity: ${d.similarity.toFixed(2)})`).join(", ");
      result.duplicateWarning = `Similar entries found: ${titles}`;
    }
    return result;
  }
  toErrorEntry(id, meta, body) {
    return {
      id,
      title: meta.title,
      severity: meta.severity,
      tags: meta.tags,
      status: meta.status,
      occurrences: meta.occurrences,
      first_seen: meta.first_seen,
      last_seen: meta.last_seen,
      content: body
    };
  }
  listErrorFiles() {
    if (!fs.existsSync(this.errorsDir)) return [];
    return fs.readdirSync(this.errorsDir).filter((f) => f.endsWith(".md") && f !== "_index.md").map((f) => path.join(this.errorsDir, f));
  }
  updateIndex() {
    const stats = this.getStats();
    const lines = [
      "# Error Knowledge Base Index",
      "",
      `Total: ${stats.total}`,
      "",
      "## By Severity",
      `- Critical: ${stats.by_severity.critical}`,
      `- High: ${stats.by_severity.high}`,
      `- Medium: ${stats.by_severity.medium}`,
      `- Low: ${stats.by_severity.low}`,
      "",
      "## By Status",
      `- Open: ${stats.by_status.open}`,
      `- Resolved: ${stats.by_status.resolved}`,
      `- Recurring: ${stats.by_status.recurring}`,
      `- Won't Fix: ${stats.by_status.wontfix}`,
      ""
    ];
    if (stats.top_recurring.length > 0) {
      lines.push("## Top Recurring");
      for (const entry of stats.top_recurring.slice(0, 10)) {
        lines.push(`- ${entry.title} (${entry.occurrences}x)`);
      }
      lines.push("");
    }
    const indexPath = path.join(this.kbRoot, "_index.md");
    fs.writeFileSync(indexPath, lines.join("\n"), "utf-8");
  }
};

// src/core/engine/retry.ts
var RetryConfigSchema = z.object({
  maxRetries: z.number().int().min(1),
  backoffMs: z.array(z.number().int().positive()).min(1),
  fallbackAgentMap: z.record(z.string(), z.string())
});
var DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  backoffMs: [1e3, 2e3, 4e3],
  fallbackAgentMap: {}
};
var RetryEngine = class {
  db;
  config;
  sleep;
  projectRoot;
  constructor(db, config = DEFAULT_RETRY_CONFIG, sleep, projectRoot = process.cwd()) {
    this.db = db;
    this.config = config;
    this.sleep = sleep ?? ((ms) => new Promise((resolve5) => setTimeout(resolve5, ms)));
    this.projectRoot = projectRoot;
  }
  /**
   * 태스크 실행을 최대 maxRetries회 재시도한다.
   *
   * - done/skipped 상태이면 즉시 에러를 던지고 중단한다
   * - 각 시도마다 AgentHandoffModel에 attempt를 기록한다
   * - 재시도 전 backoffMs에 맞는 대기 시간을 적용한다
   * - 이전 실패 에러를 다음 시도의 executeFn에 전달한다
   */
  async executeWithRetry(taskId, agentType, planId, executeFn) {
    const taskModel = new TaskModel(this.db);
    const handoffModel = new AgentHandoffModel(this.db);
    const { maxRetries, backoffMs } = this.config;
    const previousErrors = [];
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const task = taskModel.getById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      if (task.status === "done" || task.status === "skipped") {
        throw new Error(
          `\uD0DC\uC2A4\uD06C\uAC00 ${task.status} \uC0C1\uD0DC\uC774\uBBC0\uB85C \uC7AC\uC2DC\uB3C4\uB97C \uC911\uB2E8\uD569\uB2C8\uB2E4: ${taskId}`
        );
      }
      if (attempt > 1) {
        const backoffIndex = Math.min(attempt - 2, backoffMs.length - 1);
        await this.sleep(backoffMs[backoffIndex]);
      }
      try {
        const result = await executeFn(attempt, previousErrors);
        handoffModel.create(
          taskId,
          planId,
          agentType,
          attempt,
          "success",
          `Attempt ${attempt} succeeded`
        );
        return result;
      } catch (err) {
        const error = normalizeError(err);
        previousErrors.push(error);
        handoffModel.create(
          taskId,
          planId,
          agentType,
          attempt,
          "failure",
          `Attempt ${attempt} failed: ${error.message}`
        );
      }
    }
    throw previousErrors[previousErrors.length - 1] ?? new Error("\uBAA8\uB4E0 \uC7AC\uC2DC\uB3C4\uAC00 \uC18C\uC9C4\uB418\uC5C8\uC2B5\uB2C8\uB2E4");
  }
  /**
   * 에스컬레이션 — fallbackAgentMap에서 대체 에이전트를 찾아 executeWithRetry 재실행.
   * 대체 에이전트도 실패하거나 매핑이 없으면 error-kb에 기록하고 결과를 반환한다.
   *
   * @param taskId 태스크 ID
   * @param planId 플랜 ID
   * @param originalAgent 원래 에이전트 타입
   * @param executeFn 원래 실행 함수 (fallback 실행에도 재사용)
   * @param fallbackExecuteFn 대체 에이전트용 실행 함수 (선택적, 없으면 executeFn 사용)
   */
  async escalate(taskId, planId, originalAgent, executeFn, fallbackExecuteFn) {
    const fallbackAgent = this.config.fallbackAgentMap[originalAgent];
    const errorKb = new ErrorKBEngine(this.projectRoot);
    if (!fallbackAgent) {
      errorKb.add({
        title: `escalation failure: ${originalAgent} \u2014 no fallback`,
        severity: "high",
        tags: ["escalation", originalAgent, taskId],
        cause: `Task ${taskId} failed and no fallback agent is configured for ${originalAgent}`,
        solution: `Add a fallback agent mapping for ${originalAgent} in RetryConfig.fallbackAgentMap`
      });
      return { escalated: false, attempts: [] };
    }
    const attempts = [];
    const fn = fallbackExecuteFn ?? executeFn;
    try {
      await this.executeWithRetry(taskId, fallbackAgent, planId, async (attempt, previousErrors) => {
        const result = await fn(attempt, previousErrors);
        attempts.push({ success: true, attempt });
        return result;
      });
      return { escalated: true, fallbackAgent, attempts };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      attempts.push({ success: false, attempt: attempts.length + 1, error });
      errorKb.add({
        title: `escalation failure: ${originalAgent} -> ${fallbackAgent}`,
        severity: "high",
        tags: ["escalation", originalAgent, fallbackAgent, taskId],
        cause: `Task ${taskId} failed with both ${originalAgent} and fallback ${fallbackAgent}: ${error.message}`,
        solution: `Investigate the root cause of failure in task ${taskId}`
      });
      console.error(`[retry] Task ${taskId}: \uBAA8\uB4E0 \uC7AC\uC2DC\uB3C4 \uC2E4\uD328. error-kb\uC5D0 \uAE30\uB85D\uB428 (${error.message})`);
      return { escalated: true, fallbackAgent, attempts };
    }
  }
};

// src/core/engine/wave-coordinator.ts
var WaveCoordinator = class {
  taskModel;
  constructor(db) {
    this.taskModel = new TaskModel(db);
  }
  /**
   * 주어진 태스크 ID 목록에서 allowed_files 교집합(충돌) 맵을 반환한다.
   * allowed_files가 null/undefined인 태스크는 충돌 계산에서 제외한다.
   */
  detectFileConflicts(taskIds) {
    const conflicts = [];
    const taskFiles = /* @__PURE__ */ new Map();
    for (const id of taskIds) {
      const task = this.taskModel.getById(id);
      if (!task || task.allowed_files === null || task.allowed_files === void 0) {
        continue;
      }
      try {
        const files = JSON.parse(task.allowed_files);
        taskFiles.set(task.id, files);
      } catch {
      }
    }
    const fileToTasks = /* @__PURE__ */ new Map();
    for (const [taskId, files] of taskFiles) {
      for (const file of files) {
        const list = fileToTasks.get(file);
        if (list) list.push(taskId);
        else fileToTasks.set(file, [taskId]);
      }
    }
    const pairKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
    const pairFiles = /* @__PURE__ */ new Map();
    for (const [file, tasks] of fileToTasks) {
      if (tasks.length < 2) continue;
      for (let i = 0; i < tasks.length; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
          const key = pairKey(tasks[i], tasks[j]);
          const shared = pairFiles.get(key);
          if (shared) shared.push(file);
          else pairFiles.set(key, [file]);
        }
      }
    }
    for (const [key, sharedFiles] of pairFiles) {
      const [taskA, taskB] = key.split("|");
      conflicts.push({ taskA, taskB, sharedFiles });
    }
    return { conflicts };
  }
  /**
   * planId에 대해 WaveExecutionPlan[]을 반환한다.
   * 각 wave 내 태스크를 충돌 분석하여 parallelGroups와 sequentialTasks로 분류한다.
   * - allowed_files가 null인 태스크 → sequentialTasks
   * - 충돌하는 태스크 → sequentialTasks
   * - 충돌 없는 태스크 → parallelGroups (하나의 그룹으로 묶음)
   */
  buildExecutionPlan(planId) {
    const waves = this.taskModel.getWaves(planId);
    if (waves.length === 0) return [];
    const result = [];
    for (const wave of waves) {
      const taskIds = wave.task_ids;
      const nullFileTasks = [];
      const definedFileTasks = [];
      const tasksInWave = taskIds.map((id) => this.taskModel.getById(id)).filter(Boolean);
      const taskMap = new Map(tasksInWave.map((t) => [t.id, t]));
      for (const id of taskIds) {
        const task = taskMap.get(id);
        if (!task || task.allowed_files === null || task.allowed_files === void 0) {
          nullFileTasks.push(id);
        } else {
          definedFileTasks.push(id);
        }
      }
      const conflictMap = this.detectFileConflicts(definedFileTasks);
      const conflictingIds = /* @__PURE__ */ new Set();
      for (const conflict of conflictMap.conflicts) {
        conflictingIds.add(conflict.taskA);
        conflictingIds.add(conflict.taskB);
      }
      const parallelTaskIds = definedFileTasks.filter((id) => !conflictingIds.has(id));
      const sequentialFromDefined = definedFileTasks.filter((id) => conflictingIds.has(id));
      const sequentialTasks = [...nullFileTasks, ...sequentialFromDefined];
      const parallelGroups = parallelTaskIds.length > 0 ? [parallelTaskIds] : [];
      result.push({
        waveIndex: wave.index,
        parallelGroups,
        sequentialTasks
      });
    }
    return result;
  }
  /**
   * Executes a WaveExecutionPlan: parallel groups run concurrently (with semaphore),
   * sequential tasks run one at a time. Returns a WaveResult with per-task outcomes.
   */
  async executeWaveParallel(plan, executeFn, options = {}) {
    const maxConcurrent = options.maxConcurrent ?? 3;
    const dependsOn = options.dependsOn ?? {};
    const results = [];
    for (const group of plan.parallelGroups) {
      const groupResults = await this.runParallelGroup(group, executeFn, maxConcurrent);
      results.push(...groupResults);
    }
    const blockedTaskIds = new Set(
      results.filter((r) => r.status === "blocked" || r.status === "failed").map((r) => r.taskId)
    );
    for (const [taskId, deps] of Object.entries(dependsOn)) {
      const isBlocked = deps.some((dep) => blockedTaskIds.has(dep));
      if (isBlocked && !results.find((r) => r.taskId === taskId)) {
        results.push({ taskId, status: "blocked" });
      }
    }
    for (const taskId of plan.sequentialTasks) {
      try {
        await executeFn(taskId);
        results.push({ taskId, status: "success" });
      } catch (err) {
        results.push({ taskId, status: "failed", error: normalizeError(err) });
      }
    }
    return { waveIndex: plan.waveIndex, results };
  }
  async runParallelGroup(taskIds, executeFn, maxConcurrent) {
    const results = [];
    let activeCount = 0;
    let taskIndex = 0;
    const queue = [...taskIds];
    let resolved = false;
    return new Promise((resolve5) => {
      const tryResolve = () => {
        if (!resolved && activeCount === 0 && taskIndex >= queue.length) {
          resolved = true;
          resolve5(results);
        }
      };
      const tryNext = () => {
        if (queue.length === 0) {
          tryResolve();
          return;
        }
        while (activeCount < maxConcurrent && taskIndex < queue.length) {
          const taskId = queue[taskIndex++];
          activeCount++;
          executeFn(taskId).then(
            () => {
              results.push({ taskId, status: "success" });
              activeCount--;
              tryNext();
              tryResolve();
            },
            (err) => {
              results.push({
                taskId,
                status: "failed",
                error: normalizeError(err)
              });
              activeCount--;
              tryNext();
              tryResolve();
            }
          );
        }
      };
      tryNext();
    });
  }
};

// src/core/engine/lifecycle.ts
var LifecycleEngine = class {
  db;
  planModel;
  taskModel;
  events;
  constructor(db, planModel, taskModel, events) {
    this.db = db;
    this.planModel = planModel;
    this.taskModel = taskModel;
    this.events = events;
  }
  canComplete(planId) {
    const allTasks = this.taskModel.getByPlan(planId);
    const leafTasks = this.getLeafTasks(allTasks);
    const blockers = leafTasks.filter((t) => t.status !== "done" && t.status !== "skipped").map((t) => t.title);
    return {
      completable: blockers.length === 0,
      blockers
    };
  }
  completePlan(planId) {
    const { completable, blockers } = this.canComplete(planId);
    if (!completable) {
      throw new Error(
        `Plan cannot be completed. Blockers: ${blockers.join(", ")}`
      );
    }
    const verifier = new PlanVerifier(this.db);
    verifier.verify(planId).then((verification) => {
      if (verification.warnings.length > 0) {
        console.log(`[lifecycle] Plan ${planId} verification warnings:`);
        for (const w of verification.warnings) {
          console.log(`  - ${w}`);
        }
      }
      if (verification.overallScore >= 0) {
        console.log(`[lifecycle] AC verification score: ${verification.overallScore}/100`);
      }
    }).catch((err) => {
      console.error(`[lifecycle] Plan ${planId} verification failed:`, err instanceof Error ? err.message : err);
    });
    const plan = this.planModel.complete(planId);
    this.events?.record(
      "plan",
      planId,
      "lifecycle_completed",
      null,
      JSON.stringify({ status: "completed" })
    );
    return plan;
  }
  autoCheckCompletion(planId) {
    const allTasks = this.taskModel.getByPlan(planId);
    const leafTasks = this.getLeafTasks(allTasks);
    const total = leafTasks.length;
    const done = leafTasks.filter(
      (t) => t.status === "done" || t.status === "skipped"
    ).length;
    const pct = total === 0 ? 100 : Math.round(done / total * 100);
    return {
      all_done: total > 0 && done === total,
      progress: { total, done, pct }
    };
  }
  /**
   * 단일 태스크를 RetryEngine으로 실행한다 (재시도 + 에스컬레이션).
   * vs-next에서 호출하는 진입점.
   */
  async executeTaskWithRetry(taskId, planId, agentType, executeFn, retryConfig) {
    const engine = new RetryEngine(this.db, retryConfig ?? DEFAULT_RETRY_CONFIG);
    try {
      await engine.executeWithRetry(taskId, agentType, planId, executeFn);
      return { success: true, escalated: false };
    } catch (retryError) {
      const result = await engine.escalate(taskId, planId, agentType, executeFn);
      const lastAttempt = result.attempts[result.attempts.length - 1];
      const success = result.escalated && lastAttempt?.success === true;
      return { success, escalated: result.escalated };
    }
  }
  /**
   * 플랜의 wave를 WaveCoordinator로 병렬 실행한다.
   * vs-exec 배치 모드에서 호출하는 진입점.
   */
  async executeWavesParallel(planId, executeFn, options) {
    const coordinator = new WaveCoordinator(this.db);
    const plans = coordinator.buildExecutionPlan(planId);
    let completed = 0;
    let failed = 0;
    let blocked = 0;
    for (const wavePlan of plans) {
      const result = await coordinator.executeWaveParallel(
        wavePlan,
        executeFn,
        { maxConcurrent: options?.maxConcurrent ?? 3 }
      );
      for (const taskResult of result.results) {
        if (taskResult.status === "success") completed++;
        else if (taskResult.status === "failed") failed++;
        else if (taskResult.status === "blocked") blocked++;
      }
      this.events?.record(
        "plan",
        planId,
        "wave_completed",
        null,
        JSON.stringify({
          waveIndex: wavePlan.waveIndex,
          completed,
          failed,
          blocked
        })
      );
    }
    return { completed, failed, blocked };
  }
  getLeafTasks(tasks) {
    const parentIds = new Set(
      tasks.filter((t) => t.parent_id !== null).map((t) => t.parent_id)
    );
    return tasks.filter((t) => !parentIds.has(t.id));
  }
};

// src/cli/shared.ts
var jsonMode = false;
function setJsonMode(mode) {
  jsonMode = mode;
}
function getJsonMode() {
  return jsonMode;
}
var verboseMode = false;
function setVerboseMode(mode) {
  verboseMode = mode;
}
function output(data, formatted) {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatted ?? JSON.stringify(data, null, 2));
  }
}
function outputError(message) {
  if (jsonMode) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error(message);
  }
  process.exit(1);
}
function withErrorHandler(fn) {
  try {
    fn();
  } catch (e) {
    if (verboseMode && e instanceof Error && e.stack) {
      console.error(e.stack);
    }
    outputError(e instanceof Error ? e.message : String(e));
  }
}
function initModels() {
  const db = getDb();
  initSchema(db);
  const events = new EventModel(db);
  const cache = /* @__PURE__ */ new Map();
  function lazy(name, factory) {
    return {
      get() {
        if (!cache.has(name)) cache.set(name, factory());
        return cache.get(name);
      }
    };
  }
  const lazyAgentHandoff = lazy("agentHandoffModel", () => new AgentHandoffModel(db));
  const lazyPlan = lazy("planModel", () => new PlanModel(db, events, lazyAgentHandoff.get()));
  const lazyTask = lazy("taskModel", () => new TaskModel(db, events));
  const lazyTaskMetrics = lazy("taskMetricsModel", () => new TaskMetricsModel(db));
  const lazySkillUsage = lazy("skillUsageModel", () => new SkillUsageModel(db));
  const lazyLifecycle = lazy("lifecycle", () => new LifecycleEngine(db, lazyPlan.get(), lazyTask.get(), events));
  const lazyDashboard = lazy("dashboard", () => new DashboardEngine(db, lazySkillUsage.get()));
  const lazyAlerts = lazy("alerts", () => new AlertsEngine(db));
  const lazyStats = lazy("stats", () => new StatsEngine(db));
  const lazyInsights = lazy("insights", () => new InsightsEngine(db));
  const lazyQaRun = lazy("qaRunModel", () => new QARunModel(db));
  const lazyQaScenario = lazy("qaScenarioModel", () => new QAScenarioModel(db));
  const lazyQaFinding = lazy("qaFindingModel", () => new QAFindingModel(db));
  const lazyBacklog = lazy("backlogModel", () => new BacklogModel(db, events));
  const lazyMergeReport = lazy("mergeReportModel", () => new MergeReportModel(db));
  const lazyWaveGate = lazy("waveGateModel", () => new WaveGateModel(db));
  const lazyPlanRevision = lazy("planRevisionModel", () => new PlanRevisionModel(db));
  const lazyContextLog = lazy("contextModel", () => new ContextLogModel(db));
  return {
    db,
    events,
    get planModel() {
      return lazyPlan.get();
    },
    get taskModel() {
      return lazyTask.get();
    },
    get taskMetricsModel() {
      return lazyTaskMetrics.get();
    },
    get skillUsageModel() {
      return lazySkillUsage.get();
    },
    get lifecycle() {
      return lazyLifecycle.get();
    },
    get dashboard() {
      return lazyDashboard.get();
    },
    get alerts() {
      return lazyAlerts.get();
    },
    get stats() {
      return lazyStats.get();
    },
    get insights() {
      return lazyInsights.get();
    },
    get qaRunModel() {
      return lazyQaRun.get();
    },
    get qaScenarioModel() {
      return lazyQaScenario.get();
    },
    get qaFindingModel() {
      return lazyQaFinding.get();
    },
    get backlogModel() {
      return lazyBacklog.get();
    },
    get mergeReportModel() {
      return lazyMergeReport.get();
    },
    get agentHandoffModel() {
      return lazyAgentHandoff.get();
    },
    get waveGateModel() {
      return lazyWaveGate.get();
    },
    get planRevisionModel() {
      return lazyPlanRevision.get();
    },
    get contextModel() {
      return lazyContextLog.get();
    }
  };
}
function initDb() {
  const db = getDb();
  initSchema(db);
  return db;
}

// src/cli/commands/governance.ts
import { resolve as resolve2, join as join6 } from "path";
import { existsSync as existsSync7, readFileSync as readFileSync6, writeFileSync as writeFileSync5, chmodSync } from "fs";

// src/core/config-schema.ts
import { z as z2 } from "zod";
var ConfigValidationError = class extends Error {
  constructor(key, value, reason) {
    super(`Invalid config value for "${key}": "${value}" \u2014 ${reason}`);
    this.name = "ConfigValidationError";
  }
};
var BooleanStringSchema = z2.enum(["true", "false"]);
var PathStringSchema = z2.string().min(1, "Path must not be empty");
var CONFIG_SCHEMAS = {
  "careful.enabled": BooleanStringSchema,
  "freeze.enabled": BooleanStringSchema,
  "guard.enabled": BooleanStringSchema,
  "freeze.path": PathStringSchema
};
function validateConfigEntry(key, value) {
  const schema = CONFIG_SCHEMAS[key];
  if (!schema) {
    return;
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    const reason = result.error.issues.map((i) => i.message).join("; ");
    throw new ConfigValidationError(key, value, reason);
  }
}

// src/core/config.ts
function getConfig(db, key) {
  const row = db.prepare("SELECT value FROM vs_config WHERE key = ?").get(key);
  return row?.value ?? null;
}
function setConfig(db, key, value) {
  validateConfigEntry(key, value);
  db.prepare("INSERT INTO vs_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
function deleteConfig(db, key) {
  db.prepare("DELETE FROM vs_config WHERE key = ?").run(key);
}
function listConfig(db) {
  return db.prepare("SELECT key, value FROM vs_config ORDER BY key").all();
}

// src/cli/commands/skill-deferred-helpers.ts
import { readdirSync as readdirSync3, readFileSync as readFileSync4, writeFileSync as writeFileSync3, existsSync as existsSync4 } from "fs";
import { join as join3 } from "path";
function parseFrontmatter2(content) {
  const result = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    result[key] = value;
  }
  return result;
}
function listDeferredSkills(skillsDir) {
  if (!existsSync4(skillsDir)) return [];
  const entries = readdirSync3(skillsDir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = join3(skillsDir, entry.name, "SKILL.md");
    if (!existsSync4(skillMdPath)) continue;
    const content = readFileSync4(skillMdPath, "utf8");
    const fm = parseFrontmatter2(content);
    if (fm["invocation"] === "deferred") {
      results.push({
        name: fm["name"] ?? entry.name,
        description: fm["description"] ?? "",
        invocation: "deferred"
      });
    }
  }
  return results;
}
function promoteSkill(skillsDir, skillName) {
  const skillMdPath = join3(skillsDir, skillName, "SKILL.md");
  if (!existsSync4(skillMdPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  const content = readFileSync4(skillMdPath, "utf8");
  const fm = parseFrontmatter2(content);
  if (fm["invocation"] !== "deferred") {
    throw new Error(`Skill '${skillName}' is not deferred (current: ${fm["invocation"] ?? "unknown"})`);
  }
  const updated = content.replace(/^invocation: deferred$/m, "invocation: user");
  writeFileSync3(skillMdPath, updated, "utf8");
  return {
    name: skillName,
    invocation: "user",
    previous: "deferred"
  };
}
function demoteSkill(skillsDir, skillName) {
  const skillMdPath = join3(skillsDir, skillName, "SKILL.md");
  if (!existsSync4(skillMdPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  const content = readFileSync4(skillMdPath, "utf8");
  const fm = parseFrontmatter2(content);
  if (fm["invocation"] === "deferred") {
    throw new Error(`Skill '${skillName}' is already deferred`);
  }
  const currentInvocation = fm["invocation"] ?? "user";
  const updated = content.replace(
    new RegExp(`^invocation: ${currentInvocation}$`, "m"),
    "invocation: deferred"
  );
  writeFileSync3(skillMdPath, updated, "utf8");
  return {
    name: skillName,
    invocation: "deferred",
    previous: currentInvocation
  };
}

// src/core/engine/artifact-cleanup.ts
import { existsSync as existsSync6, readdirSync as readdirSync5, rmSync as rmSync2, statSync as statSync2 } from "fs";
import { join as join5 } from "path";

// src/core/engine/rule-cleanup.ts
function tokenize(text) {
  return new Set(
    text.toLowerCase().split(/\s+/).filter((t) => t.length > 0)
  );
}
function jaccardSimilarity(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = /* @__PURE__ */ new Set([...a, ...b]);
  return intersection.size / union.size;
}
var RuleCleanup = class {
  db;
  engine;
  // In-memory store for detected groups (keyed by group id)
  groups = /* @__PURE__ */ new Map();
  constructor(db, engine) {
    this.db = db;
    this.engine = engine;
  }
  detectDuplicates() {
    const rules = this.engine.listRules("active");
    if (rules.length === 0) {
      this.groups.clear();
      return [];
    }
    const grouped = /* @__PURE__ */ new Map();
    const similarityMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const ruleA = rules[i];
        const ruleB = rules[j];
        const tokensA = tokenize(ruleA.title);
        const tokensB = tokenize(ruleB.title);
        const sim = jaccardSimilarity(tokensA, tokensB);
        if (sim >= 0.7) {
          similarityMap.set(`${ruleA.id}:${ruleB.id}`, sim);
          if (!grouped.has(ruleA.id)) grouped.set(ruleA.id, /* @__PURE__ */ new Set([ruleA.id]));
          if (!grouped.has(ruleB.id)) grouped.set(ruleB.id, /* @__PURE__ */ new Set([ruleB.id]));
          const setA = grouped.get(ruleA.id);
          const setB = grouped.get(ruleB.id);
          const merged = /* @__PURE__ */ new Set([...setA, ...setB]);
          for (const id of merged) {
            grouped.set(id, merged);
          }
        }
      }
    }
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    this.groups.clear();
    for (const [, set] of grouped) {
      if (seen.has(set)) continue;
      seen.add(set);
      const ids = [...set];
      if (ids.length < 2) continue;
      const ruleObjs = ids.map((id) => {
        const rule = rules.find((r) => r.id === id);
        let maxSim = 0;
        for (const otherId of ids) {
          if (otherId === id) continue;
          const key1 = `${id}:${otherId}`;
          const key2 = `${otherId}:${id}`;
          const sim = similarityMap.get(key1) ?? similarityMap.get(key2) ?? 0;
          if (sim > maxSim) maxSim = sim;
        }
        return { id, title: rule.title, similarity: maxSim };
      });
      const groupId = generateId();
      const group = { id: groupId, rules: ruleObjs };
      this.groups.set(groupId, group);
      result.push(group);
    }
    return result;
  }
  detectConflicts() {
    const rules = this.engine.listRules("active");
    if (rules.length < 2) return [];
    const FORBIDDEN_KEYWORDS = ["\uD558\uC9C0 \uB9C8", "\uAE08\uC9C0", "\uC0AC\uC6A9\uD558\uC9C0", "\uD53C\uD558", "don't", "avoid", "never"];
    const RECOMMEND_KEYWORDS = ["\uC0AC\uC6A9\uD558", "\uD574\uC57C", "\uD544\uC218", "always", "must", "use"];
    const ALL_ACTION_KEYWORDS = [...FORBIDDEN_KEYWORDS, ...RECOMMEND_KEYWORDS];
    function classifyAction(title) {
      const lower = title.toLowerCase();
      if (FORBIDDEN_KEYWORDS.some((k) => lower.includes(k))) return "forbidden";
      if (RECOMMEND_KEYWORDS.some((k) => lower.includes(k))) return "recommend";
      return "neutral";
    }
    function stripActionKeywords(title) {
      const tokens = [...tokenize(title)];
      const filtered = tokens.filter((t) => !ALL_ACTION_KEYWORDS.some((k) => t.includes(k.toLowerCase())));
      return new Set(filtered.length > 0 ? filtered : tokens);
    }
    const conflicts = [];
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const ruleA = rules[i];
        const ruleB = rules[j];
        if (ruleA.category !== ruleB.category) continue;
        const actionA = classifyAction(ruleA.title);
        const actionB = classifyAction(ruleB.title);
        if (actionA === "neutral" || actionB === "neutral") continue;
        if (actionA === actionB) continue;
        const tokensA = stripActionKeywords(ruleA.title);
        const tokensB = stripActionKeywords(ruleB.title);
        const sim = jaccardSimilarity(tokensA, tokensB);
        if (sim < 0.5) continue;
        conflicts.push({
          ruleA: { id: ruleA.id, title: ruleA.title },
          ruleB: { id: ruleB.id, title: ruleB.title },
          reason: `\uAC19\uC740 \uCE74\uD14C\uACE0\uB9AC(${ruleA.category}) \uB0B4 \uC0C1\uBC18\uB418\uB294 action (\uC720\uC0AC\uB3C4: ${Math.round(sim * 100)}%)`
        });
      }
    }
    return conflicts;
  }
  async runSessionCleanup() {
    try {
      const duplicateGroups = this.detectDuplicates();
      const conflicts = this.detectConflicts();
      const archivedIds = this.engine.autoArchiveStale();
      const report = {
        duplicates: duplicateGroups.length,
        conflicts: conflicts.length,
        archived: archivedIds.length
      };
      console.log(
        `[Cleanup] \uC138\uC158 \uC815\uB9AC \uC644\uB8CC \u2014 \uC911\uBCF5: ${report.duplicates}, \uCDA9\uB3CC: ${report.conflicts}, \uC544\uCE74\uC774\uBE0C: ${report.archived}`
      );
      return report;
    } catch (err) {
      console.error("[Cleanup] \uC138\uC158 \uC815\uB9AC \uC2E4\uD328:", err instanceof Error ? err.message : err);
      return { duplicates: 0, conflicts: 0, archived: 0 };
    }
  }
  mergeDuplicates(groupId) {
    const group = this.groups.get(groupId);
    if (!group) return;
    const ruleIds = group.rules.map((r) => r.id);
    if (ruleIds.length < 2) return;
    const ruleRecords = ruleIds.map((id) => this.engine.listRules().find((r) => r.id === id)).filter((r) => r !== void 0);
    if (ruleRecords.length === 0) return;
    const representative = ruleRecords.reduce((latest, r) => {
      return r.created_at > latest.created_at ? r : latest;
    });
    const totalOccurrences = ruleRecords.reduce((sum, r) => sum + r.occurrences, 0);
    const totalPrevented = ruleRecords.reduce((sum, r) => sum + r.prevented, 0);
    this.db.prepare(
      "UPDATE self_improve_rules SET occurrences = ?, prevented = ? WHERE id = ?"
    ).run(totalOccurrences, totalPrevented, representative.id);
    for (const rule of ruleRecords) {
      if (rule.id !== representative.id) {
        this.engine.archiveRule(rule.id);
      }
    }
  }
};

// src/core/engine/self-improve.ts
import * as fs2 from "fs";
import * as path2 from "path";
var RULES_DIR = ".claude/rules";
var ARCHIVE_DIR = ".claude/rules/archive";
var PENDING_DIR = ".claude/self-improve/pending";
var PROCESSED_DIR = ".claude/self-improve/processed";
var CONFIG_LAST_RUN = "self_improve_last_run";
var MAX_ACTIVE_RULES = 30;
var SelfImproveEngine = class {
  db;
  projectRoot;
  rulesDir;
  archiveDir;
  pendingDir;
  processedDir;
  constructor(db, projectRoot) {
    this.db = db;
    this.projectRoot = projectRoot;
    this.rulesDir = path2.join(projectRoot, RULES_DIR);
    this.archiveDir = path2.join(projectRoot, ARCHIVE_DIR);
    this.pendingDir = path2.join(projectRoot, PENDING_DIR);
    this.processedDir = path2.join(projectRoot, PROCESSED_DIR);
    this.ensureDirectories();
  }
  ensureDirectories() {
    fs2.mkdirSync(this.rulesDir, { recursive: true });
    fs2.mkdirSync(this.archiveDir, { recursive: true });
    fs2.mkdirSync(this.pendingDir, { recursive: true });
    fs2.mkdirSync(this.processedDir, { recursive: true });
  }
  createRule(newRule) {
    const id = generateId();
    const slug = newRule.title.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    const filename = `${newRule.category.toLowerCase()}-${slug}.md`;
    const rulePath = path2.join(RULES_DIR, filename);
    const fullPath = path2.join(this.projectRoot, rulePath);
    const enforcement = newRule.enforcement ?? "SOFT";
    const ruleType = newRule.rule_type ?? "preventive";
    const content = ruleType === "procedural" ? this.buildProceduralTemplate(newRule.title, newRule.ruleContent) : newRule.ruleContent;
    fs2.writeFileSync(fullPath, content, "utf-8");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(`
      INSERT INTO self_improve_rules (id, error_kb_id, title, category, rule_type, rule_path, occurrences, prevented, status, enforcement, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)
    `).run(id, newRule.error_kb_id ?? null, newRule.title, newRule.category, ruleType, rulePath, enforcement, now);
    return {
      id,
      error_kb_id: newRule.error_kb_id ?? null,
      title: newRule.title,
      category: newRule.category,
      rule_type: ruleType,
      rule_path: rulePath,
      occurrences: 0,
      prevented: 0,
      status: "active",
      enforcement,
      escalated_at: null,
      created_at: now,
      last_triggered_at: null
    };
  }
  listRules(status, type) {
    const conditions = [];
    const params = [];
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (type) {
      conditions.push("rule_type = ?");
      params.push(type);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const order = status ? "ORDER BY created_at DESC" : "ORDER BY status ASC, created_at DESC";
    return this.db.prepare(`SELECT * FROM self_improve_rules ${where} ${order}`).all(...params);
  }
  getRule(id) {
    return this.db.prepare(
      "SELECT * FROM self_improve_rules WHERE id = ?"
    ).get(id) ?? null;
  }
  archiveRule(id) {
    const rule = this.getRule(id);
    if (!rule || rule.status === "archived") return false;
    const srcPath = path2.join(this.projectRoot, rule.rule_path);
    const destPath = path2.join(this.archiveDir, path2.basename(rule.rule_path));
    if (fs2.existsSync(srcPath)) {
      fs2.renameSync(srcPath, destPath);
    }
    const newRulePath = path2.join(ARCHIVE_DIR, path2.basename(rule.rule_path));
    this.db.prepare(
      "UPDATE self_improve_rules SET status = ?, rule_path = ? WHERE id = ?"
    ).run("archived", newRulePath, id);
    return true;
  }
  incrementPrevented(id) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "UPDATE self_improve_rules SET prevented = prevented + 1, last_triggered_at = ? WHERE id = ?"
    ).run(now, id);
  }
  updateOccurrences(id, occurrences) {
    this.db.prepare(
      "UPDATE self_improve_rules SET occurrences = ? WHERE id = ?"
    ).run(occurrences, id);
  }
  getPendingCount() {
    if (!fs2.existsSync(this.pendingDir)) return 0;
    return fs2.readdirSync(this.pendingDir).filter((f) => f.endsWith(".json")).length;
  }
  listPending() {
    if (!fs2.existsSync(this.pendingDir)) return [];
    return fs2.readdirSync(this.pendingDir).filter((f) => f.endsWith(".json")).map((f) => path2.join(this.pendingDir, f)).sort();
  }
  movePendingToProcessed(pendingPath) {
    const filename = path2.basename(pendingPath);
    const destPath = path2.join(this.processedDir, filename);
    if (fs2.existsSync(pendingPath)) {
      fs2.renameSync(pendingPath, destPath);
    }
  }
  getLastRunTimestamp() {
    return getConfig(this.db, CONFIG_LAST_RUN);
  }
  setLastRunTimestamp() {
    setConfig(this.db, CONFIG_LAST_RUN, (/* @__PURE__ */ new Date()).toISOString());
  }
  getRuleStats() {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived,
        COALESCE(SUM(prevented), 0) AS total_prevented
      FROM self_improve_rules
    `).get();
    return {
      active: row?.active ?? 0,
      archived: row?.archived ?? 0,
      total_prevented: row?.total_prevented ?? 0
    };
  }
  getEffectiveness(id) {
    const rule = this.getRule(id);
    if (!rule) return 0;
    const total = rule.prevented + rule.occurrences;
    if (total === 0) return 0;
    return rule.prevented / total;
  }
  isAtCapacity() {
    const stats = this.getRuleStats();
    return stats.active >= MAX_ACTIVE_RULES;
  }
  getMaxActiveRules() {
    return MAX_ACTIVE_RULES;
  }
  escalateRule(id) {
    const rule = this.getRule(id);
    if (!rule || rule.enforcement === "HARD") return false;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "UPDATE self_improve_rules SET enforcement = ?, escalated_at = ? WHERE id = ?"
    ).run("HARD", now, id);
    const fullPath = path2.join(this.projectRoot, rule.rule_path);
    if (fs2.existsSync(fullPath)) {
      let content = fs2.readFileSync(fullPath, "utf-8");
      content = content.replace(/Enforcement:\s*SOFT/g, "Enforcement: HARD");
      fs2.writeFileSync(fullPath, content, "utf-8");
    }
    return true;
  }
  checkEscalation() {
    const rows = this.db.prepare(`
      SELECT id, title, rule_path, created_at, occurrences, prevented,
        CAST((julianday('now') - julianday(created_at)) AS INTEGER) AS days_since_creation
      FROM self_improve_rules
      WHERE status = 'active'
        AND enforcement = 'SOFT'
        AND occurrences >= 3
        AND prevented = 0
        AND CAST((julianday('now') - julianday(created_at)) AS INTEGER) >= 30
      ORDER BY occurrences DESC
    `).all();
    return rows;
  }
  autoArchiveStale(days = 60) {
    const rows = this.db.prepare(`
      SELECT id, rule_path FROM self_improve_rules
      WHERE status = 'active'
        AND occurrences = 0
        AND prevented = 0
        AND CAST((julianday('now') - julianday(created_at)) AS INTEGER) >= ?
    `).all(days);
    const archivedIds = [];
    for (const row of rows) {
      if (this.archiveRule(row.id)) {
        archivedIds.push(row.id);
      }
    }
    return archivedIds;
  }
  recordViolation(id) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "UPDATE self_improve_rules SET occurrences = occurrences + 1, last_triggered_at = ? WHERE id = ?"
    ).run(now, id);
  }
  recordPrevention(id) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "UPDATE self_improve_rules SET prevented = prevented + 1, last_triggered_at = ? WHERE id = ?"
    ).run(now, id);
  }
  buildProceduralTemplate(title, content) {
    return `# ${title}

## When to Use
${content}

## Procedure
(\uC808\uCC28\uB97C \uAE30\uC220\uD558\uC138\uC694)

## Pitfalls
(\uC54C\uB824\uC9C4 \uD568\uC815\uC744 \uAE30\uC220\uD558\uC138\uC694)
`;
  }
  getRulesDir() {
    return this.rulesDir;
  }
  getPendingDir() {
    return this.pendingDir;
  }
  getProcessedDir() {
    return this.processedDir;
  }
  // --- Dream: auto-cleanup of duplicate/conflicting rules ---
  dream() {
    const ruleFiles = this.listRuleFiles();
    if (ruleFiles.length === 0) {
      return new DreamResult([], [], ruleFiles.map((r) => r.filename), this);
    }
    const merged = [];
    const archived = [];
    const kept = [];
    const processed = /* @__PURE__ */ new Set();
    for (let i = 0; i < ruleFiles.length; i++) {
      if (processed.has(i)) continue;
      let foundDuplicate = false;
      for (let j = i + 1; j < ruleFiles.length; j++) {
        if (processed.has(j)) continue;
        const overlap = this.keywordOverlap(ruleFiles[i].keywords, ruleFiles[j].keywords);
        if (overlap >= 0.5) {
          merged.push({
            source: [ruleFiles[i].filename, ruleFiles[j].filename],
            mergedContent: this.mergeContents(ruleFiles[i], ruleFiles[j]),
            mergedFilename: ruleFiles[i].filename
          });
          archived.push(ruleFiles[j].filename);
          processed.add(j);
          foundDuplicate = true;
          break;
        }
      }
      if (!foundDuplicate) {
        kept.push(ruleFiles[i].filename);
      } else {
        processed.add(i);
      }
    }
    for (let i = 0; i < ruleFiles.length; i++) {
      if (!processed.has(i) && !kept.includes(ruleFiles[i].filename)) {
        kept.push(ruleFiles[i].filename);
      }
    }
    return new DreamResult(merged, archived, kept, this);
  }
  listRuleFiles() {
    if (!fs2.existsSync(this.rulesDir)) return [];
    const files = fs2.readdirSync(this.rulesDir).filter((f) => f.endsWith(".md"));
    const results = [];
    for (const file of files) {
      const fullPath = path2.join(this.rulesDir, file);
      try {
        const content = fs2.readFileSync(fullPath, "utf-8");
        const keywords = this.extractKeywords(content);
        results.push({ filename: file, content, keywords, fullPath });
      } catch {
        console.warn(`[dream] Skipping unreadable rule file: ${file}`);
      }
    }
    return results;
  }
  extractKeywords(content) {
    const words = content.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2);
    return new Set(words);
  }
  keywordOverlap(a, b) {
    if (a.size === 0 || b.size === 0) return 0;
    let overlap = 0;
    for (const word of a) {
      if (b.has(word)) overlap++;
    }
    const minSize = Math.min(a.size, b.size);
    return overlap / minSize;
  }
  mergeContents(a, b) {
    return `${a.content}

---
## Merged from: ${b.filename}
${b.content}`;
  }
  /** Move a file to archive directory (used by DreamResult.apply) */
  moveToArchive(filename) {
    const srcPath = path2.join(this.rulesDir, filename);
    const destPath = path2.join(this.archiveDir, filename);
    if (fs2.existsSync(srcPath)) {
      fs2.renameSync(srcPath, destPath);
    }
  }
  /** Overwrite a rule file's content (used by DreamResult.apply) */
  writeRuleFile(filename, content) {
    const fullPath = path2.join(this.rulesDir, filename);
    fs2.writeFileSync(fullPath, content, "utf-8");
  }
};
var DreamResult = class {
  merged;
  archived;
  kept;
  engine;
  constructor(merged, archived, kept, engine) {
    this.merged = merged;
    this.archived = archived;
    this.kept = kept;
    this.engine = engine;
  }
  get isEmpty() {
    return this.merged.length === 0 && this.archived.length === 0;
  }
  apply() {
    for (const filename of this.archived) {
      this.engine.moveToArchive(filename);
    }
    for (const pair of this.merged) {
      this.engine.writeRuleFile(pair.mergedFilename, pair.mergedContent);
    }
  }
  /** Generate a human-readable diff summary for display */
  formatDiff() {
    if (this.isEmpty) return "";
    const lines = [];
    lines.push(`## Dream \uACB0\uACFC: ${this.merged.length}\uAC74 \uBCD1\uD569, ${this.archived.length}\uAC74 \uC544\uCE74\uC774\uBE0C
`);
    for (const pair of this.merged) {
      lines.push(`### \uBCD1\uD569: ${pair.source[0]} + ${pair.source[1]}`);
      lines.push(`\u2192 ${pair.mergedFilename} (\uD1B5\uD569\uBCF8)`);
      lines.push(`  - ${pair.source[1]} \u2192 archive/ \uC774\uB3D9`);
      lines.push("");
    }
    if (this.kept.length > 0) {
      lines.push(`### \uC720\uC9C0: ${this.kept.length}\uAC1C \uADDC\uCE59 \uBCC0\uACBD \uC5C6\uC74C`);
    }
    return lines.join("\n");
  }
};

// src/core/engine/artifact-cleanup.ts
var PRESERVED_DIRS = /* @__PURE__ */ new Set(["archive", "hooks", "error-kb", "plans", "qa-reports", "qa-results", "self-improve"]);
var ArtifactCleanup = class {
  db;
  projectRoot;
  claudeDir;
  constructor(db, projectRoot) {
    this.db = db;
    this.projectRoot = projectRoot;
    this.claudeDir = join5(projectRoot, ".claude");
  }
  async run(options) {
    const retentionDays = options?.retentionDays ?? 7;
    const dryRun = options?.dryRun ?? false;
    const trigger = options?.trigger ?? "manual";
    const result = {
      handoffsRemoved: 0,
      reportsRemoved: 0,
      rulesArchived: 0,
      rulesConflicts: 0,
      emptyDirsRemoved: 0,
      details: []
    };
    if (!existsSync6(this.claudeDir)) {
      result.details.push(".claude/ directory not found, skipping");
      return result;
    }
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    result.handoffsRemoved = this.cleanHandoffs(retentionDays, dryRun, result.details);
    result.reportsRemoved = this.cleanReports(retentionDays, dryRun, result.details);
    const ruleResult = this.runRuleCleanup(result.details);
    result.rulesArchived = ruleResult.archived;
    result.rulesConflicts = ruleResult.conflicts;
    result.emptyDirsRemoved = this.cleanEmptyDirs(dryRun, result.details);
    this.recordCleanup(generateId(), trigger, startedAt, dryRun, result);
    return result;
  }
  cleanHandoffs(retentionDays, dryRun, details) {
    const handoffDir = join5(this.claudeDir, "handoff");
    if (!existsSync6(handoffDir)) return 0;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1e3;
    const activeTaskIds = this.getActiveHandoffTaskIds();
    let removed = 0;
    for (const entry of readdirSync5(handoffDir)) {
      const fullPath = join5(handoffDir, entry);
      try {
        const stat = statSync2(fullPath);
        if (!stat.isDirectory()) continue;
        const isActive = activeTaskIds.has(entry);
        const contents = readdirSync5(fullPath);
        if (contents.length === 0 && !isActive) {
          if (!dryRun) rmSync2(fullPath, { recursive: true });
          details.push(`${dryRun ? "[dry-run] " : ""}removed empty handoff: ${entry}`);
          removed++;
          continue;
        }
        if (stat.mtimeMs < cutoff && !isActive) {
          if (!dryRun) rmSync2(fullPath, { recursive: true });
          details.push(`${dryRun ? "[dry-run] " : ""}removed expired handoff: ${entry}`);
          removed++;
        }
      } catch (err) {
        details.push(`error cleaning handoff ${entry}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return removed;
  }
  cleanReports(retentionDays, dryRun, details) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1e3;
    const reportDirs = ["session-reports", "reports"];
    let removed = 0;
    for (const dirName of reportDirs) {
      const dir = join5(this.claudeDir, dirName);
      if (!existsSync6(dir)) continue;
      for (const entry of readdirSync5(dir)) {
        const fullPath = join5(dir, entry);
        try {
          const stat = statSync2(fullPath);
          if (!stat.isFile()) continue;
          if (stat.mtimeMs < cutoff) {
            if (!dryRun) rmSync2(fullPath);
            details.push(`${dryRun ? "[dry-run] " : ""}removed ${dirName}/${entry}`);
            removed++;
          }
        } catch (err) {
          details.push(`error cleaning ${dirName}/${entry}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    return removed;
  }
  runRuleCleanup(details) {
    try {
      const engine = new SelfImproveEngine(this.db, this.projectRoot);
      const cleanup = new RuleCleanup(this.db, engine);
      const report = cleanup.detectDuplicates();
      const conflicts = cleanup.detectConflicts();
      const staleArchived = engine.autoArchiveStale();
      details.push(`rule cleanup: ${report.length} duplicate groups, ${conflicts.length} conflicts, ${staleArchived.length} stale archived`);
      return { archived: staleArchived.length, conflicts: conflicts.length };
    } catch (err) {
      details.push(`rule cleanup error: ${err instanceof Error ? err.message : String(err)}`);
      return { archived: 0, conflicts: 0 };
    }
  }
  cleanEmptyDirs(dryRun, details) {
    let removed = 0;
    const dirsToCheck = ["worktrees"];
    for (const dirName of dirsToCheck) {
      const dir = join5(this.claudeDir, dirName);
      if (!existsSync6(dir)) continue;
      for (const entry of readdirSync5(dir)) {
        const fullPath = join5(dir, entry);
        try {
          const stat = statSync2(fullPath);
          if (!stat.isDirectory()) continue;
          if (PRESERVED_DIRS.has(entry)) continue;
          const contents = readdirSync5(fullPath);
          if (contents.length === 0) {
            if (!dryRun) rmSync2(fullPath, { recursive: true });
            details.push(`${dryRun ? "[dry-run] " : ""}removed empty dir: ${dirName}/${entry}`);
            removed++;
          }
        } catch (err) {
          details.push(`error cleaning ${dirName}/${entry}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    return removed;
  }
  getActiveHandoffTaskIds() {
    try {
      const rows = this.db.prepare(`
        SELECT DISTINCT ah.task_id
        FROM agent_handoffs ah
        JOIN plans p ON ah.plan_id = p.id
        WHERE p.status IN ('draft', 'active', 'approved')
      `).all();
      return new Set(rows.map((r) => r.task_id));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  recordCleanup(id, trigger, startedAt, dryRun, result) {
    try {
      const summary = [
        `handoffs: ${result.handoffsRemoved}`,
        `reports: ${result.reportsRemoved}`,
        `rules archived: ${result.rulesArchived}`,
        `conflicts: ${result.rulesConflicts}`,
        `empty dirs: ${result.emptyDirsRemoved}`
      ].join(", ");
      this.db.prepare(`
        INSERT INTO artifact_cleanups (id, trigger, started_at, completed_at, handoffs_removed, reports_removed, rules_archived, rules_conflicts, empty_dirs_removed, dry_run, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        trigger,
        startedAt,
        (/* @__PURE__ */ new Date()).toISOString(),
        result.handoffsRemoved,
        result.reportsRemoved,
        result.rulesArchived,
        result.rulesConflicts,
        result.emptyDirsRemoved,
        dryRun ? 1 : 0,
        summary
      );
    } catch {
    }
  }
};

// src/cli/commands/governance.ts
function manageHook(action, hookId, toolName, scriptPath) {
  const settingsDir = join6(process.cwd(), ".claude");
  const settingsPath = join6(settingsDir, "settings.local.json");
  let settings = {};
  if (existsSync7(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync6(settingsPath, "utf8"));
    } catch {
      settings = {};
    }
  }
  if (!settings.hooks) settings.hooks = {};
  const hooks = settings.hooks;
  if (!hooks.PreToolUse) hooks.PreToolUse = [];
  const preToolUse = hooks.PreToolUse;
  if (action === "add") {
    hooks.PreToolUse = preToolUse.filter((h) => h.id !== hookId);
    hooks.PreToolUse.push({
      id: hookId,
      type: "command",
      matcher: toolName,
      command: scriptPath
    });
    if (existsSync7(scriptPath)) {
      try {
        chmodSync(scriptPath, 493);
      } catch {
      }
    }
  } else {
    hooks.PreToolUse = preToolUse.filter((h) => h.id !== hookId);
  }
  writeFileSync5(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
function registerGovernanceCommands(program2, _getModels) {
  const careful = program2.command("careful").description("Manage careful mode (destructive command guard)");
  careful.command("on").description("Enable careful mode").action(() => {
    const db = initDb();
    setConfig(db, "careful.enabled", "true");
    const scriptPath = join6(process.cwd(), "bin", "check-careful.sh");
    manageHook("add", "vs-careful", "Bash", scriptPath);
    output({ careful: true }, "\u26A0\uFE0F careful \uBAA8\uB4DC \uD65C\uC131\uD654\uB428 \u2014 \uD30C\uAD34\uC801 \uBA85\uB839\uC774 \uCC28\uB2E8\uB429\uB2C8\uB2E4.");
  });
  careful.command("off").description("Disable careful mode").action(() => {
    const db = initDb();
    setConfig(db, "careful.enabled", "false");
    manageHook("remove", "vs-careful", "Bash", "");
    output({ careful: false }, "careful \uBAA8\uB4DC \uBE44\uD65C\uC131\uD654\uB428.");
  });
  careful.command("status").description("Show careful mode status").action(() => {
    const db = initDb();
    const enabled = getConfig(db, "careful.enabled") === "true";
    output({ careful: enabled }, enabled ? "\u26A0\uFE0F careful \uBAA8\uB4DC: \uD65C\uC131\uD654" : "careful \uBAA8\uB4DC: \uBE44\uD65C\uC131\uD654");
  });
  const freeze = program2.command("freeze").description("Manage freeze boundary (edit scope restriction)");
  freeze.command("set").argument("<path>", "Directory path to restrict edits to").description("Set freeze boundary").action((inputPath) => {
    const db = initDb();
    const absPath = resolve2(inputPath);
    setConfig(db, "freeze.path", absPath);
    const scriptPath = join6(process.cwd(), "bin", "check-freeze.sh");
    manageHook("add", "vs-freeze-edit", "Edit", scriptPath);
    manageHook("add", "vs-freeze-write", "Write", scriptPath);
    output({ freeze: absPath }, `\u{1F512} freeze \uD65C\uC131\uD654\uB428 \u2014 \uD3B8\uC9D1 \uBC94\uC704: ${absPath}`);
  });
  freeze.command("off").description("Remove freeze boundary").action(() => {
    const db = initDb();
    deleteConfig(db, "freeze.path");
    manageHook("remove", "vs-freeze-edit", "Edit", "");
    manageHook("remove", "vs-freeze-write", "Write", "");
    output({ freeze: null }, "freeze \uBE44\uD65C\uC131\uD654\uB428 \u2014 \uD3B8\uC9D1 \uBC94\uC704 \uC81C\uD55C \uD574\uC81C.");
  });
  freeze.command("status").description("Show freeze boundary status").action(() => {
    const db = initDb();
    const freezePath = getConfig(db, "freeze.path");
    output(
      { freeze: freezePath },
      freezePath ? `\u{1F512} freeze: ${freezePath}` : "freeze: \uBE44\uD65C\uC131\uD654"
    );
  });
  const guard = program2.command("guard").description("Enable/disable careful + freeze combined");
  guard.command("on").argument("<path>", "Directory path to restrict edits to").description("Enable careful mode and set freeze boundary").action((inputPath) => {
    const db = initDb();
    const absPath = resolve2(inputPath);
    setConfig(db, "careful.enabled", "true");
    setConfig(db, "freeze.path", absPath);
    const carefulScript = join6(process.cwd(), "bin", "check-careful.sh");
    const freezeScript = join6(process.cwd(), "bin", "check-freeze.sh");
    manageHook("add", "vs-careful", "Bash", carefulScript);
    manageHook("add", "vs-freeze-edit", "Edit", freezeScript);
    manageHook("add", "vs-freeze-write", "Write", freezeScript);
    output(
      { careful: true, freeze: absPath },
      `\u{1F6E1}\uFE0F guard \uD65C\uC131\uD654\uB428 \u2014 careful + freeze: ${absPath}`
    );
  });
  guard.command("off").description("Disable both careful mode and freeze boundary").action(() => {
    const db = initDb();
    setConfig(db, "careful.enabled", "false");
    deleteConfig(db, "freeze.path");
    manageHook("remove", "vs-careful", "Bash", "");
    manageHook("remove", "vs-freeze-edit", "Edit", "");
    manageHook("remove", "vs-freeze-write", "Write", "");
    output({ careful: false, freeze: null }, "guard \uBE44\uD65C\uC131\uD654\uB428 \u2014 careful + freeze \uBAA8\uB450 \uD574\uC81C.");
  });
  guard.command("status").description("Show guard status").action(() => {
    const db = initDb();
    const carefulEnabled = getConfig(db, "careful.enabled") === "true";
    const freezePath = getConfig(db, "freeze.path");
    output(
      { careful: carefulEnabled, freeze: freezePath },
      `\u{1F6E1}\uFE0F guard: careful=${carefulEnabled ? "\uD65C\uC131\uD654" : "\uBE44\uD65C\uC131\uD654"}, freeze=${freezePath ?? "\uBE44\uD65C\uC131\uD654"}`
    );
  });
  const handoff = program2.command("handoff").description("Manage agent handoff records and files");
  handoff.command("write").argument("<task_id>", "Task ID").requiredOption("--agent <type>", "Agent type").requiredOption("--attempt <n>", "Attempt number", parseInt).requiredOption("--verdict <v>", "Verdict").requiredOption("--summary <text>", "Summary text").option("--report-path <path>", "Report file path").description("Create a handoff record and JSON report file").action((taskId, opts) => {
    withErrorHandler(() => {
      const models = _getModels();
      const handoffModel = new AgentHandoffModel(models.db);
      const task = models.taskModel.getById(taskId);
      if (!task) return outputError(`Task not found: ${taskId}`);
      const planId = task.plan_id;
      const record = handoffModel.create(
        taskId,
        planId,
        opts.agent,
        opts.attempt,
        opts.verdict,
        opts.summary,
        opts.reportPath
      );
      const reportData = {
        id: record.id,
        task_id: taskId,
        plan_id: planId,
        agent_type: opts.agent,
        attempt: opts.attempt,
        verdict: opts.verdict,
        summary: opts.summary,
        created_at: record.created_at
      };
      const filePath = handoffModel.writeHandoffReport(taskId, opts.agent, opts.attempt, reportData);
      output(
        { ...record, report_file: filePath },
        `Handoff created: ${record.id} (file: ${filePath})`
      );
    });
  });
  handoff.command("read").argument("<task_id>", "Task ID").option("--agent <type>", "Agent type").option("--attempt <n>", "Attempt number", parseInt).description("Read handoff records and report files").action((taskId, opts) => {
    withErrorHandler(() => {
      const models = _getModels();
      const handoffModel = new AgentHandoffModel(models.db);
      const records = handoffModel.getByTask(taskId, opts.agent, opts.attempt);
      if (records.length === 0) return outputError(`No handoff records found for task: ${taskId}`);
      const results = records.map((rec) => {
        let reportContent = null;
        if (rec.agent_type && rec.attempt) {
          reportContent = handoffModel.readHandoffReport(taskId, rec.agent_type, rec.attempt);
        }
        return { ...rec, report_content: reportContent };
      });
      output(results, results.map(
        (r) => `[${r.agent_type}#${r.attempt}] ${r.verdict} \u2014 ${r.summary}`
      ).join("\n"));
    });
  });
  handoff.command("clean").argument("<plan_id>", "Plan ID").description("Delete all handoff records and files for a plan").action((planId) => {
    withErrorHandler(() => {
      const models = _getModels();
      const handoffModel = new AgentHandoffModel(models.db);
      const before = handoffModel.list(planId).length;
      handoffModel.cleanByPlan(planId);
      output(
        { plan_id: planId, deleted: before },
        `Cleaned ${before} handoff record(s) for plan: ${planId}`
      );
    });
  });
  const skillDeferred = program2.command("skill-deferred").description("Manage deferred skill loading (promote/demote)");
  skillDeferred.command("list").description("List skills with invocation: deferred").action(() => {
    const skillsDir = join6(process.cwd(), "skills");
    const skills = listDeferredSkills(skillsDir);
    output(
      skills,
      skills.length === 0 ? "deferred \uC2A4\uD0AC\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." : skills.map((s) => `  - ${s.name}: ${s.description}`).join("\n")
    );
  });
  skillDeferred.command("promote").argument("<skill>", "Skill name to promote (deferred \u2192 user)").description("Promote a deferred skill to user invocation").action((skillName) => {
    withErrorHandler(() => {
      const skillsDir = join6(process.cwd(), "skills");
      const result = promoteSkill(skillsDir, skillName);
      output(result, `${result.name}: deferred \u2192 user \uC804\uD658 \uC644\uB8CC`);
    });
  });
  skillDeferred.command("demote").argument("<skill>", "Skill name to demote (user \u2192 deferred)").description("Demote a user skill to deferred invocation").action((skillName) => {
    withErrorHandler(() => {
      const skillsDir = join6(process.cwd(), "skills");
      const result = demoteSkill(skillsDir, skillName);
      output(result, `${result.name}: ${result.previous} \u2192 deferred \uC804\uD658 \uC644\uB8CC`);
    });
  });
  const planCmd = program2.commands.find((c) => c.name() === "plan");
  if (!planCmd) {
    throw new Error("plan command must be registered before governance commands");
  }
  const revision = planCmd.command("revision").description("Manage plan revisions");
  revision.command("create").argument("<plan_id>", "Plan ID").requiredOption("--trigger-type <type>", "Trigger type (assumption_violation|scope_explosion|design_flaw|complexity_exceeded|dependency_shift)").requiredOption("--description <text>", "Revision description").requiredOption("--changes <json>", "Changes as JSON string").option("--trigger-source <id>", "Source ID that triggered the revision").description("Create a plan revision").action((planId, opts) => {
    withErrorHandler(() => {
      const models = _getModels();
      const rev = models.planRevisionModel.create(
        planId,
        opts.triggerType,
        opts.triggerSource ?? null,
        opts.description,
        opts.changes
      );
      output(rev, `Revision created: ${rev.id} (${rev.trigger_type}) \u2014 ${rev.status}`);
    });
  });
  revision.command("list").argument("<plan_id>", "Plan ID").description("List revisions for a plan").action((planId) => {
    withErrorHandler(() => {
      const models = _getModels();
      const revisions = models.planRevisionModel.listByPlan(planId);
      if (revisions.length === 0) {
        output([], `No revisions found for plan: ${planId}`);
        return;
      }
      output(
        revisions,
        revisions.map((r) => `[${r.id}] ${r.trigger_type} \u2014 ${r.status}: ${r.description}`).join("\n")
      );
    });
  });
  revision.command("update").argument("<id>", "Revision ID").requiredOption("--status <status>", "New status (approved|rejected)").description("Update revision status").action((id, opts) => {
    withErrorHandler(() => {
      const models = _getModels();
      const rev = models.planRevisionModel.updateStatus(id, opts.status);
      output(rev, `Revision ${rev.id} updated to: ${rev.status}`);
    });
  });
  const artifact = program2.command("artifact").description("Manage .claude/ artifacts");
  artifact.command("cleanup").description("Clean up expired artifacts (handoffs, reports, rules)").option("--retention-days <days>", "Retention period in days", "7").option("--dry-run", "Show what would be removed without deleting").action(async (opts) => {
    try {
      const db = initDb();
      const cleanup = new ArtifactCleanup(db, process.cwd());
      const result = await cleanup.run({
        retentionDays: parseInt(opts.retentionDays, 10),
        dryRun: opts.dryRun ?? false,
        trigger: "manual"
      });
      const total = result.handoffsRemoved + result.reportsRemoved + result.emptyDirsRemoved;
      output(result, [
        opts.dryRun ? "[DRY RUN] " : "",
        `Artifact cleanup: ${total} items removed`,
        `  handoffs: ${result.handoffsRemoved}, reports: ${result.reportsRemoved}, empty dirs: ${result.emptyDirsRemoved}`,
        `  rules \u2014 archived: ${result.rulesArchived}, conflicts: ${result.rulesConflicts}`
      ].join("\n"));
    } catch (err) {
      outputError(`Artifact cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

// src/cli/importers.ts
import { execFileSync } from "child_process";
import { readFileSync as readFileSync7, existsSync as existsSync8 } from "fs";
var REPO_FORMAT_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
function validateRepoFormat(repo) {
  const trimmed = repo.trim();
  if (!trimmed) {
    throw new Error('repo \uD30C\uB77C\uBBF8\uD130\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. "owner/repo" \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD558\uC138\uC694.');
  }
  if (!REPO_FORMAT_RE.test(trimmed)) {
    throw new Error(
      `\uC798\uBABB\uB41C repo \uD615\uC2DD\uC785\uB2C8\uB2E4: "${repo}". "owner/repo" \uD615\uC2DD(\uC608: octocat/Hello-World)\uB9CC \uD5C8\uC6A9\uB429\uB2C8\uB2E4.`
    );
  }
}
function importFromGithub(repo, options) {
  const errors = [];
  try {
    validateRepoFormat(repo);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { items: [], source_prefix: `github:${repo}`, errors };
  }
  const state = options?.state ?? "open";
  const args = [
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    state,
    "--json",
    "number,title,body,labels",
    "--limit",
    "50"
  ];
  if (options?.label) {
    args.push("--label", options.label);
  }
  let jsonStr;
  try {
    jsonStr = execFileSync("gh", args, { encoding: "utf-8", timeout: 3e4 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("command not found") || msg.includes("not found") || msg.includes("ENOENT")) {
      errors.push("gh CLI\uAC00 \uC124\uCE58\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. https://cli.github.com \uC5D0\uC11C \uC124\uCE58\uD558\uC138\uC694.");
    } else {
      errors.push(`GitHub API \uC624\uB958: ${msg.slice(0, 200)}`);
    }
    return { items: [], source_prefix: `github:${repo}`, errors };
  }
  let issues;
  try {
    issues = JSON.parse(jsonStr);
  } catch {
    errors.push("GitHub API \uC751\uB2F5\uC744 \uD30C\uC2F1\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return { items: [], source_prefix: `github:${repo}`, errors };
  }
  const items = issues.map((issue) => {
    const labelNames = issue.labels.map((l) => l.name);
    return {
      title: issue.title,
      description: issue.body?.slice(0, 500) ?? void 0,
      priority: inferPriorityFromLabels(labelNames),
      category: inferCategoryFromLabels(labelNames),
      tags: labelNames.length > 0 ? labelNames : void 0,
      source: `github:${repo}#${issue.number}`
    };
  });
  return { items, source_prefix: `github:${repo}`, errors };
}
function inferPriorityFromLabels(labels) {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.some((l) => l.includes("critical") || l.includes("urgent") || l.includes("p0"))) return "critical";
  if (lower.some((l) => l.includes("high") || l.includes("important") || l.includes("p1"))) return "high";
  if (lower.some((l) => l.includes("low") || l.includes("minor") || l.includes("p3"))) return "low";
  return "medium";
}
function inferCategoryFromLabels(labels) {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.some((l) => l.includes("bug") || l.includes("fix"))) return "bugfix";
  if (lower.some((l) => l.includes("feature") || l.includes("enhancement"))) return "feature";
  if (lower.some((l) => l.includes("refactor"))) return "refactor";
  if (lower.some((l) => l.includes("chore") || l.includes("maintenance"))) return "chore";
  return void 0;
}
function importFromFile(filepath) {
  const errors = [];
  if (!existsSync8(filepath)) {
    errors.push(`\uD30C\uC77C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${filepath}`);
    return { items: [], source_prefix: `file:${filepath}`, errors };
  }
  let content;
  try {
    content = readFileSync7(filepath, "utf-8");
  } catch (e) {
    errors.push(`\uD30C\uC77C \uC77D\uAE30 \uC2E4\uD328: ${e instanceof Error ? e.message : String(e)}`);
    return { items: [], source_prefix: `file:${filepath}`, errors };
  }
  const lines = content.split("\n");
  const items = [];
  for (const line of lines) {
    const match = line.match(/^[\s]*-\s+\[\s\]\s+(.+)$/);
    if (match) {
      items.push({
        title: match[1].trim(),
        source: `file:${filepath}`
      });
    }
  }
  if (items.length === 0 && lines.length > 0) {
    errors.push("\uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uD56D\uBAA9(- [ ])\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }
  return { items, source_prefix: `file:${filepath}`, errors };
}
function importFromSlack(channel, _options) {
  return {
    items: [],
    source_prefix: `slack:${channel}`,
    errors: ["Slack import\uB294 \uC2A4\uD0AC \uBAA8\uB4DC(/vs-backlog)\uC5D0\uC11C MCP \uB3C4\uAD6C\uB97C \uD1B5\uD574 \uC2E4\uD589\uD558\uC138\uC694. CLI\uC5D0\uC11C\uB294 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."]
  };
}

// src/core/types.ts
var VALID_PLAN_STATUSES = ["draft", "active", "approved", "completed", "archived"];
var VALID_QA_RUN_TERMINAL_STATUSES = ["completed", "failed"];
var VALID_BACKLOG_PRIORITIES = ["critical", "high", "medium", "low"];
var VALID_BACKLOG_CATEGORIES = ["feature", "bugfix", "refactor", "chore", "idea"];
var VALID_BACKLOG_COMPLEXITIES = ["simple", "moderate", "complex"];
var VALID_BACKLOG_STATUSES = ["open", "planned", "done", "dropped"];

// src/cli/commands/backlog.ts
function registerBacklogCommands(program2, getModels) {
  const backlog = program2.command("backlog").description("Manage backlog items");
  backlog.command("add").description("Add a backlog item").requiredOption("--title <title>", "Item title").option("--description <desc>", "Item description").option("--priority <priority>", "Priority: critical|high|medium|low", "medium").option("--category <category>", "Category: feature|bugfix|refactor|chore|idea").option("--tags <tags>", "Comma-separated tags").option("--complexity <complexity>", "Complexity hint: simple|moderate|complex").option("--source <source>", "Source of the item").action((opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    if (opts.priority && !VALID_BACKLOG_PRIORITIES.includes(opts.priority)) {
      outputError(`Invalid priority: ${opts.priority}. Must be one of: ${VALID_BACKLOG_PRIORITIES.join(", ")}`);
    }
    if (opts.category && !VALID_BACKLOG_CATEGORIES.includes(opts.category)) {
      outputError(`Invalid category: ${opts.category}. Must be one of: ${VALID_BACKLOG_CATEGORIES.join(", ")}`);
    }
    if (opts.complexity && !VALID_BACKLOG_COMPLEXITIES.includes(opts.complexity)) {
      outputError(`Invalid complexity: ${opts.complexity}. Must be one of: ${VALID_BACKLOG_COMPLEXITIES.join(", ")}`);
    }
    const tags = opts.tags ? opts.tags.split(",").map((t) => t.trim()) : void 0;
    const item = backlogModel.create({
      title: opts.title,
      description: opts.description,
      priority: opts.priority,
      category: opts.category,
      tags,
      complexity_hint: opts.complexity,
      source: opts.source
    });
    output(item, `Created backlog item: ${item.id} \u2014 ${item.title}`);
  }));
  backlog.command("list").description("List backlog items").option("--status <status>", "Filter by status").option("--priority <priority>", "Filter by priority").option("--category <category>", "Filter by category").option("--tag <tag>", "Filter by tag").action((opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const items = backlogModel.list({
      status: opts.status,
      priority: opts.priority,
      category: opts.category,
      tag: opts.tag
    });
    output(items, formatBacklogList(items));
  }));
  backlog.command("show").description("Show backlog item details").argument("<id>", "Backlog item ID").action((id) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const item = backlogModel.getById(id);
    if (!item) outputError(`Backlog item not found: ${id}`);
    output(item, formatBacklogDetail(item));
  }));
  backlog.command("update").description("Update a backlog item").argument("<id>", "Backlog item ID").option("--title <title>", "New title").option("--description <desc>", "New description").option("--priority <priority>", "New priority").option("--category <category>", "New category").option("--tags <tags>", "New comma-separated tags").option("--complexity <complexity>", "New complexity hint").option("--source <source>", "New source").option("--status <status>", "New status").action((id, opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const fields = {};
    if (opts.title) fields.title = opts.title;
    if (opts.description) fields.description = opts.description;
    if (opts.priority) {
      if (!VALID_BACKLOG_PRIORITIES.includes(opts.priority)) {
        outputError(`Invalid priority: ${opts.priority}`);
      }
      fields.priority = opts.priority;
    }
    if (opts.category) {
      if (!VALID_BACKLOG_CATEGORIES.includes(opts.category)) {
        outputError(`Invalid category: ${opts.category}`);
      }
      fields.category = opts.category;
    }
    if (opts.tags) fields.tags = JSON.stringify(opts.tags.split(",").map((t) => t.trim()));
    if (opts.complexity) {
      if (!VALID_BACKLOG_COMPLEXITIES.includes(opts.complexity)) {
        outputError(`Invalid complexity: ${opts.complexity}`);
      }
      fields.complexity_hint = opts.complexity;
    }
    if (opts.source) fields.source = opts.source;
    if (opts.status) {
      if (!VALID_BACKLOG_STATUSES.includes(opts.status)) {
        outputError(`Invalid status: ${opts.status}`);
      }
      fields.status = opts.status;
    }
    const item = backlogModel.update(id, fields);
    output(item, formatBacklogDetail(item));
  }));
  backlog.command("delete").description("Delete a backlog item").argument("<id>", "Backlog item ID").action((id) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    backlogModel.delete(id);
    output({ deleted: id }, `Deleted backlog item: ${id}`);
  }));
  backlog.command("promote").description("Promote a backlog item to a plan").argument("<id>", "Backlog item ID").requiredOption("--plan <planId>", "Plan ID to link").action((id, opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const item = backlogModel.promote(id, opts.plan);
    output(item, `Promoted backlog item ${item.id} \u2192 plan ${opts.plan}`);
  }));
  backlog.command("stats").description("Show backlog statistics").action(() => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const statsData = backlogModel.getStats();
    output(statsData, formatBacklogStats(statsData));
  }));
  backlog.command("board").description("Show backlog in kanban board view").option("--category <category>", "Filter by category").option("--status <status>", "Filter by status", "open").action((opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const items = backlogModel.list({
      status: opts.status,
      category: opts.category
    });
    output(items, formatBacklogBoard(items));
  }));
  const importCmd = backlog.command("import").description("Import backlog items from external sources");
  importCmd.command("github").description("Import from GitHub Issues").requiredOption("--repo <repo>", "Repository (owner/repo)").option("--label <label>", "Filter by label").option("--state <state>", "Issue state", "open").option("--dry-run", "Preview without importing").action((opts) => withErrorHandler(() => {
    const result = importFromGithub(opts.repo, { label: opts.label, state: opts.state });
    if (opts.dryRun || result.items.length === 0) {
      output(result, formatImportPreview(result));
      return;
    }
    const { backlogModel } = getModels();
    let imported = 0;
    let skipped = 0;
    const warnings = [];
    for (const item of result.items) {
      const existing = backlogModel.findByTitle(item.title, "open");
      if (existing) {
        warnings.push(`Duplicate: "${item.title}" (existing: ${existing.id})`);
        skipped++;
        continue;
      }
      backlogModel.create(item);
      imported++;
    }
    const summary = [`Imported ${imported} items from ${result.source_prefix}`];
    if (skipped > 0) summary.push(`Skipped ${skipped} duplicates`);
    if (warnings.length > 0) summary.push(...warnings.map((w) => `  \u26A0 ${w}`));
    output({ imported, skipped, warnings }, summary.join("\n"));
  }));
  importCmd.command("file").description("Import from a markdown/text file").requiredOption("--path <filepath>", "File path").option("--dry-run", "Preview without importing").action((opts) => withErrorHandler(() => {
    const result = importFromFile(opts.path);
    if (opts.dryRun || result.items.length === 0) {
      output(result, formatImportPreview(result));
      return;
    }
    const { backlogModel } = getModels();
    let imported = 0;
    let skipped = 0;
    const warnings = [];
    for (const item of result.items) {
      const existing = backlogModel.findByTitle(item.title, "open");
      if (existing) {
        warnings.push(`Duplicate: "${item.title}" (existing: ${existing.id})`);
        skipped++;
        continue;
      }
      backlogModel.create(item);
      imported++;
    }
    const summary = [`Imported ${imported} items from ${result.source_prefix}`];
    if (skipped > 0) summary.push(`Skipped ${skipped} duplicates`);
    if (warnings.length > 0) summary.push(...warnings.map((w) => `  \u26A0 ${w}`));
    output({ imported, skipped, warnings }, summary.join("\n"));
  }));
  importCmd.command("slack").description("Import from Slack channel (requires MCP)").requiredOption("--channel <channel>", "Slack channel ID").option("--since <days>", "Days to look back", "7").option("--dry-run", "Preview without importing").action((opts) => withErrorHandler(() => {
    const result = importFromSlack(opts.channel, { since: opts.since });
    output(result, formatImportPreview(result));
  }));
}

// src/cli/commands/planning.ts
function registerPlanningCommands(program2, getModels) {
  const plan = program2.command("plan").description("Manage plans");
  plan.command("list").option("--status <status>", "Filter by status (draft, active, approved, completed, archived)").option("--branch <branch>", "Filter by branch").description("List plans").action((opts) => {
    const { planModel } = getModels();
    const filter = {};
    if (opts.status) {
      if (!VALID_PLAN_STATUSES.includes(opts.status)) {
        return outputError(`Invalid status. Must be: ${VALID_PLAN_STATUSES.join(", ")}`);
      }
      filter.status = opts.status;
    }
    if (opts.branch) filter.branch = opts.branch;
    const plans = planModel.list(Object.keys(filter).length > 0 ? filter : void 0);
    output(plans, formatPlanList(plans));
  });
  plan.command("show").argument("<id>", "Plan ID").description("Show plan details with task tree and waves").action((id) => {
    const { planModel, taskModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const tree = taskModel.getTree(id);
    const waves = taskModel.getWaves(id);
    output({ plan: p, tasks: tree, waves }, formatPlanTree(p, tree));
  });
  plan.command("create").requiredOption("--title <title>", "Plan title").option("--spec <spec>", "Plan specification").option("--summary <summary>", "Plan summary").description("Create a new plan and activate it").action((opts) => {
    const { planModel } = getModels();
    const created = planModel.create(opts.title, opts.spec, opts.summary);
    const activated = planModel.activate(created.id);
    output(activated, `Created plan: ${activated.id} "${activated.title}" (${activated.status})`);
  });
  plan.command("edit").argument("<id>", "Plan ID").option("--title <title>", "New title").option("--spec <spec>", "Replace spec").option("--append-spec <text>", "Append text to existing spec").option("--summary <summary>", "New summary").description("Edit plan title, spec, or summary").action((id, opts) => {
    const { planModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const updates = {};
    if (opts.title) updates.title = opts.title;
    if (opts.spec) updates.spec = opts.spec;
    if (opts.appendSpec) updates.spec = (p.spec ?? "") + "\n\n" + opts.appendSpec;
    if (opts.summary) updates.summary = opts.summary;
    if (Object.keys(updates).length === 0) return outputError("No changes specified");
    const updated = planModel.update(id, updates);
    output(updated, `Plan updated: ${updated.id} "${updated.title}"`);
  });
  plan.command("complete").argument("<id>", "Plan ID").description("Complete a plan").action((id) => {
    withErrorHandler(() => {
      const { lifecycle } = getModels();
      const completed = lifecycle.completePlan(id);
      output(completed, `Plan completed: ${completed.id} "${completed.title}"`);
    });
  });
  plan.command("approve").argument("<id>", "Plan ID").description("Approve a plan (active \u2192 approved)").action((id) => {
    withErrorHandler(() => {
      const { planModel } = getModels();
      const approved = planModel.approve(id);
      output(approved, `Plan approved: ${approved.id} "${approved.title}"`);
    });
  });
  plan.command("archive").argument("<id>", "Plan ID").description("Archive a plan").action((id) => {
    const { planModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const archived = planModel.archive(id);
    output(archived, `Plan archived: ${archived.id} "${archived.title}"`);
  });
  plan.command("update").argument("<id>", "Plan ID").option("--title <title>", "New title").option("--spec <spec>", "New spec").option("--summary <summary>", "New summary").description("Update plan title, spec, or summary").action((id, opts) => {
    const { planModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const updated = planModel.update(id, opts);
    output(updated, `Plan updated: ${updated.id} "${updated.title}"`);
  });
  plan.command("delete").argument("<id>", "Plan ID").description("Delete a draft plan and all its tasks").action((id) => {
    withErrorHandler(() => {
      const { planModel } = getModels();
      planModel.delete(id);
      output({ deleted: true, plan_id: id }, `Plan deleted: ${id}`);
    });
  });
  plan.command("summary").argument("<id>", "Plan ID").description("Show the running summary of a plan").action((id) => {
    const { planModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    if (!p.running_summary) {
      output({ plan_id: id, running_summary: null }, `No running summary for plan: ${id}`);
      return;
    }
    output({ plan_id: id, running_summary: p.running_summary }, p.running_summary);
  });
  const task = program2.command("task").description("Manage tasks");
  task.command("create").requiredOption("--plan <plan_id>", "Plan ID").requiredOption("--title <title>", "Task title").option("--parent <parent_id>", "Parent task ID for subtasks").option("--spec <spec>", "Task specification").option("--acceptance <acceptance>", "Acceptance criteria").option("--depends-on <ids>", "Comma-separated task IDs this task depends on").option("--allowed-files <files>", "Comma-separated list of allowed files").option("--forbidden-patterns <patterns>", "Comma-separated list of forbidden patterns").option("--force", "Skip acceptance criteria validation warnings").description("Create a new task").action((opts) => {
    withErrorHandler(() => {
      const { taskModel } = getModels();
      const dependsOn = opts.dependsOn ? opts.dependsOn.split(",").map((s) => s.trim()) : void 0;
      const allowedFiles = opts.allowedFiles ? opts.allowedFiles.split(",").map((s) => s.trim()) : void 0;
      const forbiddenPatterns = opts.forbiddenPatterns ? opts.forbiddenPatterns.split(",").map((s) => s.trim()) : void 0;
      const created = taskModel.create(opts.plan, opts.title, {
        parentId: opts.parent,
        spec: opts.spec,
        acceptance: opts.acceptance,
        dependsOn,
        allowedFiles,
        forbiddenPatterns
      });
      const { warnings, ...taskData } = created;
      if (warnings.length > 0 && !opts.force) {
        for (const w of warnings) {
          console.error(`\u26A0 AC Warning: ${w}`);
        }
      }
      if (getJsonMode()) {
        output({ ...taskData, warnings }, `Created task: ${created.id} "${created.title}" (${created.status})`);
      } else {
        output(taskData, `Created task: ${created.id} "${created.title}" (${created.status})`);
      }
    });
  });
  task.command("update").argument("<id>", "Task ID").argument("<status>", "New status (todo, in_progress, done, blocked, skipped)").option("--impl-status <status>", "Implementation status (DONE, DONE_WITH_CONCERNS, BLOCKED)").option("--test-count <count>", "Number of tests written").option("--files-changed <count>", "Number of files changed").option("--has-concerns", "Whether there are concerns").option("--changed-files-detail <json>", "JSON string of changed files detail").option("--scope-violations <json>", "JSON string of scope violations").description("Update task status with optional metrics").action((id, status, opts) => {
    const VALID = ["todo", "in_progress", "done", "blocked", "skipped"];
    if (!VALID.includes(status)) {
      return outputError(`Invalid status. Must be: ${VALID.join(", ")}`);
    }
    const { taskModel, taskMetricsModel, lifecycle } = getModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);
    const updated = taskModel.updateStatus(id, status);
    const completionCheck = lifecycle.autoCheckCompletion(updated.plan_id);
    if (["done", "blocked", "skipped"].includes(status)) {
      try {
        const metrics = {};
        if (opts.implStatus) metrics.impl_status = opts.implStatus;
        if (opts.testCount) metrics.test_count = parseInt(opts.testCount, 10);
        if (opts.filesChanged) metrics.files_changed = parseInt(opts.filesChanged, 10);
        if (opts.hasConcerns) metrics.has_concerns = true;
        if (opts.changedFilesDetail) metrics.changed_files_detail = opts.changedFilesDetail;
        if (opts.scopeViolations) metrics.scope_violations = opts.scopeViolations;
        taskMetricsModel.record(id, updated.plan_id, status, Object.keys(metrics).length > 0 ? metrics : void 0);
      } catch {
      }
    }
    output(
      { task: updated, completion_check: completionCheck },
      `Task ${updated.id}: ${updated.title} \u2192 ${updated.status}`
    );
  });
  task.command("next").argument("<plan_id>", "Plan ID").description("Get the next pending task").action((planId) => {
    const { taskModel } = getModels();
    const next = taskModel.getNextAvailable(planId);
    if (!next) {
      output(
        { message: "No pending tasks", hint: "All tasks are done or blocked. Use vs plan complete to finish the plan." },
        "No pending tasks."
      );
      return;
    }
    output(next, [
      `Next: ${next.id} "${next.title}"`,
      next.spec ? `Spec: ${next.spec}` : "",
      next.acceptance ? `Acceptance: ${next.acceptance}` : ""
    ].filter(Boolean).join("\n"));
  });
  task.command("show").argument("<id>", "Task ID").description("Show task details").action((id) => {
    const { taskModel } = getModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);
    output(t, [
      `ID:         ${t.id}`,
      `Title:      ${t.title}`,
      `Status:     ${t.status}`,
      `Plan:       ${t.plan_id}`,
      `Depth:      ${t.depth}`,
      t.spec ? `Spec:       ${t.spec}` : "",
      t.acceptance ? `Acceptance: ${t.acceptance}` : "",
      t.allowed_files ? `Allowed:    ${t.allowed_files}` : "",
      t.forbidden_patterns ? `Forbidden:  ${t.forbidden_patterns}` : "",
      `Created:    ${t.created_at}`,
      t.completed_at ? `Completed:  ${t.completed_at}` : ""
    ].filter(Boolean).join("\n"));
  });
  task.command("block").argument("<id>", "Task ID").option("--reason <reason>", "Reason for blocking").description("Mark a task as blocked").action((id, opts) => {
    const { taskModel, events } = getModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);
    const blocked = taskModel.updateStatus(id, "blocked");
    if (opts.reason) {
      events.record("task", id, "blocked_reason", null, JSON.stringify({ reason: opts.reason }));
    }
    output(
      { ...blocked, block_reason: opts.reason ?? null },
      `Task blocked: ${blocked.id} "${blocked.title}"${opts.reason ? ` (reason: ${opts.reason})` : ""}`
    );
  });
  task.command("edit").argument("<id>", "Task ID").option("--title <title>", "New title").option("--spec <spec>", "New spec").option("--acceptance <acceptance>", "New acceptance criteria").option("--allowed-files <files>", "Comma-separated list of allowed files").option("--forbidden-patterns <patterns>", "Comma-separated list of forbidden patterns").description("Edit task title, spec, acceptance, or scope").action((id, opts) => {
    const { taskModel } = getModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);
    const fields = {};
    if (opts.title !== void 0) fields.title = opts.title;
    if (opts.spec !== void 0) fields.spec = opts.spec;
    if (opts.acceptance !== void 0) fields.acceptance = opts.acceptance;
    if (opts.allowedFiles !== void 0) {
      fields.allowed_files = JSON.stringify(opts.allowedFiles.split(",").map((s) => s.trim()));
    }
    if (opts.forbiddenPatterns !== void 0) {
      fields.forbidden_patterns = JSON.stringify(opts.forbiddenPatterns.split(",").map((s) => s.trim()));
    }
    const edited = taskModel.update(id, fields);
    output(edited, `Task edited: ${edited.id} "${edited.title}"`);
  });
  task.command("delete").argument("<id>", "Task ID").description("Delete a task and its subtasks").action((id) => {
    const { taskModel } = getModels();
    withErrorHandler(() => {
      taskModel.delete(id);
      output({ deleted: true, task_id: id }, `Task deleted: ${id}`);
    });
  });
}

// src/cli/commands/auxiliary.ts
function registerAuxiliaryCommands(program2, getModels) {
  const config = program2.command("config").description("Manage configuration");
  config.command("set").argument("<key>", "Config key").argument("<value>", "Config value").description("Set a configuration value").action((key, value) => {
    const db = getDb();
    initSchema(db);
    setConfig(db, key, value);
    output({ key, value }, `${key} = ${value}`);
  });
  config.command("get").argument("<key>", "Config key").description("Get a configuration value").action((key) => {
    const db = getDb();
    initSchema(db);
    const value = getConfig(db, key);
    if (value === null) return outputError(`Config not found: ${key}`);
    output({ key, value }, `${key} = ${value}`);
  });
  config.command("list").description("List all configuration values").action(() => {
    const db = getDb();
    initSchema(db);
    const items = listConfig(db);
    if (items.length === 0) {
      output(items, "No configuration values set.");
      return;
    }
    const formatted = items.map((i) => `${i.key} = ${i.value}`).join("\n");
    output(items, formatted);
  });
  config.command("delete").argument("<key>", "Config key").description("Delete a configuration value").action((key) => {
    const db = getDb();
    initSchema(db);
    deleteConfig(db, key);
    output({ deleted: true, key }, `Deleted: ${key}`);
  });
  program2.command("stats").argument("[plan_id]", "Optional plan ID").description("Show velocity and estimates").action((planId) => {
    const { stats } = getModels();
    const velocity = stats.getVelocity(planId);
    const estimate = planId ? stats.getEstimatedCompletion(planId) : void 0;
    const timeline = stats.getTimeline(planId);
    output(
      { velocity, ...estimate ? { estimated_completion: estimate } : {}, ...timeline.length > 0 ? { timeline } : {} },
      formatStats(velocity, estimate, timeline.length > 0 ? timeline : void 0)
    );
  });
  program2.command("history").argument("<type>", "Entity type (plan, task)").argument("<id>", "Entity ID").description("Show change history").action((type, id) => {
    const validTypes = ["plan", "task"];
    if (!validTypes.includes(type)) {
      return outputError(`Invalid entity type. Must be: ${validTypes.join(", ")}`);
    }
    const { events } = getModels();
    const eventList = events.getByEntity(type, id);
    output(eventList, formatHistory(eventList));
  });
  program2.command("insights").option("--scope <scope>", "Scope: blocked_patterns, duration_stats, success_rates, all (default: all)").description("Get learning insights from task history").action((opts) => {
    const { insights } = getModels();
    const validScopes = ["blocked_patterns", "duration_stats", "success_rates", "all"];
    const scope = opts.scope && validScopes.includes(opts.scope) ? opts.scope : "all";
    const result = {};
    if (scope === "all" || scope === "blocked_patterns") {
      result.blocked_patterns = insights.getBlockedPatterns();
    }
    if (scope === "all" || scope === "duration_stats") {
      result.duration_stats = insights.getDurationStats();
    }
    if (scope === "all" || scope === "success_rates") {
      result.success_rates = insights.getSuccessRates();
    }
    if (scope === "all") {
      result.recommendations = insights.getRecommendations();
      result.confidence = insights.getConfidenceLevel();
    }
    output(result);
  });
  program2.command("skill-log").argument("<name>", "Skill name to record").option("--plan-id <id>", "Plan ID to associate").option("--session-id <id>", "Session ID to associate").description("Record a skill usage").action((name, opts) => {
    const { skillUsageModel } = getModels();
    const record = skillUsageModel.record(name, {
      planId: opts.planId,
      sessionId: opts.sessionId
    });
    output(record, `Recorded skill: ${record.skill_name} (${record.id})`);
  });
  program2.command("skill-stats").option("--days <days>", "Filter by recent N days").description("Show skill usage statistics").action((opts) => {
    const { skillUsageModel } = getModels();
    const days = opts.days ? parseInt(opts.days, 10) : void 0;
    const skillStats = skillUsageModel.getStats(days);
    if (skillStats.length === 0) {
      output(skillStats, "No skill usage data.");
      return;
    }
    output(skillStats, formatSkillUsage(skillStats));
  });
  const mergeReport = program2.command("merge-report").description("Manage merge reports");
  mergeReport.command("show").argument("<id>", "Report ID or commit hash").description("Show a merge report").action((id) => withErrorHandler(() => {
    const { mergeReportModel } = getModels();
    const report = mergeReportModel.get(id) ?? mergeReportModel.getByCommit(id);
    if (!report) return outputError(`Merge report not found: ${id}`);
    output(report, formatMergeReportSummary(report));
  }));
  mergeReport.command("list").option("--plan-id <plan_id>", "Filter by plan ID").option("--limit <n>", "Limit results", "20").description("List merge reports").action((opts) => withErrorHandler(() => {
    const { mergeReportModel } = getModels();
    const reports = mergeReportModel.list({ planId: opts.planId, limit: parseInt(opts.limit, 10) });
    output(reports, formatMergeReportList(reports));
  }));
  mergeReport.command("latest").description("Show the latest merge report").action(() => withErrorHandler(() => {
    const { mergeReportModel } = getModels();
    const reports = mergeReportModel.getLatest(1);
    if (reports.length === 0) {
      output(null, "\uB9AC\uD3EC\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. vs-merge\uB85C \uBA38\uC9C0\uB97C \uC644\uB8CC\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uC0DD\uC131\uB429\uB2C8\uB2E4.");
      return;
    }
    output(reports[0], formatMergeReportSummary(reports[0]));
  }));
  mergeReport.command("create").description("Create a merge report (used internally by vs-merge)").requiredOption("--commit <hash>", "Commit hash").requiredOption("--source <branch>", "Source branch").requiredOption("--target <branch>", "Target branch").requiredOption("--changes <json>", "Changes summary JSON").requiredOption("--checklist <json>", "Review checklist JSON").requiredOption("--verification <json>", "Verification result JSON").requiredOption("--report-path <path>", "Path to MD report file").option("--plan-id <id>", "Plan ID").option("--conflict-log <json>", "Conflict log JSON").option("--ai-judgments <json>", "AI judgments JSON").option("--task-ids <json>", "Task IDs JSON").action((opts) => withErrorHandler(() => {
    const { mergeReportModel } = getModels();
    const report = mergeReportModel.create({
      commit_hash: opts.commit,
      source_branch: opts.source,
      target_branch: opts.target,
      changes_summary: JSON.parse(opts.changes),
      review_checklist: JSON.parse(opts.checklist),
      verification: JSON.parse(opts.verification),
      report_path: opts.reportPath,
      plan_id: opts.planId,
      conflict_log: opts.conflictLog ? JSON.parse(opts.conflictLog) : void 0,
      ai_judgments: opts.aiJudgments ? JSON.parse(opts.aiJudgments) : void 0,
      task_ids: opts.taskIds ? JSON.parse(opts.taskIds) : void 0
    });
    output(report, `Created merge report: ${report.id}`);
  }));
}
function formatMergeReportSummary(r) {
  const lines = [];
  lines.push(`# Merge Report: ${r.source_branch} \u2192 ${r.target_branch}`);
  lines.push(`> ${r.created_at} | Commit: ${r.commit_hash.slice(0, 8)}`);
  if (r.plan_id) lines.push(`> Plan: ${r.plan_id}`);
  lines.push("");
  lines.push("## \uBCC0\uACBD \uC694\uC57D");
  for (const c of r.changes_summary) {
    lines.push(`- [${c.category}] ${c.file} \u2014 ${c.description}`);
  }
  lines.push("");
  lines.push("## Review Checklist");
  const levelIcon = { must: "\u{1F534}", should: "\u{1F7E1}", info: "\u{1F7E2}" };
  for (const item of r.review_checklist) {
    const loc = item.line ? `${item.file}:${item.line}` : item.file;
    lines.push(`- ${levelIcon[item.level]} ${loc} \u2014 ${item.description}`);
    lines.push(`  \u2514 ${item.reason}`);
  }
  lines.push("");
  if (r.conflict_log && r.conflict_log.length > 0) {
    lines.push("## \uCDA9\uB3CC \uD574\uACB0 \uAE30\uB85D");
    for (const c of r.conflict_log) {
      lines.push(`- ${c.file} (${c.hunks} hunks) \u2192 ${c.resolution}: ${c.choice_reason}`);
    }
    lines.push("");
  }
  if (r.ai_judgments && r.ai_judgments.length > 0) {
    lines.push("## AI \uD310\uB2E8 \uB85C\uADF8");
    for (const j of r.ai_judgments) {
      const loc = j.line ? `${j.file}:${j.line}` : j.file;
      lines.push(`- [${j.confidence}] ${loc} \u2014 ${j.description} (${j.type})`);
    }
    lines.push("");
  }
  const v = r.verification;
  lines.push("## \uAC80\uC99D \uACB0\uACFC");
  lines.push(`- Build: ${v.build}`);
  lines.push(`- Test: ${v.test.status}${v.test.passed != null ? ` (${v.test.passed} passed${v.test.failed ? `, ${v.test.failed} failed` : ""})` : ""}`);
  lines.push(`- Lint: ${v.lint}`);
  lines.push(`- Acceptance: ${v.acceptance}`);
  if (r.task_ids && r.task_ids.length > 0) {
    lines.push("");
    lines.push(`## \uAD00\uB828 \uD0DC\uC2A4\uD06C: ${r.task_ids.join(", ")}`);
  }
  return lines.join("\n");
}
function formatMergeReportList(reports) {
  if (reports.length === 0) return "\uB9AC\uD3EC\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
  const header = "| # | \uB0A0\uC9DC | \uBE0C\uB79C\uCE58 | \uCEE4\uBC0B | Checklist | \uCDA9\uB3CC |";
  const sep2 = "|---|------|--------|------|-----------|------|";
  const rows = reports.map((r, i) => {
    const date = r.created_at.split("T")[0] || r.created_at.split(" ")[0];
    const must = r.review_checklist.filter((c) => c.level === "must").length;
    const should = r.review_checklist.filter((c) => c.level === "should").length;
    const info = r.review_checklist.filter((c) => c.level === "info").length;
    const conflicts = r.conflict_log?.length ?? 0;
    return `| ${i + 1} | ${date} | ${r.source_branch} \u2192 ${r.target_branch} | ${r.commit_hash.slice(0, 8)} | \u{1F534}${must} \u{1F7E1}${should} \u{1F7E2}${info} | ${conflicts} |`;
  });
  return [header, sep2, ...rows].join("\n");
}

// src/core/engine/qa-findings-analyzer.ts
import * as fs3 from "fs";
import * as path3 from "path";
var PENDING_DIR2 = ".claude/self-improve/pending";
function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return a.slice(0, i);
}
function isSimilarDescription(a, b) {
  if (a.includes(b) || b.includes(a)) return true;
  const prefix = commonPrefix(a, b).trim();
  const minLen = Math.min(a.length, b.length);
  return minLen > 0 && prefix.length >= minLen * 0.5;
}
function analyzeRecurringFindings(db, projectRoot) {
  const pendingDir = path3.join(projectRoot, PENDING_DIR2);
  fs3.mkdirSync(pendingDir, { recursive: true });
  const findings = db.prepare(`
    SELECT qf.id, qf.run_id, qf.category, qf.description
    FROM qa_findings qf
    JOIN qa_runs qr ON qr.id = qf.run_id
    ORDER BY qf.category, qf.description
  `).all();
  const analyzed = findings.length;
  const groups = [];
  for (const finding of findings) {
    let matched = false;
    for (const group of groups) {
      if (group.category !== finding.category) continue;
      if (isSimilarDescription(finding.description, group.description_pattern)) {
        group.finding_ids.push(finding.id);
        group.run_ids.add(finding.run_id);
        const common = commonPrefix(finding.description, group.description_pattern).trim();
        if (common.length > 0) {
          group.description_pattern = common;
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.push({
        category: finding.category,
        description_pattern: finding.description,
        finding_ids: [finding.id],
        run_ids: /* @__PURE__ */ new Set([finding.run_id])
      });
    }
  }
  let pendingCreated = 0;
  for (const group of groups) {
    if (group.run_ids.size >= 3) {
      const pending = {
        type: "recurring_qa_finding",
        finding_ids: group.finding_ids,
        category: group.category,
        description_pattern: group.description_pattern,
        repeat_count: group.run_ids.size,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      const filename = `recurring-${group.category}-${Date.now()}-${pendingCreated}.json`;
      const filePath = path3.join(pendingDir, filename);
      fs3.writeFileSync(filePath, JSON.stringify(pending, null, 2), "utf-8");
      pendingCreated++;
    }
  }
  return { analyzed, pendingCreated };
}

// src/cli/commands/knowledge.ts
function getErrorKBEngine() {
  const root = findProjectRoot(process.cwd());
  return new ErrorKBEngine(root);
}
function getSelfImproveEngine() {
  const db = initDb();
  const root = findProjectRoot(process.cwd());
  return new SelfImproveEngine(db, root);
}
function registerKnowledgeCommands(program2, getModels) {
  const errorKb = program2.command("error-kb").description("Manage error knowledge base");
  errorKb.command("search").argument("<query>", "Search query").option("--tag <tag>", "Filter by tag").option("--severity <level>", "Filter by severity (critical, high, medium, low)").description("Search error knowledge base").action((query, opts) => {
    const engine = getErrorKBEngine();
    const searchOpts = {};
    if (opts.tag) searchOpts.tags = [opts.tag];
    if (opts.severity) searchOpts.severity = opts.severity;
    const results = engine.search(query, searchOpts);
    output(results, formatErrorSearchResults(results));
  });
  errorKb.command("add").requiredOption("--title <title>", "Error title").requiredOption("--cause <cause>", "Error cause").requiredOption("--solution <solution>", "Error solution").option("--tags <tags>", "Comma-separated tags").option("--severity <level>", "Severity level (critical, high, medium, low)", "medium").description("Add a new error entry").action((opts) => {
    const engine = getErrorKBEngine();
    const tags = opts.tags ? opts.tags.split(",").map((t) => t.trim()) : [];
    const entry = engine.add({
      title: opts.title,
      cause: opts.cause,
      solution: opts.solution,
      tags,
      severity: opts.severity
    });
    output(entry, `Created error: ${entry.id}
Title: ${entry.title}
File: .claude/error-kb/errors/${entry.id}.md`);
  });
  errorKb.command("show").argument("<id>", "Error ID").description("Show error entry details").action((id) => {
    const engine = getErrorKBEngine();
    const entry = engine.show(id);
    if (!entry) return outputError(`Error not found: ${id}`);
    output(entry, formatErrorDetail(entry));
  });
  errorKb.command("update").argument("<id>", "Error ID").option("--occurrence <context>", "Record a new occurrence with context").option("--status <status>", "Update status (open, resolved, recurring, wontfix)").option("--severity <level>", "Update severity (critical, high, medium, low)").description("Update an error entry or record occurrence").action((id, opts) => {
    const engine = getErrorKBEngine();
    const existing = engine.show(id);
    if (!existing) return outputError(`Error not found: ${id}`);
    if (opts.occurrence) {
      engine.recordOccurrence(id, opts.occurrence);
      const updated = engine.show(id);
      output(updated, `Recorded occurrence for ${id}: ${opts.occurrence}`);
    } else {
      const patch = {};
      if (opts.status) patch.status = opts.status;
      if (opts.severity) patch.severity = opts.severity;
      engine.update(id, patch);
      const updated = engine.show(id);
      output(updated, `Updated error: ${id}`);
    }
  });
  errorKb.command("stats").description("Show error knowledge base statistics").action(() => {
    const engine = getErrorKBEngine();
    const stats = engine.getStats();
    output(stats, formatErrorKBStats(stats));
  });
  errorKb.command("delete").argument("<id>", "Error ID").description("Delete an error entry").action((id) => {
    const engine = getErrorKBEngine();
    const deleted = engine.delete(id);
    if (!deleted) return outputError(`Error not found: ${id}`);
    output({ deleted: true, error_id: id }, `Error deleted: ${id}`);
  });
  const selfImprove = program2.command("self-improve").description("Self-improve rules management");
  selfImprove.command("status").description("Show self-improve status (pending, rules, last run)").action(() => {
    const engine = getSelfImproveEngine();
    const pending = engine.getPendingCount();
    const stats = engine.getRuleStats();
    const lastRun = engine.getLastRunTimestamp();
    const data = { pending, rules: stats, last_run: lastRun };
    if (getJsonMode()) {
      output(data);
    } else {
      const lines = [
        `Pending: ${pending}\uAC74`,
        `Rules: active ${stats.active}, archived ${stats.archived}, prevented ${stats.total_prevented}`,
        `Last run: ${lastRun ?? "never"}`
      ];
      if (stats.active > engine.getMaxActiveRules()) {
        lines.push(`\u26A0 \uD65C\uC131 \uADDC\uCE59\uC774 ${engine.getMaxActiveRules()}\uAC1C \uC0C1\uD55C\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4.`);
      }
      output(data, lines.join("\n"));
    }
  });
  const rules = selfImprove.command("rules").description("Manage self-improve rules");
  rules.command("list").option("--status <status>", "Filter by status (active, archived)").description("List self-improve rules").action((opts) => {
    const engine = getSelfImproveEngine();
    const status = opts.status;
    const ruleList = engine.listRules(status);
    if (ruleList.length === 0) {
      output(ruleList, "No rules found.");
      return;
    }
    if (getJsonMode()) {
      output(ruleList);
    } else {
      output(ruleList, formatRuleList(ruleList));
    }
  });
  rules.command("show").argument("<id>", "Rule ID").description("Show rule details").action((id) => {
    const engine = getSelfImproveEngine();
    const rule = engine.getRule(id);
    if (!rule) return outputError(`Rule not found: ${id}`);
    if (getJsonMode()) {
      output(rule);
    } else {
      output(rule, formatRuleDetail(rule));
    }
  });
  rules.command("update").argument("<id>", "Rule ID").option("--enforcement <level>", "Set enforcement level (SOFT or HARD)").description("Update a rule").action((id, opts) => {
    const engine = getSelfImproveEngine();
    if (opts.enforcement === "HARD") {
      const result = engine.escalateRule(id);
      if (!result) return outputError(`Rule not found or already HARD: ${id}`);
      const updated = engine.getRule(id);
      output(updated, `Rule ${id} escalated to HARD enforcement.`);
    } else if (opts.enforcement === "SOFT") {
      const rule = engine.getRule(id);
      if (!rule) return outputError(`Rule not found: ${id}`);
      output(rule, `Rule ${id} enforcement is SOFT.`);
    } else {
      outputError("--enforcement must be SOFT or HARD");
    }
  });
  rules.command("archive").argument("<id>", "Rule ID").description("Archive a rule").action((id) => {
    const engine = getSelfImproveEngine();
    const result = engine.archiveRule(id);
    if (!result) return outputError(`Rule not found or already archived: ${id}`);
    output({ archived: true, rule_id: id }, `Rule archived: ${id}`);
  });
  selfImprove.command("escalation-status").description("Show rules pending escalation to HARD").action(() => {
    const engine = getSelfImproveEngine();
    const candidates = engine.checkEscalation();
    if (getJsonMode()) {
      output(candidates);
    } else {
      output(candidates, formatEscalationStatus(candidates));
    }
  });
  selfImprove.command("escalate").option("--auto", "Automatically escalate all eligible rules to HARD").description("Escalate rules to HARD enforcement").action((opts) => {
    if (!opts.auto) {
      return outputError("Use --auto flag to escalate eligible rules.");
    }
    const engine = getSelfImproveEngine();
    const candidates = engine.checkEscalation();
    if (candidates.length === 0) {
      output({ escalated: [], count: 0 }, "No rules eligible for escalation.");
      return;
    }
    const escalated = [];
    for (const c of candidates) {
      if (engine.escalateRule(c.id)) {
        escalated.push(c.id);
      }
    }
    output(
      { escalated, count: escalated.length },
      `Escalated ${escalated.length} rule(s) to HARD: ${escalated.join(", ")}`
    );
  });
  selfImprove.command("archive-stale").option("--days <days>", "Number of days without trigger before archiving", "60").description("Archive stale rules that have not been triggered").action((opts) => {
    const engine = getSelfImproveEngine();
    const days = parseInt(opts.days, 10);
    const archived = engine.autoArchiveStale(days);
    output(
      { archived, count: archived.length },
      archived.length > 0 ? `Archived ${archived.length} stale rule(s): ${archived.join(", ")}` : "No stale rules to archive."
    );
  });
  selfImprove.command("analyze-qa").description("Analyze QA findings for recurring patterns and generate pending self-improve signals").action(() => {
    const db = initDb();
    const root = findProjectRoot(process.cwd());
    const result = analyzeRecurringFindings(db, root);
    output(
      result,
      `Analyzed ${result.analyzed} findings, created ${result.pendingCreated} pending signal(s).`
    );
  });
}

// src/cli/commands/quality.ts
import * as fs5 from "fs";

// src/core/engine/qa-config.ts
import { z as z3 } from "zod";
import * as YAML from "yaml";
import * as fs4 from "fs";
var CustomRuleSchema = z3.object({
  id: z3.string(),
  pattern: z3.string().refine(
    (val) => {
      try {
        new RegExp(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid regular expression pattern" }
  ),
  severity: z3.enum(["critical", "high", "medium", "low"]),
  message: z3.string()
});
var IgnoreRuleSchema = z3.object({
  rule_id: z3.string(),
  paths: z3.array(z3.string()),
  reason: z3.string(),
  expires: z3.string().optional()
});
var SeverityAdjustmentSchema = z3.object({
  rule_id: z3.string(),
  new_severity: z3.enum(["critical", "high", "medium", "low"]),
  condition: z3.string()
});
var SkipWhenSchema = z3.object({
  task_tags: z3.array(z3.string()).optional(),
  changed_files_only: z3.array(z3.string()).optional()
});
var ActivateWhenSchema = z3.object({
  completed_tasks_gte: z3.number().optional(),
  changed_files_pattern: z3.string().optional()
});
var ModuleConditionalConfigSchema = z3.object({
  enabled: z3.boolean(),
  skip_when: SkipWhenSchema.optional(),
  activate_when: ActivateWhenSchema.optional()
});
var ConditionalModuleSchema = z3.union([z3.boolean(), ModuleConditionalConfigSchema]).optional();
var QaRulesSchema = z3.object({
  profile: z3.enum(["web-frontend", "api-server", "fullstack", "library", "cli-tool"]).optional(),
  risk_thresholds: z3.object({
    green: z3.number(),
    yellow: z3.number(),
    orange: z3.number()
  }).optional(),
  severity_weights: z3.object({
    critical: z3.number(),
    high: z3.number(),
    medium: z3.number(),
    low: z3.number()
  }).optional(),
  modules: z3.object({
    lint_check: z3.boolean().optional(),
    type_check: z3.boolean().optional(),
    test_coverage: z3.boolean().optional(),
    dead_code: z3.boolean().optional(),
    dependency_audit: z3.boolean().optional(),
    complexity_analysis: z3.boolean().optional(),
    shadow: ConditionalModuleSchema,
    flow_tester: ConditionalModuleSchema,
    wave_gate: z3.boolean().optional(),
    adaptive_planner: z3.boolean().optional(),
    design_review: z3.boolean().optional(),
    skeleton_guard: z3.boolean().optional(),
    auto_trigger: z3.object({
      enabled: z3.boolean().default(true),
      milestones: z3.array(z3.number()).default([50, 100])
    }).optional()
  }).optional(),
  regression_bonus: z3.number().optional(),
  custom_rules: z3.array(CustomRuleSchema).optional(),
  ignore: z3.array(IgnoreRuleSchema).optional(),
  severity_adjustments: z3.array(SeverityAdjustmentSchema).optional()
});
var DEFAULT_QA_CONFIG = {
  risk_thresholds: { green: 0.2, yellow: 0.5, orange: 0.8 },
  severity_weights: { critical: 0.4, high: 0.3, medium: 0.2, low: 0.1 },
  modules: {
    lint_check: true,
    type_check: true,
    test_coverage: true,
    dead_code: true,
    dependency_audit: true,
    complexity_analysis: true,
    shadow: { enabled: false },
    flow_tester: { enabled: false },
    wave_gate: false,
    adaptive_planner: false,
    design_review: false,
    skeleton_guard: false,
    auto_trigger: {
      enabled: true,
      milestones: [50, 100]
    }
  },
  regression_bonus: 0.2
};
var PROFILE_PRESETS = {
  "web-frontend": {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: { enabled: true },
      flow_tester: { enabled: false },
      wave_gate: false,
      adaptive_planner: false,
      design_review: true,
      skeleton_guard: true,
      auto_trigger: { enabled: true, milestones: [50, 100] }
    },
    severity_weights: { critical: 0.4, high: 0.3, medium: 0.2, low: 0.1 }
  },
  "api-server": {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: { enabled: false },
      flow_tester: { enabled: false },
      wave_gate: true,
      adaptive_planner: false,
      design_review: false,
      skeleton_guard: false,
      auto_trigger: { enabled: true, milestones: [50, 100] }
    },
    severity_weights: { critical: 0.5, high: 0.3, medium: 0.15, low: 0.05 }
  },
  fullstack: {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: { enabled: true },
      flow_tester: { enabled: false },
      wave_gate: true,
      adaptive_planner: false,
      design_review: true,
      skeleton_guard: true,
      auto_trigger: { enabled: true, milestones: [50, 100] }
    }
  },
  library: {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: { enabled: false },
      flow_tester: { enabled: false },
      wave_gate: false,
      adaptive_planner: false,
      design_review: false,
      skeleton_guard: false,
      auto_trigger: { enabled: true, milestones: [50, 100] }
    },
    regression_bonus: 0.3
  },
  "cli-tool": {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: false,
      complexity_analysis: true,
      shadow: { enabled: false },
      flow_tester: { enabled: false },
      wave_gate: false,
      adaptive_planner: false,
      design_review: false,
      skeleton_guard: false,
      auto_trigger: { enabled: true, milestones: [50, 100] }
    }
  }
};
function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overrideVal = override[key];
    if (overrideVal !== null && overrideVal !== void 0 && typeof overrideVal === "object" && !Array.isArray(overrideVal) && typeof baseVal === "object" && baseVal !== null && !Array.isArray(baseVal)) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== void 0) {
      result[key] = overrideVal;
    }
  }
  return result;
}
function loadYamlConfig(yamlPath) {
  try {
    if (!fs4.existsSync(yamlPath)) {
      return { ...DEFAULT_QA_CONFIG };
    }
    const content = fs4.readFileSync(yamlPath, "utf-8");
    const parsed = YAML.parse(content);
    if (parsed === null || parsed === void 0) {
      return { ...DEFAULT_QA_CONFIG };
    }
    const validated = QaRulesSchema.parse(parsed);
    return deepMerge(DEFAULT_QA_CONFIG, validated);
  } catch (err) {
    console.warn(
      `[VibeSpec] qa-rules.yaml \uD30C\uC2F1 \uC2E4\uD328, L0 \uAE30\uBCF8\uAC12\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4: ${err instanceof Error ? err.message : String(err)}`
    );
    return { ...DEFAULT_QA_CONFIG };
  }
}
function filterExpiredIgnoreRules(config) {
  if (!config.ignore) return config;
  const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const filtered = config.ignore.filter((rule) => {
    if (!rule.expires) return true;
    return rule.expires >= now;
  });
  return { ...config, ignore: filtered };
}
function normalizeConditionalModule(value, defaultValue) {
  if (value === void 0) return defaultValue;
  if (typeof value === "boolean") return { enabled: value };
  return value;
}
function normalizeConditionalModules(config) {
  return {
    ...config,
    modules: {
      ...config.modules,
      shadow: normalizeConditionalModule(
        config.modules.shadow,
        DEFAULT_QA_CONFIG.modules.shadow
      ),
      flow_tester: normalizeConditionalModule(
        config.modules.flow_tester,
        DEFAULT_QA_CONFIG.modules.flow_tester
      )
    }
  };
}
function resolveConfig(options = {}) {
  const { planId, db, yamlPath, rawConfig } = options;
  let config = { ...DEFAULT_QA_CONFIG };
  if (rawConfig) {
    config = { ...rawConfig };
    config = normalizeConditionalModules(config);
    return filterExpiredIgnoreRules(config);
  }
  const effectiveYamlPath = yamlPath ?? ".claude/qa-rules.yaml";
  const yamlConfig = loadYamlConfig(effectiveYamlPath);
  const profileName = yamlConfig.profile;
  if (profileName && PROFILE_PRESETS[profileName]) {
    config = deepMerge(config, PROFILE_PRESETS[profileName]);
  }
  config = deepMerge(config, yamlConfig);
  if (planId && db) {
    try {
      const row = db.prepare("SELECT qa_overrides FROM plans WHERE id = ?").get(planId);
      if (row?.qa_overrides) {
        const overrides = JSON.parse(row.qa_overrides);
        config = deepMerge(config, overrides);
      }
    } catch {
    }
  }
  config = normalizeConditionalModules(config);
  config = filterExpiredIgnoreRules(config);
  return config;
}
function validateConfig(config) {
  const errors = [];
  const warnings = [];
  const { green, yellow, orange } = config.risk_thresholds;
  if (green >= yellow) {
    errors.push(`risk_thresholds ordering error: green (${green}) must be less than yellow (${yellow})`);
  }
  if (yellow >= orange) {
    errors.push(`risk_thresholds ordering error: yellow (${yellow}) must be less than orange (${orange})`);
  }
  if (config.custom_rules) {
    for (const rule of config.custom_rules) {
      try {
        new RegExp(rule.pattern);
      } catch {
        errors.push(`Invalid regex pattern in custom_rule '${rule.id}': ${rule.pattern}`);
      }
    }
  }
  if (config.modules) {
    const allFalse = Object.entries(config.modules).filter(([key]) => key !== "auto_trigger").every(([, v]) => {
      if (typeof v === "boolean") return v === false;
      if (typeof v === "object" && v !== null && "enabled" in v) return !v.enabled;
      return false;
    });
    if (allFalse) {
      warnings.push("All modules are disabled. No QA checks will be performed.");
    }
  }
  return { errors, warnings };
}
function detectProfile(packageJson) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const depNames = Object.keys(allDeps);
  const frontendIndicators = ["react", "react-dom", "vue", "svelte", "next", "nuxt", "angular", "@angular/core"];
  const backendIndicators = ["express", "fastify", "koa", "hapi", "@nestjs/core", "hono"];
  const cliIndicators = ["commander", "yargs", "inquirer", "oclif", "meow", "cac"];
  const hasFrontend = depNames.some((d) => frontendIndicators.includes(d));
  const hasBackend = depNames.some((d) => backendIndicators.includes(d));
  const hasCli = depNames.some((d) => cliIndicators.includes(d));
  if (hasFrontend && hasBackend) return "fullstack";
  if (hasFrontend) return "web-frontend";
  if (hasBackend) return "api-server";
  if (hasCli) return "cli-tool";
  return "library";
}

// src/cli/commands/quality.ts
import * as YAML2 from "yaml";
function getQAModels() {
  const m = initModels();
  return { qaRun: m.qaRunModel, qaScenario: m.qaScenarioModel, qaFinding: m.qaFindingModel, planModel: m.planModel };
}
function registerQualityCommands(program2, getModels) {
  const qa = program2.command("qa").description("Manage QA runs, scenarios, and findings");
  const qaRun = qa.command("run").description("Manage QA runs");
  qaRun.command("create").argument("[plan_id]", "Plan ID (optional for --mode security-only)").option("--trigger <type>", "Trigger type (manual, auto, milestone)", "manual").option("--mode <mode>", "Run mode (full, security-only)").description("Create a new QA run").action((planId, opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel } = getQAModels();
    if (opts.mode === "security-only") {
      const { planModel: planModel2 } = initModels();
      let sentinelPlan = planModel2.list({ status: "active" }).find((p) => p.title === "__security_audit__");
      if (!sentinelPlan) {
        sentinelPlan = planModel2.create("__security_audit__", "Auto-created sentinel plan for standalone security audits");
      }
      const run2 = qaRunModel.create(sentinelPlan.id, opts.trigger);
      output(run2, `Created security-only QA run: ${run2.id} (sentinel plan: ${sentinelPlan.id})`);
      return;
    }
    if (!planId) return outputError("Plan ID is required (use --mode security-only for standalone)");
    const { planModel } = initModels();
    const plan = planModel.getById(planId);
    if (!plan) return outputError(`Plan not found: ${planId}`);
    const run = qaRunModel.create(planId, opts.trigger);
    output(run, `Created QA run: ${run.id} (plan: ${planId}, trigger: ${opts.trigger})`);
  }));
  qaRun.command("list").option("--plan <plan_id>", "Filter by plan ID").description("List QA runs").action((opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel } = getQAModels();
    const runs = qaRunModel.list(opts.plan);
    if (runs.length === 0) {
      output(runs, "No QA runs found.");
      return;
    }
    output(runs, runs.map(
      (r) => `${r.id}  ${r.status.padEnd(10)}  risk:${r.risk_score.toFixed(2)}  ${r.passed_scenarios}/${r.total_scenarios} passed  ${r.created_at}`
    ).join("\n"));
  }));
  qaRun.command("show").argument("<run_id>", "QA Run ID").description("Show QA run details with scenarios and findings").action((runId) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaScenario, qaFinding } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    const summary = qaRunModel.getSummary(runId);
    const scenarios = qaScenario.listByRun(runId);
    const findings = qaFinding.list({ runId });
    output({ run, summary, scenarios, findings }, [
      `QA Run: ${run.id} (${run.status})`,
      `Plan: ${run.plan_id} | Trigger: ${run.trigger} | Risk: ${run.risk_score.toFixed(2)}`,
      `Scenarios: ${run.passed_scenarios}/${run.total_scenarios} passed, ${run.failed_scenarios} failed`,
      findings.length > 0 ? `Findings: ${findings.length} total` : "Findings: none",
      run.summary ? `Summary: ${run.summary}` : ""
    ].filter(Boolean).join("\n"));
  }));
  qaRun.command("complete").argument("<run_id>", "QA Run ID").option("--summary <text>", "Summary of the QA run results").option("--status <status>", "Final status (completed, failed)", "completed").description("Complete a QA run and set its final status").action((runId, opts) => withErrorHandler(() => {
    const statusInput = opts.status;
    if (!VALID_QA_RUN_TERMINAL_STATUSES.includes(statusInput)) {
      return outputError(`Invalid status: ${statusInput}. Must be one of: ${VALID_QA_RUN_TERMINAL_STATUSES.join(", ")}`);
    }
    const status = statusInput;
    const { qaRun: qaRunModel } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    if (VALID_QA_RUN_TERMINAL_STATUSES.includes(run.status)) {
      return outputError(`QA run ${runId} is already ${run.status}`);
    }
    const updated = qaRunModel.updateStatus(runId, status, opts.summary);
    output(updated, `QA run ${runId} marked as ${status}${opts.summary ? ` \u2014 ${opts.summary}` : ""}`);
  }));
  const qaScenarioCmd = qa.command("scenario").description("Manage QA scenarios");
  qaScenarioCmd.command("create").argument("<run_id>", "QA Run ID").requiredOption("--title <title>", "Scenario title").requiredOption("--description <desc>", "Scenario description").requiredOption("--category <cat>", "Category (functional, integration, flow, regression, edge_case)").option("--priority <p>", "Priority (critical, high, medium, low)", "medium").option("--related-tasks <ids>", "Comma-separated related task IDs").option("--agent <name>", "Assigned agent name").option("--source <source>", "Scenario source (seed, shadow, wave, final, manual)", "final").description("Create a QA scenario").action((runId, opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaScenario } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    if (run.status !== "pending" && run.status !== "running") {
      return outputError(`Cannot add scenarios to ${run.status} run`);
    }
    const scenario = qaScenario.create(runId, {
      category: opts.category,
      title: opts.title,
      description: opts.description,
      priority: opts.priority,
      related_tasks: opts.relatedTasks ? JSON.stringify(opts.relatedTasks.split(",").map((s) => s.trim())) : void 0,
      source: opts.source
    });
    output(scenario, `Created scenario: ${scenario.id} [${scenario.category}] ${scenario.title}`);
  }));
  qaScenarioCmd.command("update").argument("<id>", "Scenario ID").requiredOption("--status <status>", "Status (pending, running, pass, fail, skip, warn)").option("--evidence <text>", "Evidence text").description("Update scenario status").action((id, opts) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const existing = qaScenario.get(id);
    if (!existing) return outputError(`Scenario not found: ${id}`);
    qaScenario.updateStatus(id, opts.status, opts.evidence);
    const updated = qaScenario.get(id);
    output(updated, `Updated scenario ${id}: ${updated.status}`);
  }));
  qaScenarioCmd.command("list").argument("<run_id>", "QA Run ID").option("--category <cat>", "Filter by category").option("--status <status>", "Filter by status").option("--source <source>", "Filter by source (seed, shadow, wave, final, manual)").description("List scenarios for a QA run").action((runId, opts) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const scenarios = qaScenario.listByRun(runId, {
      category: opts.category,
      status: opts.status,
      source: opts.source
    });
    if (scenarios.length === 0) {
      output(scenarios, "No scenarios found.");
      return;
    }
    output(scenarios, scenarios.map(
      (s) => `${s.id}  [${s.category}]  ${s.status.padEnd(7)}  ${s.priority.padEnd(8)}  ${s.title}`
    ).join("\n"));
  }));
  qaScenarioCmd.command("list-by-plan").argument("<plan_id>", "Plan ID").option("--task-id <taskId>", "Filter by related task ID").option("--source <source>", "Filter by source (seed, shadow, wave, final, manual)").option("--category <cat>", "Filter by category").option("--status <status>", "Filter by status").description("List scenarios for a plan (with optional task/source filters)").action((planId, opts) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const scenarios = qaScenario.listByPlan(planId, {
      taskId: opts.taskId,
      source: opts.source,
      category: opts.category,
      status: opts.status
    });
    if (scenarios.length === 0) {
      output(scenarios, "No scenarios found for this plan.");
      return;
    }
    output(scenarios, scenarios.map(
      (s) => `${s.id}  [${s.category}]  ${s.status.padEnd(7)}  ${s.priority.padEnd(8)}  src:${s.source ?? "n/a"}  ${s.title}`
    ).join("\n"));
  }));
  const qaFindingCmd = qa.command("finding").description("Manage QA findings");
  qaFindingCmd.command("create").argument("<run_id>", "QA Run ID").requiredOption("--title <title>", "Finding title").requiredOption("--description <desc>", "Finding description").requiredOption("--severity <s>", "Severity (critical, high, medium, low)").requiredOption("--category <cat>", "Category (bug, regression, missing_feature, inconsistency, performance, security, ux_issue, spec_gap)").option("--scenario-id <id>", "Related scenario ID").option("--affected-files <files>", "Comma-separated affected files").option("--related-task-id <id>", "Related task ID").option("--fix-suggestion <text>", "Fix suggestion").description("Create a QA finding").action((runId, opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaFinding } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    const finding = qaFinding.create(runId, {
      scenario_id: opts.scenarioId,
      severity: opts.severity,
      category: opts.category,
      title: opts.title,
      description: opts.description,
      affected_files: opts.affectedFiles ? JSON.stringify(opts.affectedFiles.split(",").map((s) => s.trim())) : void 0,
      related_task_id: opts.relatedTaskId,
      fix_suggestion: opts.fixSuggestion
    });
    output(finding, `Created finding: ${finding.id} [${finding.severity}] ${finding.title}`);
  }));
  qaFindingCmd.command("update").argument("<id>", "Finding ID").requiredOption("--status <status>", "Status (open, planned, fixed, wontfix, duplicate)").option("--fix-plan-id <id>", "Fix plan ID").description("Update finding status").action((id, opts) => withErrorHandler(() => {
    const { qaFinding } = getQAModels();
    const existing = qaFinding.get(id);
    if (!existing) return outputError(`Finding not found: ${id}`);
    qaFinding.updateStatus(id, opts.status, opts.fixPlanId);
    const updated = qaFinding.get(id);
    output(updated, `Updated finding ${id}: ${updated.status}`);
  }));
  qaFindingCmd.command("list").option("--run <run_id>", "Filter by QA run ID").option("--severity <s>", "Filter by severity").option("--status <s>", "Filter by status").option("--category <cat>", "Filter by category").description("List QA findings").action((opts) => withErrorHandler(() => {
    const { qaFinding } = getQAModels();
    const findings = qaFinding.list({
      runId: opts.run,
      severity: opts.severity,
      status: opts.status,
      category: opts.category
    });
    if (findings.length === 0) {
      output(findings, "No findings found.");
      return;
    }
    output(findings, findings.map(
      (f) => `${f.id}  [${f.severity}]  ${f.status.padEnd(9)}  ${f.category.padEnd(16)}  ${f.title}`
    ).join("\n"));
  }));
  qa.command("stats").option("--plan <plan_id>", "Filter by plan ID").description("Show QA statistics").action((opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaFinding } = getQAModels();
    const runs = qaRunModel.list(opts.plan);
    const completedRuns = runs.filter((r) => r.status === "completed");
    const avgRisk = completedRuns.length > 0 ? completedRuns.reduce((sum, r) => sum + r.risk_score, 0) / completedRuns.length : 0;
    const allFindings = opts.plan ? runs.flatMap((r) => qaFinding.list({ runId: r.id })) : qaFinding.list();
    const openFindings = allFindings.filter((f) => f.status === "open");
    const statsData = {
      total_runs: runs.length,
      completed_runs: completedRuns.length,
      avg_risk_score: Math.round(avgRisk * 100) / 100,
      total_findings: allFindings.length,
      open_findings: openFindings.length,
      findings_by_severity: {
        critical: openFindings.filter((f) => f.severity === "critical").length,
        high: openFindings.filter((f) => f.severity === "high").length,
        medium: openFindings.filter((f) => f.severity === "medium").length,
        low: openFindings.filter((f) => f.severity === "low").length
      }
    };
    output(statsData, [
      `QA Statistics${opts.plan ? ` (plan: ${opts.plan})` : ""}`,
      `Runs: ${statsData.total_runs} total, ${statsData.completed_runs} completed`,
      `Avg Risk Score: ${statsData.avg_risk_score}`,
      `Findings: ${statsData.total_findings} total, ${statsData.open_findings} open`,
      `  critical: ${statsData.findings_by_severity.critical}  high: ${statsData.findings_by_severity.high}  medium: ${statsData.findings_by_severity.medium}  low: ${statsData.findings_by_severity.low}`
    ].join("\n"));
  }));
  const qaSeed = qa.command("seed").description("Manage QA seed scenarios (pre-generated from spec)");
  qaSeed.command("create").argument("<plan_id>", "Plan ID").option("--trigger <type>", "Trigger type (manual, auto)", "manual").description("Create a QA run for seeding and display agent prompt").action((planId, opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel, planModel } = getQAModels();
    const plan = planModel.getById(planId);
    if (!plan) return outputError(`Plan not found: ${planId}`);
    const run = qaRunModel.create(planId, opts.trigger);
    output(run, [
      `Created QA run for seeding: ${run.id} (plan: ${planId})`,
      "",
      "Dispatch qa-seeder agent with:",
      `  plan_id: ${planId}`,
      `  run_id: ${run.id}`,
      `  plan_spec: (from plan show)`,
      `  task_list: (from plan show --tasks)`
    ].join("\n"));
  }));
  qaSeed.command("list").argument("<plan_id>", "Plan ID").description("List seed scenarios for a plan (source=seed)").action((planId) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const scenarios = qaScenario.listByPlanSource(planId, "seed");
    if (scenarios.length === 0) {
      output(scenarios, "No seed scenarios found for this plan.");
      return;
    }
    output(scenarios, scenarios.map(
      (s) => `${s.id}  [${s.category}]  ${s.status.padEnd(7)}  ${s.priority.padEnd(8)}  ${s.title}`
    ).join("\n"));
  }));
  const qaConfig = qa.command("config").description("Manage QA configuration");
  qaConfig.command("resolve").argument("[plan_id]", "Plan ID for L2 overrides").description("Resolve and display merged QA configuration").action((planId) => withErrorHandler(() => {
    const resolveOpts = {};
    if (planId) {
      resolveOpts.planId = planId;
      resolveOpts.db = initDb();
    }
    const config = resolveConfig(resolveOpts);
    output(config, formatConfigHuman(config));
  }));
  qaConfig.command("validate").description("Validate .claude/qa-rules.yaml").action(() => withErrorHandler(() => {
    const yamlPath = ".claude/qa-rules.yaml";
    if (!fs5.existsSync(yamlPath)) {
      return outputError(`Configuration file not found: ${yamlPath}`);
    }
    const rawContent = fs5.readFileSync(yamlPath, "utf-8");
    const parsed = YAML2.parse(rawContent);
    const zodResult = QaRulesSchema.safeParse(parsed);
    const errors = [];
    const warnings = [];
    if (!zodResult.success) {
      for (const issue of zodResult.error.issues) {
        errors.push(`Schema error at ${issue.path.join(".")}: ${issue.message}`);
      }
    }
    if (zodResult.success) {
      const config = resolveConfig({ yamlPath });
      const validation = validateConfig(config);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }
    const result = { errors, warnings, valid: errors.length === 0 };
    output(result, [
      `Validation: ${result.valid ? "PASS" : "FAIL"}`,
      errors.length > 0 ? `Errors (${errors.length}):` : "",
      ...errors.map((e) => `  - ${e}`),
      warnings.length > 0 ? `Warnings (${warnings.length}):` : "",
      ...warnings.map((w) => `  - ${w}`)
    ].filter(Boolean).join("\n"));
  }));
  qaConfig.command("init").description("Auto-detect profile and create .claude/qa-rules.yaml").action(() => withErrorHandler(() => {
    const yamlPath = ".claude/qa-rules.yaml";
    if (fs5.existsSync(yamlPath)) {
      return outputError(`Configuration file already exists: ${yamlPath}`);
    }
    let profile = "library";
    try {
      const pkgContent = fs5.readFileSync("package.json", "utf-8");
      const pkgJson = JSON.parse(pkgContent);
      profile = detectProfile(pkgJson);
    } catch {
    }
    const preset = PROFILE_PRESETS[profile] ?? {};
    const config = {
      profile,
      ...DEFAULT_QA_CONFIG,
      ...preset
    };
    if (!fs5.existsSync(".claude")) {
      fs5.mkdirSync(".claude", { recursive: true });
    }
    const yamlContent = YAML2.stringify(config);
    fs5.writeFileSync(yamlPath, yamlContent, "utf-8");
    output(
      { profile, path: yamlPath },
      `Created ${yamlPath} with profile: ${profile}`
    );
  }));
  qaConfig.command("show").argument("[plan_id]", "Plan ID for L2 overrides").description("Show resolved QA configuration (alias for resolve)").action((planId) => withErrorHandler(() => {
    const resolveOpts = {};
    if (planId) {
      resolveOpts.planId = planId;
      resolveOpts.db = initDb();
    }
    const config = resolveConfig(resolveOpts);
    output(config, formatConfigHuman(config));
  }));
  qa.command("verify").argument("<plan_id>", "Plan ID to verify").description("Verify plan AC matching against code changes").action(async (planId) => withErrorHandler(async () => {
    const { PlanVerifier: PlanVerifier2 } = await import("../plan-verifier-BVECMKZK.js");
    const db = initDb();
    const verifier = new PlanVerifier2(db);
    const result = await verifier.verify(planId);
    output(result, [
      `AC Verification: ${result.overallScore >= 0 ? `${result.overallScore}/100` : "N/A"}`,
      `Tasks verified: ${result.taskResults.length}`,
      `Unmatched ACs: ${result.unmatchedACs.length}`,
      result.warnings.length > 0 ? `Warnings:` : "",
      ...result.warnings.map((w) => `  - ${w}`)
    ].filter(Boolean).join("\n"));
  }));
  const waveGate = program2.command("wave-gate").description("Manage wave gates for integration verification");
  waveGate.command("create").argument("<plan_id>", "Plan ID").requiredOption("--wave <number>", "Wave number").requiredOption("--verdict <verdict>", "Verdict (GREEN, YELLOW, RED)").requiredOption("--task-ids <ids>", "Comma-separated task IDs").option("--summary <text>", "Summary of wave gate results").option("--findings-count <n>", "Number of findings", "0").description("Create a wave gate record").action((planId, opts) => withErrorHandler(() => {
    const validVerdicts = ["GREEN", "YELLOW", "RED"];
    if (!validVerdicts.includes(opts.verdict)) {
      return outputError(`Invalid verdict: ${opts.verdict}. Must be one of: ${validVerdicts.join(", ")}`);
    }
    const m = initModels();
    const plan = m.planModel.getById(planId);
    if (!plan) return outputError(`Plan not found: ${planId}`);
    const waveNumber = parseInt(opts.wave, 10);
    if (isNaN(waveNumber) || waveNumber < 0) return outputError(`Invalid wave number: ${opts.wave}`);
    const taskIds = opts.taskIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (taskIds.length === 0) return outputError("At least one task ID is required");
    const findingsCount = parseInt(opts.findingsCount, 10) || 0;
    const gate = m.waveGateModel.create(planId, waveNumber, taskIds, opts.verdict, opts.summary, findingsCount);
    output(gate, `Created wave gate: ${gate.id} (wave ${waveNumber}, verdict: ${opts.verdict})`);
  }));
  waveGate.command("list").argument("<plan_id>", "Plan ID").description("List wave gates for a plan").action((planId) => withErrorHandler(() => {
    const m = initModels();
    const gates = m.waveGateModel.listByPlan(planId);
    if (gates.length === 0) {
      output(gates, "No wave gates found.");
      return;
    }
    output(gates, gates.map(
      (g) => `${g.id}  wave:${g.wave_number}  ${g.verdict.padEnd(6)}  findings:${g.findings_count}  ${g.created_at}`
    ).join("\n"));
  }));
}
function formatConfigHuman(config) {
  const lines = [];
  if (config.profile) {
    lines.push(`Profile: ${config.profile}`);
    lines.push("");
  }
  lines.push("Risk Thresholds:");
  lines.push(`  green:  ${config.risk_thresholds.green}`);
  lines.push(`  yellow: ${config.risk_thresholds.yellow}`);
  lines.push(`  orange: ${config.risk_thresholds.orange}`);
  lines.push("");
  lines.push("Severity Weights:");
  lines.push(`  critical: ${config.severity_weights.critical}`);
  lines.push(`  high:     ${config.severity_weights.high}`);
  lines.push(`  medium:   ${config.severity_weights.medium}`);
  lines.push(`  low:      ${config.severity_weights.low}`);
  lines.push("");
  lines.push("Modules:");
  for (const [key, val] of Object.entries(config.modules)) {
    lines.push(`  ${key}: ${val ? "enabled" : "disabled"}`);
  }
  lines.push("");
  lines.push(`Regression Bonus: ${config.regression_bonus}`);
  if (config.custom_rules && config.custom_rules.length > 0) {
    lines.push("");
    lines.push(`Custom Rules (${config.custom_rules.length}):`);
    for (const rule of config.custom_rules) {
      lines.push(`  [${rule.severity}] ${rule.id}: ${rule.message}`);
    }
  }
  if (config.ignore && config.ignore.length > 0) {
    lines.push("");
    lines.push(`Ignore Rules (${config.ignore.length}):`);
    for (const rule of config.ignore) {
      lines.push(`  ${rule.rule_id}: ${rule.reason} (${rule.paths.join(", ")})`);
    }
  }
  return lines.join("\n");
}

// src/cli/commands/generation.ts
var IDEATION_TAG = "[ideation]";
function registerGenerationCommands(program2, getModels) {
  const ideate = program2.command("ideate").description("Manage ideation records");
  ideate.command("list").description("List ideation records from context log").action(() => {
    withErrorHandler(() => {
      const { contextModel } = getModels();
      const ideations = contextModel.search(IDEATION_TAG);
      if (ideations.length === 0) {
        output([], "ideation \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. /vs-ideate\uB85C \uC544\uC774\uB514\uC5B4\uB97C \uC815\uB9AC\uD574\uBCF4\uC138\uC694.");
        return;
      }
      const formatted = ideations.map(
        (l, i) => `${i + 1}. [#${l.id}] ${l.summary.replace(`${IDEATION_TAG} `, "")} (${l.created_at})`
      ).join("\n");
      output(ideations, `## Ideation \uC774\uB825

${formatted}`);
    });
  });
  ideate.command("show").argument("<id>", "Context log ID").description("Show ideation detail").action((id) => {
    withErrorHandler(() => {
      const { contextModel } = getModels();
      const log = contextModel.getById(parseInt(id, 10));
      if (!log) return outputError(`Ideation not found: ${id}`);
      output(log, `## Ideation #${log.id}

**Created**: ${log.created_at}

${log.summary}`);
    });
  });
  ideate.command("save").requiredOption("--title <title>", "Ideation title").requiredOption("--summary <summary>", "One-line summary").option("--plan-id <planId>", "Associated plan ID").option("--session-id <sessionId>", "Session ID").description("Save an ideation record to context log").action((opts) => {
    withErrorHandler(() => {
      const { contextModel } = getModels();
      const log = contextModel.create({
        summary: `${IDEATION_TAG} ${opts.title}: ${opts.summary}`,
        plan_id: opts.planId,
        session_id: opts.sessionId
      });
      output(log, `Ideation saved: #${log.id} \u2014 ${opts.title}`);
    });
  });
}

// src/core/engine/codex-detect.ts
import * as fs6 from "fs";
import * as path4 from "path";
import * as os from "os";
import { execSync as execSync2 } from "child_process";
var CODEX_PLUGIN_PATH = ".claude/plugins/marketplaces/openai-codex/plugins/codex";
var CODEX_AGENT_FILE = "agents/codex-rescue.md";
var CODEX_COMPANION_FILE = "scripts/codex-companion.mjs";
var CodexDetector = class {
  cache = null;
  detect() {
    if (this.cache) return this.cache;
    try {
      const result = this.performDetection();
      this.cache = result;
      return result;
    } catch {
      const fallback = { available: false, authenticated: false };
      this.cache = fallback;
      console.warn("[codex-detect] Detection failed, returning unavailable");
      return fallback;
    }
  }
  clearCache() {
    this.cache = null;
  }
  performDetection() {
    const pluginPath = path4.join(os.homedir(), CODEX_PLUGIN_PATH);
    if (!fs6.existsSync(pluginPath)) return { available: false, authenticated: false };
    if (!fs6.existsSync(path4.join(pluginPath, CODEX_AGENT_FILE))) return { available: false, authenticated: false };
    try {
      fs6.accessSync(path4.join(pluginPath, CODEX_COMPANION_FILE), fs6.constants.R_OK);
    } catch {
      return { available: false, authenticated: false };
    }
    return { available: true, authenticated: this.checkAuthentication(), plugin_path: pluginPath };
  }
  checkAuthentication() {
    try {
      const output2 = execSync2("codex setup --status", { encoding: "utf-8", timeout: 5e3, stdio: ["pipe", "pipe", "pipe"] });
      const lower = output2.toLowerCase();
      return lower.includes("authenticated") || lower.includes("ready") || lower.includes("ok");
    } catch {
      try {
        return fs6.existsSync(path4.join(os.homedir(), ".codex", "auth.json"));
      } catch {
        return false;
      }
    }
  }
};

// src/core/engine/codex-prompt-builder.ts
import * as fs7 from "fs";
import * as path5 from "path";
var SENSITIVE_PATTERNS = [/^\.env$/i, /^\.env\..+$/i, /secret/i, /credential/i, /\.key$/i, /\.pem$/i, /api[_-]?key/i];
function isSensitiveFile(filePath) {
  const normalized = path5.normalize(filePath);
  const basename4 = path5.basename(normalized);
  return SENSITIVE_PATTERNS.some((p) => p.test(basename4)) || normalized.split(path5.sep).some((seg) => SENSITIVE_PATTERNS.some((p) => p.test(seg)));
}
function buildCodexPrompt(finding, projectRoot, errorKB) {
  if (!finding.affected_files) {
    return { prompt: "", included_files: [], excluded_sensitive_files: [], escalation: { finding_id: finding.id, reason: "Finding has no affected_files specified" } };
  }
  const files = finding.affected_files.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
  const includedFiles = [];
  const excludedSensitiveFiles = [];
  const snippets = [];
  for (const file of files) {
    if (isSensitiveFile(file)) {
      excludedSensitiveFiles.push(file);
      continue;
    }
    const fullPath = path5.resolve(projectRoot, file);
    if (!fs7.existsSync(fullPath)) continue;
    try {
      const content = fs7.readFileSync(fullPath, "utf-8");
      includedFiles.push(file);
      snippets.push(`### ${file}
\`\`\`
${content}
\`\`\``);
    } catch {
      continue;
    }
  }
  if (includedFiles.length === 0) {
    return { prompt: "", included_files: [], excluded_sensitive_files: excludedSensitiveFiles, escalation: { finding_id: finding.id, reason: "None of the affected_files exist or all are sensitive" } };
  }
  const sections = [
    `## Bug Report
**Title:** ${finding.title}
**Severity:** ${finding.severity}
**Category:** ${finding.category}`,
    `## Description
${finding.description}`
  ];
  if (finding.fix_suggestion) sections.push(`## Suggested Fix
${finding.fix_suggestion}`);
  sections.push(`## Affected Files
${snippets.join("\n\n")}`);
  if (errorKB) {
    try {
      const results = errorKB.search(finding.title);
      if (results.length > 0) sections.push(`## Previous Solutions (Error KB)
${results.map((r) => `- **${r.title}**: ${r.solution ?? "N/A"}`).join("\n")}`);
    } catch {
    }
  }
  sections.push("## Instructions\nFix the bug described above. Only modify the affected files. Run tests after fixing.");
  return { prompt: sections.join("\n\n"), included_files: includedFiles, excluded_sensitive_files: excludedSensitiveFiles };
}

// src/core/engine/codex-integration-db.ts
var CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS codex_integrations (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  codex_thread_id TEXT NOT NULL DEFAULT '',
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt >= 1 AND attempt <= 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','verifying','passed','failed','escalated')),
  touched_files TEXT NOT NULL DEFAULT '[]',
  verification_result TEXT CHECK(verification_result IN ('PASS','WARN','FAIL') OR verification_result IS NULL),
  error_kb_entry_id TEXT,
  escalation_summary TEXT,
  prompt_context TEXT NOT NULL DEFAULT '',
  fallback_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;
function initCodexIntegrationSchema(db) {
  db.exec(CREATE_TABLE_SQL);
}
function getByFindingId(db, findingId) {
  return db.prepare("SELECT * FROM codex_integrations WHERE finding_id = ? ORDER BY created_at DESC LIMIT 1").get(findingId) ?? null;
}
function listByRunId(db, runId) {
  return db.prepare("SELECT * FROM codex_integrations WHERE run_id = ? ORDER BY created_at").all(runId);
}

// src/cli/commands/codex.ts
function registerCodexCommands(program2, _getModels) {
  const codex = program2.command("codex").description("Codex plugin integration");
  codex.command("detect").option("--invalidate-cache", "Invalidate cache and re-detect").description("Detect Codex plugin availability and auth status").action((opts) => withErrorHandler(() => {
    const detector = new CodexDetector();
    if (opts.invalidateCache) detector.clearCache();
    const result = detector.detect();
    output(result, result.available ? `Codex: available, ${result.authenticated ? "authenticated" : "NOT authenticated"}${result.plugin_path ? ` (${result.plugin_path})` : ""}` : "Codex: not available");
  }));
  const qa = program2.commands.find((c) => c.name() === "qa");
  if (!qa) return;
  const autofix = qa.command("autofix").description("Codex-powered autofix for QA findings");
  autofix.command("status").argument("<finding_id>", "Finding ID").description("Show autofix status for a finding").action((findingId) => withErrorHandler(() => {
    const db = initDb();
    initCodexIntegrationSchema(db);
    const record = getByFindingId(db, findingId);
    if (!record) return outputError(`No autofix record for finding: ${findingId}`);
    output(record, `Autofix ${findingId}: status=${record.status}, attempt=${record.attempt}, verification=${record.verification_result ?? "pending"}`);
  }));
  autofix.command("list").argument("<run_id>", "QA Run ID").option("--severity <levels>", "Filter by severity (comma-separated)", "critical,high").description("List autofix records for a QA run").action((runId, _opts) => withErrorHandler(() => {
    const db = initDb();
    initCodexIntegrationSchema(db);
    const records = listByRunId(db, runId);
    output(records, records.length > 0 ? `${records.length} autofix record(s) for run ${runId}` : `No autofix records for run ${runId}`);
  }));
  autofix.command("dry-run").argument("<finding_id>", "Finding ID").description("Generate Codex prompt without executing (dry run)").action((findingId) => withErrorHandler(() => {
    const m = initModels();
    const finding = m.qaFindingModel.getById(findingId);
    if (!finding) return outputError(`Finding not found: ${findingId}`);
    const result = buildCodexPrompt(finding, process.cwd());
    if (result.escalation) return outputError(`Cannot generate prompt: ${result.escalation.reason}`);
    output(result, `[DRY RUN] Prompt for ${findingId}:

${result.prompt.substring(0, 500)}${result.prompt.length > 500 ? "\n... (truncated)" : ""}`);
  }));
}

// src/core/engine/gc.ts
import { execSync as execSync3 } from "child_process";
import * as fs8 from "fs";
import * as path6 from "path";
var GCEngine = class {
  db;
  projectRoot;
  scanners = [];
  constructor(db, projectRoot) {
    this.db = db;
    this.projectRoot = projectRoot;
  }
  registerScanner(scanner) {
    this.scanners.push(scanner);
  }
  getScanners() {
    return this.scanners;
  }
  async scan(options) {
    const scanId = generateId();
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(`
      INSERT INTO gc_scans (id, scan_type, started_at, status)
      VALUES (?, ?, ?, 'running')
    `).run(scanId, options.scan_type, startedAt);
    try {
      const targetPath = options.path ?? this.projectRoot;
      const files = await this.collectFiles(targetPath);
      const scannerResults = await Promise.allSettled(
        this.scanners.map((scanner) => scanner.scan(files))
      );
      const allFindings = [];
      for (let i = 0; i < scannerResults.length; i++) {
        const result = scannerResults[i];
        if (result.status === "fulfilled") {
          allFindings.push(...result.value);
        } else {
          console.error(`[GC] Scanner "${this.scanners[i].name}" failed:`, result.reason);
        }
      }
      const insertFinding = this.db.prepare(`
        INSERT INTO gc_findings (id, scan_id, category, severity, safety_level, file_path, line_start, line_end, rule_source, rule_id, description, suggested_fix, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'detected')
      `);
      const insertMany = this.db.transaction((findings) => {
        for (const f of findings) {
          insertFinding.run(
            f.id,
            scanId,
            f.category,
            f.severity,
            f.safety_level,
            f.file_path,
            f.line_start,
            f.line_end,
            f.rule_source,
            f.rule_id,
            f.description,
            f.suggested_fix
          );
        }
      });
      insertMany(allFindings);
      const completedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.db.prepare(`
        UPDATE gc_scans SET completed_at = ?, files_scanned = ?, findings_count = ?, status = 'completed'
        WHERE id = ?
      `).run(completedAt, files.length, allFindings.length, scanId);
      return this.getScan(scanId);
    } catch (err) {
      this.db.prepare(`
        UPDATE gc_scans SET completed_at = ?, status = 'failed' WHERE id = ?
      `).run((/* @__PURE__ */ new Date()).toISOString(), scanId);
      throw err;
    }
  }
  getScan(scanId) {
    return this.db.prepare("SELECT * FROM gc_scans WHERE id = ?").get(scanId) ?? null;
  }
  listScans() {
    return this.db.prepare("SELECT * FROM gc_scans ORDER BY started_at DESC").all();
  }
  getFindings(scanId, severity) {
    if (severity) {
      return this.db.prepare(
        "SELECT * FROM gc_findings WHERE scan_id = ? AND severity = ? ORDER BY file_path, line_start"
      ).all(scanId, severity);
    }
    return this.db.prepare(
      "SELECT * FROM gc_findings WHERE scan_id = ? ORDER BY file_path, line_start"
    ).all(scanId);
  }
  async applySafeFixes(scanId) {
    this.assertCleanWorkingTree();
    const findings = this.db.prepare(
      "SELECT * FROM gc_findings WHERE scan_id = ? AND safety_level = 'SAFE' AND suggested_fix IS NOT NULL AND status = 'detected'"
    ).all(scanId);
    if (findings.length === 0) return [];
    const changes = [];
    for (const finding of findings) {
      const change = this.applyFixToFile(finding);
      if (change) {
        changes.push(change);
        this.db.prepare(
          "UPDATE gc_findings SET status = 'auto_fixed', resolved_at = ? WHERE id = ?"
        ).run((/* @__PURE__ */ new Date()).toISOString(), finding.id);
      }
    }
    if (changes.length > 0) {
      execSync3("git add -A", { cwd: this.projectRoot, stdio: "pipe" });
      const commitMsg = `chore(gc): auto-fix ${changes.length} safe findings from scan ${scanId}`;
      execSync3(`git commit -m "${commitMsg}"`, { cwd: this.projectRoot, stdio: "pipe" });
      const commitSha = execSync3("git rev-parse HEAD", { cwd: this.projectRoot, stdio: "pipe" }).toString().trim();
      const insertChange = this.db.prepare(
        "INSERT INTO gc_changes (id, finding_id, commit_sha, file_path, diff_content, rollback_cmd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const change of changes) {
        change.commit_sha = commitSha;
        change.rollback_cmd = `git revert --no-edit ${commitSha}`;
        insertChange.run(change.id, change.finding_id, commitSha, change.file_path, change.diff_content, change.rollback_cmd, now);
      }
      this.db.prepare(
        "UPDATE gc_scans SET auto_fixed_count = ? WHERE id = ?"
      ).run(changes.length, scanId);
    }
    return changes;
  }
  async applyFinding(findingId) {
    this.assertCleanWorkingTree();
    const finding = this.db.prepare(
      "SELECT * FROM gc_findings WHERE id = ?"
    ).get(findingId);
    if (!finding || !finding.suggested_fix || finding.status !== "detected") {
      return null;
    }
    const change = this.applyFixToFile(finding);
    if (!change) return null;
    execSync3("git add -A", { cwd: this.projectRoot, stdio: "pipe" });
    const commitMsg = `chore(gc): fix ${finding.category} in ${finding.file_path}`;
    execSync3(`git commit -m "${commitMsg}"`, { cwd: this.projectRoot, stdio: "pipe" });
    const commitSha = execSync3("git rev-parse HEAD", { cwd: this.projectRoot, stdio: "pipe" }).toString().trim();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    change.commit_sha = commitSha;
    change.rollback_cmd = `git revert --no-edit ${commitSha}`;
    this.db.prepare(
      "INSERT INTO gc_changes (id, finding_id, commit_sha, file_path, diff_content, rollback_cmd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(change.id, change.finding_id, commitSha, change.file_path, change.diff_content, change.rollback_cmd, now);
    this.db.prepare(
      "UPDATE gc_findings SET status = 'approved', resolved_at = ? WHERE id = ?"
    ).run(now, finding.id);
    return change;
  }
  async revertScan(scanId) {
    const changes = this.db.prepare(
      "SELECT DISTINCT commit_sha FROM gc_changes WHERE finding_id IN (SELECT id FROM gc_findings WHERE scan_id = ?) ORDER BY created_at DESC"
    ).all(scanId);
    for (const { commit_sha } of changes) {
      execSync3(`git revert --no-edit ${commit_sha}`, { cwd: this.projectRoot, stdio: "pipe" });
    }
    this.db.prepare(
      "UPDATE gc_findings SET status = 'reverted', resolved_at = ? WHERE scan_id = ? AND status IN ('auto_fixed', 'approved')"
    ).run((/* @__PURE__ */ new Date()).toISOString(), scanId);
  }
  assertCleanWorkingTree() {
    const status = execSync3("git status --porcelain", { cwd: this.projectRoot, stdio: "pipe" }).toString().trim();
    if (status.length > 0) {
      throw new Error("Cannot apply fixes: uncommitted changes exist. Commit or stash them first.");
    }
  }
  applyFixToFile(finding) {
    if (!finding.suggested_fix) return null;
    const filePath = finding.file_path;
    const absPath = filePath.startsWith("/") ? filePath : `${this.projectRoot}/${filePath}`;
    if (!fs8.existsSync(absPath)) return null;
    const originalContent = fs8.readFileSync(absPath, "utf-8");
    const lines = originalContent.split("\n");
    const start = Math.max(0, finding.line_start - 1);
    const end = Math.min(lines.length, finding.line_end);
    const removedLines = lines.slice(start, end).join("\n");
    lines.splice(start, end - start);
    fs8.writeFileSync(absPath, lines.join("\n"), "utf-8");
    return {
      id: generateId(),
      finding_id: finding.id,
      commit_sha: "",
      // filled after git commit
      file_path: finding.file_path,
      diff_content: `--- removed lines ${finding.line_start}-${finding.line_end}:
${removedLines}`,
      rollback_cmd: "",
      // filled after git commit
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async collectFiles(targetPath) {
    const extensions = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".py", ".go", ".rs"]);
    const ignoreDirs = /* @__PURE__ */ new Set(["node_modules", "dist", "build", ".git", ".claude"]);
    const results = [];
    const walk = (dir) => {
      const entries = fs8.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            walk(path6.join(dir, entry.name));
          }
        } else if (extensions.has(path6.extname(entry.name))) {
          results.push(path6.join(dir, entry.name));
        }
      }
    };
    walk(targetPath);
    return results;
  }
};

// src/core/engine/scanners/rule-retro-scanner.ts
var import_picomatch = __toESM(require_picomatch2(), 1);
import * as fs10 from "fs";
import * as path7 from "path";

// src/core/engine/scanners/scanner-utils.ts
import * as fs9 from "fs";
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function searchFileForViolations(filePath, patterns) {
  const results = [];
  let content;
  try {
    content = fs9.readFileSync(filePath, "utf-8");
  } catch {
    return results;
  }
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      if (pattern.test(lines[i])) {
        results.push({ lineStart: i + 1, lineEnd: i + 1, pattern });
      }
    }
  }
  return results;
}

// src/core/engine/scanners/rule-retro-scanner.ts
var RULES_DIR2 = ".claude/rules";
var MAX_MATCHING_FILES_WARNING = 500;
function parseRuleFile(content) {
  const result = {
    ruleId: null,
    appliesWhen: [],
    patterns: []
  };
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const ruleIdMatch = frontmatter.match(/^Rule-ID:\s*(.+)$/m);
    if (ruleIdMatch) {
      result.ruleId = ruleIdMatch[1].trim();
    }
    const appliesWhenMatch = frontmatter.match(/^Applies[-\s]When:\s*(.+)$/im);
    if (appliesWhenMatch) {
      const raw = appliesWhenMatch[1].trim();
      result.appliesWhen = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  const lines = content.split("\n");
  for (const line of lines) {
    const neverDoMatch = line.match(/^NEVER\s+DO:\s*(.+)$/i);
    if (neverDoMatch) {
      const patternStr = neverDoMatch[1].trim();
      try {
        result.patterns.push(new RegExp(escapeRegex(patternStr)));
      } catch {
      }
    }
  }
  return result;
}
function matchesAnyGlob(filePath, globs) {
  if (globs.length === 0) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return globs.some((glob) => (0, import_picomatch.default)(glob)(normalized));
}
var RuleRetroScanner = class {
  name = "RuleRetroScanner";
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  async scan(files) {
    const rulesDir = path7.join(this.projectRoot, RULES_DIR2);
    if (!fs10.existsSync(rulesDir)) {
      return [];
    }
    let ruleFiles;
    try {
      ruleFiles = fs10.readdirSync(rulesDir).filter((f) => f.endsWith(".md")).map((f) => path7.join(rulesDir, f));
    } catch {
      return [];
    }
    if (ruleFiles.length === 0) {
      return [];
    }
    const findings = [];
    const scanId = generateId();
    for (const ruleFile of ruleFiles) {
      let content;
      try {
        content = fs10.readFileSync(ruleFile, "utf-8");
      } catch {
        continue;
      }
      const parsed = parseRuleFile(content);
      if (parsed.appliesWhen.length === 0 || parsed.patterns.length === 0) {
        continue;
      }
      const matchingFiles = files.filter((f) => matchesAnyGlob(f, parsed.appliesWhen));
      if (matchingFiles.length > MAX_MATCHING_FILES_WARNING) {
        console.warn(
          `[RuleRetroScanner] Rule "${parsed.ruleId ?? ruleFile}" matches ${matchingFiles.length} files (>${MAX_MATCHING_FILES_WARNING}). Consider narrowing the Applies-When glob.`
        );
      }
      for (const filePath of matchingFiles) {
        const violations = searchFileForViolations(filePath, parsed.patterns);
        for (const violation of violations) {
          const finding = {
            id: generateId(),
            scan_id: scanId,
            category: "RULE_VIOLATION",
            severity: "medium",
            safety_level: "SAFE",
            file_path: filePath,
            line_start: violation.lineStart,
            line_end: violation.lineEnd,
            rule_source: "SELF_IMPROVE",
            rule_id: parsed.ruleId,
            description: `Rule violation: pattern "${violation.pattern.source}" matched in file`,
            suggested_fix: null,
            status: "detected",
            resolved_at: null
          };
          findings.push(finding);
        }
      }
    }
    return findings;
  }
};

// src/core/engine/scanners/policy-scanner.ts
import * as fs11 from "fs";
import * as path8 from "path";
var POLICY_FILE = "docs/POLICY.md";
function extractPolicyRules(content) {
  const rules = [];
  let ruleCounter = 0;
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!/금지/.test(trimmed)) continue;
    const backtickMatches = trimmed.matchAll(/`([^`]+)`/g);
    for (const match of backtickMatches) {
      const patternStr = match[1].trim();
      if (!patternStr || patternStr.length < 2) continue;
      try {
        const regex = new RegExp(escapeRegex(patternStr));
        ruleCounter++;
        rules.push({
          ruleId: `policy-rule-${ruleCounter}`,
          pattern: regex,
          description: `POLICY.md \uAE08\uC9C0 \uD328\uD134: ${patternStr}`
        });
      } catch {
      }
    }
    const plainMatch = trimmed.match(/금지[^:：]*[:：]\s*([^\s(`（,]+)/);
    if (plainMatch && !trimmed.includes("`")) {
      const patternStr = plainMatch[1].trim().replace(/[.,;]$/, "");
      if (patternStr && patternStr.length >= 2) {
        try {
          const regex = new RegExp(escapeRegex(patternStr));
          ruleCounter++;
          rules.push({
            ruleId: `policy-rule-${ruleCounter}`,
            pattern: regex,
            description: `POLICY.md \uAE08\uC9C0 \uD328\uD134: ${patternStr}`
          });
        } catch {
        }
      }
    }
  }
  const codeBlockRegex = /```[^\n]*\n([\s\S]*?)```/g;
  let codeMatch;
  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    const blockStart = codeMatch.index;
    const preceding = content.slice(Math.max(0, blockStart - 300), blockStart);
    if (!/금지/.test(preceding)) continue;
    const blockContent = codeMatch[1];
    const blockLines = blockContent.split("\n").filter((l) => l.trim().length > 0);
    for (const blockLine of blockLines) {
      const trimmedLine = blockLine.trim();
      if (trimmedLine.length < 2) continue;
      try {
        const regex = new RegExp(escapeRegex(trimmedLine));
        ruleCounter++;
        rules.push({
          ruleId: `policy-rule-${ruleCounter}`,
          pattern: regex,
          description: `POLICY.md \uCF54\uB4DC\uBE14\uB85D \uAE08\uC9C0 \uD328\uD134: ${trimmedLine}`
        });
      } catch {
      }
    }
  }
  return rules;
}
var PolicyScanner = class {
  name = "PolicyScanner";
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  async scan(files) {
    const policyPath = path8.join(this.projectRoot, POLICY_FILE);
    if (!fs11.existsSync(policyPath)) {
      console.warn(`[PolicyScanner] POLICY.md not found at: ${policyPath}`);
      return [];
    }
    let policyContent;
    try {
      policyContent = fs11.readFileSync(policyPath, "utf-8");
    } catch {
      console.warn(`[PolicyScanner] Failed to read POLICY.md at: ${policyPath}`);
      return [];
    }
    const rules = extractPolicyRules(policyContent);
    if (rules.length === 0 || files.length === 0) {
      return [];
    }
    const findings = [];
    for (const filePath of files) {
      const violations = searchFileForViolations(filePath, rules.map((r) => r.pattern));
      for (const violation of violations) {
        const matchedRule = rules.find((r) => r.pattern.test(
          fs11.readFileSync(filePath, "utf-8").split("\n")[violation.lineStart - 1] ?? ""
        ));
        const finding = {
          id: generateId(),
          scan_id: "",
          category: "POLICY_VIOLATION",
          severity: "medium",
          safety_level: "SAFE",
          file_path: filePath,
          line_start: violation.lineStart,
          line_end: violation.lineEnd,
          rule_source: "POLICY",
          rule_id: matchedRule?.ruleId ?? null,
          description: matchedRule?.description ?? "POLICY.md \uADDC\uCE59 \uC704\uBC18",
          suggested_fix: null,
          status: "detected",
          resolved_at: null
        };
        findings.push(finding);
      }
    }
    return findings;
  }
};

// src/core/engine/scanners/dead-code-scanner.ts
import * as fs12 from "fs";
import * as path9 from "path";
var CHUNK_SIZE = 1e4;
var TEST_PATH_PATTERNS = [
  /[/\\]test[/\\]/,
  /[/\\]__tests__[/\\]/,
  /\.test\.[^/\\]+$/,
  /\.spec\.[^/\\]+$/
];
function isTestFile(filePath) {
  return TEST_PATH_PATTERNS.some((p) => p.test(filePath));
}
var DYNAMIC_IMPORT_PATTERNS = [
  /require\s*\(\s*[^'"]/,
  // require(variable)
  /\beval\s*\(/,
  // eval(
  /\bimport\s*\(\s*[^'"]/
  // import(variable) — not a static string
];
function hasDynamicImport(content) {
  return DYNAMIC_IMPORT_PATTERNS.some((p) => p.test(content));
}
function extractExports(content) {
  const results = [];
  let match;
  const exportRegex = /export\s+(?:(?:async|default)\s+)?(?:function\s*\*?\s*|const\s+|let\s+|var\s+|class\s+|type\s+|interface\s+|enum\s+)(\w+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    const name = match[1];
    if (name && name !== "default") {
      const lineNum = content.slice(0, match.index).split("\n").length;
      results.push({ name, line: lineNum });
    }
  }
  const braceRegex = /export\s*\{([^}]+)\}/g;
  while ((match = braceRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    const items = match[1].split(",");
    for (const item of items) {
      const parts = item.trim().split(/\s+as\s+/);
      const exportedName = (parts[parts.length - 1] || "").trim();
      if (exportedName && exportedName !== "default") {
        results.push({ name: exportedName, line: lineNum });
      }
    }
  }
  return results;
}
function buildReferenceSet(allContents) {
  const refs = /* @__PURE__ */ new Set();
  const identifierRegex = /\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  for (const content of allContents) {
    let m;
    while ((m = identifierRegex.exec(content)) !== null) {
      refs.add(m[1]);
    }
  }
  return refs;
}
function extractImports(content) {
  const imports = [];
  let match;
  const regex = /(?:import|export)\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))?\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}
function resolveImportPath(fromFile, importPath) {
  if (importPath.startsWith(".")) {
    const dir = path9.dirname(fromFile);
    let resolved = path9.resolve(dir, importPath);
    resolved = resolved.replace(/\.js$/, "");
    return resolved;
  }
  return null;
}
function detectCircularRefs(files, contentMap) {
  const graph = /* @__PURE__ */ new Map();
  for (const file of files) {
    const content = contentMap.get(file) ?? "";
    const normalizedFile = file.replace(/\.[^/.]+$/, "");
    const deps = /* @__PURE__ */ new Set();
    const imports = extractImports(content);
    for (const imp of imports) {
      const resolved = resolveImportPath(file, imp);
      if (resolved) deps.add(resolved);
    }
    graph.set(normalizedFile, deps);
  }
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  const cycleNodes = /* @__PURE__ */ new Set();
  function dfs(node) {
    if (inStack.has(node)) {
      cycleNodes.add(node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    const deps = graph.get(node) ?? /* @__PURE__ */ new Set();
    for (const dep of deps) {
      if (dfs(dep)) {
        cycleNodes.add(node);
      }
    }
    inStack.delete(node);
    return false;
  }
  for (const node of graph.keys()) {
    dfs(node);
  }
  const cycleFiles = /* @__PURE__ */ new Set();
  for (const file of files) {
    const normalized = file.replace(/\.[^/.]+$/, "");
    if (cycleNodes.has(normalized)) {
      cycleFiles.add(file);
    }
  }
  return cycleFiles;
}
function splitIntoChunks(lines, chunkSize) {
  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize));
  }
  return chunks;
}
var DeadCodeScanner = class {
  name = "DeadCodeScanner";
  async scan(files) {
    if (files.length === 0) return [];
    const findings = [];
    const contentMap = /* @__PURE__ */ new Map();
    for (const file of files) {
      try {
        contentMap.set(file, fs12.readFileSync(file, "utf-8"));
      } catch {
      }
    }
    const circularFiles = detectCircularRefs(files, contentMap);
    for (const file of files) {
      const content = contentMap.get(file);
      if (!content) continue;
      const isTest = isTestFile(file);
      const hasDynamic = hasDynamicImport(content);
      const isCircular = circularFiles.has(file);
      if (hasDynamic) {
        findings.push({
          id: generateId(),
          scan_id: "",
          category: "DEAD_CODE",
          severity: "medium",
          safety_level: "RISKY",
          file_path: file,
          line_start: 1,
          line_end: 1,
          rule_source: "BUILTIN",
          rule_id: null,
          description: "Dynamic import detected (require(variable) or eval()). Module analysis skipped.",
          suggested_fix: "Replace dynamic imports with static imports where possible.",
          status: "detected",
          resolved_at: null
        });
        continue;
      }
      if (isTest) continue;
      if (isCircular) {
        findings.push({
          id: generateId(),
          scan_id: "",
          category: "DEAD_CODE",
          severity: "medium",
          safety_level: "RISKY",
          file_path: file,
          line_start: 1,
          line_end: 1,
          rule_source: "BUILTIN",
          rule_id: null,
          description: "Circular reference detected. Findings are classified as RISKY.",
          suggested_fix: "Refactor to remove circular dependencies.",
          status: "detected",
          resolved_at: null
        });
      }
      const lines = content.split("\n");
      const chunks = lines.length > CHUNK_SIZE ? splitIntoChunks(lines, CHUNK_SIZE) : [lines];
      const allExports = [];
      let chunkOffset = 0;
      for (const chunk of chunks) {
        const chunkContent = chunk.join("\n");
        const chunkExports = extractExports(chunkContent);
        for (const exp of chunkExports) {
          allExports.push({ name: exp.name, line: exp.line + chunkOffset });
        }
        chunkOffset += chunk.length;
      }
      const otherContents = [];
      for (const [f, c] of contentMap.entries()) {
        if (f !== file) otherContents.push(c);
      }
      const otherRefs = buildReferenceSet(otherContents);
      for (const exp of allExports) {
        if (!otherRefs.has(exp.name)) {
          findings.push({
            id: generateId(),
            scan_id: "",
            category: "DEAD_CODE",
            severity: "low",
            safety_level: isCircular ? "RISKY" : "SAFE",
            file_path: file,
            line_start: exp.line,
            line_end: exp.line,
            rule_source: "BUILTIN",
            rule_id: null,
            description: `Unused export: '${exp.name}' is exported but not referenced in other files.`,
            suggested_fix: `Remove or internalize the export of '${exp.name}'.`,
            status: "detected",
            resolved_at: null
          });
        }
      }
    }
    return findings;
  }
};

// src/core/engine/scanners/refactor-scanner.ts
import * as fs13 from "fs";
function readLines(filePath) {
  try {
    return fs13.readFileSync(filePath, "utf-8").split("\n");
  } catch {
    return null;
  }
}
function normalizeForDup(line) {
  const stripped = line.replace(/\/\/.*$/, "");
  return stripped.trim().replace(/\s+/g, " ");
}
function findFunctions(lines) {
  const results = [];
  const funcKeywordRe = /(?:^|\s)function\s+(\w+)\s*\(/;
  const arrowFuncRe = /(?:^|(?:export\s+)?)(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(.*\)\s*(?::\s*\S+\s*)?=>/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const funcMatch = line.match(funcKeywordRe) ?? line.match(arrowFuncRe);
    if (!funcMatch) continue;
    const name = funcMatch[1];
    let braceStart = -1;
    let searchLine = i;
    while (searchLine < Math.min(i + 5, lines.length)) {
      const idx = lines[searchLine].indexOf("{");
      if (idx !== -1) {
        braceStart = searchLine;
        break;
      }
      searchLine++;
    }
    if (braceStart === -1) continue;
    let depth = 0;
    let bodyEnd = -1;
    for (let j = braceStart; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            bodyEnd = j;
            break;
          }
        }
      }
      if (bodyEnd !== -1) break;
    }
    if (bodyEnd === -1) continue;
    results.push({ name, bodyStart: braceStart + 1, bodyEnd: bodyEnd + 1 });
  }
  return results;
}
function computeCC(lines, bodyStart, bodyEnd) {
  const branchPatterns = [
    /\belse\s+if\s*\(/g,
    // else if( — counted once (not as separate if)
    /(?<!else\s)\bif\s*\(/g,
    // if( — plain if only (not else if)
    /\bcase\s+/g,
    // switch case
    /\bfor\s*\(/g,
    // for(
    /\bwhile\s*\(/g,
    // while(
    /\bdo\s*\{/g,
    // do {
    /\bcatch\s*\(/g,
    // catch(
    /&&/g,
    // logical AND
    /\|\|/g,
    // logical OR
    /\?(?![?.])/g
    // ternary ? (not ?. or ??)
  ];
  let count = 1;
  for (let i = bodyStart - 1; i < bodyEnd; i++) {
    const line = lines[i];
    const cleaned = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
    for (const pattern of branchPatterns) {
      const matches = cleaned.match(pattern);
      if (matches) count += matches.length;
    }
  }
  return count;
}
function scanCC(filePath, lines, scanId) {
  const findings = [];
  const functions = findFunctions(lines);
  for (const fn of functions) {
    const cc = computeCC(lines, fn.bodyStart, fn.bodyEnd);
    if (cc < 10) continue;
    const severity = cc >= 15 ? "high" : "medium";
    findings.push({
      id: generateId(),
      scan_id: scanId,
      category: "REFACTOR_CANDIDATE",
      severity,
      safety_level: "SAFE",
      file_path: filePath,
      line_start: fn.bodyStart,
      line_end: fn.bodyEnd,
      rule_source: "BUILTIN",
      rule_id: "high-complexity",
      description: `Function '${fn.name}' has cyclomatic complexity of ${cc} (threshold: 10)`,
      suggested_fix: "Consider breaking this function into smaller, more focused functions.",
      status: "detected",
      resolved_at: null
    });
  }
  return findings;
}
var MIN_DUP_LINES = 10;
function scanDuplication(filePath, lines, scanId) {
  const findings = [];
  const normalized = [];
  for (let i = 0; i < lines.length; i++) {
    const text = normalizeForDup(lines[i]);
    if (text.length === 0) continue;
    normalized.push({ original: i + 1, text });
  }
  const n = normalized.length;
  if (n < MIN_DUP_LINES * 2) return findings;
  const reported = /* @__PURE__ */ new Set();
  for (let i = 0; i <= n - MIN_DUP_LINES; i++) {
    if (reported.has(i)) continue;
    for (let j = i + MIN_DUP_LINES; j <= n - MIN_DUP_LINES; j++) {
      if (reported.has(j)) continue;
      let matchLen = 0;
      while (i + matchLen < n && j + matchLen < n && normalized[i + matchLen].text === normalized[j + matchLen].text) {
        matchLen++;
      }
      if (matchLen >= MIN_DUP_LINES) {
        if (!reported.has(j)) {
          const lineStart = normalized[j].original;
          const lineEnd = normalized[j + matchLen - 1].original;
          const firstLineStart = normalized[i].original;
          const firstLineEnd = normalized[i + matchLen - 1].original;
          findings.push({
            id: generateId(),
            scan_id: scanId,
            category: "REFACTOR_CANDIDATE",
            severity: "medium",
            safety_level: "SAFE",
            file_path: filePath,
            line_start: lineStart,
            line_end: lineEnd,
            rule_source: "BUILTIN",
            rule_id: "code-duplication",
            description: `Duplicate code block (${matchLen} lines) also appears at lines ${firstLineStart}-${firstLineEnd}`,
            suggested_fix: "Extract the duplicated logic into a shared function.",
            status: "detected",
            resolved_at: null
          });
          reported.add(j);
        }
        break;
      }
    }
  }
  return findings;
}
var MAX_FUNCTION_LINES = 100;
function scanFunctionLength(filePath, lines, scanId) {
  const findings = [];
  const functions = findFunctions(lines);
  for (const fn of functions) {
    const length = fn.bodyEnd - fn.bodyStart + 1;
    if (length <= MAX_FUNCTION_LINES) continue;
    findings.push({
      id: generateId(),
      scan_id: scanId,
      category: "REFACTOR_CANDIDATE",
      severity: "medium",
      safety_level: "SAFE",
      file_path: filePath,
      line_start: fn.bodyStart,
      line_end: fn.bodyEnd,
      rule_source: "BUILTIN",
      rule_id: "long-function",
      description: `Function '${fn.name}' is ${length} lines long (threshold: ${MAX_FUNCTION_LINES})`,
      suggested_fix: "Break this function into smaller, more focused functions.",
      status: "detected",
      resolved_at: null
    });
  }
  return findings;
}
var MAX_NESTING_DEPTH = 5;
function scanNestingDepth(filePath, lines, scanId) {
  const findings = [];
  const functions = findFunctions(lines);
  const reported = /* @__PURE__ */ new Set();
  for (const fn of functions) {
    let depth = 0;
    let violationStart = -1;
    let violationEnd = -1;
    for (let i = fn.bodyStart - 1; i < fn.bodyEnd; i++) {
      const line = lines[i];
      const cleaned = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
      for (const ch of cleaned) {
        if (ch === "{") {
          depth++;
          if (depth >= MAX_NESTING_DEPTH) {
            if (violationStart === -1) {
              violationStart = i + 1;
            }
            violationEnd = i + 1;
          }
        } else if (ch === "}") {
          depth--;
        }
      }
    }
    if (violationStart !== -1) {
      const key = `${filePath}:${fn.name}`;
      if (!reported.has(key)) {
        reported.add(key);
        findings.push({
          id: generateId(),
          scan_id: scanId,
          category: "REFACTOR_CANDIDATE",
          severity: "medium",
          safety_level: "SAFE",
          file_path: filePath,
          line_start: violationStart,
          line_end: violationEnd,
          rule_source: "BUILTIN",
          rule_id: "deep-nesting",
          description: `Function '${fn.name}' has nesting depth >= ${MAX_NESTING_DEPTH}`,
          suggested_fix: "Reduce nesting by extracting logic into helper functions or using early returns.",
          status: "detected",
          resolved_at: null
        });
      }
    }
  }
  return findings;
}
var RefactorScanner = class {
  name = "RefactorScanner";
  async scan(files) {
    if (files.length === 0) return [];
    const scanId = generateId();
    const findings = [];
    for (const filePath of files) {
      const lines = readLines(filePath);
      if (lines === null) continue;
      findings.push(...scanCC(filePath, lines, scanId));
      findings.push(...scanDuplication(filePath, lines, scanId));
      findings.push(...scanFunctionLength(filePath, lines, scanId));
      findings.push(...scanNestingDepth(filePath, lines, scanId));
    }
    return findings;
  }
};

// src/cli/commands/gc.ts
function getGCEngine() {
  const db = initDb();
  const root = findProjectRoot(process.cwd());
  const engine = new GCEngine(db, root);
  engine.registerScanner(new RuleRetroScanner(root));
  engine.registerScanner(new PolicyScanner(root));
  engine.registerScanner(new DeadCodeScanner());
  engine.registerScanner(new RefactorScanner());
  return engine;
}
function registerGCCommands(program2, _getModels) {
  const gc = program2.command("gc").description("Garbage Collection \u2014 codebase quality scanner");
  gc.command("scan").option("--full", "Full scan (default)").option("--incremental", "Incremental scan (changed files only)").option("--path <dir>", "Target directory").description("Run GC scan on codebase").action(async (opts) => {
    try {
      const engine = getGCEngine();
      const scanType = opts.incremental ? "incremental" : "full";
      const result = await engine.scan({ scan_type: scanType, path: opts.path });
      output(result, [
        `\u2705 GC Scan completed (${result.scan_type})`,
        `   Files scanned: ${result.files_scanned}`,
        `   Findings: ${result.findings_count}`,
        `   Scan ID: ${result.id}`
      ].join("\n"));
    } catch (e) {
      outputError(e instanceof Error ? e.message : String(e));
    }
  });
  gc.command("report").option("--severity <level>", "Minimum severity (critical, high, medium, low)", "high").option("--format <fmt>", "Output format (json, md)", "md").option("--scan-id <id>", "Specific scan ID (default: latest)").description("Show GC scan results").action((opts) => {
    const engine = getGCEngine();
    let scanId = opts.scanId;
    if (!scanId) {
      const scans = engine.listScans();
      if (scans.length === 0) {
        outputError("No scans found. Run `vs gc scan` first.");
      }
      scanId = scans[0].id;
    }
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const minLevel = severityOrder[opts.severity] ?? 1;
    const allFindings = engine.getFindings(scanId);
    const filtered = allFindings.filter((f) => (severityOrder[f.severity] ?? 3) <= minLevel);
    if (opts.format === "json") {
      output(filtered);
      return;
    }
    const lines = [`## GC Report \u2014 Scan ${scanId}`, `Findings: ${filtered.length} (${opts.severity}+ severity)`, ""];
    const byCategory = {};
    for (const f of filtered) {
      (byCategory[f.category] ??= []).push(f);
    }
    for (const [cat, findings] of Object.entries(byCategory)) {
      lines.push(`### ${cat} (${findings.length})`);
      for (const f of findings) {
        lines.push(`- [${f.severity}] ${f.file_path}:${f.line_start} \u2014 ${f.description} (${f.safety_level})`);
      }
      lines.push("");
    }
    output(filtered, lines.join("\n"));
  });
  gc.command("apply").option("--auto-only", "Apply only SAFE fixes").option("--all", "Apply all fixes (requires approval for RISKY)").option("--dry-run", "Show what would be changed without applying").option("--scan-id <id>", "Specific scan ID (default: latest)").description("Apply GC fixes").action(async (opts) => {
    try {
      const engine = getGCEngine();
      let scanId = opts.scanId;
      if (!scanId) {
        const scans = engine.listScans();
        if (scans.length === 0) {
          outputError("No scans found. Run `vs gc scan` first.");
        }
        scanId = scans[0].id;
      }
      if (opts.dryRun) {
        const findings = engine.getFindings(scanId);
        const safe = findings.filter((f) => f.safety_level === "SAFE" && f.suggested_fix && f.status === "detected");
        output(safe, [
          `\u{1F50D} Dry run \u2014 ${safe.length} SAFE fixes would be applied:`,
          ...safe.map((f) => `  - ${f.file_path}:${f.line_start} \u2014 ${f.description}`)
        ].join("\n"));
        return;
      }
      const changes = await engine.applySafeFixes(scanId);
      output(changes, [
        `\u2705 Applied ${changes.length} safe fixes`,
        ...changes.map((c) => `  - ${c.file_path}`)
      ].join("\n"));
    } catch (e) {
      outputError(e instanceof Error ? e.message : String(e));
    }
  });
  gc.command("history").description("Show GC scan history").action(() => {
    const engine = getGCEngine();
    const scans = engine.listScans();
    if (scans.length === 0) {
      output([], "No GC scans found.");
      return;
    }
    const lines = ["## GC Scan History", ""];
    for (const s of scans) {
      lines.push(`- ${s.id} | ${s.scan_type} | ${s.status} | findings: ${s.findings_count} | fixed: ${s.auto_fixed_count} | ${s.started_at}`);
    }
    output(scans, lines.join("\n"));
  });
  gc.command("revert").argument("<scan_id>", "Scan ID to revert").description("Revert all changes from a GC scan").action(async (scanId) => {
    try {
      const engine = getGCEngine();
      await engine.revertScan(scanId);
      output({ reverted: scanId }, `\u2705 Reverted scan ${scanId}`);
    } catch (e) {
      outputError(e instanceof Error ? e.message : String(e));
    }
  });
}

// src/cli/index.ts
var require3 = createRequire2(import.meta.url);
var pkg = require3("../../package.json");
var program = new Command();
program.name("vp").description("VibeSpec CLI").version(pkg.version).option("--json", "Output in JSON format").option("--verbose", "Show detailed error output").hook("preAction", () => {
  setJsonMode(program.opts().json === true);
  setVerboseMode(program.opts().verbose === true);
});
program.command("dashboard").description("Show all active plans overview").action(() => {
  const { dashboard, alerts } = initModels();
  const overview = dashboard.getOverview();
  const alertList = alerts.getAlerts();
  const skillUsage = dashboard.getSkillUsageSummary(7);
  const dashboardText = formatDashboard(overview, alertList);
  const skillText = formatSkillUsage(skillUsage);
  const combined = skillText ? `${dashboardText}

${skillText}` : dashboardText;
  output({ overview, alerts: alertList, skill_usage: skillUsage }, combined);
});
registerPlanningCommands(program, initModels);
registerAuxiliaryCommands(program, initModels);
registerGovernanceCommands(program, initModels);
registerKnowledgeCommands(program, initModels);
registerQualityCommands(program, initModels);
registerGenerationCommands(program, initModels);
registerCodexCommands(program, initModels);
registerBacklogCommands(program, initModels);
registerGCCommands(program, initModels);
program.parse();
//# sourceMappingURL=index.js.map