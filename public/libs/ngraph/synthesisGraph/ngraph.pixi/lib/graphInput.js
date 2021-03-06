/**
 * Tracks mouse input and updates pixi graphics (zoom/pan).
 *
 * Note: I don't really like how this module is tightly coupled with graphics.
 * If you have dieas how to make this copuling loose, please let me know!
 */
module.exports = function (graphics, layout, synthesisClient_callback) {
  var addWheelListener = require('./addWheelListener');
  var graphGraphics = graphics.graphGraphics;

  self = this;
  self.synthesisClient_callback = synthesisClient_callback;

  addWheelListener(graphics.domContainer, function (e) {
    zoom(e.clientX, e.clientY, e.deltaY < 0);
  });

  addDragListener();

  var getGraphCoordinates = (function () {
    var ctx = {
      global: { x: 0, y: 0} // store it inside closure to avoid GC pressure
    };

    return function (x, y) {
      ctx.global.x = x; ctx.global.y = y;
      return PIXI.InteractionData.prototype.getLocalPosition.call(ctx, graphGraphics);
    }
  }());

  function zoom(x, y, isZoomIn) {
    direction = isZoomIn ? 1 : -1;
    var factor = (1 + direction * 0.1);
    graphGraphics.scale.x *= factor;
    graphGraphics.scale.y *= factor;

    // Technically code below is not required, but helps to zoom on mouse
    // cursor, instead center of graphGraphics coordinates
    var beforeTransform = getGraphCoordinates(x, y);
    graphGraphics.updateTransform();
    var afterTransform = getGraphCoordinates(x, y);

    graphGraphics.position.x += (afterTransform.x - beforeTransform.x) * graphGraphics.scale.x;
    graphGraphics.position.y += (afterTransform.y - beforeTransform.y) * graphGraphics.scale.y;
    graphGraphics.updateTransform();
  }

  function addDragListener() {
    var stage = graphics.stage;
    stage.setInteractive(true);

    var isDragging = false,
        nodeUnderCursor,
        prevX, prevY;

    stage.mousedown = function (moveData) {
      var pos = moveData.global;
      var graphPos = getGraphCoordinates(pos.x, pos.y);
      nodeUnderCursor = graphics.getNodeAt(graphPos.x, graphPos.y);
      if (nodeUnderCursor) {
        // just to make sure layouter will not attempt to move this node
        // based on physical forces. Now it's completely under our control:
        layout.pinNode(nodeUnderCursor, true);
      }

      prevX = pos.x; prevY = pos.y;
      isDragging = true;
    };

    stage.mousemove = function (moveData) {
      if (!isDragging) {
        return;
      }
      var pos = moveData.global;

      if (nodeUnderCursor) {
        var graphPos = getGraphCoordinates(pos.x, pos.y);
        layout.setNodePosition(nodeUnderCursor.id, graphPos.x, graphPos.y);
      } else {
        var dx = pos.x - prevX;
        var dy = pos.y - prevY;
        prevX = pos.x; prevY = pos.y;
        graphGraphics.position.x += dx;
        graphGraphics.position.y += dy;
      }
    };

    stage.mouseup = function (moveDate) {
      isDragging = false;
      var dragged = (moveDate.global.x != prevX) || (moveDate.global.y != prevY)
      self.synthesisClient_callback(nodeUnderCursor, moveDate.global, dragged);
      if (nodeUnderCursor) {
        draggingNode = null;
        layout.pinNode(nodeUnderCursor, false);
      }
    };
  }
}
