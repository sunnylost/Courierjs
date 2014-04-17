var gulp   = require('gulp');
var concat = require('gulp-concat');
var jshint = require('gulp-jshint');
var uglify = require('gulp-uglify');

var curPath  = './';
var filename = 'courier';
var ext = '.js';

gulp.task('default', function() {
	gulp.src(curPath + filename + ext)
		.pipe(jshint())
		.pipe(concat(curPath + filename + '-min' + ext))
		.pipe(uglify({outSourceMap: true}))
		.pipe(gulp.dest(curPath));
});