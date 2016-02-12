/*jshint unused:true*/
(function () {
  d3.fisheye = {
    scale: function (scaleType) {
      return d3_fisheye_scale(scaleType(), 3, 0);
    },
    circular: function () {
      var radius = 200,
        distortion = 2,
        k0,
        k1,
        focus = [0, 0];

      function fisheye(d) {
        var dx = d.x - focus[0],
          dy = d.y - focus[1],
          dd = Math.sqrt(dx * dx + dy * dy);
        if (!dd || dd >= radius) return {
          x: d.x,
          y: d.y,
          z: dd >= radius ? 1 : 10
        };
        var k = k0 * (1 - Math.exp(-dd * k1)) / dd * .75 + .25;
        return {
          x: focus[0] + dx * k,
          y: focus[1] + dy * k,
          z: Math.min(k, 10)
        };
      }

      function rescale() {
        k0 = Math.exp(distortion);
        k0 = k0 / (k0 - 1) * radius;
        k1 = distortion / radius;
        return fisheye;
      }

      fisheye.radius = function (_) {
        if (!arguments.length) return radius;
        radius = +_;
        return rescale();
      };

      fisheye.distortion = function (_) {
        if (!arguments.length) return distortion;
        distortion = +_;
        return rescale();
      };

      fisheye.focus = function (_) {
        if (!arguments.length) return focus;
        focus = _;
        return fisheye;
      };

      return rescale();
    }
  };

  function d3_fisheye_scale(scale, d, a) {

    function fisheye(_) {
      var x = scale(_),
        left = x < a,
        range = d3.extent(scale.range()),
        min = range[0],
        max = range[1],
        m = left ? a - min : max - a;
      if (m == 0) m = max - min;
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
    return d3.rebind(fisheye, scale, "domain", "range");
  }
})();

var accordiGallers = d3.selectAll('[data-accordi-gallers]');

accordiGallers.each(createGallers);

function createGallers() {
  var ctx = d3.select(this);
  var data = JSON.parse(ctx.attr('collection-info'));
  var width = ctx.node().getBoundingClientRect().width;
  var easing = d3.ease('cubic');
  var inContext = false; // Are we hovering/focused on the item?
  var maxDistortion = 2;

  var x = d3.fisheye.scale(d3.scale.linear)
    .domain([0, data.length])
    .range([0, width])
    .distortion(0)
    .focus(width / 2);

  function mousemove() {
    if (inContext === false) {
      grow();
    }
    inContext = true;
    var mousePos = d3.mouse(this)[0];
    mousePos = (mousePos < x.range()[0]) ? x.range()[0] : mousePos
    mousePos = (mousePos > x.range()[1]) ? x.range()[1] : mousePos

    x.focus(mousePos);
    render();
  }

  function mouseout() {
    if (inContext === true) {
      shrink();
    }
    inContext = false;
  }

  var touchstart;

  function oneFingerTouch(fn) {
    return function () {
      if (d3.event.touches.length !== 1) {
        return;
      }
      d3.event.preventDefault();
      fn.call(this)
    }
  }

  ctx
    .on('mousemove', mousemove)
    .on('mouseleave', mouseout)
    .on('touchend', function () {
      var isQuickClick = Date.now() - touchstart < 500;
      var isNotMovedClick = touchstartPos === d3.mouse(this)[0]

      if (isQuickClick || isNotMovedClick) {
       // alert('click');
      }
      mouseout()
    })
    .on('touchmove', oneFingerTouch(mousemove))
    .on('touchstart', oneFingerTouch(function () {
      inContext = false;

      mousemove.call(this);
      touchstartPos = d3.mouse(this)[0];
      touchstart = Date.now();
    }));


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
      progress = progress - 0.04; // ~400ms
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
        return x(i);
      })
      .style('width', function (d, i) {
        var x0 = x(i);
        var x1 = x(i + 1);
        return x1 - x0;
      });
  }

  var liEl = ctx.selectAll('ul li')
    .data(data)
    .enter()
    .append('li')
    .style('background-image', function (d) {
      return 'url(' + d.path + ')';
    })
    .style({
      'position': 'absolute',
      'top': '0',
      'outline': '1px solid black',
      'background-size': '200px',
      'background-repeat': 'no-repeat',
      'background-position': 'center',
      height: '300px',
      'float': 'left'
    })

  var aEl = liEl.append('a')
    .attr('href', function (d) {
      return d.href;
    })
    .style({
      width: '100%',
      height: '100%',
      display: 'block'
    })

  render();
}
