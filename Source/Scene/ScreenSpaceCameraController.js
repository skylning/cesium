/*global define*/
define([
        '../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Core/Cartesian4',
        '../Core/Cartographic',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/Ellipsoid',
        '../Core/FAR',
        '../Core/IntersectionTests',
        '../Core/isArray',
        '../Core/KeyboardEventModifier',
        '../Core/Math',
        '../Core/Matrix3',
        '../Core/Matrix4',
        '../Core/Plane',
        '../Core/Quaternion',
        '../Core/Ray',
        '../Core/Transforms',
        './AnimationCollection',
        './CameraEventAggregator',
        './CameraEventType',
        './SceneMode'
    ], function(
        Cartesian2,
        Cartesian3,
        Cartesian4,
        Cartographic,
        defaultValue,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        Ellipsoid,
        FAR,
        IntersectionTests,
        isArray,
        KeyboardEventModifier,
        CesiumMath,
        Matrix3,
        Matrix4,
        Plane,
        Quaternion,
        Ray,
        Transforms,
        AnimationCollection,
        CameraEventAggregator,
        CameraEventType,
        SceneMode) {
    "use strict";

    /**
     * Modifies the camera position and orientation based on mouse input to a canvas.
     * @alias ScreenSpaceCameraController
     * @constructor
     *
     * @param {Scene} scene The scene.
     */
    var ScreenSpaceCameraController = function(scene) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(scene)) {
            throw new DeveloperError('scene is required.');
        }
        //>>includeEnd('debug');

        /**
         * If true, inputs are allowed conditionally with the flags enableTranslate, enableZoom,
         * enableRotate, enableTilt, and enableLook.  If false, all inputs are disabled.
         *
         * NOTE: This setting is for temporary use cases, such as camera flights and
         * drag-selection of regions (see Picking demo).  It is typically set to false at the
         * start of such events, and set true on completion.  To keep inputs disabled
         * past the end of camera flights, you must use the other booleans (enableTranslate,
         * enableZoom, enableRotate, enableTilt, and enableLook).
         * @type {Boolean}
         * @default true
         */
        this.enableInputs = true;
        /**
         * If true, allows the user to pan around the map.  If false, the camera stays locked at the current position.
         * This flag only applies in 2D and Columbus view modes.
         * @type {Boolean}
         * @default true
         */
        this.enableTranslate = true;
        /**
         * If true, allows the user to zoom in and out.  If false, the camera is locked to the current distance from the ellipsoid.
         * @type {Boolean}
         * @default true
         */
        this.enableZoom = true;
        /**
         * If true, allows the user to rotate the camera.  If false, the camera is locked to the current heading.
         * This flag only applies in 2D and 3D.
         * @type {Boolean}
         * @default true
         */
        this.enableRotate = true;
        /**
         * If true, allows the user to tilt the camera.  If false, the camera is locked to the current heading.
         * This flag only applies in 3D and Columbus view.
         * @type {Boolean}
         * @default true
         */
        this.enableTilt = true;
        /**
         * If true, allows the user to use free-look. If false, the camera view direction can only be changed through translating
         * or rotating. This flag only applies in 3D and Columbus view modes.
         * @type {Boolean}
         * @default true
         */
        this.enableLook = true;
        /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to spin because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.9
         */
        this.inertiaSpin = 0.9;
        /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to translate because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.9
         */
        this.inertiaTranslate = 0.9;
        /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to zoom because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.8
         */
        this.inertiaZoom = 0.8;
        /**
         * A parameter in the range <code>[0, 1)</code> used to limit the range
         * of various user inputs to a percentage of the window width/height per animation frame.
         * This helps keep the camera under control in low-frame-rate situations.
         * @type {Number}
         * @default 0.1
         */
        this.maximumMovementRatio = 0.1;
        /**
         * Sets the duration, in milliseconds, of the bounce back animations in 2D and Columbus view. The default value is 3000.
         * @type {Number}
         * @default 3000.0
         */
        this.bounceAnimationTime = 3000.0;
        /**
         * The minimum magnitude, in meters, of the camera position when zooming. Defaults to 20.0.
         * @type {Number}
         * @default 20.0
         */
        this.minimumZoomDistance = 20.0;
        /**
         * The maximum magnitude, in meters, of the camera position when zooming. Defaults to positive infinity.
         * @type {Number}
         * @default {@link Number.POSITIVE_INFINITY}
         */
        this.maximumZoomDistance = Number.POSITIVE_INFINITY;
        /**
         * The input that allows the user to pan around the map. This only applies in 2D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default {@link CameraEventType.LEFT_DRAG}
         */
        this.translateEventTypes = CameraEventType.LEFT_DRAG;
        /**
         * The input that allows the user to zoom in/out.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default [{@link CameraEventType.RIGHT_DRAG}, {@link CameraEventType.WHEEL}, {@link CameraEventType.PINCH}]
         */
        this.zoomEventTypes = [CameraEventType.RIGHT_DRAG, CameraEventType.WHEEL, CameraEventType.PINCH];
        /**
         * The input that allows the user to rotate around the globe or another object. This only applies in 3D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default {@link CameraEventType.LEFT_DRAG}
         */
        this.rotateEventTypes = CameraEventType.LEFT_DRAG;
        /**
         * The input that allows the user to tilt in 3D and Columbus view or twist in 2D.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default [{@link CameraEventType.MIDDLE_DRAG}, {@link CameraEventType.PINCH}, {
         *     eventType : {@link CameraEventType.LEFT_DRAG},
         *     modifier : {@link KeyboardEventModifier.CTRL}
         * }]
         */
        this.tiltEventTypes = [CameraEventType.MIDDLE_DRAG, CameraEventType.PINCH, {
            eventType : CameraEventType.LEFT_DRAG,
            modifier : KeyboardEventModifier.CTRL
        }];
        /**
         * The input that allows the user to change the direction the camera is viewing. This only applies in 3D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default { eventType : {@link CameraEventType.LEFT_DRAG}, modifier : {@link KeyboardEventModifier.SHIFT} }
         */
        this.lookEventTypes = {
            eventType : CameraEventType.LEFT_DRAG,
            modifier : KeyboardEventModifier.SHIFT
        };
        /**
         * The minimum height the camera must be before picking the terrain instead of the ellipsoid.
         * @type {Number}
         * @default 150000.0
         */
        this.minimumPickingTerrainHeight = 150000.0;
        /**
         * The minimum height the camera must be before tesing for collision with terrain.
         * @type {Number}
         * @default 10000.0
         */
        this.minimumCollisionTerrainHeight = 10000.0;

        this._scene = scene;
        this._globe = undefined;
        this._ellipsoid = undefined;

        this._aggregator = new CameraEventAggregator(scene.canvas);

        this._lastInertiaSpinMovement = undefined;
        this._lastInertiaZoomMovement = undefined;
        this._lastInertiaTranslateMovement = undefined;
        this._lastInertiaWheelZoomMovement = undefined;
        this._lastInertiaTiltMovement = undefined;

        this._animations = new AnimationCollection();
        this._animation = undefined;

        this._horizontalRotationAxis = undefined;

        this._tiltCenterMousePosition = new Cartesian2();
        this._tiltCenter = new Cartesian3();

        // Constants, Make any of these public?
        this._zoomFactor = 5.0;
        this._rotateFactor = undefined;
        this._rotateRateRangeAdjustment = undefined;
        this._maximumRotateRate = 1.77;
        this._minimumRotateRate = 1.0 / 5000.0;
        this._translateFactor = 1.0;
        this._minimumZoomRate = 20.0;
        this._maximumZoomRate = FAR;
    };

    function decay(time, coefficient) {
        if (time < 0) {
            return 0.0;
        }

        var tau = (1.0 - coefficient) * 25.0;
        return Math.exp(-tau * time);
    }

    function sameMousePosition(movement) {
        return Cartesian2.equalsEpsilon(movement.startPosition, movement.endPosition, CesiumMath.EPSILON14);
    }

    // If the time between mouse down and mouse up is not between
    // these thresholds, the camera will not move with inertia.
    // This value is probably dependent on the browser and/or the
    // hardware. Should be investigated further.
    var inertiaMaxClickTimeThreshold = 0.4;

    function maintainInertia(aggregator, frameState, type, modifier, decayCoef, action, object, lastMovementName) {
        var movementState = object[lastMovementName];
        if (!defined(movementState)) {
            movementState = object[lastMovementName] = {
                startPosition : new Cartesian2(),
                endPosition : new Cartesian2(),
                motion : new Cartesian2(),
                active : false
            };
        }

        var ts = aggregator.getButtonPressTime(type, modifier);
        var tr = aggregator.getButtonReleaseTime(type, modifier);

        var threshold = ts && tr && ((tr.getTime() - ts.getTime()) / 1000.0);
        var now = new Date();
        var fromNow = tr && ((now.getTime() - tr.getTime()) / 1000.0);

        if (ts && tr && threshold < inertiaMaxClickTimeThreshold) {
            var d = decay(fromNow, decayCoef);

            if (!movementState.active) {
                var lastMovement = aggregator.getLastMovement(type, modifier);
                if (!defined(lastMovement) || sameMousePosition(lastMovement)) {
                    return;
                }

                movementState.motion.x = (lastMovement.endPosition.x - lastMovement.startPosition.x) * 0.5;
                movementState.motion.y = (lastMovement.endPosition.y - lastMovement.startPosition.y) * 0.5;

                movementState.startPosition = Cartesian2.clone(lastMovement.startPosition, movementState.startPosition);

                movementState.endPosition = Cartesian2.multiplyByScalar(movementState.motion, d, movementState.endPosition);
                movementState.endPosition = Cartesian2.add(movementState.startPosition, movementState.endPosition, movementState.endPosition);

                movementState.active = true;
            } else {
                movementState.startPosition = Cartesian2.clone(movementState.endPosition, movementState.startPosition);

                movementState.endPosition = Cartesian2.multiplyByScalar(movementState.motion, d, movementState.endPosition);
                movementState.endPosition = Cartesian2.add(movementState.startPosition, movementState.endPosition, movementState.endPosition);

                movementState.motion = Cartesian3.clone(Cartesian2.ZERO, movementState.motion);
            }

            // If value from the decreasing exponential function is close to zero,
            // the end coordinates may be NaN.
            if (isNaN(movementState.endPosition.x) || isNaN(movementState.endPosition.y) || sameMousePosition(movementState)) {
                movementState.active = false;
                return;
            }

            if (!aggregator.isButtonDown(type, modifier)) {
                var startPosition = aggregator.getStartMousePosition(type, modifier);
                action(object, startPosition, movementState, frameState);
            }
        } else {
            movementState.active = false;
        }
    }

    var scratchEventTypeArray = [];

    function reactToInput(controller, frameState, enabled, eventTypes, action, inertiaConstant, inertiaStateName) {
        if (!defined(eventTypes)) {
            return;
        }

        var aggregator = controller._aggregator;

        if (!isArray(eventTypes)) {
            scratchEventTypeArray[0] = eventTypes;
            eventTypes = scratchEventTypeArray;
        }

        var length = eventTypes.length;
        for (var i = 0; i < length; ++i) {
            var eventType = eventTypes[i];
            var type = defined(eventType.eventType) ? eventType.eventType : eventType;
            var modifier = eventType.modifier;

            var movement = aggregator.isMoving(type, modifier) && aggregator.getMovement(type, modifier);
            var startPosition = aggregator.getStartMousePosition(type, modifier);

            if (controller.enableInputs && enabled) {
                if (movement) {
                    action(controller, startPosition, movement, frameState);
                } else if (inertiaConstant < 1.0) {
                    maintainInertia(aggregator, frameState, type, modifier, inertiaConstant, action, controller, inertiaStateName);
                }
            }
        }
    }

    function handleZoom(object, startPosition, movement, frameState, zoomFactor, distanceMeasure, unitPositionDotDirection) {
        var percentage = 1.0;
        if (defined(unitPositionDotDirection)) {
            percentage = CesiumMath.clamp(Math.abs(unitPositionDotDirection), 0.25, 1.0);
        }

        // distanceMeasure should be the height above the ellipsoid.
        // The zoomRate slows as it approaches the surface and stops minimumZoomDistance above it.
        var minHeight = object.minimumZoomDistance * percentage;
        var maxHeight = object.maximumZoomDistance;

        var minDistance = distanceMeasure - minHeight;
        var zoomRate = zoomFactor * minDistance;
        zoomRate = CesiumMath.clamp(zoomRate, object._minimumZoomRate, object._maximumZoomRate);

        var diff = movement.endPosition.y - movement.startPosition.y;
        var rangeWindowRatio = diff / object._scene.canvas.clientHeight;
        rangeWindowRatio = Math.min(rangeWindowRatio, object.maximumMovementRatio);
        var distance = zoomRate * rangeWindowRatio;

        if (distance > 0.0 && Math.abs(distanceMeasure - minHeight) < 1.0) {
            return;
        }

        if (distance < 0.0 && Math.abs(distanceMeasure - maxHeight) < 1.0) {
            return;
        }

        if (distanceMeasure - distance < minHeight) {
            distance = distanceMeasure - minHeight - 1.0;
        } else if (distanceMeasure - distance > maxHeight) {
            distance = distanceMeasure - maxHeight;
        }

        object._scene.camera.zoomIn(distance);
    }

    var translate2DStart = new Ray();
    var translate2DEnd = new Ray();
    var scratchTranslateP0 = new Cartesian3();
    var scratchTranslateP1 = new Cartesian3();

    function translate2D(controller, startPosition, movement, frameState) {
        var camera = controller._scene.camera;
        var start = camera.getPickRay(movement.startPosition, translate2DStart).origin;
        var end = camera.getPickRay(movement.endPosition, translate2DEnd).origin;

        var position = camera.position;
        var p0 = Cartesian3.subtract(start, position, scratchTranslateP0);
        var p1 = Cartesian3.subtract(end, position, scratchTranslateP1);
        var direction = Cartesian3.subtract(p0, p1, scratchTranslateP0);
        var distance = Cartesian3.magnitude(direction);

        if (distance > 0.0) {
            Cartesian3.normalize(direction, direction);
            camera.move(direction, distance);
        }
    }

    function zoom2D(controller, startPosition, movement, frameState) {
        if (defined(movement.distance)) {
            movement = movement.distance;
        }

        handleZoom(controller, startPosition, movement, frameState, controller._zoomFactor, controller._scene.camera.getMagnitude());
    }

    var twist2DStart = new Cartesian2();
    var twist2DEnd = new Cartesian2();
    function twist2D(controller, startPosition, movement, frameState) {
        if (defined(movement.angleAndHeight)) {
            singleAxisTwist2D(controller, startPosition, movement.angleAndHeight, frameState);
            return;
        }

        var canvas = controller._scene.canvas;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;

        var start = twist2DStart;
        start.x = (2.0 / width) * movement.startPosition.x - 1.0;
        start.y = (2.0 / height) * (height - movement.startPosition.y) - 1.0;
        start = Cartesian2.normalize(start, start);

        var end = twist2DEnd;
        end.x = (2.0 / width) * movement.endPosition.x - 1.0;
        end.y = (2.0 / height) * (height - movement.endPosition.y) - 1.0;
        end = Cartesian2.normalize(end, end);

        var startTheta = CesiumMath.acosClamped(start.x);
        if (start.y < 0) {
            startTheta = CesiumMath.TWO_PI - startTheta;
        }
        var endTheta = CesiumMath.acosClamped(end.x);
        if (end.y < 0) {
            endTheta = CesiumMath.TWO_PI - endTheta;
        }
        var theta = endTheta - startTheta;

        controller._scene.camera.twistRight(theta);
    }

    function singleAxisTwist2D(controller, startPosition, movement, frameState) {
        var rotateRate = controller._rotateFactor * controller._rotateRateRangeAdjustment;

        if (rotateRate > controller._maximumRotateRate) {
            rotateRate = controller._maximumRotateRate;
        }

        if (rotateRate < controller._minimumRotateRate) {
            rotateRate = controller._minimumRotateRate;
        }

        var phiWindowRatio = (movement.endPosition.x - movement.startPosition.x) / controller._scene.canvas.clientWidth;
        phiWindowRatio = Math.min(phiWindowRatio, controller.maximumMovementRatio);

        var deltaPhi = rotateRate * phiWindowRatio * Math.PI * 4.0;

        controller._scene.camera.twistRight(deltaPhi);
    }

    function update2D(controller, frameState) {
        var animations = controller._animations;
        if (controller._aggregator.anyButtonDown()) {
            animations.removeAll();
        }

        var camera = controller._scene.camera;

        if (!Matrix4.equals(Matrix4.IDENTITY, camera.transform)) {
            reactToInput(controller, frameState, controller.enableRotate, controller.translateEventTypes, twist2D, controller.inertiaSpin, '_lastInertiaSpinMovement');
            reactToInput(controller, frameState, controller.enableZoom, controller.zoomEventTypes, zoom3D, controller.inertiaZoom, '_lastInertiaZoomMovement');
        } else {
            reactToInput(controller, frameState, controller.enableTranslate, controller.translateEventTypes, translate2D, controller.inertiaTranslate, '_lastInertiaTranslateMovement');
            reactToInput(controller, frameState, controller.enableZoom, controller.zoomEventTypes, zoom2D, controller.inertiaZoom, '_lastInertiaZoomMovement');
            reactToInput(controller, frameState, controller.enableRotate, controller.tiltEventTypes, twist2D, controller.inertiaSpin, '_lastInertiaTiltMovement');
        }

        if (!controller._aggregator.anyButtonDown() &&
                (!defined(controller._lastInertiaZoomMovement) || !controller._lastInertiaZoomMovement.active) &&
                (!defined(controller._lastInertiaTranslateMovement) || !controller._lastInertiaTranslateMovement.active) &&
                !animations.contains(controller._animation)) {
            var animation = camera.createCorrectPositionAnimation(controller.bounceAnimationTime);
            if (defined(animation)) {
                controller._animation = animations.add(animation);
            }
        }

        animations.update();
    }

    var translateCVStartRay = new Ray();
    var translateCVEndRay = new Ray();
    var translateCVStartPos = new Cartesian3();
    var translateCVEndPos = new Cartesian3();
    var translatCVDifference = new Cartesian3();
    var translateCVOrigin = new Cartesian3();
    var translateCVPlane = new Plane(Cartesian3.ZERO, 0.0);

    function translateCV(controller, startPosition, movement, frameState) {
        var camera = controller._scene.camera;
        var startRay = camera.getPickRay(movement.startPosition, translateCVStartRay);
        var endRay = camera.getPickRay(movement.endPosition, translateCVEndRay);

        var origin = Cartesian3.clone(Cartesian3.ZERO, translateCVOrigin);
        var normal = Cartesian3.UNIT_X;

        var startPlanePos;

        if (defined(controller._globe) && camera.position.z < controller.minimumPickingTerrainHeight) {
            startPlanePos = controller._globe.pick(startRay, frameState, translateCVStartPos);
            if (defined(startPlanePos)) {
                origin.x = startPlanePos.x;
            }
        }

        if (!defined(startPlanePos)) {
            var position = startRay.origin;
            var direction = startRay.direction;

            var scalar = -Cartesian3.dot(normal, position) / Cartesian3.dot(normal, direction);
            startPlanePos = Cartesian3.multiplyByScalar(direction, scalar, translateCVStartPos);
            Cartesian3.add(position, startPlanePos, startPlanePos);
        }

        var plane = Plane.fromPointNormal(origin, normal, translateCVPlane);
        var endPlanePos = IntersectionTests.rayPlane(endRay, plane, translateCVEndPos);

        if (!defined(startPlanePos) || !defined(endPlanePos)) {
            return;
        }

        var diff = Cartesian3.subtract(startPlanePos, endPlanePos, translatCVDifference);
        var temp = diff.x;
        diff.x = diff.y;
        diff.y = diff.z;
        diff.z = temp;
        var mag = Cartesian3.magnitude(diff);
        if (mag > CesiumMath.EPSILON6) {
            Cartesian3.normalize(diff, diff);
            camera.move(diff, mag);
        }
    }

    var rotateCVWindowPos = new Cartesian2();
    var rotateCVWindowRay = new Ray();
    var rotateCVCenter = new Cartesian3();
    var rotateCVVerticalCenter = new Cartesian3();
    var rotateCVTransform = new Matrix4();
    var rotateCVVerticalTransform = new Matrix4();
    var rotateCVOrigin = new Cartesian3();
    var rotateCVPlane = new Plane(Cartesian3.ZERO, 0.0);
    var rotateCVCartesian3 = new Cartesian3();
    var rotateCVCart = new Cartographic();
    var rotateCVOldTransform = new Matrix4();
    var rotateCVQuaternion = new Quaternion();
    var rotateCVMatrix = new Matrix3();

    function rotateCV(controller, startPosition, movement, frameState) {
        if (defined(movement.angleAndHeight)) {
            movement = movement.angleAndHeight;
        }

        var ellipsoid = controller._ellipsoid;
        var camera = controller._scene.camera;

        var center;
        var ray;
        var intersection;
        var normal = Cartesian3.UNIT_X;

        if (Cartesian2.equals(startPosition, controller._tiltCenterMousePosition)) {
            center = Cartesian3.clone(controller._tiltCenter, rotateCVCenter);
        } else {
            ray = camera.getPickRay(startPosition, rotateCVWindowRay);
            if (defined(controller._globe) && camera.position.z < controller.minimumPickingTerrainHeight) {
                center = controller._globe.pick(ray, frameState, rotateCVCenter);
            }

            if (!defined(center)) {
                var position = ray.origin;
                var direction = ray.direction;
                var scalar = -Cartesian3.dot(normal, position) / Cartesian3.dot(normal, direction);
                center = Cartesian3.multiplyByScalar(direction, scalar, rotateCVCenter);
                Cartesian3.add(position, center, center);
            }

            Cartesian2.clone(startPosition, controller._tiltCenterMousePosition);
            Cartesian3.clone(center, controller._tiltCenter);
        }

        var windowPosition = rotateCVWindowPos;
        windowPosition.x = controller._scene.canvas.clientWidth / 2;
        windowPosition.y = controller._tiltCenterMousePosition.y;
        ray = camera.getPickRay(windowPosition, rotateCVWindowRay);

        var origin = Cartesian3.clone(Cartesian3.ZERO, rotateCVOrigin);
        origin.x = center.x;

        var plane = Plane.fromPointNormal(origin, normal, rotateCVPlane);
        var verticalCenter = IntersectionTests.rayPlane(ray, plane, rotateCVVerticalCenter);

        var projection = controller._scene.camera._projection;
        ellipsoid = projection.ellipsoid;

        Cartesian3.fromElements(center.y, center.z, center.x, center);
        var cart = projection.unproject(center, rotateCVCart);
        ellipsoid.cartographicToCartesian(cart, center);

        var transform = Transforms.eastNorthUpToFixedFrame(center, ellipsoid, rotateCVTransform);

        var verticalTransform;
        if (defined(verticalCenter)) {
            Cartesian3.fromElements(verticalCenter.y, verticalCenter.z, verticalCenter.x, verticalCenter);
            cart = projection.unproject(verticalCenter, rotateCVCart);
            ellipsoid.cartographicToCartesian(cart, verticalCenter);

            verticalTransform = Transforms.eastNorthUpToFixedFrame(verticalCenter, ellipsoid, rotateCVVerticalTransform);
        } else {
            verticalTransform = transform;
        }

        var oldGlobe = controller._globe;
        var oldEllipsoid = controller._ellipsoid;
        controller._globe = undefined;
        controller._ellipsoid = Ellipsoid.UNIT_SPHERE;
        controller._rotateFactor = 1.0;
        controller._rotateRateRangeAdjustment = 1.0;

        var constrainedAxis = Cartesian3.UNIT_Z;

        var oldTransform = Matrix4.clone(camera.transform, rotateCVOldTransform);
        camera.setTransform(transform);

        var tangent = Cartesian3.cross(Cartesian3.UNIT_Z, Cartesian3.normalize(camera.position, rotateCVCartesian3), rotateCVCartesian3);
        var dot = Cartesian3.dot(camera.right, tangent);

        rotate3D(controller, startPosition, movement, frameState, constrainedAxis, false, true);

        camera.setTransform(verticalTransform);
        if (dot < 0.0) {
            if (movement.startPosition.y > movement.endPosition.y) {
                constrainedAxis = undefined;
            }

            var oldConstrainedAxis = camera.constrainedAxis;
            camera.constrainedAxis = undefined;

            rotate3D(controller, startPosition, movement, frameState, constrainedAxis, true, false);

            camera.constrainedAxis = oldConstrainedAxis;
        } else {
            rotate3D(controller, startPosition, movement, frameState, constrainedAxis, true, false);
        }

        if (defined(camera.constrainedAxis)) {
            var right = Cartesian3.cross(camera.direction, camera.constrainedAxis, tilt3DCartesian3);
            if (!Cartesian3.equalsEpsilon(right, Cartesian3.ZERO, CesiumMath.EPSILON6)) {
                if (Cartesian3.dot(right, camera.right) < 0.0) {
                    Cartesian3.negate(right, right);
                }

                Cartesian3.cross(right, camera.direction, camera.up);
                Cartesian3.cross(camera.direction, camera.up, camera.right);

                Cartesian3.normalize(camera.up, camera.up);
                Cartesian3.normalize(camera.right, camera.right);
            }
        }

        camera.setTransform(oldTransform);
        controller._globe = oldGlobe;
        controller._ellipsoid = oldEllipsoid;

        var radius = oldEllipsoid.maximumRadius;
        controller._rotateFactor = 1.0 / radius;
        controller._rotateRateRangeAdjustment = radius;

        var originalPosition = Cartesian3.clone(camera.positionWC, rotateCVCartesian3);
        adjustHeightForTerrain(controller, frameState);

        if (!Cartesian3.equals(camera.positionWC, originalPosition)) {
            camera.setTransform(verticalTransform);
            camera.worldToCameraCoordinatesPoint(originalPosition, originalPosition);

            var angle = Cartesian3.angleBetween(originalPosition, camera.position);
            var axis = Cartesian3.cross(originalPosition, camera.position, originalPosition);
            Cartesian3.normalize(axis, axis);

            var quaternion = Quaternion.fromAxisAngle(axis, angle, rotateCVQuaternion);
            var rotation = Matrix3.fromQuaternion(quaternion, rotateCVMatrix);
            Matrix3.multiplyByVector(rotation, camera.direction, camera.direction);
            Matrix3.multiplyByVector(rotation, camera.up, camera.up);
            Cartesian3.cross(camera.direction, camera.up, camera.right);
            Cartesian3.cross(camera.right, camera.direction, camera.up);

            camera.setTransform(oldTransform);
        }
    }

    var zoomCVWindowPos = new Cartesian2();
    var zoomCVWindowRay = new Ray();
    function zoomCV(controller, startPosition, movement, frameState) {
        if (defined(movement.distance)) {
            movement = movement.distance;
        }

        var canvas = controller._scene.canvas;

        var windowPosition = zoomCVWindowPos;
        windowPosition.x = canvas.clientWidth / 2;
        windowPosition.y = canvas.clientHeight / 2;
        var ray = controller._scene.camera.getPickRay(windowPosition, zoomCVWindowRay);
        var normal = Cartesian3.UNIT_X;

        var position = ray.origin;
        var direction = ray.direction;
        var scalar = -Cartesian3.dot(normal, position) / Cartesian3.dot(normal, direction);

        handleZoom(controller, startPosition, movement, frameState, controller._zoomFactor, scalar);
    }

    function updateCV(controller, frameState) {
        var camera = controller._scene.camera;

        if (!Matrix4.equals(Matrix4.IDENTITY, camera.transform)) {
            reactToInput(controller, frameState, controller.enableRotate, controller.rotateEventTypes, rotate3D, controller.inertiaSpin, '_lastInertiaSpinMovement');
            reactToInput(controller, frameState, controller.enableZoom, controller.zoomEventTypes, zoom3D, controller.inertiaZoom, '_lastInertiaZoomMovement');
        } else {
            var animations = controller._animations;

            if (controller._aggregator.anyButtonDown()) {
                animations.removeAll();
            }

            reactToInput(controller, frameState, controller.enableTilt, controller.tiltEventTypes, rotateCV, controller.inertiaSpin, '_lastInertiaTiltMovement');
            reactToInput(controller, frameState, controller.enableTranslate, controller.translateEventTypes, translateCV, controller.inertiaTranslate, '_lastInertiaTranslateMovement');
            reactToInput(controller, frameState, controller.enableZoom, controller.zoomEventTypes, zoomCV, controller.inertiaZoom, '_lastInertiaZoomMovement');
            reactToInput(controller, frameState, controller.enableLook, controller.lookEventTypes, look3D);

            if (!controller._aggregator.anyButtonDown() && (!defined(controller._lastInertiaZoomMovement) || !controller._lastInertiaZoomMovement.active) &&
                    (!defined(controller._lastInertiaTranslateMovement) || !controller._lastInertiaTranslateMovement.active) &&
                    !animations.contains(controller._animation)) {
                var animation = camera.createCorrectPositionAnimation(controller.bounceAnimationTime);
                if (defined(animation)) {
                    controller._animation = animations.add(animation);
                }
            }

            animations.update();
        }
    }

    var spin3DPick = new Cartesian3();
    var scratchStartRay = new Ray();
    var scratchCartographic = new Cartographic();
    var scratchMousePos = new Cartesian3();
    var scratchRadii = new Cartesian3();
    var scratchEllipsoid = new Ellipsoid();

    function spin3D(controller, startPosition, movement, frameState) {
        var camera = controller._scene.camera;
        if (!Matrix4.equals(camera.transform, Matrix4.IDENTITY)) {
            rotate3D(controller, startPosition, movement, frameState);
            return;
        }

        var height = controller._ellipsoid.cartesianToCartographic(camera.positionWC, scratchCartographic).height;
        if (defined(controller._globe) && height < controller.minimumPickingTerrainHeight) {
            var startRay = camera.getPickRay(movement.startPosition, scratchStartRay);
            var mousePos = controller._globe.pick(startRay, frameState, scratchMousePos);
            if (defined(mousePos)) {
                var magnitude = Cartesian3.magnitude(mousePos);
                var radii = scratchRadii;
                radii.x = radii.y = radii.z = magnitude;
                var ellipsoid = Ellipsoid.fromCartesian3(radii, scratchEllipsoid);
                pan3D(controller, startPosition, movement, frameState, ellipsoid);
            }
        } else if (defined(camera.pickEllipsoid(movement.startPosition, controller._ellipsoid, spin3DPick))) {
            pan3D(controller, startPosition, movement, frameState, controller._ellipsoid);
        }
    }

    function rotate3D(controller, startPosition, movement, frameState, constrainedAxis, rotateOnlyVertical, rotateOnlyHorizontal) {
        rotateOnlyVertical = defaultValue(rotateOnlyVertical, false);
        rotateOnlyHorizontal = defaultValue(rotateOnlyHorizontal, false);

        var camera = controller._scene.camera;
        var oldAxis = camera.constrainedAxis;
        if (defined(constrainedAxis)) {
            camera.constrainedAxis = constrainedAxis;
        }

        var rho = Cartesian3.magnitude(camera.position);
        var rotateRate = controller._rotateFactor * (rho - controller._rotateRateRangeAdjustment);

        if (rotateRate > controller._maximumRotateRate) {
            rotateRate = controller._maximumRotateRate;
        }

        if (rotateRate < controller._minimumRotateRate) {
            rotateRate = controller._minimumRotateRate;
        }

        var canvas = controller._scene.canvas;
        var phiWindowRatio = (movement.startPosition.x - movement.endPosition.x) / canvas.clientWidth;
        var thetaWindowRatio = (movement.startPosition.y - movement.endPosition.y) / canvas.clientHeight;
        phiWindowRatio = Math.min(phiWindowRatio, controller.maximumMovementRatio);
        thetaWindowRatio = Math.min(thetaWindowRatio, controller.maximumMovementRatio);

        var deltaPhi = rotateRate * phiWindowRatio * Math.PI * 2.0;
        var deltaTheta = rotateRate * thetaWindowRatio * Math.PI;

        if (!rotateOnlyVertical) {
            camera.rotateRight(deltaPhi);
        }

        if (!rotateOnlyHorizontal) {
            camera.rotateUp(deltaTheta);
        }

        camera.constrainedAxis = oldAxis;
    }

    var pan3DP0 = Cartesian4.clone(Cartesian4.UNIT_W);
    var pan3DP1 = Cartesian4.clone(Cartesian4.UNIT_W);
    var pan3DTemp0 = new Cartesian3();
    var pan3DTemp1 = new Cartesian3();
    var pan3DTemp2 = new Cartesian3();
    var pan3DTemp3 = new Cartesian3();
    var pan3DStartMousePosition = new Cartesian2();
    var pan3DEndMousePosition = new Cartesian2();

    function pan3D(controller, startPosition, movement, frameState, ellipsoid) {
        var camera = controller._scene.camera;
        var cameraPosMag = Cartesian3.magnitude(camera.position);

        var startMousePosition = Cartesian2.clone(movement.startPosition, pan3DStartMousePosition);
        var endMousePosition = Cartesian2.clone(movement.endPosition, pan3DEndMousePosition);
        if (cameraPosMag < ellipsoid.maximumRadius) {
            startMousePosition.y = endMousePosition.y;
            endMousePosition.y = movement.startPosition.y;
        }

        var p0 = camera.pickEllipsoid(startMousePosition, ellipsoid, pan3DP0);
        var p1 = camera.pickEllipsoid(endMousePosition, ellipsoid, pan3DP1);

        if (!defined(p0) || !defined(p1)) {
            return;
        }

        p0 = camera.worldToCameraCoordinates(p0, p0);
        p1 = camera.worldToCameraCoordinates(p1, p1);

        if (!defined(camera.constrainedAxis)) {
            Cartesian3.normalize(p0, p0);
            Cartesian3.normalize(p1, p1);
            var dot = Cartesian3.dot(p0, p1);
            var axis = Cartesian3.cross(p0, p1, pan3DTemp0);

            if (dot < 1.0 && !Cartesian3.equalsEpsilon(axis, Cartesian3.ZERO, CesiumMath.EPSILON14)) { // dot is in [0, 1]
                var angle = Math.acos(dot);
                camera.rotate(axis, angle);
            }
        } else {
            var basis0 = camera.constrainedAxis;
            var basis1 = Cartesian3.mostOrthogonalAxis(basis0, pan3DTemp0);
            Cartesian3.cross(basis1, basis0, basis1);
            Cartesian3.normalize(basis1, basis1);
            var basis2 = Cartesian3.cross(basis0, basis1, pan3DTemp1);

            var startRho = Cartesian3.magnitude(p0);
            var startDot = Cartesian3.dot(basis0, p0);
            var startTheta = Math.acos(startDot / startRho);
            var startRej = Cartesian3.multiplyByScalar(basis0, startDot, pan3DTemp2);
            Cartesian3.subtract(p0, startRej, startRej);
            Cartesian3.normalize(startRej, startRej);

            var endRho = Cartesian3.magnitude(p1);
            var endDot = Cartesian3.dot(basis0, p1);
            var endTheta = Math.acos(endDot / endRho);
            var endRej = Cartesian3.multiplyByScalar(basis0, endDot, pan3DTemp3);
            Cartesian3.subtract(p1, endRej, endRej);
            Cartesian3.normalize(endRej, endRej);

            var startPhi = Math.acos(Cartesian3.dot(startRej, basis1));
            if (Cartesian3.dot(startRej, basis2) < 0) {
                startPhi = CesiumMath.TWO_PI - startPhi;
            }

            var endPhi = Math.acos(Cartesian3.dot(endRej, basis1));
            if (Cartesian3.dot(endRej, basis2) < 0) {
                endPhi = CesiumMath.TWO_PI - endPhi;
            }

            var deltaPhi = startPhi - endPhi;

            var east;
            if (Cartesian3.equalsEpsilon(basis0, camera.position, CesiumMath.EPSILON2)) {
                east = camera.right;
            } else {
                east = Cartesian3.cross(basis0, camera.position, pan3DTemp0);
            }

            var planeNormal = Cartesian3.cross(basis0, east, pan3DTemp0);
            var side0 = Cartesian3.dot(planeNormal, Cartesian3.subtract(p0, basis0, pan3DTemp1));
            var side1 = Cartesian3.dot(planeNormal, Cartesian3.subtract(p1, basis0, pan3DTemp1));

            var deltaTheta;
            if (side0 > 0 && side1 > 0) {
                deltaTheta = endTheta - startTheta;
            } else if (side0 > 0 && side1 <= 0) {
                if (Cartesian3.dot(camera.position, basis0) > 0) {
                    deltaTheta = -startTheta - endTheta;
                } else {
                    deltaTheta = startTheta + endTheta;
                }
            } else {
                deltaTheta = startTheta - endTheta;
            }

            camera.rotateRight(deltaPhi);
            camera.rotateUp(deltaTheta);
        }
    }

    var zoom3DUnitPosition = new Cartesian3();
    function zoom3D(controller, startPosition, movement, frameState) {
        if (defined(movement.distance)) {
            movement = movement.distance;
        }

        var camera = controller._scene.camera;
        var ellipsoid = controller._ellipsoid;

        var height = ellipsoid.cartesianToCartographic(camera.position).height;
        var unitPosition = Cartesian3.normalize(camera.position, zoom3DUnitPosition);

        handleZoom(controller, startPosition, movement, frameState, controller._zoomFactor, height, Cartesian3.dot(unitPosition, camera.direction));
    }

    var tilt3DWindowPos = new Cartesian2();
    var tilt3DRay = new Ray();
    var tilt3DCenter = new Cartesian3();
    var tilt3DVerticalCenter = new Cartesian3();
    var tilt3DTransform = new Matrix4();
    var tilt3DVerticalTransform = new Matrix4();
    var tilt3DNormal = new Cartesian3();
    var tilt3DCartesian3 = new Cartesian3();
    var tilt3DOldTransform = new Matrix4();
    var tilt3DQuaternion = new Quaternion();
    var tilt3DMatrix = new Matrix3();

    function tilt3D(controller, startPosition, movement, frameState) {
        if (!Matrix4.equals(controller._scene.camera.transform, Matrix4.IDENTITY)) {
            return;
        }

        if (defined(movement.angleAndHeight)) {
            movement = movement.angleAndHeight;
        }

        var camera = controller._scene.camera;
        var ellipsoid = controller._ellipsoid;

        var center;
        var ray;
        var intersection;

        if (Cartesian2.equals(startPosition, controller._tiltCenterMousePosition)) {
            center = Cartesian3.clone(controller._tiltCenter, tilt3DCenter);
        } else {
            ray = camera.getPickRay(startPosition, tilt3DRay);
            if (defined(controller._globe)) {
                center = controller._globe.pick(ray, frameState, tilt3DCenter);
            }

            if (!defined(center)) {
                intersection = IntersectionTests.rayEllipsoid(ray, ellipsoid);
                if (!defined(intersection)) {
                    return;
                }
                center = Ray.getPoint(ray, intersection.start, tilt3DCenter);
            }

            Cartesian2.clone(startPosition, controller._tiltCenterMousePosition);
            Cartesian3.clone(center, controller._tiltCenter);
        }


        var windowPosition = tilt3DWindowPos;
        windowPosition.x = controller._scene.canvas.clientWidth / 2;
        windowPosition.y = controller._tiltCenterMousePosition.y;
        ray = camera.getPickRay(windowPosition, tilt3DRay);

        var mag = Cartesian3.magnitude(center);
        var radii = Cartesian3.fromElements(mag, mag, mag, scratchRadii);
        var newEllipsoid = Ellipsoid.fromCartesian3(radii, scratchEllipsoid);

        intersection = IntersectionTests.rayEllipsoid(ray, newEllipsoid);
        if (!defined(intersection)) {
            return;
        }

        var t = Cartesian3.magnitude(ray.origin) > mag ? intersection.start : intersection.stop;
        var verticalCenter = Ray.getPoint(ray, t, tilt3DVerticalCenter);

        var transform = Transforms.eastNorthUpToFixedFrame(center, ellipsoid, tilt3DTransform);
        var verticalTransform = Transforms.eastNorthUpToFixedFrame(verticalCenter, newEllipsoid, tilt3DVerticalTransform);

        var oldGlobe = controller._globe;
        var oldEllipsoid = controller._ellipsoid;
        controller._globe = undefined;
        controller._ellipsoid = Ellipsoid.UNIT_SPHERE;
        controller._rotateFactor = 1.0;
        controller._rotateRateRangeAdjustment = 1.0;

        var constrainedAxis = Cartesian3.UNIT_Z;

        var oldTransform = Matrix4.clone(camera.transform, tilt3DOldTransform);
        camera.setTransform(transform);

        var tangent = Cartesian3.cross(Matrix4.getColumn(verticalTransform, 2, tilt3DNormal), Cartesian3.normalize(camera.position, tilt3DCartesian3), tilt3DCartesian3);
        var dot = Cartesian3.dot(camera.right, tangent);

        rotate3D(controller, startPosition, movement, frameState, constrainedAxis, false, true);

        camera.setTransform(verticalTransform);

        if (dot < 0.0) {
            if (movement.startPosition.y > movement.endPosition.y) {
                constrainedAxis = undefined;
            }

            var oldConstrainedAxis = camera.constrainedAxis;
            camera.constrainedAxis = undefined;

            rotate3D(controller, startPosition, movement, frameState, constrainedAxis, true, false);

            camera.constrainedAxis = oldConstrainedAxis;
        } else {
            rotate3D(controller, startPosition, movement, frameState, constrainedAxis, true, false);
        }

        if (defined(camera.constrainedAxis)) {
            var right = Cartesian3.cross(camera.direction, camera.constrainedAxis, tilt3DCartesian3);
            if (!Cartesian3.equalsEpsilon(right, Cartesian3.ZERO, CesiumMath.EPSILON6)) {
                if (Cartesian3.dot(right, camera.right) < 0.0) {
                    Cartesian3.negate(right, right);
                }

                Cartesian3.cross(right, camera.direction, camera.up);
                Cartesian3.cross(camera.direction, camera.up, camera.right);

                Cartesian3.normalize(camera.up, camera.up);
                Cartesian3.normalize(camera.right, camera.right);
            }
        }

        camera.setTransform(oldTransform);
        controller._globe = oldGlobe;
        controller._ellipsoid = oldEllipsoid;

        var radius = oldEllipsoid.maximumRadius;
        controller._rotateFactor = 1.0 / radius;
        controller._rotateRateRangeAdjustment = radius;

        var originalPosition = Cartesian3.clone(camera.positionWC, tilt3DCartesian3);
        adjustHeightForTerrain(controller, frameState);

        if (!Cartesian3.equals(camera.positionWC, originalPosition)) {
            camera.setTransform(verticalTransform);
            camera.worldToCameraCoordinatesPoint(originalPosition, originalPosition);

            var angle = Cartesian3.angleBetween(originalPosition, camera.position);
            var axis = Cartesian3.cross(originalPosition, camera.position, originalPosition);
            Cartesian3.normalize(axis, axis);

            var quaternion = Quaternion.fromAxisAngle(axis, angle, tilt3DQuaternion);
            var rotation = Matrix3.fromQuaternion(quaternion, tilt3DMatrix);
            Matrix3.multiplyByVector(rotation, camera.direction, camera.direction);
            Matrix3.multiplyByVector(rotation, camera.up, camera.up);
            Cartesian3.cross(camera.direction, camera.up, camera.right);
            Cartesian3.cross(camera.right, camera.direction, camera.up);

            camera.setTransform(oldTransform);
        }
    }

    var look3DStartPos = new Cartesian2();
    var look3DEndPos = new Cartesian2();
    var look3DStartRay = new Ray();
    var look3DEndRay = new Ray();
    function look3D(controller, startPosition, movement, frameState) {
        var camera = controller._scene.camera;

        var startPos = look3DStartPos;
        startPos.x = movement.startPosition.x;
        startPos.y = 0.0;
        var endPos = look3DEndPos;
        endPos.x = movement.endPosition.x;
        endPos.y = 0.0;
        var start = camera.getPickRay(startPos, look3DStartRay).direction;
        var end = camera.getPickRay(endPos, look3DEndRay).direction;

        var angle = 0.0;
        var dot = Cartesian3.dot(start, end);
        if (dot < 1.0) { // dot is in [0, 1]
            angle = Math.acos(dot);
        }
        angle = (movement.startPosition.x > movement.endPosition.x) ? -angle : angle;
        var rotationAxis = controller._horizontalRotationAxis;
        if (defined(rotationAxis)) {
            camera.look(rotationAxis, angle);
        } else {
            camera.lookLeft(angle);
        }

        startPos.x = 0.0;
        startPos.y = movement.startPosition.y;
        endPos.x = 0.0;
        endPos.y = movement.endPosition.y;
        start = camera.getPickRay(startPos, look3DStartRay).direction;
        end = camera.getPickRay(endPos, look3DEndRay).direction;

        angle = 0.0;
        dot = Cartesian3.dot(start, end);
        if (dot < 1.0) { // dot is in [0, 1]
            angle = Math.acos(dot);
        }
        angle = (movement.startPosition.y > movement.endPosition.y) ? -angle : angle;
        camera.lookUp(angle);
    }

    function update3D(controller, frameState) {
        reactToInput(controller, frameState, controller.enableRotate, controller.rotateEventTypes, spin3D, controller.inertiaSpin, '_lastInertiaSpinMovement');
        reactToInput(controller, frameState, controller.enableZoom, controller.zoomEventTypes, zoom3D, controller.inertiaZoom, '_lastInertiaZoomMovement');
        reactToInput(controller, frameState, controller.enableTilt, controller.tiltEventTypes, tilt3D, controller.inertiaSpin, '_lastInertiaTiltMovement');
        reactToInput(controller, frameState, controller.enableLook, controller.lookEventTypes, look3D);
    }

    var scratchAdjustHeightCartographic = new Cartographic();

    function adjustHeightForTerrain(controller, frameState) {
        var mode = frameState.mode;
        var globe = controller._globe;

        if (!defined(globe) || mode === SceneMode.SCENE2D || mode === SceneMode.MORPHING) {
            return;
        }

        var camera = controller._scene.camera;
        var ellipsoid = controller._ellipsoid;
        var projection = frameState.mapProjection;

        var cartographic = scratchAdjustHeightCartographic;
        if (mode === SceneMode.SCENE3D) {
            ellipsoid.cartesianToCartographic(camera.position, cartographic);
        } else {
            projection.unproject(camera.position, cartographic);
        }

        if (cartographic.height > controller.minimumCollisionTerrainHeight) {
            return;
        }

        var height = globe.getHeight(cartographic, frameState);
        if (!defined(height)) {
            return;
        }

        height += controller.minimumZoomDistance;
        if (cartographic.height >= height) {
            return;
        }

        cartographic.height = height;
        if (mode === SceneMode.SCENE3D) {
            ellipsoid.cartographicToCartesian(cartographic, camera.position);
        } else {
            projection.project(cartographic, camera.position);
        }
    }

    /**
     * @private
     */
    ScreenSpaceCameraController.prototype.update = function(frameState) {
        if (!Matrix4.equals(this._scene.camera.transform, Matrix4.IDENTITY)) {
            this._globe = undefined;
            this._ellipsoid = Ellipsoid.UNIT_SPHERE;
        } else {
            this._globe = this._scene.globe;
            this._ellipsoid = defined(this._globe) ? this._globe.ellipsoid : this._scene.mapProjection.ellipsoid;
        }

        var radius = this._ellipsoid.maximumRadius;
        this._rotateFactor = 1.0 / radius;
        this._rotateRateRangeAdjustment = radius;

        var mode = frameState.mode;
        if (mode === SceneMode.SCENE2D) {
            update2D(this, frameState);
        } else if (mode === SceneMode.COLUMBUS_VIEW) {
            this._horizontalRotationAxis = Cartesian3.UNIT_Z;
            updateCV(this, frameState);
        } else if (mode === SceneMode.SCENE3D) {
            this._horizontalRotationAxis = undefined;
            update3D(this, frameState);
        }

        adjustHeightForTerrain(this, frameState);

        this._aggregator.reset();
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see ScreenSpaceCameraController#destroy
     */
    ScreenSpaceCameraController.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Removes mouse listeners held by this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see ScreenSpaceCameraController#isDestroyed
     *
     * @example
     * controller = controller && controller.destroy();
     */
    ScreenSpaceCameraController.prototype.destroy = function() {
        this._animations.removeAll();
        this._spinHandler = this._spinHandler && this._spinHandler.destroy();
        this._translateHandler = this._translateHandler && this._translateHandler.destroy();
        this._lookHandler = this._lookHandler && this._lookHandler.destroy();
        this._rotateHandler = this._rotateHandler && this._rotateHandler.destroy();
        this._zoomHandler = this._zoomHandler && this._zoomHandler.destroy();
        this._zoomWheelHandler = this._zoomWheelHandler && this._zoomWheelHandler.destroy();
        this._pinchHandler = this._pinchHandler && this._pinchHandler.destroy();
        return destroyObject(this);
    };

    return ScreenSpaceCameraController;
});
