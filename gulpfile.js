'use strict';
require('dotenv').config({silent:true});

var ftp = require('vinyl-ftp');
var gutil = require('gulp-util');
var browserSync = require('browser-sync').create();
var gulp = require('gulp');
var uglifycss = require('gulp-uglifycss');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');

var source = require('vinyl-source-stream'); // Used to stream bundle for further handling
var browserify = require('browserify');
var watchify = require('watchify');
var reactify = require('reactify');

// Dependencies you don't want to re-bundle while developing,
// but do want to include in your application deployment.
var dependencies = [
	'react',
	'react-addons-test-utils'
];

var browserifyTask = function (options) {
	// The app bundler
	var appBundler = browserify({
		// Only need initial file, browserify finds the rest
		entries: [options.src],

		// Convert JSX to normal javascript
		transform: [
			[babelify, {presets: ['react']}]
		],

		// Enable sourcemaps in production
		debug: options.development,

		// Below are requirements for watchify
		cache: {},
		packageCache: {},
		fullPaths: options.development
	});

	// We set our dependencies as externals on our app bundler when developing
	(options.development ? dependencies : []).forEach(function (dep) {
		appBundler.external(dep);
	});

	// The re-bundle process
	var rebundle = function () {
		var start = Date.now();
		console.log('Building APP bundle');
		appBundler.bundle()
			.on('error', gutil.log)
			.pipe(source('main.js'))
			.pipe(gulpif(!options.development, streamify(uglify())))
			.pipe(gulp.dest(options.dest))
			.pipe(gulpif(options.development, livereload()))
			.pipe(notify(function () {
				console.log('APP bundle built in ' + (Date.now() - start) + 'ms');
			}));
	};

	// Fire up watchify when developing
	if (options.development) {
		appBundler = watchify(appBundler);
		appBundler.on('update', rebundle);
	}

	rebundle();

	// We create a separate bundle for our dependencies as they
	// should not re-bundle on file changes in development.
	// When deploying to production builds, the dependencies will
	// be included in the application bundle
	if (options.development) {
		var testFiles = glob.sync('./specs/**/*-spec.js');
		var testBundler = browserify({
			entries: testFiles,

			// Enable sourcemapping
			debug: true,

			// Convert JSX to normal javascript
			transform: [[babelify, {presets: ['react']}]],

			// Below are requirements for watchify
			cache: {},
			packageCache: {},
			fullPaths: true
		});

		testBundler.external(dependencies);

		var rebundleTests = function () {
			var start = Date.now();
			console.log('Building TEST bundle');
			testBundler.bundle()
				.on('error', gutil.log)
				.pipe(source('specs.js'))
				.pipe(gulp.dest(options.dest))
				.pipe(livereload())
				.pipe(notify(function () {
					console.log('TEST bundle built in ' + (Date.now() - start) + 'ms');
				}));
		};

		testBundler = watchify(testBundler);
		testBundler.on('update', rebundleTests);
		rebundleTests();

		var vendorsBundler = browserify({
			debug: true,
			require: dependencies
		});

		// Run the vendor bundle
		var start = new Date();
		console.log('Building VENDORS bundle');
		vendorsBundler.bundle()
			.on('error', gutil.log)
			.pipe(source('vendors.js'))
			.pipe(gulpif(!options.development, streamify(uglify())))
			.pipe(gulp.dest(options.dest))
			.pipe(notify(function () {
				console.log('VENDORS bundle built in ' + (Date.now() - start) + 'ms');
			}));
	}
};

var cssTask = function (options) {
	if (options.development) {
		var run = function () {
			console.log(arguments);
			var start = new Date();
			console.log('Building CSS bundle');
			gulp.src(options.src)
				.pipe(concat('main.css'))
				.pipe(gulp.dest(options.dest))
				.pipe(notify(function () {
					console.log('CSS bundle built in ' + (Date.now() - start) + 'ms');
				}));
		};
		run();
		gulp.watch(options.src, run);
	} else {
		gulp.src(options.src)
			.pipe(concat('main.css'))
			.pipe(cssmin())
			.pipe(gulp.dest(options.dest));
	}
};

// Starts our development workflow
gulp.task('default', ['browser-sync'], function () {
	browserifyTask({
		development: true,
		src: './app/main.js',
		dest: './build'
	});

	cssTask({
		development: true,
		src: './dist/**/*.css',
		dest: './build'
	});

	connect.server({
		root: 'build/',
		port: 8889
	});

});

gulp.task('deploy', function () {

	browserifyTask({
		development: false,
		src: './app/main.js',
		dest: './dist'
	});

	cssTask({
		development: false,
		src: './styles/**/*.css',
		dest: './dist'
	});

});

gulp.task('test', function () {
	return gulp.src('./build/testrunner-phantomjs.html').pipe(jasminePhantomJs());
});


// ±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±±

/**
 * Concat/minify all SASS files into a single css file.
 *
 */
gulp.task('sass', function () {
	return gulp.src(['./dist/sass/*.scss', '!./dist/sass/mixins.scss'])
		.pipe(sass().on('error', sass.logError))
		.pipe(uglifycss({
			"maxLineLen": 80,
			"uglyComments": true
		}))
		.pipe(concat('styles.min.css'))
		.pipe(gulp.dest('./dist/css'));
});

/**
 * Concat/minify all JS dependencies into a single file.
 *
 */
gulp.task('build-deps', function() {
	console.log('building dependencies to file: ./src/js/vendor/build/dependencies.min.js');
	return gulp.src(['./dist/js/vendor/*.js'])
		.pipe(uglify({
			preserveComments: 'license'
		}))
		.pipe(concat('dependencies.min.js'))
		.pipe(gulp.dest('./dist/js/vendor/build/'));
});

/**
 * Set the browserSync defaults and start the watch process.
 *
 */
gulp.task('browser-sync', function () {
	browserSync.init({
		server: {
			baseDir: './dist'
		}
	});
	gulp.watch(['./dist/**/*.html'], ['reload']);
	gulp.watch(['./dist/css/*.css'], ['reload']);
	gulp.watch(['./dist/sass/*.scss'], ['reload']);
	gulp.watch(['./dist/js/*.js'], ['reload']);
});

gulp.task('reload', ['sass'], function () {
	browserSync.reload();
});

/**
 * Send your website files to the server via FTP
 *
 */
gulp.task('ftp', function () {
	var conn = ftp.create({
		host:     process.env.FTP_HOST,
		user:     process.env.FTP_USER,
		password: process.env.FTP_PASS,
		parallel: 2,
		log:      gutil.log
	});
	var globs = [
		'dist/**/*'
	];
	// using base = '.' will transfer everything to /public_html correctly
	// turn off buffering in gulp.src for best performance
	return gulp.src(globs, {base: 'dist', buffer: false})
		.pipe(conn.newer('/')) // only upload newer files
		.pipe(conn.dest('/'));
});

/**
 * The default task (called when you run `gulp` from cli)
 *
 */
gulp.task('default', ['sass', 'browser-sync']);
