// grab our packages
var gulp   = require('gulp'),
  jshint = require('gulp-jshint'),
  sass   = require('gulp-sass'),
  rename = require('gulp-rename');

// define the default task and add the watch task to it
gulp.task('default', ['sass:watch']);

gulp.task('sass', function () {
  return gulp.src('external/sass/import.scss')
    .pipe(sass()
      .on('error', function (err) {
        sass.logError(err);
        this.emit('end');
      })
    )
    .pipe(rename('layout.css'))
    .pipe(gulp.dest('external/css'));
});

gulp.task('sass:watch', function () {
  gulp.watch('external/sass/**/*.scss', ['sass']);
});