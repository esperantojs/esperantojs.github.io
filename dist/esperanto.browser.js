/*
	esperanto.js v0.6.24 - 2015-03-30
	http://esperantojs.org

	Released under the MIT License.
*/

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('acorn')) :
	typeof define === 'function' && define.amd ? define(['acorn'], factory) :
	global.esperanto = factory(global.acorn)
}(this, function (acorn) { 'use strict';

	var hasOwnProp = Object.prototype.hasOwnProperty;
	var utils_hasOwnProp = hasOwnProp;

	function hasNamedImports ( mod ) {
		var i = mod.imports.length;

		while ( i-- ) {
			if ( mod.imports[i].isNamed ) {
				return true;
			}
		}
	}

	function hasNamedExports ( mod ) {
		var i = mod.exports.length;

		while ( i-- ) {
			if ( !mod.exports[i].isDefault ) {
				return true;
			}
		}
	}

	var _btoa;

	if ( typeof window !== 'undefined' && typeof window.btoa === 'function' ) {
		_btoa = window.btoa;
	} else if ( typeof Buffer === 'function' ) {
		_btoa = function ( str ) {
			return new Buffer( str ).toString( 'base64' );
		};
	} else {
		throw new Error( 'Unsupported environment: `window.btoa` or `Buffer` should be supported.' );
	}

	var btoa = _btoa;

	var SourceMap = function ( properties ) {
		this.version = 3;

		this.file           = properties.file;
		this.sources        = properties.sources;
		this.sourcesContent = properties.sourcesContent;
		this.names          = properties.names;
		this.mappings       = properties.mappings;
	};

	SourceMap.prototype = {
		toString: function () {
			return JSON.stringify( this );
		},

		toUrl: function () {
			return 'data:application/json;charset=utf-8;base64,' + btoa( this.toString() );
		}
	};

	var src_SourceMap = SourceMap;

	function utils_getRelativePath__getRelativePath ( from, to ) {
		var fromParts, toParts, i;

		fromParts = from.split( /[\/\\]/ );
		toParts = to.split( /[\/\\]/ );

		fromParts.pop(); // get dirname

		while ( fromParts[0] === toParts[0] ) {
			fromParts.shift();
			toParts.shift();
		}

		if ( fromParts.length ) {
			i = fromParts.length;
			while ( i-- ) fromParts[i] = '..';
		}

		return fromParts.concat( toParts ).join( '/' );
	}

	var Bundle = function ( options ) {
		options = options || {};

		this.intro = options.intro || '';
		this.outro = options.outro || '';
		this.separator = 'separator' in options ? options.separator : '\n';

		this.sources = [];
	};

	Bundle.prototype = {
		addSource: function ( source ) {
			if ( typeof source !== 'object' || !source.content ) {
				throw new Error( 'bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`' );
			}

			this.sources.push( source );
			return this;
		},

		append: function ( str ) {
			this.outro += str;
			return this;
		},

		clone: function () {
			var bundle = new Bundle({
				intro: this.intro,
				outro: this.outro,
				separator: this.separator
			});

			this.sources.forEach( function ( source ) {
				bundle.addSource({
					filename: source.filename,
					content: source.content.clone()
				});
			});

			return bundle;
		},

		generateMap: function ( options ) {
			var offsets = {}, encoded, encodingSeparator;

			encodingSeparator = getSemis( this.separator );

			encoded = (
				getSemis( this.intro ) +
				this.sources.map( function ( source, sourceIndex) {
					return source.content.getMappings( options.hires, sourceIndex, offsets );
				}).join( encodingSeparator ) +
				getSemis( this.outro )
			);

			return new src_SourceMap({
				file: options.file.split( /[\/\\]/ ).pop(),
				sources: this.sources.map( function ( source ) {
					return utils_getRelativePath__getRelativePath( options.file, source.filename );
				}),
				sourcesContent: this.sources.map( function ( source ) {
					return options.includeContent ? source.content.original : null;
				}),
				names: [],
				mappings: encoded
			});
		},

		getIndentString: function () {
			var indentStringCounts = {};

			this.sources.forEach( function ( source ) {
				var indentStr = source.content.indentStr;

				if ( indentStr === null ) return;

				if ( !indentStringCounts[ indentStr ] ) indentStringCounts[ indentStr ] = 0;
				indentStringCounts[ indentStr ] += 1;
			});

			return ( Object.keys( indentStringCounts ).sort( function ( a, b ) {
				return indentStringCounts[a] - indentStringCounts[b];
			})[0] ) || '\t';
		},

		indent: function ( indentStr ) {
			if ( !indentStr ) {
				indentStr = this.getIndentString();
			}

			this.sources.forEach( function ( source ) {
				source.content.indent( indentStr, { exclude: source.indentExclusionRanges });
			});

			this.intro = this.intro.replace( /^[^\n]/gm, indentStr + '$&' );
			this.outro = this.outro.replace( /^[^\n]/gm, indentStr + '$&' );

			return this;
		},

		prepend: function ( str ) {
			this.intro = str + this.intro;
			return this;
		},

		toString: function () {
			return this.intro + this.sources.map( stringify ).join( this.separator ) + this.outro;
		},

		trimLines: function () {
			return this.trim('[\\r\\n]');
		},

		trim: function (charType) {
			return this.trimStart(charType).trimEnd(charType);
		},

		trimStart: function (charType) {
			var rx = new RegExp('^' + (charType || '\\s') + '+');
			this.intro = this.intro.replace( rx, '' );

			if ( !this.intro ) {
				var source;
				var i = 0;
				do {
					source = this.sources[i];

					if ( !source ) {
						this.outro = this.outro.replace( rx, '' );
						break;
					}

					source.content.trimStart();
					i += 1;
				} while ( source.content.str === '' );
			}

			return this;
		},

		trimEnd: function(charType) {
			var rx = new RegExp((charType || '\\s') + '+$');
			this.outro = this.outro.replace( rx, '' );

			if ( !this.outro ) {
				var source;
				var i = this.sources.length - 1;
				do {
					source = this.sources[i];

					if ( !source ) {
						this.intro = this.intro.replace( rx, '' );
						break;
					}

					source.content.trimEnd(charType);
					i -= 1;
				} while ( source.content.str === '' );
			}

			return this;
		}
	};

	var src_Bundle = Bundle;

	function stringify ( source ) {
		return source.content.toString();
	}

	function getSemis ( str ) {
		return new Array( str.split( '\n' ).length ).join( ';' );
	}

	function guessIndent ( code ) {
		var lines, tabbed, spaced, min;

		lines = code.split( '\n' );

		tabbed = lines.filter( function ( line ) {
			return /^\t+/.test( line );
		});

		spaced = lines.filter( function ( line ) {
			return /^ {2,}/.test( line );
		});

		if ( tabbed.length === 0 && spaced.length === 0 ) {
			return null;
		}

		// More lines tabbed than spaced? Assume tabs, and
		// default to tabs in the case of a tie (or nothing
		// to go on)
		if ( tabbed.length >= spaced.length ) {
			return '\t';
		}

		// Otherwise, we need to guess the multiple
		min = spaced.reduce( function ( previous, current ) {
			var numSpaces = /^ +/.exec( current )[0].length;
			return Math.min( numSpaces, previous );
		}, Infinity );

		return new Array( min + 1 ).join( ' ' );
	}

	var charToInteger = {};
	var integerToChar = {};

	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split( '' ).forEach( function ( char, i ) {
		charToInteger[ char ] = i;
		integerToChar[ i ] = char;
	});

	function decode ( string ) {
		var result = [],
			len = string.length,
			i,
			hasContinuationBit,
			shift = 0,
			value = 0,
			integer,
			shouldNegate;

		for ( i = 0; i < len; i += 1 ) {
			integer = charToInteger[ string[i] ];

			if ( integer === undefined ) {
				throw new Error( 'Invalid character (' + string[i] + ')' );
			}

			hasContinuationBit = integer & 32;

			integer &= 31;
			value += integer << shift;

			if ( hasContinuationBit ) {
				shift += 5;
			} else {
				shouldNegate = value & 1;
				value >>= 1;

				result.push( shouldNegate ? -value : value );

				// reset
				value = shift = 0;
			}
		}

		return result;
	}

	function encode ( value ) {
		var result, i;

		if ( typeof value === 'number' ) {
			result = encodeInteger( value );
		} else {
			result = '';
			for ( i = 0; i < value.length; i += 1 ) {
				result += encodeInteger( value[i] );
			}
		}

		return result;
	}

	function encodeInteger ( num ) {
		var result = '', clamped;

		if ( num < 0 ) {
			num = ( -num << 1 ) | 1;
		} else {
			num <<= 1;
		}

		do {
			clamped = num & 31;
			num >>= 5;

			if ( num > 0 ) {
				clamped |= 32;
			}

			result += integerToChar[ clamped ];
		} while ( num > 0 );

		return result;
	}

	var utils_encode = encode;

	function encodeMappings ( original, str, mappings, hires, sourcemapLocations, sourceIndex, offsets ) {
		var lineStart,
			locations,
			lines,
			encoded,
			inverseMappings,
			charOffset = 0,
			firstSegment = true;

		// store locations, for fast lookup
		lineStart = 0;
		locations = original.split( '\n' ).map( function ( line ) {
			var start = lineStart;
			lineStart += line.length + 1; // +1 for the newline

			return start;
		});

		inverseMappings = invert( str, mappings );

		lines = str.split( '\n' ).map( function ( line ) {
			var segments, len, char, origin, lastOrigin, i, location;

			segments = [];

			len = line.length;
			for ( i = 0; i < len; i += 1 ) {
				char = i + charOffset;
				origin = inverseMappings[ char ];

				if ( !~origin ) {
					if ( !~lastOrigin ) {
						// do nothing
					} else {
						segments.push({
							generatedCodeColumn: i,
							sourceIndex: sourceIndex,
							sourceCodeLine: 0,
							sourceCodeColumn: 0
						});
					}
				}

				else {
					if ( !hires && ( origin === lastOrigin + 1 ) && !sourcemapLocations[ origin ] ) {
						// do nothing
					} else {
						location = getLocation( locations, origin );

						segments.push({
							generatedCodeColumn: i,
							sourceIndex: sourceIndex,
							sourceCodeLine: location.line,
							sourceCodeColumn: location.column
						});
					}
				}

				lastOrigin = origin;
			}

			charOffset += line.length + 1;
			return segments;
		});

		offsets = offsets || {};

		offsets.sourceIndex = offsets.sourceIndex || 0;
		offsets.sourceCodeLine = offsets.sourceCodeLine || 0;
		offsets.sourceCodeColumn = offsets.sourceCodeColumn || 0;

		encoded = lines.map( function ( segments ) {
			var generatedCodeColumn = 0;

			return segments.map( function ( segment ) {
				var arr = [
					segment.generatedCodeColumn - generatedCodeColumn,
					segment.sourceIndex - offsets.sourceIndex,
					segment.sourceCodeLine - offsets.sourceCodeLine,
					segment.sourceCodeColumn - offsets.sourceCodeColumn
				];

				generatedCodeColumn = segment.generatedCodeColumn;
				offsets.sourceIndex = segment.sourceIndex;
				offsets.sourceCodeLine = segment.sourceCodeLine;
				offsets.sourceCodeColumn = segment.sourceCodeColumn;

				firstSegment = false;

				return utils_encode( arr );
			}).join( ',' );
		}).join( ';' );

		return encoded;
	}


	function invert ( str, mappings ) {
		var inverted = new Uint32Array( str.length ), i;

		// initialise everything to -1
		i = str.length;
		while ( i-- ) {
			inverted[i] = -1;
		}

		// then apply the actual mappings
		i = mappings.length;
		while ( i-- ) {
			if ( ~mappings[i] ) {
				inverted[ mappings[i] ] = i;
			}
		}

		return inverted;
	}

	function getLocation ( locations, char ) {
		var i;

		i = locations.length;
		while ( i-- ) {
			if ( locations[i] <= char ) {
				return {
					line: i,
					column: char - locations[i]
				};
			}
		}

		throw new Error( 'Character out of bounds' );
	}

	var MagicString = function ( string ) {
		this.original = this.str = string;
		this.mappings = initMappings( string.length );

		this.sourcemapLocations = {};

		this.indentStr = guessIndent( string );
	};

	MagicString.prototype = {
		addSourcemapLocation: function ( char ) {
			this.sourcemapLocations[ char ] = true;
		},

		append: function ( content ) {
			if ( typeof content !== 'string' ) {
				throw new TypeError( 'appended content must be a string' );
			}

			this.str += content;
			return this;
		},

		clone: function () {
			var clone, i;

			clone = new MagicString( this.original );
			clone.str = this.str;

			i = clone.mappings.length;
			while ( i-- ) {
				clone.mappings[i] = this.mappings[i];
			}

			return clone;
		},

		generateMap: function ( options ) {
			options = options || {};

			return new src_SourceMap({
				file: ( options.file ? options.file.split( '/' ).pop() : null ),
				sources: [ options.source ? utils_getRelativePath__getRelativePath( options.file || '', options.source ) : null ],
				sourcesContent: options.includeContent ? [ this.original ] : [ null ],
				names: [],
				mappings: this.getMappings( options.hires, 0 )
			});
		},

		getIndentString: function () {
			return this.indentStr === null ? '\t' : this.indentStr;
		},

		getMappings: function ( hires, sourceIndex, offsets ) {
			return encodeMappings( this.original, this.str, this.mappings, hires, this.sourcemapLocations, sourceIndex, offsets );
		},

		indent: function ( indentStr, options ) {
			var self = this,
				mappings = this.mappings,
				reverseMappings = reverse( mappings, this.str.length ),
				pattern = /^[^\r\n]/gm,
				match,
				inserts = [],
				adjustments,
				exclusions,
				lastEnd,
				i;

			if ( typeof indentStr === 'object' ) {
				options = indentStr;
				indentStr = undefined;
			}

			indentStr = indentStr !== undefined ? indentStr : ( this.indentStr || '\t' );

			options = options || {};

			// Process exclusion ranges
			if ( options.exclude ) {
				exclusions = typeof options.exclude[0] === 'number' ? [ options.exclude ] : options.exclude;

				exclusions = exclusions.map( function ( range ) {
					var rangeStart, rangeEnd;

					rangeStart = self.locate( range[0] );
					rangeEnd = self.locate( range[1] );

					if ( rangeStart === null || rangeEnd === null ) {
						throw new Error( 'Cannot use indices of replaced characters as exclusion ranges' );
					}

					return [ rangeStart, rangeEnd ];
				});

				exclusions.sort( function ( a, b ) {
					return a[0] - b[0];
				});

				// check for overlaps
				lastEnd = -1;
				exclusions.forEach( function ( range ) {
					if ( range[0] < lastEnd ) {
						throw new Error( 'Exclusion ranges cannot overlap' );
					}

					lastEnd = range[1];
				});
			}

			if ( !exclusions ) {
				while ( match = pattern.exec( this.str ) ) {
					inserts.push( match.index );
				}

				this.str = this.str.replace( pattern, indentStr + '$&' );
			} else {
				while ( match = pattern.exec( this.str ) ) {
					if ( !isExcluded( match.index - 1 ) ) {
						inserts.push( match.index );
					}
				}

				this.str = this.str.replace( pattern, function ( match, index ) {
					return isExcluded( index - 1 ) ? match : indentStr + match;
				});
			}

			adjustments = inserts.map( function ( index ) {
				var origin;

				do {
					origin = reverseMappings[ index++ ];
				} while ( !~origin && index < self.str.length );

				return origin;
			});

			i = adjustments.length;
			lastEnd = this.mappings.length;
			while ( i-- ) {
				adjust( self.mappings, adjustments[i], lastEnd, ( ( i + 1 ) * indentStr.length ) );
				lastEnd = adjustments[i];
			}

			return this;

			function isExcluded ( index ) {
				var i = exclusions.length, range;

				while ( i-- ) {
					range = exclusions[i];

					if ( range[1] < index ) {
						return false;
					}

					if ( range[0] <= index ) {
						return true;
					}
				}
			}
		},

		insert: function ( index, content ) {
			if ( typeof content !== 'string' ) {
				throw new TypeError( 'inserted content must be a string' );
			}

			if ( index === 0 ) {
				this.prepend( content );
			} else if ( index === this.original.length ) {
				this.append( content );
			} else {
				var mapped = this.locate(index);

				if ( mapped === null ) {
					throw new Error( 'Cannot insert at replaced character index: ' + index );
				}

				this.str = this.str.substr( 0, mapped ) + content + this.str.substr( mapped );
				adjust( this.mappings, index, this.mappings.length, content.length );
			}

			return this;
		},

		// get current location of character in original string
		locate: function ( character ) {
			var loc;

			if ( character < 0 || character > this.mappings.length ) {
				throw new Error( 'Character is out of bounds' );
			}

			loc = this.mappings[ character ];
			return ~loc ? loc : null;
		},

		locateOrigin: function ( character ) {
			var i;

			if ( character < 0 || character >= this.str.length ) {
				throw new Error( 'Character is out of bounds' );
			}

			i = this.mappings.length;
			while ( i-- ) {
				if ( this.mappings[i] === character ) {
					return i;
				}
			}

			return null;
		},

		prepend: function ( content ) {
			this.str = content + this.str;
			adjust( this.mappings, 0, this.mappings.length, content.length );
			return this;
		},

		remove: function ( start, end ) {
			var loc, d, i, currentStart, currentEnd;

			if ( start < 0 || end > this.mappings.length ) {
				throw new Error( 'Character is out of bounds' );
			}

			d = 0;
			currentStart = -1;
			currentEnd = -1;
			for ( i = start; i < end; i += 1 ) {
				loc = this.mappings[i];

				if ( loc !== -1 ) {
					if ( !~currentStart ) {
						currentStart = loc;
					}

					currentEnd = loc + 1;

					this.mappings[i] = -1;
					d += 1;
				}
			}

			this.str = this.str.slice( 0, currentStart ) + this.str.slice( currentEnd );

			adjust( this.mappings, end, this.mappings.length, -d );
			return this;
		},

		replace: function ( start, end, content ) {
			if ( typeof content !== 'string' ) {
				throw new TypeError( 'replacement content must be a string' );
			}

			var firstChar, lastChar, d;

			firstChar = this.locate( start );
			lastChar = this.locate( end - 1 );

			if ( firstChar === null || lastChar === null ) {
				throw new Error( 'Cannot replace the same content twice' );
			}

			if ( firstChar > lastChar + 1 ) {
				throw new Error(
					'BUG! First character mapped to a position after the last character: ' +
					'[' + start + ', ' + end + '] -> [' + firstChar + ', ' + ( lastChar + 1 ) + ']'
				);
			}

			this.str = this.str.substr( 0, firstChar ) + content + this.str.substring( lastChar + 1 );

			d = content.length - ( lastChar + 1 - firstChar );

			blank( this.mappings, start, end );
			adjust( this.mappings, end, this.mappings.length, d );
			return this;
		},

		slice: function ( start, end ) {
			var firstChar, lastChar;

			firstChar = this.locate( start );
			lastChar = this.locate( end - 1 ) + 1;

			if ( firstChar === null || lastChar === null ) {
				throw new Error( 'Cannot use replaced characters as slice anchors' );
			}

			return this.str.slice( firstChar, lastChar );
		},

		toString: function () {
			return this.str;
		},

		trimLines: function() {
			return this.trim('[\\r\\n]');
		},

		trim: function (charType) {
			return this.trimStart(charType).trimEnd(charType);
		},

		trimEnd: function (charType) {
			var self = this;
			var rx = new RegExp((charType || '\\s') + '+$');

			this.str = this.str.replace( rx, function ( trailing, index, str ) {
				var strLength = str.length,
					length = trailing.length,
					i,
					chars = [];

				i = strLength;
				while ( i-- > strLength - length ) {
					chars.push( self.locateOrigin( i ) );
				}

				i = chars.length;
				while ( i-- ) {
					if ( chars[i] !== null ) {
						self.mappings[ chars[i] ] = -1;
					}
				}

				return '';
			});

			return this;
		},

		trimStart: function (charType) {
			var self = this;
			var rx = new RegExp('^' + (charType || '\\s') + '+');

			this.str = this.str.replace( rx, function ( leading ) {
				var length = leading.length, i, chars = [], adjustmentStart = 0;

				i = length;
				while ( i-- ) {
					chars.push( self.locateOrigin( i ) );
				}

				i = chars.length;
				while ( i-- ) {
					if ( chars[i] !== null ) {
						self.mappings[ chars[i] ] = -1;
						adjustmentStart += 1;
					}
				}

				adjust( self.mappings, adjustmentStart, self.mappings.length, -length );

				return '';
			});

			return this;
		}
	};

	MagicString.Bundle = src_Bundle;

	function adjust ( mappings, start, end, d ) {
		var i = end;

		if ( !d ) return; // replacement is same length as replaced string

		while ( i-- > start ) {
			if ( ~mappings[i] ) {
				mappings[i] += d;
			}
		}
	}

	function initMappings ( i ) {
		var mappings = new Uint32Array( i );

		while ( i-- ) {
			mappings[i] = i;
		}

		return mappings;
	}

	function blank ( mappings, start, i ) {
		while ( i-- > start ) {
			mappings[i] = -1;
		}
	}

	function reverse ( mappings, i ) {
		var result, location;

		result = new Uint32Array( i );

		while ( i-- ) {
			result[i] = -1;
		}

		i = mappings.length;
		while ( i-- ) {
			location = mappings[i];

			if ( ~location ) {
				result[ location ] = i;
			}
		}

		return result;
	}

	var magic_string = MagicString;

	function walk ( ast, leave) {var enter = leave.enter, leave = leave.leave;
		visit( ast, null, enter, leave );
	}

	var ast_walk__context = {
		skip: function()  {return ast_walk__context.shouldSkip = true}
	};

	var ast_walk__childKeys = {};

	var ast_walk__toString = Object.prototype.toString;

	function isArray ( thing ) {
		return ast_walk__toString.call( thing ) === '[object Array]';
	}

	function visit ( node, parent, enter, leave ) {
		if ( enter ) {
			ast_walk__context.shouldSkip = false;
			enter.call( ast_walk__context, node, parent );
			if ( ast_walk__context.shouldSkip ) return;
		}

		var keys = ast_walk__childKeys[ node.type ] || (
			ast_walk__childKeys[ node.type ] = Object.keys( node ).filter( function(key ) {return typeof node[ key ] === 'object'} )
		);

		var key, value, i, j;

		i = keys.length;
		while ( i-- ) {
			key = keys[i];
			value = node[ key ];

			if ( isArray( value ) ) {
				j = value.length;
				while ( j-- ) {
					visit( value[j], node, enter, leave );
				}
			}

			else if ( value && value.type ) {
				visit( value, node, enter, leave );
			}
		}

		if ( leave ) {
			leave( node, parent );
		}
	}

	function getId ( m ) {
		return m.id;
	}

	function getName ( m ) {
		return m.name;
	}

	function quote ( str ) {
		return "'" + JSON.stringify(str).slice(1, -1).replace(/'/g, "\\'") + "'";
	}

	function req ( path ) {
		return (("require(" + (quote(path))) + ")");
	}

	function globalify ( name ) {
	  	if ( /^__dep\d+__$/.test( name ) ) {
			return 'undefined';
		} else {
			return ("global." + name);
		}
	}

	/*
		This module traverse a module's AST, attaching scope information
		to nodes as it goes, which is later used to determine which
		identifiers need to be rewritten to avoid collisions
	*/

	function Scope ( options ) {
		options = options || {};

		this.parent = options.parent;
		this.names = options.params || [];
	}

	Scope.prototype = {
		add: function ( name ) {
			this.names.push( name );
		},

		contains: function ( name, ignoreTopLevel ) {
			if ( ignoreTopLevel && !this.parent ) {
				return false;
			}

			if ( ~this.names.indexOf( name ) ) {
				return true;
			}

			if ( this.parent ) {
				return this.parent.contains( name, ignoreTopLevel );
			}

			return false;
		}
	};

	function annotateAst ( ast ) {
		var scope = new Scope();
		var blockScope = new Scope();
		var declared = {};
		var topLevelFunctionNames = [];
		var templateLiteralRanges = [];

		var envDepth = 0;

		walk( ast, {
			enter: function ( node ) {
				if ( node.type === 'ImportDeclaration' || node.type === 'ExportSpecifier' ) {
					node._skip = true;
				}

				if ( node._skip ) {
					return this.skip();
				}

				switch ( node.type ) {
					case 'FunctionExpression':
					case 'FunctionDeclaration':

						envDepth += 1;

						// fallthrough

					case 'ArrowFunctionExpression':
						if ( node.id ) {
							addToScope( node );

							// If this is the root scope, this may need to be
							// exported early, so we make a note of it
							if ( !scope.parent && node.type === 'FunctionDeclaration' ) {
								topLevelFunctionNames.push( node.id.name );
							}
						}

						var names = node.params.map( getName );

						names.forEach( function(name ) {return declared[ name ] = true} );

						scope = node._scope = new Scope({
							parent: scope,
							params: names // TODO rest params?
						});

						break;

					case 'BlockStatement':
						blockScope = node._blockScope = new Scope({
							parent: blockScope
						});

						break;

					case 'VariableDeclaration':
						node.declarations.forEach( node.kind === 'let' ? addToBlockScope : addToScope );
						break;

					case 'ClassExpression':
					case 'ClassDeclaration':
						addToScope( node );
						break;

					case 'MemberExpression':
						if ( envDepth === 0 && node.object.type === 'ThisExpression' ) {
							throw new Error('`this` at the top level is undefined');
						}
						!node.computed && ( node.property._skip = true );
						break;

					case 'Property':
						node.key._skip = true;
						break;

					case 'TemplateLiteral':
						templateLiteralRanges.push([ node.start, node.end ]);
						break;

					case 'ThisExpression':
						if (envDepth === 0) {
							node._topLevel = true;
						}
						break;
				}
			},
			leave: function ( node ) {
				switch ( node.type ) {
					case 'FunctionExpression':
					case 'FunctionDeclaration':

						envDepth -= 1;

						// fallthrough

					case 'ArrowFunctionExpression':

						scope = scope.parent;

						break;

					case 'BlockStatement':
						blockScope = blockScope.parent;
						break;
				}
			}
		});

		function addToScope ( declarator ) {
			var name = declarator.id.name;

			scope.add( name );
			declared[ name ] = true;
		}

		function addToBlockScope ( declarator ) {
			var name = declarator.id.name;

			blockScope.add( name );
			declared[ name ] = true;
		}

		ast._scope = scope;
		ast._blockScope = blockScope;
		ast._topLevelNames = ast._scope.names.concat( ast._blockScope.names );
		ast._topLevelFunctionNames = topLevelFunctionNames;
		ast._declared = declared;
		ast._templateLiteralRanges = templateLiteralRanges;
	}

	/**
	 * Inspects a module and discovers/categorises import & export declarations
	 * @param {object} mod - the module object
	 * @param {string} source - the module's original source code
	 * @param {object} ast - the result of parsing `source` with acorn
	 * @returns {array} - [ imports, exports ]
	 */
	function findImportsAndExports ( mod, source, ast ) {
		var imports = [], exports = [], previousDeclaration;

		ast.body.forEach( function(node ) {
			var passthrough, declaration;

			if ( previousDeclaration ) {
				previousDeclaration.next = node.start;

				if ( node.type !== 'EmptyStatement' ) {
					previousDeclaration = null;
				}
			}

			if ( node.type === 'ImportDeclaration' ) {
				declaration = processImport( node );
				imports.push( declaration );
			}

			else if ( node.type === 'ExportDefaultDeclaration' ) {
				declaration = processDefaultExport( node, source );
				exports.push( declaration );

				if ( mod.defaultExport ) {
					throw new Error( 'Duplicate default exports' );
				}
				mod.defaultExport = declaration;
			}

			else if ( node.type === 'ExportNamedDeclaration' ) {
				declaration = processExport( node, source );
				exports.push( declaration );

				if ( node.source ) {
					// it's both an import and an export, e.g.
					// `export { foo } from './bar';
					passthrough = processImport( node, true );
					imports.push( passthrough );

					declaration.passthrough = passthrough;
				}
			}

			if ( declaration ) {
				previousDeclaration = declaration;
			}
		});

		// catch any trailing semicolons
		if ( previousDeclaration ) {
			previousDeclaration.next = source.length;
			previousDeclaration.isFinal = true;
		}

		return [ imports, exports ];
	}

	/**
	 * Generates a representation of an import declaration
	 * @param {object} node - the original AST node
	 * @param {boolean} passthrough - `true` if this is an `export { foo } from 'bar'`-style declaration
	 * @returns {object}
	 */
	function processImport ( node, passthrough ) {
		var x = {
			id: null, // used by bundler - filled in later
			node: node,
			start: node.start,
			end: node.end,
			passthrough: !!passthrough,

			path: node.source.value,
			specifiers: node.specifiers.map( function(s ) {
				var id;

				if ( s.type === 'ImportNamespaceSpecifier' ) {
					return {
						isBatch: true,
						name: s.local.name, // TODO is this line necessary?
						as: s.local.name
					};
				}

				if ( s.type === 'ImportDefaultSpecifier' ) {
					return {
						isDefault: true,
						name: 'default',
						as: s.local.name
					}
				}

				return {
					name: ( !!passthrough ? s.exported : s.imported ).name,
					as: s.local.name
				};
			})
		};

		// TODO have different types of imports - batch, default, named
		if ( x.specifiers.length === 0 ) {
			x.isEmpty = true;
		} else if ( x.specifiers.length === 1 && x.specifiers[0].isDefault ) {
			x.isDefault = true;
			x.as = x.specifiers[0].as;

		} else if ( x.specifiers.length === 1 && x.specifiers[0].isBatch ) {
			x.isBatch = true;
			x.as = x.specifiers[0].name;
		} else {
			x.isNamed = true;
		}

		return x;
	}

	function processDefaultExport ( node, source ) {
		var result = {
			isDefault: true,
			node: node,
			start: node.start,
			end: node.end
		};

		var d = node.declaration;

		if ( d.type === 'FunctionExpression' ) {
			// Case 1: `export default function () {...}`
			result.hasDeclaration = true; // TODO remove in favour of result.type
			result.type = 'anonFunction';
		}

		else if ( d.type === 'FunctionDeclaration' ) {
			// Case 2: `export default function foo () {...}`
			result.hasDeclaration = true; // TODO remove in favour of result.type
			result.type = 'namedFunction';
			result.name = d.id.name;
		}

		else if ( d.type === 'ClassExpression' ) {
			// Case 3: `export default class {...}`
			result.hasDeclaration = true; // TODO remove in favour of result.type
			result.type = 'anonClass';
		}

		else if ( d.type === 'ClassDeclaration' ) {
			// Case 4: `export default class Foo {...}`
			result.hasDeclaration = true; // TODO remove in favour of result.type
			result.type = 'namedClass';
			result.name = d.id.name;
		}

		else {
			result.type = 'expression';
			result.name = 'default';
		}

		result.value = source.slice( d.start, d.end );
		result.valueStart = d.start;

		return result;
	}

	/**
	 * Generates a representation of an export declaration
	 * @param {object} node - the original AST node
	 * @param {string} source - the original source code
	 * @returns {object}
	 */
	function processExport ( node, source ) {
		var result, d;

		result = {
			node: node,
			start: node.start,
			end: node.end
		};

		if ( d = node.declaration ) {
			result.value = source.slice( d.start, d.end );
			result.valueStart = d.start;

			// Case 1: `export var foo = 'bar'`
			if ( d.type === 'VariableDeclaration' ) {
				result.hasDeclaration = true; // TODO remove in favour of result.type
				result.type = 'varDeclaration';
				result.name = d.declarations[0].id.name;
			}

			// Case 2: `export function foo () {...}`
			else if ( d.type === 'FunctionDeclaration' ) {
				result.hasDeclaration = true; // TODO remove in favour of result.type
				result.type = 'namedFunction';
				result.name = d.id.name;
			}

			// Case 3: `export class Foo {...}`
			else if ( d.type === 'ClassDeclaration' ) {
				result.hasDeclaration = true; // TODO remove in favour of result.type
				result.type = 'namedClass';
				result.name = d.id.name;
			}
		}

		// Case 9: `export { foo, bar };`
		else {
			result.type = 'named';
			result.specifiers = node.specifiers.map( function(s ) {
				return {
					name: s.local.name,
					as: s.exported.name
				};
			});
		}

		return result;
	}

	function getUnscopedNames ( mod ) {
		var unscoped = [], importedNames, scope;

		function imported ( name ) {
			if ( !importedNames ) {
				importedNames = {};
				mod.imports.forEach( function(i ) {
					!i.passthrough && i.specifiers.forEach( function(s ) {
						importedNames[ s.as ] = true;
					});
				});
			}
			return utils_hasOwnProp.call( importedNames, name );
		}

		walk( mod.ast, {
			enter: function ( node ) {
				// we're only interested in references, not property names etc
				if ( node._skip ) return this.skip();

				if ( node._scope ) {
					scope = node._scope;
				}

				if ( node.type === 'Identifier' &&
						 !scope.contains( node.name ) &&
						 !imported( node.name ) &&
						 !~unscoped.indexOf( node.name ) ) {
					unscoped.push( node.name );
				}
			},

			leave: function ( node ) {
				if ( node.type === 'Program' ) {
					return;
				}

				if ( node._scope ) {
					scope = scope.parent;
				}
			}
		});

		return unscoped;
	}

	function disallowConflictingImports ( imports ) {
		var usedNames = {};

		imports.forEach( function(x ) {
			if ( x.passthrough ) return;

			if ( x.as ) {
				checkName( x.as );
			} else {
				x.specifiers.forEach( checkSpecifier );
			}
		});

		function checkSpecifier ( s ) {
			checkName( s.as );
		}

		function checkName ( name ) {
			if ( utils_hasOwnProp.call( usedNames, name ) ) {
				throw new SyntaxError( (("Duplicated import ('" + name) + "')") );
			}

			usedNames[ name ] = true;
		}
	}

	var RESERVED = 'break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield'.split( ' ' );
	var INVALID_CHAR = /[^a-zA-Z0-9_$]/g;
	var INVALID_LEADING_CHAR = /[^a-zA-Z_$]/;

	/**
	 * Generates a sanitized (i.e. valid identifier) name from a module ID
	 * @param {string} id - a module ID, or part thereof
	 * @returns {string}
	 */
	function sanitize ( name ) {
		name = name.replace( INVALID_CHAR, '_' );

		if ( INVALID_LEADING_CHAR.test( name[0] ) || ~RESERVED.indexOf( name ) ) {
			name = ("_" + name);
		}

		return name;
	}

	var pathSplitRE = /\/|\\/;
	function splitPath ( path ) {
		return path.split( pathSplitRE );
	}

	var SOURCEMAPPINGURL_REGEX = /^# sourceMappingURL=/;

	function getStandaloneModule ( options ) {
		var toRemove = [];

		var mod = {
			body: new magic_string( options.source ),
			ast: acorn.parse( options.source, {
				ecmaVersion: 6,
				sourceType: 'module',
				onComment: function ( block, text, start, end ) {
					// sourceMappingURL comments should be removed
					if ( !block && SOURCEMAPPINGURL_REGEX.test( text ) ) {
						toRemove.push({ start: start, end: end });
					}
				}
			})
		};

		toRemove.forEach( function(end)  {var start = end.start, end = end.end;return mod.body.remove( start, end )} );

		var imports = (exports = findImportsAndExports( mod, options.source, mod.ast ))[0], exports = exports[1];

		disallowConflictingImports( imports );

		mod.imports = imports;
		mod.exports = exports;

		var conflicts = {};

		if ( options.strict ) {
			annotateAst( mod.ast );

			// TODO there's probably an easier way to get this array
			Object.keys( mod.ast._declared ).concat( getUnscopedNames( mod ) ).forEach( function(n ) {
				conflicts[n] = true;
			});
		}

		determineImportNames( imports, options.getModuleName, conflicts );

		return mod;
	}

	function determineImportNames ( imports, userFn, usedNames ) {
		var nameById = {};
		var inferredNames = {};

		imports.forEach( function(x ) {
			var moduleId = x.path;
			var name;

			moduleId = x.path;

			// use existing value
			if ( utils_hasOwnProp.call( nameById, moduleId ) ) {
				x.name = nameById[ moduleId ];
				return;
			}

			// if user supplied a function, defer to it
			if ( userFn && ( name = userFn( moduleId ) ) ) {
				name = sanitize( name );

				if ( utils_hasOwnProp.call( usedNames, name ) ) {
					// TODO write a test for this
					throw new Error( (("Naming collision: module " + moduleId) + (" cannot be called " + name) + "") );
				}
			}

			else {
				var parts = splitPath( moduleId );
				var i;
				var prefix = '';
				var candidate;

				do {
					i = parts.length;
					while ( i-- > 0 ) {
						candidate = prefix + sanitize( parts.slice( i ).join( '__' ) );

						if ( !utils_hasOwnProp.call( usedNames, candidate ) ) {
							name = candidate;
							break;
						}
					}

					prefix += '_';
				} while ( !name );
			}

			usedNames[ name ] = true;
			nameById[ moduleId ] = name;

			x.name = name;
		});

		// use inferred names for default imports, wherever they
		// don't clash with path-based names
		imports.forEach( function(x ) {
			if ( x.as && !utils_hasOwnProp.call( usedNames, x.as ) ) {
				inferredNames[ x.path ] = x.as;
			}
		});

		imports.forEach( function(x ) {
			if ( utils_hasOwnProp.call( inferredNames, x.path ) ) {
				x.name = inferredNames[ x.path ];
			}
		});
	}

	function transformExportDeclaration ( declaration, body ) {
		if ( !declaration ) {
			return;
		}

		var exportedValue;

		switch ( declaration.type ) {
			case 'namedFunction':
			case 'namedClass':
				body.remove( declaration.start, declaration.valueStart );
				exportedValue = declaration.name;
				break;

			case 'anonFunction':
			case 'anonClass':
				if ( declaration.isFinal ) {
					body.replace( declaration.start, declaration.valueStart, 'return ' );
				} else {
					body.replace( declaration.start, declaration.valueStart, 'var __export = ' );
					exportedValue = '__export';
				}

				// add semi-colon, if necessary
				// TODO body.original is an implementation detail of magic-string - there
				// should probably be an API for this sort of thing
				if ( body.original[ declaration.end - 1 ] !== ';' ) {
					body.insert( declaration.end, ';' );
				}

				break;

			case 'expression':
				body.remove( declaration.start, declaration.next );
				exportedValue = declaration.value;
				break;

			default:
				throw new Error( (("Unexpected export type '" + (declaration.type)) + "'") );
		}

		if ( exportedValue ) {
			body.append( (("\nreturn " + exportedValue) + ";") );
		}
	}

	var ABSOLUTE_PATH = /^(?:[A-Z]:)?[\/\\]/i;

	var utils_packageResult__warned = {};

	function packageResult ( bundleOrModule, body, options, methodName, isBundle ) {
		// wrap output
		if ( options.banner ) body.prepend( options.banner );
		if ( options.footer ) body.append( options.footer );

		var code = body.toString();
		var map;

		if ( !!options.sourceMap ) {
			if ( options.sourceMap !== 'inline' && !options.sourceMapFile ) {
				throw new Error( 'You must provide `sourceMapFile` option' );
			}

			if ( !isBundle && !options.sourceMapSource ) {
				throw new Error( 'You must provide `sourceMapSource` option' );
			}

			var sourceMapFile;
			if ( options.sourceMap === 'inline' ) {
				sourceMapFile = null;
			} else {
				sourceMapFile = ABSOLUTE_PATH.test( options.sourceMapFile ) ? options.sourceMapFile : './' + splitPath( options.sourceMapFile ).pop();
			}

			if ( isBundle ) {
				markBundleSourcemapLocations( bundleOrModule );
			} else {
				markModuleSourcemapLocations( bundleOrModule );
			}

			map = body.generateMap({
				includeContent: true,
				file: sourceMapFile,
				source: ( sourceMapFile && !isBundle ) ? utils_packageResult__getRelativePath( sourceMapFile, options.sourceMapSource ) : null
			});

			if ( options.sourceMap === 'inline' ) {
				code += '\n//# sourceMa' + 'ppingURL=' + map.toUrl();
				map = null;
			} else {
				code += '\n//# sourceMa' + 'ppingURL=' + sourceMapFile + '.map';
			}
		} else {
			map = null;
		}

		return {
			code: code,
			map: map,
			toString: function () {
				if ( !utils_packageResult__warned[ methodName ] ) {
					console.log( (("Warning: esperanto." + methodName) + "() returns an object with a 'code' property. You should use this instead of using the returned value directly") );
					utils_packageResult__warned[ methodName ] = true;
				}

				return code;
			}
		};
	}

	function utils_packageResult__getRelativePath ( from, to ) {
		var fromParts, toParts, i;

		fromParts = splitPath( from );
		toParts = splitPath( to );

		fromParts.pop(); // get dirname

		while ( fromParts[0] === toParts[0] ) {
			fromParts.shift();
			toParts.shift();
		}

		if ( fromParts.length ) {
			i = fromParts.length;
			while ( i-- ) fromParts[i] = '..';

			return fromParts.concat( toParts ).join( '/' );
		} else {
			toParts.unshift( '.' );
			return toParts.join( '/' );
		}
	}

	function markBundleSourcemapLocations ( bundle ) {
		bundle.modules.forEach( function(mod ) {
			walk( mod.ast, {
				enter: function(node ) {
					mod.body.addSourcemapLocation( node.start );
				}
			});
		});
	}

	function markModuleSourcemapLocations ( mod ) {
		walk( mod.ast, {
			enter: function(node ) {
				mod.body.addSourcemapLocation( node.start );
			}
		});
	}

	function resolveId ( importPath, importerPath ) {
		var resolved, importerParts, importParts;

		if ( importPath[0] !== '.' ) {
			resolved = importPath;
		} else {
			importerParts = splitPath( importerPath );
			importParts = splitPath( importPath );

			if ( importParts[0] === '.' ) {
				importParts.shift();
			}

			importerParts.pop(); // get dirname
			while ( importParts[0] === '..' ) {
				importParts.shift();
				importerParts.pop();
			}

			while ( importParts[0] === '.' ) {
				importParts.shift();
			}

			resolved = importerParts.concat( importParts ).join( '/' );
		}

		return resolved.replace( /\.js$/, '' );
	}

	function resolveAgainst ( importerPath ) {
		return function ( importPath ) {
			return resolveId( importPath, importerPath );
		};
	}

	function getImportSummary (name) {var imports = name.imports, absolutePaths = name.absolutePaths, name = name.name;
		var paths = [];
		var names = [];
		var seen = {};
		var placeholders = 0;

		imports.forEach( function(x ) {
			var path = x.id || x.path; // TODO unify these

			if ( !seen[ path ] ) {
				seen[ path ] = true;

				paths.push( path );

				// TODO x could be an external module, or an internal one.
				// they have different shapes, resulting in the confusing
				// code below
				if ( ( x.needsDefault || x.needsNamed ) || ( x.specifiers && x.specifiers.length ) ) {
					while ( placeholders ) {
						names.push( (("__dep" + (names.length)) + "__") );
						placeholders--;
					}
					names.push( x.name );
				} else {
					placeholders++;
				}
			}
		});

		var ids = absolutePaths ? paths.map( function(relativePath ) {return resolveId( relativePath, name )} ) : paths.slice();

		return { ids: ids, paths: paths, names: names };
	}

	function processName ( name ) {
		return name ? quote( name ) + ', ' : '';
	}

	function processIds ( ids ) {
		return ids.length ? '[' + ids.map( quote ).join( ', ' ) + '], ' : '';
	}

	function amdIntro (absolutePaths) {var name = absolutePaths.name, imports = absolutePaths.imports, hasExports = absolutePaths.hasExports, indentStr = absolutePaths.indentStr, absolutePaths = absolutePaths.absolutePaths;
		var ids = (names = getImportSummary({ name: name, imports: imports, absolutePaths: absolutePaths })).ids, names = names.names;

		if ( hasExports ) {
			ids.unshift( 'exports' );
			names.unshift( 'exports' );
		}

		var intro = (("\
\ndefine(" + (processName(name))) + ("" + (processIds(ids))) + ("function (" + (names.join( ', ' ))) + ") {\
\n\
\n	'use strict';\
\n\
\n");

		return intro.replace( /\t/g, indentStr );
	}

	function defaultsMode_amd__amd ( mod, options ) {
		mod.imports.forEach( function(x ) {
			mod.body.remove( x.start, x.next );
		});

		transformExportDeclaration( mod.exports[0], mod.body );

		var intro = amdIntro({
			name: options.amdName,
			imports: mod.imports,
			absolutePaths: options.absolutePaths,
			indentStr: mod.body.getIndentString()
		});

		mod.body.trim()
			.indent()
			.prepend( intro )
			.trim()
			.append( '\n\n});' );

		return packageResult( mod, mod.body, options, 'toAmd' );
	}

	function defaultsMode_cjs__cjs ( mod, options ) {
		var seen = {};

		mod.imports.forEach( function(x ) {
			if ( !utils_hasOwnProp.call( seen, x.path ) ) {
				var replacement = x.isEmpty ? (("" + (req(x.path))) + ";") : (("var " + (x.as)) + (" = " + (req(x.path))) + ";");
				mod.body.replace( x.start, x.end, replacement );

				seen[ x.path ] = true;
			} else {
				mod.body.remove( x.start, x.next );
			}
		});

		var exportDeclaration = mod.exports[0];

		if ( exportDeclaration ) {
			switch ( exportDeclaration.type ) {
				case 'namedFunction':
				case 'namedClass':
					mod.body.remove( exportDeclaration.start, exportDeclaration.valueStart );
					mod.body.replace( exportDeclaration.end, exportDeclaration.end, (("\nmodule.exports = " + (exportDeclaration.node.declaration.id.name)) + ";") );
					break;

				default:
					mod.body.replace( exportDeclaration.start, exportDeclaration.valueStart, 'module.exports = ' );
					break;
			}
		}

		mod.body.prepend( "'use strict';\n\n" ).trimLines();

		return packageResult( mod, mod.body, options, 'toCjs' );
	}

	function umdIntro (strict) {var amdName = strict.amdName, name = strict.name, hasExports = strict.hasExports, imports = strict.imports, absolutePaths = strict.absolutePaths, externalDefaults = strict.externalDefaults, indentStr = strict.indentStr, strict = strict.strict;
		var intro;

		if ( !hasExports && !imports.length ) {
			intro =
				(("(function (factory) {\
\n				!(typeof exports === 'object' && typeof module !== 'undefined') &&\
\n				typeof define === 'function' && define.amd ? define(" + (processName(amdName))) + "factory) :\
\n				factory()\
\n			}(function () { 'use strict';\
\n\
\n			");
		}

		else {
			var ids = (names = getImportSummary({ imports: imports, name: amdName, absolutePaths: absolutePaths })).ids, paths = names.paths, names = names.names;

			var amdExport, cjsExport, globalExport, defaultsBlock;

			if ( strict ) {
				cjsExport = (("factory(" + (( hasExports ? [ 'exports' ] : [] ).concat( paths.map( req ) ).join( ', ' ))) + ")");
				var globalDeps = ( hasExports ? [ (("(global." + name) + " = {})") ] : [] ).concat( names.map( globalify ) ).join( ', ' );
				globalExport = (("factory(" + globalDeps) + ")");

				if ( hasExports ) {
					ids.unshift( 'exports' );
					names.unshift( 'exports' );
				}

				amdExport = (("define(" + (processName(amdName))) + ("" + (processIds(ids))) + "factory)");
				defaultsBlock = '';
				if ( externalDefaults && externalDefaults.length > 0 ) {
					defaultsBlock = externalDefaults.map( function(x )
						{return '\t' + ( x.needsNamed ? (("var " + (x.name)) + "__default") : x.name ) +
							((" = ('default' in " + (x.name)) + (" ? " + (x.name)) + ("['default'] : " + (x.name)) + ");")}
				).join('\n') + '\n\n';
				}
			} else {
				amdExport = (("define(" + (processName(amdName))) + ("" + (processIds(ids))) + "factory)");
				cjsExport = ( hasExports ? 'module.exports = ' : '' ) + (("factory(" + (paths.map( req ).join( ', ' ))) + ")");
				globalExport = ( hasExports ? (("global." + name) + " = ") : '' ) + (("factory(" + (names.map( globalify ).join( ', ' ))) + ")");

				defaultsBlock = '';
			}

			intro =
				(("(function (global, factory) {\
\n				typeof exports === 'object' && typeof module !== 'undefined' ? " + cjsExport) + (" :\
\n				typeof define === 'function' && define.amd ? " + amdExport) + (" :\
\n				" + globalExport) + ("\
\n			}(this, function (" + (names.join( ', ' ))) + (") { 'use strict';\
\n\
\n			" + defaultsBlock) + "");

		}

		return intro.replace( /^\t\t\t/gm, '' ).replace( /\t/g, indentStr );
	}

	var EsperantoError = function ( message, data ) {
		var prop;

		this.message = message;
		this.stack = (new Error()).stack;

		for ( prop in data ) {
			if ( data.hasOwnProperty( prop ) ) {
				this[ prop ] = data[ prop ];
			}
		}
	};

	EsperantoError.prototype = new Error();
	EsperantoError.prototype.constructor = EsperantoError;
	EsperantoError.prototype.name = 'EsperantoError';

	var utils_EsperantoError = EsperantoError;

	function requireName ( options ) {
		if ( !options.name ) {
			throw new utils_EsperantoError( 'You must supply a `name` option for UMD modules', {
				code: 'MISSING_NAME'
			});
		}
	}

	function defaultsMode_umd__umd ( mod, options ) {
		requireName( options );

		mod.imports.forEach( function(x ) {
			mod.body.remove( x.start, x.next );
		});

		var intro = umdIntro({
			hasExports: mod.exports.length > 0,
			imports: mod.imports,
			amdName: options.amdName,
			absolutePaths: options.absolutePaths,
			name: options.name,
			indentStr: mod.body.getIndentString()
		});

		transformExportDeclaration( mod.exports[0], mod.body );

		mod.body.indent().prepend( intro ).trimLines().append( '\n\n}));' );

		return packageResult( mod, mod.body, options, 'toUmd' );
	}

	var defaultsMode = {
		amd: defaultsMode_amd__amd,
		cjs: defaultsMode_cjs__cjs,
		umd: defaultsMode_umd__umd
	};

	function gatherImports ( imports ) {
		var chains = {};
		var identifierReplacements = {};

		imports.forEach( function(x ) {
			x.specifiers.forEach( function(s ) {
				if ( s.isBatch ) {
					return;
				}

				var name = s.as;
				var replacement = x.name + ( s.isDefault ? ("['default']") : ("." + (s.name)) );

				if ( !x.passthrough ) {
					identifierReplacements[ name ] = replacement;
				}

				chains[ name ] = replacement;
			});
		});

		return [ chains, identifierReplacements ];
	}

	function getExportNames ( exports ) {
		var result = {};

		exports.forEach( function(x ) {
			if ( x.isDefault ) return;

			if ( x.hasDeclaration ) {
				result[ x.name ] = x.name;
				return;
			}

			x.specifiers.forEach( function(s ) {
				result[ s.name ] = s.as;
			});
		});

		return result;
	}

	/**
	 * Scans an array of imports, and determines which identifiers
	   are readonly, and which cannot be assigned to. For example
	   you cannot `import foo from 'foo'` then do `foo = 42`, nor
	   can you `import * as foo from 'foo'` then do `foo.answer = 42`
	 * @param {array} imports - the array of imports
	 * @returns {array} [ importedBindings, importedNamespaces ]
	 */
	function getReadOnlyIdentifiers ( imports ) {
		var importedBindings = {}, importedNamespaces = {};

		imports.forEach( function(x ) {
			if ( x.passthrough ) return;

			x.specifiers.forEach( function(s ) {
				if ( s.isBatch ) {
					importedNamespaces[ s.as ] = true;
				} else {
					importedBindings[ s.as ] = true;
				}
			});
		});

		return [ importedBindings, importedNamespaces ];
	}

	var bindingMessage = 'Cannot reassign imported binding ',
		namespaceMessage = 'Cannot reassign imported binding of namespace ';

	function disallowIllegalReassignment ( node, importedBindings, importedNamespaces, scope ) {
		var assignee, isNamespaceAssignment;

		if ( node.type === 'AssignmentExpression' ) {
			assignee = node.left;
		} else if ( node.type === 'UpdateExpression' ) {
			assignee = node.argument;
		} else {
			return; // not an assignment
		}

		if ( assignee.type === 'MemberExpression' ) {
			assignee = assignee.object;
			isNamespaceAssignment = true;
		}

		if ( assignee.type !== 'Identifier' ) {
			return; // not assigning to a binding
		}

		var name = assignee.name;

		if ( utils_hasOwnProp.call( isNamespaceAssignment ? importedNamespaces : importedBindings, name ) && !scope.contains( name ) ) {
			throw new Error( ( isNamespaceAssignment ? namespaceMessage : bindingMessage ) + '`' + name + '`' );
		}
	}

	function replaceIdentifiers ( body, node, identifierReplacements, scope ) {
		var name = node.name;
		var replacement = utils_hasOwnProp.call( identifierReplacements, name ) && identifierReplacements[ name ];

		// TODO unchanged identifiers shouldn't have got this far -
		// remove the `replacement !== name` safeguard once that's the case
		if ( replacement && replacement !== name && !scope.contains( name, true ) ) {
			// rewrite
			body.replace( node.start, node.end, replacement );
		}
	}

	function rewriteExportAssignments ( body, node, exports, scope, capturedUpdates ) {
		var assignee;

		if ( node.type === 'AssignmentExpression' ) {
			assignee = node.left;
		} else if ( node.type === 'UpdateExpression' ) {
			assignee = node.argument;
		} else {
			return; // not an assignment
		}

		if ( assignee.type !== 'Identifier' ) {
			return;
		}

		var name = assignee.name;

		if ( scope.contains( name, true ) ) {
			return; // shadows an export
		}

		if ( exports && utils_hasOwnProp.call( exports, name ) ) {
			var exportAs = exports[ name ];

			if ( !!capturedUpdates ) {
				capturedUpdates.push({ name: name, exportAs: exportAs });
				return;
			}

			// special case - increment/decrement operators
			if ( node.operator === '++' || node.operator === '--' ) {
				body.replace( node.end, node.end, ((", exports." + exportAs) + (" = " + name) + "") );
			} else {
				body.replace( node.start, node.start, (("exports." + exportAs) + " = ") );
			}
		}
	}

	function traverseAst ( ast, body, identifierReplacements, importedBindings, importedNamespaces, exportNames ) {
		var scope = ast._scope;
		var blockScope = ast._blockScope;
		var capturedUpdates = null;
		var previousCapturedUpdates = null;

		walk( ast, {
			enter: function ( node, parent ) {
				// we're only interested in references, not property names etc
				if ( node._skip ) return this.skip();

				if ( node._scope ) {
					scope = node._scope;
				} else if ( node._blockScope ) {
					blockScope = node._blockScope;
				}

				// Special case: if you have a variable declaration that updates existing
				// bindings as a side-effect, e.g. `var a = b++`, where `b` is an exported
				// value, we can't simply append `exports.b = b` to the update (as we
				// normally would) because that would be syntactically invalid. Instead,
				// we capture the change and update the export (and any others) after the
				// variable declaration
				if ( node.type === 'VariableDeclaration' ) {
					previousCapturedUpdates = capturedUpdates;
					capturedUpdates = [];
					return;
				}

				disallowIllegalReassignment( node, importedBindings, importedNamespaces, scope );

				// Rewrite assignments to exports inside functions, to keep bindings live.
				// This call may mutate `capturedUpdates`, which is used elsewhere
				if ( scope !== ast._scope ) {
					rewriteExportAssignments( body, node, exportNames, scope, capturedUpdates );
				}

				if ( node.type === 'Identifier' && parent.type !== 'FunctionExpression' ) {
					replaceIdentifiers( body, node, identifierReplacements, scope );
				}

				// Replace top-level this with undefined ES6 8.1.1.5.4
				if ( node.type === 'ThisExpression' && node._topLevel ) {
					body.replace( node.start, node.end, 'undefined' );
				}
			},

			leave: function ( node ) {
				// Special case - see above
				if ( node.type === 'VariableDeclaration' ) {
					if ( capturedUpdates.length ) {
						body.insert( node.end, capturedUpdates.map( exportCapturedUpdate ).join( '' ) );
					}

					capturedUpdates = previousCapturedUpdates;
				}

				if ( node._scope ) {
					scope = scope.parent;
				} else if ( node._blockScope ) {
					blockScope = blockScope.parent;
				}
			}
		});
	}

	function exportCapturedUpdate ( c ) {
		return ((" exports." + (c.exportAs)) + (" = " + (c.name)) + ";");
	}

	function transformBody ( mod, body, options ) {
		var chains = (identifierReplacements = gatherImports( mod.imports ))[0], identifierReplacements = identifierReplacements[1];
		var exportNames = getExportNames( mod.exports );

		var importedBindings = (importedNamespaces = getReadOnlyIdentifiers( mod.imports ))[0], importedNamespaces = importedNamespaces[1];

		// ensure no conflict with `exports`
		identifierReplacements.exports = deconflict( 'exports', mod.ast._declared );

		traverseAst( mod.ast, body, identifierReplacements, importedBindings, importedNamespaces, exportNames );

		// Remove import statements from the body of the module
		mod.imports.forEach( function(x ) {
			body.remove( x.start, x.next );
		});

		// Prepend require() statements (CommonJS output only)
		if ( options.header ) {
			body.prepend( options.header + '\n\n' );
		}

		// Remove export statements (but keep declarations)
		mod.exports.forEach( function(x ) {
			if ( x.isDefault ) {
				if ( /^named/.test( x.type ) ) {
					// export default function answer () { return 42; }
					body.remove( x.start, x.valueStart );
					body.insert( x.end, (("\nexports['default'] = " + (x.name)) + ";") );
				} else {
					// everything else
					body.replace( x.start, x.valueStart, 'exports[\'default\'] = ' );
				}
			}

			else {
				switch ( x.type ) {
					case 'varDeclaration': // export var answer = 42; (or let)
					case 'namedFunction':  // export function answer () {...}
					case 'namedClass':     // export class answer {...}
						body.remove( x.start, x.valueStart );
						break;

					case 'named':          // export { foo, bar };
						body.remove( x.start, x.next );
						break;

					default:
						body.replace( x.start, x.valueStart, 'exports[\'default\'] = ' );
				}
			}
		});

		// Append export block (this is the same for all module types, unlike imports)
		var earlyExports = [];
		var lateExports = [];

		Object.keys( exportNames ).forEach( function(name ) {
			var exportAs = exportNames[ name ];

			if ( chains.hasOwnProperty( name ) ) {
				// special case - a binding from another module
				if ( !options._evilES3SafeReExports ) {
					earlyExports.push( (("Object.defineProperty(exports, '" + exportAs) + ("', { enumerable: true, get: function () { return " + (chains[name])) + "; }});") );
				} else {
					lateExports.push( (("exports." + exportAs) + (" = " + (chains[name])) + ";") );
				}
			} else if ( ~mod.ast._topLevelFunctionNames.indexOf( name ) ) {
				// functions should be exported early, in
				// case of cyclic dependencies
				earlyExports.push( (("exports." + exportAs) + (" = " + name) + ";") );
			} else {
				lateExports.push( (("exports." + exportAs) + (" = " + name) + ";") );
			}
		});

		// Function exports should be exported immediately after 'use strict'
		if ( earlyExports.length ) {
			body.trim().prepend( earlyExports.join( '\n' ) + '\n\n' );
		}

		// Everything else should be exported at the end
		if ( lateExports.length ) {
			body.trim().append( '\n\n' + lateExports.join( '\n' ) );
		}

		if ( options.intro && options.outro ) {
			body.indent().prepend( options.intro ).trimLines().append( options.outro );
		}
	}

	function deconflict ( name, declared ) {
		while ( utils_hasOwnProp.call( declared, name ) ) {
			name = '_' + name;
		}

		return name;
	}

	function strictMode_amd__amd ( mod, options ) {
		var intro = amdIntro({
			name: options.amdName,
			absolutePaths: options.absolutePaths,
			imports: mod.imports,
			indentStr: mod.body.getIndentString(),
			hasExports: mod.exports.length
		});

		transformBody( mod, mod.body, {
			intro: intro,
			outro: '\n\n});',
			_evilES3SafeReExports: options._evilES3SafeReExports
		});

		return packageResult( mod, mod.body, options, 'toAmd' );
	}

	function strictMode_cjs__cjs ( mod, options ) {
		var seen = {};

		// Create block of require statements
		var importBlock = mod.imports.map( function(x ) {
			if ( !utils_hasOwnProp.call( seen, x.path ) ) {
				seen[ x.path ] = true;

				if ( x.isEmpty ) {
					return (("" + (req(x.path))) + ";");
				}

				return (("var " + (x.name)) + (" = " + (req(x.path))) + ";");
			}
		}).filter( Boolean ).join( '\n' );

		transformBody( mod, mod.body, {
			header: importBlock,
			_evilES3SafeReExports: options._evilES3SafeReExports
		});

		mod.body.prepend( "'use strict';\n\n" ).trimLines();

		return packageResult( mod, mod.body, options, 'toCjs' );
	}

	function strictMode_umd__umd ( mod, options ) {
		requireName( options );

		var intro = umdIntro({
			hasExports: mod.exports.length > 0,
			imports: mod.imports,
			amdName: options.amdName,
			absolutePaths: options.absolutePaths,
			name: options.name,
			indentStr: mod.body.getIndentString(),
			strict: true
		});

		transformBody( mod, mod.body, {
			intro: intro,
			outro: '\n\n}));',
			_evilES3SafeReExports: options._evilES3SafeReExports
		});

		return packageResult( mod, mod.body, options, 'toUmd' );
	}

	var strictMode = {
		amd: strictMode_amd__amd,
		cjs: strictMode_cjs__cjs,
		umd: strictMode_umd__umd
	};

	// TODO rewrite with named imports/exports
	var moduleBuilders = {
		defaultsMode: defaultsMode,
		strictMode: strictMode
	};

	function builders_defaultsMode_amd__amd ( bundle, options ) {
		var defaultName = bundle.entryModule.identifierReplacements.default;
		if ( defaultName ) {
			bundle.body.append( (("\n\nreturn " + defaultName) + ";") );
		}

		var intro = amdIntro({
			name: options.amdName,
			imports: bundle.externalModules,
			indentStr: bundle.body.getIndentString()
		});

		bundle.body.indent().prepend( intro ).trimLines().append( '\n\n});' );
		return packageResult( bundle, bundle.body, options, 'toAmd', true );
	}

	function builders_defaultsMode_cjs__cjs ( bundle, options ) {
		var importBlock = bundle.externalModules.map( function(x ) {
			return (("var " + (x.name)) + (" = " + (req(x.id))) + ";");
		}).join( '\n' );

		if ( importBlock ) {
			bundle.body.prepend( importBlock + '\n\n' );
		}

		var defaultName = bundle.entryModule.identifierReplacements.default;
		if ( defaultName ) {
			bundle.body.append( (("\n\nmodule.exports = " + defaultName) + ";") );
		}

		bundle.body.prepend("'use strict';\n\n").trimLines();

		return packageResult( bundle, bundle.body, options, 'toCjs', true );
	}

	function builders_defaultsMode_umd__umd ( bundle, options ) {
		requireName( options );

		var entry = bundle.entryModule;

		var intro = umdIntro({
			hasExports: entry.exports.length > 0,
			imports: bundle.externalModules,
			amdName: options.amdName,
			name: options.name,
			indentStr: bundle.body.getIndentString()
		});

		if ( entry.defaultExport ) {
			bundle.body.append( (("\n\nreturn " + (entry.identifierReplacements.default)) + ";") );
		}

		bundle.body.indent().prepend( intro ).trimLines().append('\n\n}));');

		return packageResult( bundle, bundle.body, options, 'toUmd', true );
	}

	var builders_defaultsMode = {
		amd: builders_defaultsMode_amd__amd,
		cjs: builders_defaultsMode_cjs__cjs,
		umd: builders_defaultsMode_umd__umd
	};

	function getExportBlock ( entry ) {
		var name = entry.identifierReplacements.default;
		return (("exports['default'] = " + name) + ";");
	}

	function builders_strictMode_amd__amd ( bundle, options ) {
		var externalDefaults = bundle.externalModules.filter( builders_strictMode_amd__needsDefault );
		var entry = bundle.entryModule;

		if ( externalDefaults.length ) {
			var defaultsBlock = externalDefaults.map( function(x ) {
				// Case 1: default is used, and named is not
				if ( !x.needsNamed ) {
					return (("" + (x.name)) + (" = ('default' in " + (x.name)) + (" ? " + (x.name)) + ("['default'] : " + (x.name)) + ");");
				}

				// Case 2: both default and named are used
				return (("var " + (x.name)) + ("__default = ('default' in " + (x.name)) + (" ? " + (x.name)) + ("['default'] : " + (x.name)) + ");");
			}).join( '\n' );

			bundle.body.prepend( defaultsBlock + '\n\n' );
		}

		if ( entry.defaultExport ) {
			bundle.body.append( '\n\n' + getExportBlock( entry ) );
		}

		var intro = amdIntro({
			name: options.amdName,
			imports: bundle.externalModules,
			hasExports: entry.exports.length,
			indentStr: bundle.body.getIndentString()
		});

		bundle.body.indent().prepend( intro ).trimLines().append( '\n\n});' );
		return packageResult( bundle, bundle.body, options, 'toAmd', true );
	}

	function builders_strictMode_amd__needsDefault ( externalModule ) {
		return externalModule.needsDefault;
	}

	function builders_strictMode_cjs__cjs ( bundle, options ) {
		var entry = bundle.entryModule;

		var importBlock = bundle.externalModules.map( function(x ) {
			var statement = (("var " + (x.name)) + (" = " + (req(x.id))) + ";");

			if ( x.needsDefault ) {
				statement += '\n' +
					( x.needsNamed ? (("var " + (x.name)) + "__default") : x.name ) +
					((" = ('default' in " + (x.name)) + (" ? " + (x.name)) + ("['default'] : " + (x.name)) + ");");
			}

			return statement;
		}).join( '\n' );

		if ( importBlock ) {
			bundle.body.prepend( importBlock + '\n\n' );
		}

		if ( entry.defaultExport ) {
			bundle.body.append( '\n\n' + getExportBlock( entry ) );
		}

		bundle.body.prepend("'use strict';\n\n").trimLines();

		return packageResult( bundle, bundle.body, options, 'toCjs', true );
	}

	function builders_strictMode_umd__umd ( bundle, options ) {
		requireName( options );

		var entry = bundle.entryModule;

		var intro = umdIntro({
			hasExports: entry.exports.length > 0,
			imports: bundle.externalModules,
			externalDefaults: bundle.externalModules.filter( builders_strictMode_umd__needsDefault ),
			amdName: options.amdName,
			name: options.name,
			indentStr: bundle.body.getIndentString(),
			strict: true
		});

		if ( entry.defaultExport ) {
			bundle.body.append( '\n\n' + getExportBlock( entry ) );
		}

		bundle.body.indent().prepend( intro ).trimLines().append('\n\n}));');

		return packageResult( bundle, bundle.body, options, 'toUmd', true );
	}

	function builders_strictMode_umd__needsDefault ( externalModule ) {
		return externalModule.needsDefault;
	}

	var builders_strictMode = {
		amd: builders_strictMode_amd__amd,
		cjs: builders_strictMode_cjs__cjs,
		umd: builders_strictMode_umd__umd
	};

	// TODO rewrite with named imports/exports
	var bundleBuilders = {
		defaultsMode: builders_defaultsMode,
		strictMode: builders_strictMode
	};

	function concat ( bundle, options ) {
		// This bundle must be self-contained - no imports or exports
		if ( bundle.externalModules.length || bundle.entryModule.exports.length ) {
			throw new Error( (("bundle.concat() can only be used with bundles that have no imports/exports (imports: [" + (bundle.externalModules.map(function(x){return x.id}).join(', '))) + ("], exports: [" + (bundle.entryModule.exports.join(', '))) + "])") );
		}

		// TODO test these options
		var intro = 'intro' in options ? options.intro : ("(function () { 'use strict';\n\n");
		var outro = 'outro' in options ? options.outro : '\n\n})();';
		var indent;

		if ( !( 'indent' in options ) || options.indent === true ) {
			indent = bundle.body.getIndentString();
		} else {
			indent = options.indent || '';
		}

		bundle.body.trimLines().indent( indent ).prepend( intro ).append( outro );

		return packageResult( bundle, bundle.body, options, 'toString', true );
	}

	var esperanto__deprecateMessage = 'options.defaultOnly has been deprecated, and is now standard behaviour. To use named imports/exports, pass `strict: true`.';
	var esperanto__alreadyWarned = false;

	function transpileMethod ( format ) {
		return function ( source ) {var options = arguments[1];if(options === void 0)options = {};
			var mod = getStandaloneModule({
				source: source,
				getModuleName: options.getModuleName,
				strict: options.strict
			});

			if ( 'defaultOnly' in options && !esperanto__alreadyWarned ) {
				// TODO link to a wiki page explaining this, or something
				console.log( esperanto__deprecateMessage );
				esperanto__alreadyWarned = true;
			}

			if ( options.absolutePaths && !options.amdName ) {
				throw new Error( 'You must specify an `amdName` in order to use the `absolutePaths` option' );
			}

			var builder;

			if ( !options.strict ) {
				// ensure there are no named imports/exports. TODO link to a wiki page...
				if ( hasNamedImports( mod ) || hasNamedExports( mod ) ) {
					throw new Error( 'You must be in strict mode (pass `strict: true`) to use named imports or exports' );
				}

				builder = moduleBuilders.defaultsMode[ format ];
			} else {
				builder = moduleBuilders.strictMode[ format ];
			}

			return builder( mod, options );
		};
	}

	var esperanto = {
		toAmd: transpileMethod( 'amd' ),
		toCjs: transpileMethod( 'cjs' ),
		toUmd: transpileMethod( 'umd' ),

		bundle: function ( options ) {
			return getBundle( options ).then( function ( bundle ) {
				return {
					imports: bundle.externalModules.map( function(mod ) {return mod.id} ),
					exports: flattenExports( bundle.entryModule.exports ),

					toAmd: function(options ) {return transpile( 'amd', options )},
					toCjs: function(options ) {return transpile( 'cjs', options )},
					toUmd: function(options ) {return transpile( 'umd', options )},

					concat: function(options ) {return concat( bundle, options || {} )}
				};

				function transpile ( format ) {var options = arguments[1];if(options === void 0)options = {};
					if ( 'defaultOnly' in options && !esperanto__alreadyWarned ) {
						// TODO link to a wiki page explaining this, or something
						console.log( esperanto__deprecateMessage );
						esperanto__alreadyWarned = true;
					}

					var builder;

					if ( !options.strict ) {
						// ensure there are no named imports/exports
						if ( hasNamedExports( bundle.entryModule ) ) {
							throw new Error( 'Entry module can only have named exports in strict mode (pass `strict: true`)' );
						}

						bundle.modules.forEach( function(mod ) {
							mod.imports.forEach( function(x ) {
								if ( utils_hasOwnProp.call( bundle.externalModuleLookup, x.id ) && ( !x.isDefault && !x.isBatch ) ) {
									throw new Error( 'You can only have named external imports in strict mode (pass `strict: true`)' );
								}
							});
						});

						builder = bundleBuilders.defaultsMode[ format ];
					} else {
						builder = bundleBuilders.strictMode[ format ];
					}

					return builder( bundle, options );
				}
			});
		}
	};

	function flattenExports ( exports ) {
		var flattened = [];

		exports.forEach( function(x ) {
			if ( x.isDefault ) {
				flattened.push( 'default' );
			}

			else if ( x.name ) {
				flattened.push( x.name );
			}

			else if ( x.specifiers ) {
				flattened.push.apply( flattened, x.specifiers.map( getName ) );
			}
		});

		return flattened;
	}

	return esperanto;

}));