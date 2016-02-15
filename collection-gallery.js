/*jshint unused:true*/
(function () {
  "use strict";

  d3.fisheye = {
    scale: function (scaleType) {
      return d3_fisheye_scale(scaleType(), 3, 0);
    },
  };

  function d3_fisheye_scale(scale, d, a) {
    function fisheye(_) {
      var x = scale(_),
        left = x < a,
        range = d3.extent(scale.range()),
        min = range[0],
        max = range[1],
        m = left ? a - min : max - a;
      if (m === 0) m = max - min;
      return (left ? -1 : 1) * m * (d + 1) / (d + (m / Math.abs(x - a))) + a;
    }

    fisheye.distortion = function (_) {
      if (!arguments.length) return d;
      d = +_;
      return fisheye;
    };

    fisheye.focus = function (_) {
      if (!arguments.length) return a;
      a = +_;
      return fisheye;
    };

    fisheye.copy = function () {
      return d3_fisheye_scale(scale.copy(), d, a);
    };

    fisheye.nice = scale.nice;
    fisheye.ticks = scale.ticks;
    fisheye.tickFormat = scale.tickFormat;
    return d3.rebind(fisheye, scale, "domain", "range", "invert");
  }

  function createCollectionGallery() {
    var ctx = d3.select(this);
    var liEl, aEl, dispEl;
    var data;
    var dataUnparsed = ctx.attr('collection-gallery-data');
    if (!dataUnparsed) {
      throw 'collection-gallery-data attr needs to be set with stringified JSON data.';
    }
    try {
      data = JSON.parse(ctx.attr('collection-gallery-data'));
    } catch (e) {
      return console.error('unable to parse JSON, invalid JSON: ' + e);
    }
    var width = ctx.node().getBoundingClientRect().width || 600;
    var height = ctx.node().getBoundingClientRect().height || 200;
    var easing = d3.ease('cubic');
    var inContext = false; // Are we hovering/focused on the item?
    var imageWidth = 200;
    var normalWidth = width / data.length;
    var maxDistortion = imageWidth / normalWidth - 1;
    var mouseIsOverIndex = null;
    var touchstartTime, touchstartPos;
    var x = d3.fisheye.scale(d3.scale.linear)
      .domain([0, data.length])
      .range([0, width])
      .distortion(0);

    function mousemove() {
      var mousePos = d3.mouse(this)[0];
      // Limit ranges during touchmove events
      mousePos = (mousePos < x.range()[0]) ? x.range()[0] : mousePos;
      mousePos = (mousePos > x.range()[1]) ? x.range()[1] : mousePos;
      mouseIsOverIndex = Math.floor(x.invert(mousePos));

      x.focus(mousePos);
      if (inContext === false) {
        grow();
      }
      inContext = true;
      render();
    }

    function mouseout() {
      if (inContext === true) {
        shrink();
      }
      mouseIsOverIndex = null;
      inContext = false;
    }

    function oneFingerTouch(fn) {
      return function () {
        if (d3.event.touches.length !== 1) {
          return;
        }
        d3.event.preventDefault();
        fn.call(this);
      };
    }

    function addEventListeners() {
      ctx
        .on('mousemove', mousemove)
        .on('mouseleave', mouseout)
        .on('touchend', function () {
          var isQuickClick = Date.now() - touchstartTime < 500;
          var isNotMovedClick = touchstartPos === d3.mouse(this)[0];

          if (isQuickClick || isNotMovedClick) {
            if (mouseIsOverIndex !== null) {
              window.location.href = data[mouseIsOverIndex].href;
            }
          }
          mouseout();
        })
        .on('dragstart', function () {
          d3.event.preventDefault();
        })
        .on('touchmove', oneFingerTouch(mousemove))
        .on('touchstart', oneFingerTouch(function () {
          inContext = false;

          mousemove.call(this);
          touchstartPos = d3.mouse(this)[0];
          touchstartTime = Date.now();
        }));
    }

    function grow() {
      d3.timer(function () {
        if (!inContext) return true;
        var currentDistortion = x.distortion();
        var distortionNotReachedTarget = maxDistortion > currentDistortion;
        var nextDistortion = currentDistortion + 0.2;
        if (distortionNotReachedTarget) {
          x.distortion((nextDistortion > maxDistortion) ? maxDistortion : nextDistortion);
        }
        render();
        return !distortionNotReachedTarget;
      });
    }

    function shrink() {
      var progress = 1;

      d3.timer(function () {
        if (inContext) return true;
        progress = progress - 0.04; // ~400ms, but widely depends on CPU
        var animationProgress = easing(progress);
        var newDistortion = maxDistortion * animationProgress;

        if (x.distortion() > 0) {
          x.distortion((animationProgress < 0.001) ? 0 : newDistortion);
          render();
        }

        return x.distortion() === 0;
      });
    }

    function render() {
      ctx.selectAll('ul li')
        .style('left', function (d, i) {
          return x(i) + 'px';
        })
        .style('width', function (d, i) {
          var x0 = x(i);
          var x1 = x(i + 1);
          return x1 - x0 + 'px';
        });

      dispEl
        .transition()
        .duration(100)
        .style('opacity', function (d, i) {
          if (i === mouseIsOverIndex) {
            return '1';
          }
          return 0;
        });
    }

    function setupElements() {
      // The width and height aren't always set on the element thus need to always be set
      ctx.style({
        height: height + 'px',
        width: width + 'px',
        position: 'relative',
      });

      liEl = ctx.selectAll('ul li')
        .data(data)
        .enter()
        .append('li')
        .style('background-image', function (d) {
          return 'url(' + d.src + ')';
        })
        .style({
          position: 'absolute',
          top: '0',
          overflow: 'hidden',
          'list-style': 'none',
          outline: '1px solid black',
          'background-size': height + 'px',
          'background-repeat': 'no-repeat',
          'background-position': 'center',
          height: height + 'px',
          float: 'left'
        });

      aEl = liEl.append('a')
        .attr('href', function (d) {
          return d.href;
        })
        .style({
          width: '100%',
          height: height + 'px',
          display: 'block',
          position: 'relative',
          'text-decoration': 'none',
          color: 'white',
        });

      dispEl = aEl.append('p')
        .attr('class', 'popover')
        .style({
          width: '100%',
          height: '40px',
          padding: '5px 10px',
          position: 'absolute',
          top: 0,
          'font-weight': '300',
          '-webkit-font-smoothing': 'antialiased',
          '-moz-osx-font-smoothing': 'grayscale',
          left: 0,
          background: 'rgba(0,0,0, 0.5)',
          opacity: 0,
          'white-space': 'nowrap',
        })
        .html(function (d) {
          return d.title + ' <br /> ' + d.price;
        });
    }

    addEventListeners();
    setupElements();
    render();
  }

  d3.selectAll('[collection-gallery]')
    .each(createCollectionGallery);

})();
