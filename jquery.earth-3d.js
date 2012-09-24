$.widget('ui.earth3d', {
  options: {
    texture: 'images/earth1024x1024.jpg',
    sphere: {
      tilt: 0,
      turn: 0,
      r: 10
    },
    defaultSpeed: 20,
    backToDefaultTime: 4000,
    objects: {
    },
    paths: {
    },
    flightsCanvas: null,
    dragElement: null,
    objectsElement: null,
    flightsCanvasDecal: {
      x: 0,
      y: 0
    },
    pixelRadiusMultiplier: 0.97,
    onInitObject: function(object, widget) {
      var $elem = $('<div class="object"></div>');
      $elem.appendTo(widget.options.objectsElement);
      $elem.click(function() {
          alert('Clicked on ' + object.name);
      });
      object.$element = $elem;
    },
    onShowObject: function(object, x, y) {
      object.$element.show();
    },
    onRefreshObject: function(object, x, y) {
      //console.log(x, y);
      object.$element.css({
        left: x,
        top: y
      });
    },
    onHideObject: function(object, x, y) {
      object.$element.hide();
    },
    onInitFlight: function(flight, widget) {
      var $elem = $('<div class="flight"></div>');
      $elem.appendTo(widget.options.objectsElement);
      $elem.click(function() {
        alert('Clicked on ' + flight.name);
      });
      flight.$element = $elem;
    },
    onShowFlight: function(flight) {
      flight.$element.show();
    },
    onRefreshFlight: function(flight, x, y, angle, widget) {
      flight.$element.css({
        left: x,
        top: y,
        '-webkit-transform':'rotate(' + ((angle + Math.PI / 2) * 360 / (2 * Math.PI)) + 'deg)',
        '-moz-transform':'rotate(' + ((angle + Math.PI / 2) * 360 / (2 * Math.PI)) + 'deg)',
        '-o-transform':'rotate(' + ((angle + Math.PI / 2) * 360 / (2 * Math.PI)) + 'deg)'
      });
    },
    onHideFlight: function(flight) {
      flight.$element.hide();
    }
  },
  earth: null,
  posVar: 24 * 3600 * 1000,
  lastMousePos: null,
  lastSpeed: null,
  lastTime: null,
  lastTurnByTime: null,
  textureWidth: null,
  textureHeight: null,
  obj: null,
  flightsCtx: null,
  renderAnimationFrameId: null,
  mousePressed: null,

  _create: function() {
    var self = this;
    this.obj = $('div');
    if (this.options.flightsCanvas !== null) {
      this.flightsCtx = this.options.flightsCanvas[0].getContext('2d');
    }
    createSphere(this.element[0], this.options.texture, function(earth, textureWidth, textureHeight) { self._onSphereCreated(earth, textureWidth, textureHeight); });
    if (this.options.dragElement !== null) {
    this.options.dragElement
      .mousedown(function(e) {
      self._mouseDragStart(e);
      self.mousePressed = true;
    })
      .mouseup(function(e) {
        self._mouseDragStop(e);
        self.mousePressed = false;
      })
      .mousemove(function(e){
        if (self.mousePressed) {
          self._mouseDrag(e);
        }
      });
    }
    for (var key in this.options.objects) {
      var object = this.options.objects[key];
      object.visible = true;
      this.options.onInitObject(object, this);
    }
    this.initFlights();
  },

  initFlights: function() {
    for (var key in this.options.paths) {
      var path = this.options.paths[key];
      for (var key in path.flights) {
        path.flights[key].visible = true;
        this.options.onInitFlight(path.flights[key], this);
      }
    }
  },

  getSphereRadiusInPixel: function() {
    /*
     4:81
     8:167
     12:261
     6:123
     10:213
     2:41
     3:61
     9:189
     7:143
     5:101
     */
    //y = -0.281536 x^2  +  -18.0437x + -4.04651
    //pair : y = -0.25 x^2  +  -18.5x + -3
    //impair
    var r = this.options.sphere.r * this.element.width() * this.options.pixelRadiusMultiplier / 300;
    var pR = -0.281536 * r * r - 18.0437 * r - 4.04651;
    return pR / 2;
  },

  _onSphereCreated: function(earth, textureWidth, textureHeight) {
    var self = this;
    this.textureWidth = textureWidth;
    this.textureHeight = textureHeight;
    this.earth = earth;
    this.earth.init(this.options.sphere);
    this.earth.turnBy = function(time) { return self._turnBy(time); };

    var renderAnimationFrame = function(/* time */ time) {
      /* time ~= +new Date // the unix time */
      earth.renderFrame(time);
      self._renderAnimationFrame(time);
      self.renderAnimationFrameId = window.requestAnimationFrame(renderAnimationFrame);
    };
    this.renderAnimationFrameId = window.requestAnimationFrame(renderAnimationFrame);
  },

  destroy: function() {
    window.cancelAnimationFrame(this.renderAnimationFrameId);
  },

  _renderAnimationFrame: function(time) {


    var ry=90+this.options.sphere.tilt;
    var rz=180+this.options.sphere.turn;

    var RY = (90-ry);
    var RZ = (180-rz);
    var RX = 0,RY,RZ;

    var rx=RX*Math.PI/180;
    var ry=RY*Math.PI/180;
    var rz=RZ*Math.PI/180;
    //console.log(rx, ry, rz);
    var r = this.getSphereRadiusInPixel();

    var center = {
      x: this.element.width() / 2,
      y: this.element.height() / 2
    }

    for (var key in this.options.objects) {
      var object = this.options.objects[key];

      if (typeof object.delta === 'undefined') {
        object.flatPosition = {x: object.x, y: object.y};
        this.options.onRefreshObject(object, object.x, object.y, this);
        continue;
      }

      var progression = (((this.posVar + this.textureWidth * object.delta / (2 * Math.PI)) % this.textureWidth) / this.textureWidth);
      var angleAlpha = progression * 2 * Math.PI;
      var angleDelta = this._calibrated(progression, object.alpha) * 2 * Math.PI;


      var objAlpha = ry + object.alpha - Math.sin(angleAlpha / 2) * 0.15 * (object.alpha - Math.PI / 2) / (Math.PI / 4);
      var objDelta = rz + angleDelta;


      //console.log(angle);

      //console.log(objAlpha, objDelta);

      var a = this._orbitalTo3d(objAlpha, objDelta, r);

      var flatPosition = this._orthographicProjection(a);

      if (a.x < 0 && !object.visible) {
        this.options.onShowObject(object, flatPosition.x, flatPosition.y, this);
      }
      if (a.x > 0 && object.visible) {
        this.options.onHideObject(object, flatPosition.x, flatPosition.y, this);
      }
      this.options.onRefreshObject(object, flatPosition.x, flatPosition.y, this);

      object.visible = a.x < 0;
      object.position = a;
      object.flatPosition = flatPosition;
      object.rAlpha = objAlpha;
      object.rDelta = objDelta;




      //console.log(x, y, z);



      // console.log(objAlpha, objDelta);
    }

    if (this.flightsCtx !== null) {
      this.flightsCtx.clearRect(0, 0, this.options.flightsCanvas.width(), this.options.flightsCanvas.height());
      for (var key in this.options.paths) {
        this.drawPath(this.options.paths[key], center, r);
      }
    }
  },



  _line_circle_intersection: function(A, B, C, r) {
    var d = {
      x: B.x - A.x,
      y: B.y - A.y
    };

    var f = {
      x: A.x - C.x,
      y: A.y - C.y
    };

    var a = this._dot(d, d);
    var b = 2 * this._dot(f, d);
    var c = this._dot(f, f) - r * r;

    var discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      return false;
    } else {
      discriminant = Math.sqrt(discriminant);
      var t1 = (-b + discriminant) / (2 * a);
      var t2 = (-b - discriminant) / (2 * a);


      var sols = [];

      if (t1 >= 0 && t1 <= 1) {
        sols.push({
          x:A.x + t1 * d.x,
          y:A.y + t1 * d.y
        });
      }

      if (t2 >= 0 && t2 <= 1) {
        sols.push({
          x:A.x + t2 * d.x,
          y:A.y + t2 * d.y
        });
      }

      return sols;
    }
  },

  _dot: function(A, B) {
    return A.x * B.x + A.y * B.y;
  },

  drawPath: function(path, center, r) {


    var originObject = this.options.objects[path.origin];
    var destinationObject = this.options.objects[path.destination];

    var dotSize = 50;
    var spacing = 0.15;

    if (typeof originObject.delta === 'undefined' || typeof destinationObject.delta === 'undefined') {
      var pathVisible = originObject.visible && destinationObject.visible;
      if (pathVisible) {


        var flatDistance = this._distance(originObject.flatPosition, destinationObject.flatPosition);

        var nb = flatDistance * 0.9 / 20;
        for (var i = 0; i < nb; i++) {


          var fromFlatPosition = {
            x: ((nb - i) / nb) * originObject.flatPosition.x + (i / nb) * destinationObject.flatPosition.x,
            y: ((nb - i) / nb) * originObject.flatPosition.y + (i / nb) * destinationObject.flatPosition.y
          };

          var toFlatPosition = {
            x: Math.max(((nb - (i + 1)) / nb), 0) * originObject.flatPosition.x + Math.min(((i + 1) / nb), 1) * destinationObject.flatPosition.x,
            y: Math.max(((nb - (i + 1)) / nb), 0) * originObject.flatPosition.y + Math.min(((i + 1) / nb), 1) * destinationObject.flatPosition.y
          };

          var diff = {
            x: fromFlatPosition.x - toFlatPosition.x,
            y: fromFlatPosition.y - toFlatPosition.y,
            z: fromFlatPosition.z - toFlatPosition.z
          };

          fromFlatPosition.x -= diff.x * spacing;
          fromFlatPosition.y -= diff.y * spacing;
          fromFlatPosition.z -= diff.z * spacing;
          toFlatPosition.x += diff.x * spacing;
          toFlatPosition.y += diff.y * spacing;
          toFlatPosition.z += diff.z * spacing;


          this.flightsCtx.lineWidth = 3;
          this.flightsCtx.beginPath();
          this.flightsCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          this.flightsCtx.moveTo(fromFlatPosition.x + this.options.flightsCanvasDecal.x, fromFlatPosition.y + this.options.flightsCanvasDecal.y);
          this.flightsCtx.lineTo(toFlatPosition.x + this.options.flightsCanvasDecal.x, toFlatPosition.y + this.options.flightsCanvasDecal.y);
          this.flightsCtx.stroke();

        }

      }



      for (var key in path.flights) {
        var flight = path.flights[key];

        var position = flight.destination == path.destination ? flight.position : (1 - flight.position);


        var flightFlatPosition = {
          x: (1 - position) * originObject.flatPosition.x + position * destinationObject.flatPosition.x,
          y: (1 - position) * originObject.flatPosition.y + position * destinationObject.flatPosition.y
        };

        if (!flight.visible && pathVisible) {
          this.options.onShowFlight(flight, this);
          flight.visible = true;
        }

        if (flight.visible && !pathVisible) {
          this.options.onHideFlight(flight, this);
          flight.visible = false;
        }

        var angle = Math.atan2(destinationObject.flatPosition.y - originObject.flatPosition.y, destinationObject.flatPosition.x - originObject.flatPosition.x) + (flight.destination == path.destination ? 0 : Math.PI);
        //console.log(flightAheadFlatPosition.y - flightFlatPosition.y);

        this.options.onRefreshFlight(flight, flightFlatPosition.x, flightFlatPosition.y, angle, this);
      }


      return;
    }

    var objectsDistance = this._distance(originObject.position, destinationObject.position);


    var middlePosition = {
      x: 0,
      y: 0,
      z: 0
    };


    var radius = this._distance(originObject.position, middlePosition);

    var originP = {
      delta: Math.atan2((originObject.position.y - middlePosition.y), (originObject.position.x - middlePosition.x)),
      alpha: Math.acos((originObject.position.z - middlePosition.z) / radius)
    };

    var destinationP = {
      delta: Math.atan2((destinationObject.position.y - middlePosition.y), (destinationObject.position.x - middlePosition.x)),
      alpha: Math.acos((destinationObject.position.z - middlePosition.z) / radius)
    };



    if (Math.abs(originP.delta - destinationP.delta) > Math.PI) {
      if ((originP.delta - destinationP.delta) > Math.PI) {
        originP.delta -= 2 * Math.PI;
      } else {
        originP.delta += 2 * Math.PI;
      }
    }

    if (path.sens) {
      if (((originP.delta - destinationP.delta) > 0 ? 1 : -1) != path.sens) {
        if (Math.abs(originP.delta - destinationP.delta) > Math.PI / 2) {
          originP.delta += path.sens * 2 * Math.PI;
        }
      }
    } else {
      path.sens = (originP.delta - destinationP.delta) > 0 ? 1 : -1;
    }


    if (!path.nb) {
      path.nb = Math.round(((objectsDistance / (2 * -r)) * Math.PI * 2 * -r + (1 - (objectsDistance / (2 * -r))) * objectsDistance) / dotSize);
    }
    var nb = path.nb;
    var maxDistance = 1.2;
    for (var i = 0; i < nb; i++) {
      var fromP = {
        alpha: ((nb - i) / nb) * originP.alpha + (i / nb) * destinationP.alpha,
        delta: ((nb - i) / nb) * originP.delta + (i / nb) * destinationP.delta
      };

      var toP = {
        alpha: ((nb - 1 - i) / nb) * originP.alpha + ((i + 1) / nb) * destinationP.alpha,
        delta: ((nb - 1 - i) / nb) * originP.delta + ((i + 1) / nb) * destinationP.delta
      };
      //console.log(i, fromP.alpha, fromP.delta, toP.alpha, toP.delta);

      var fromPosition = this._orbitalTo3d(fromP.alpha, fromP.delta, (Math.sin(Math.PI * i / nb) * (maxDistance - 1) + 1) * radius);
      var toPosition = this._orbitalTo3d(toP.alpha, toP.delta, (Math.sin(Math.PI * (i + 1) / nb) * (maxDistance - 1) + 1) * radius);
      var diff = {
        x: fromPosition.x - toPosition.x,
        y: fromPosition.y - toPosition.y,
        z: fromPosition.z - toPosition.z
      };



      fromPosition.x -= diff.x * spacing;
      fromPosition.y -= diff.y * spacing;
      fromPosition.z -= diff.z * spacing;
      toPosition.x += diff.x * spacing;
      toPosition.y += diff.y * spacing;
      toPosition.z += diff.z * spacing;


      fromPosition.x += middlePosition.x;
      fromPosition.y += middlePosition.y;
      fromPosition.z += middlePosition.z;
      toPosition.x += middlePosition.x;
      toPosition.y += middlePosition.y;
      toPosition.z += middlePosition.z;



      var fromFlatPosition = this._orthographicProjection(fromPosition);
      var toFlatPosition = this._orthographicProjection(toPosition);

      var fromDistanceCenter = this._distance(fromFlatPosition, center);
      var toDistanceCenter = this._distance(toFlatPosition, center);

      var fromVisible = true;
      var toVisible = true;
      if (fromPosition.x > 0) {
        if (fromDistanceCenter <= -r) {
          fromVisible = false;
        }
      }

      if (toPosition.x > 0) {
        if (toDistanceCenter <= -r) {
          toVisible = false;
        }
      }

      //console.log(i, fromVisible, toVisible);

      if (!fromVisible && !toVisible) {
        continue;
      }

      if (!fromVisible) {
        var intersection = this._line_circle_intersection(fromFlatPosition, toFlatPosition, center, -r);
        if (intersection.length == 0) {
          continue;
        }
        fromFlatPosition = intersection[0];
      }

      if (!toVisible) {
        var intersection = this._line_circle_intersection(fromFlatPosition, toFlatPosition, center, -r);
        if (intersection.length == 0) {
          continue;
        }
        toFlatPosition = intersection[0];
      }



      this.flightsCtx.lineWidth = 3;
      this.flightsCtx.beginPath();
      this.flightsCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.flightsCtx.moveTo(fromFlatPosition.x + this.options.flightsCanvasDecal.x, fromFlatPosition.y + this.options.flightsCanvasDecal.y);
      this.flightsCtx.lineTo(toFlatPosition.x + this.options.flightsCanvasDecal.x, toFlatPosition.y + this.options.flightsCanvasDecal.y);
      this.flightsCtx.stroke();

    }

    for (var key in path.flights) {
      var flight = path.flights[key];

      var position = flight.destination == path.destination ? flight.position : (1 - flight.position);
      var positionAhead = flight.destination == path.destination ? (flight.position + 0.01) : (1 - (flight.position + 0.01));

      var flightP = {
        alpha: (1 - position) * originP.alpha + position * destinationP.alpha,
        delta: (1 - position) * originP.delta + position * destinationP.delta
      };

      var flightAheadP = {
        alpha: (1 - positionAhead) * originP.alpha + positionAhead * destinationP.alpha,
        delta: (1 - positionAhead) * originP.delta + positionAhead * destinationP.delta
      };

      var flightPosition = this._orbitalTo3d(flightP.alpha, flightP.delta, (Math.sin(Math.PI * position) * (maxDistance - 1) + 1) * radius);
      var flightAheadPosition = this._orbitalTo3d(flightAheadP.alpha, flightAheadP.delta, (Math.sin(Math.PI * positionAhead) * (maxDistance - 1) + 1) * radius);

      flightPosition.x += middlePosition.x;
      flightPosition.y += middlePosition.y;
      flightPosition.z += middlePosition.z;
      flightAheadPosition.x += middlePosition.x;
      flightAheadPosition.y += middlePosition.y;
      flightAheadPosition.z += middlePosition.z;

      var flightFlatPosition = this._orthographicProjection(flightPosition);
      var flightAheadFlatPosition = this._orthographicProjection(flightAheadPosition);

      var flightDistanceCenter = this._distance(flightFlatPosition, center);

      if (!flight.visible && (flightPosition.x < 0 || flightDistanceCenter > -r)) {
        this.options.onShowFlight(flight, this);
        flight.visible = true;
      }

      if (flight.visible && (flightPosition.x > 0 && flightDistanceCenter < -r)) {
        this.options.onHideFlight(flight, this);
        flight.visible = false;
      }

      var angle = Math.atan2(flightAheadFlatPosition.y - flightFlatPosition.y, flightAheadFlatPosition.x - flightFlatPosition.x);
      //console.log(flightAheadFlatPosition.y - flightFlatPosition.y);

      this.options.onRefreshFlight(flight, flightFlatPosition.x, flightFlatPosition.y, angle, this);
    }

  },

  _distance: function(A, B) {
    if (A.z) {
      return Math.sqrt(
        (A.x - B.x) * (A.x - B.x) +
          (A.y - B.y) * (A.y - B.y) +
          (A.z - B.z) * (A.z - B.z)
      );
    } else {
      return Math.sqrt(
        (A.x - B.x) * (A.x - B.x) +
          (A.y - B.y) * (A.y - B.y)
      );
    }
  },

  _calibrated: function(x, alpha) {
    var calib = 0.3 + 0.15 * Math.abs(alpha - Math.PI / 2) / (Math.PI / 4);
    //console.log(calib);
    var y = calib * (4 * (x - 0.5) * (x - 0.5) * (x - 0.5) + 0.5) + (1 - calib) * x;
    return y;
  },

  _orbitalTo3d: function(alpha, delta, r) {
    return {
      x: r * Math.sin(alpha) * Math.cos(delta),
      y: r * Math.sin(alpha) * Math.sin(delta),
      z: r * Math.cos(alpha)
    };
  },


  _orthographicProjection: function(position) {
    return {x: position.y + this.element.width() / 2, y: position.z + this.element.height() / 2};
  },

  _3dProjection: function(a, c, delta, e) {
    // Wikipedia is your friend :) : http://en.wikipedia.org/wiki/3D_projection
    var d = {x: 0, y: 0, z: 0};
    d.x = Math.cos(delta.y) * (Math.sin(delta.z) * (a.y - c.y) + Math.cos(delta.z) * (a.x - c.x)) - Math.sin(delta.y) * (a.z - c.z);
    d.y = Math.sin(delta.x) * (Math.cos(delta.y) * (a.z - c.z) + Math.sin(delta.y) * (Math.sin(delta.z) * (a.y - c.y) + Math.cos(delta.z) * (a.x - c.x)))
      + Math.cos(delta.x) * (Math.cos(delta.z) * (a.y - c.y) - Math.sin(delta.z) * (a.x - c.x))
    d.z = Math.cos(delta.x) * (Math.cos(delta.y) * (a.z - c.z) + Math.sin(delta.y) * (Math.sin(delta.z) * (a.y - c.y) + Math.cos(delta.z) * (a.x - c.x)))
      - Math.sin(delta.x) * (Math.cos(delta.z) * (a.y - c.y) - Math.sin(delta.z) * (a.x - c.x));

    //console.log(d.x, d.y, d.z);

    return {
      x: d.z, //(d.x - e.x) * (e.y / d.y),
      y: d.y //(d.z - e.z) * (e.y / d.y)
    };
  },

  _mouseDragStart: function(e) {
    this.lastMousePos = e.clientX;
    this.lastSpeed = null;
  },

  _mouseDrag: function(e) {
    this.lastSpeed = (e.clientX - this.lastMousePos);
    this.posVar = this.posVar - this.lastSpeed;
    this.lastMousePos = e.clientX;
  },
  _mouseDragStop: function(e) {
    this.lastMousePos = null;
    this.lastTime = null;
  },

  _turnBy: function(time) {
    if (this.lastTurnByTime === null) {
      this.lastTurnByTime = time;
    }
    var timeDiff = (time - this.lastTurnByTime) / 1000;
    if (this.lastMousePos === null) {
      if (this.lastSpeed !== null) {
        if (this.lastTime === null) {
          this.lastTime = time;
        }
        if (this.options.backToDefaultTime + this.lastTime - time < 0) {
          this.lastSpeed = null;
        } else {
          var backToDef = (this.options.backToDefaultTime + this.lastTime - time) / this.options.backToDefaultTime;
          this.posVar -= this.lastSpeed * backToDef + (this.options.defaultSpeed * timeDiff) * (1 - backToDef);
        }
      } else {
        this.posVar -= this.options.defaultSpeed * timeDiff;
      }
    }
    this.lastTurnByTime = time;
    return this.posVar;
  },

  _getQBezierValue: function (t, p1, p2, p3) {
    var iT = 1 - t;
    return iT * iT * p1 + 2 * iT * t * p2 + t * t * p3;
  },

  _getQBezierDerivation: function(t, p1, p2, p3) {
    return (2 * p1 - 4 * p2 + 2 * p3) * t + 2 * p2 - 2 * p1;
  },

  _getQBezierAngle: function(startX, startY, cpX, cpY, endX, endY, position) {
    var x = this._getQBezierDerivation(position, startX, cpX, endX);
    var y = this._getQBezierDerivation(position, startY, cpY, endY);
    return Math.atan2(y, x);
  },

  _getQuadraticCurvePoint: function(startX, startY, cpX, cpY, endX, endY, position) {
    return {
      x:  this._getQBezierValue(position, startX, cpX, endX),
      y:  this._getQBezierValue(position, startY, cpY, endY),
      angle: this._getQBezierAngle(startX, startY, cpX, cpY, endX, endY, position)
    };
  },

  changePaths: function(paths) {
    for (var key in this.options.paths) {
      var path = this.options.paths[key];
      for (var keyFlight in path.flights) {
        var flight = path.flights[keyFlight];
        this.options.onHideFlight(flight, this);
      }
    }
    this.options.paths = paths;
    this.initFlights();
  }

});
