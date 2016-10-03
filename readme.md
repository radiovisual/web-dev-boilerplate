# web-dev-boilerplate

> A basic web development boilerplate.

Features:

- [x] HTML5 Boilerplate
- [x] Gulp
- [x] Auto FTP deployment
- [x] Auto-reloading via BrowserSync
- [x] SASS
- [x] Auto JS dependency file minimization + concatenation
- [ ] React Starter
- [ ] Sourcemaps
- [ ] Browserify

## Install

Clone this boilerplate repo, then install the dependencies
```
$ npm install
```

## Commands

This boilerplate comes with the following gulp commands:

- `gulp`: The default command which will compile the app and launch browserSync.
- `gulp sass`: Compile all the SASS files in the dist/sass directory and place the resulting CSS files into `dist/css`
- `guilp build-deps`: Minify/concat all the `dist/js/vendor` .js files into a single .js file.
- `gulp browser-sync`: Watches/reloads browser when the following files have been changed: `html`, `js`, `css` and `scss`
- `gulp ftp`: Syncs your entire `dist` directory to your FTP server. Requires that you have a `.env` file or the following
 values available to your environment: `FTP_HOST`, `FTP_USER`, and `FTP_PASS`