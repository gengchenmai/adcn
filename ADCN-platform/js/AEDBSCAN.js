
/*****************************************************************************************AEDBSCAN********************************************************************/
/**
 * ADCN-Eps
 * AEDBSCAN - Anisotropic Ellipse  Density based clustering
 *
 * @author Gengchen Mai <gengchen_mai@geog.ucsb.edu>
 * @copyright UCSB
 */

/**
 * AEDBSCAN class construcotr
 * @constructor
 *
 * @param {Array} dataset
 * @param {number} epsilon
 * @param {number} minPts
 * @param {function} distanceFunction
 * @returns {DBSCAN}
 */
function AEDBSCAN(dataset, epsilon, minPts, rTree, distanceFunction) {
  /** @type {Array} */
  this.dataset = [];
  /** @type {number} */
  this.epsilon = 1;
  /** @type {number} */
  this.minPts = 2;
  /** @type {function} */
  this.distance = this._euclideanDistance;
  /** @type {Array} */
  this.clusters = [];
  /** @type {Array} */
  this.noise = [];

  // temporary variables used during computation

  /** @type {object} the ellipse of the point, theta in radians*/
  this.ellipse = {"a":this.epsilon, "b":this.epsilon, "theta": 0};
  /** @type {Array} */
  this._visited = [];
  /** @type {Array} */
  this._assigned = [];
  /** @type {number} */
  this._datasetLength = 0;

  this.rTree = rTree;

  this._init(dataset, epsilon, minPts, rTree, distanceFunction);

  this.computeTime = 0;
};

/**
 * AEDBSCAN isInEllipse
 * decide whether currentPoint in the Ellipse center at centerPoint
 *
 * @param {number} centerPointId - the center of the Ellipse
 * @param {number} currentPointId - current Point need to be decide whether are in this Ellipse
 * @returns {DBSCAN}
 */
AEDBSCAN.prototype.isInEllipse = function(centerPointId, currentPointId) {
  
  if(this.distance(this.dataset[centerPointId], this.dataset[currentPointId]) > this.ellipse.a)
    return false;
  if(this.distance(this.dataset[centerPointId], this.dataset[currentPointId]) < this.ellipse.b)
    return true;

  var centerPoint = this.dataset[centerPointId];
  var currentPoint = this.dataset[currentPointId];
  var normalizedCurrPtX = Number(currentPoint[0]) - Number(centerPoint[0]);
  var normalizedCurrPtY = Number(currentPoint[1]) - Number(centerPoint[1]);

  // rotate the reference system by the center point
  var rotateCurrPtX = normalizedCurrPtY * Math.sin(this.ellipse.theta) + normalizedCurrPtX * Math.cos(this.ellipse.theta);
  var rotateCurrPtY = normalizedCurrPtY * Math.cos(this.ellipse.theta) - normalizedCurrPtX * Math.sin(this.ellipse.theta);

  if(this.ellipse.b === 0)
  {
    if(rotateCurrPtY === 0)
      return true;
    else
      return false;
  }
  else
  {
    var ellipsefactor = (rotateCurrPtX*rotateCurrPtX)/(this.ellipse.a * this.ellipse.a) + (rotateCurrPtY*rotateCurrPtY)/(this.ellipse.b * this.ellipse.b);
    if(ellipsefactor < 1 || ellipsefactor === 1)
      return true;// currentPoint is inside of the Ellipse centered at centerPoint
    else
      return false;
  }
  

};

/**
 * Find all neighbors inside the Ellipse centered at given point
 *
 * @param {number} centerPointId,
 * @returns {Array}
 * @access protected
 */
AEDBSCAN.prototype.ptInEllipse = function(centerPointId) {
  var neighbors = [];

  if(this.rTree)
  {
    //console.log("ID: " +pointId);
    var x_low = this.dataset[centerPointId][0] - this.ellipse.a;
    var y_low = this.dataset[centerPointId][1] - this.ellipse.a;
    var length = 2*this.ellipse.a;
    var bboxNeighbor = rTree.search({x:x_low, y:y_low, w:length, h:length});
    // if(bboxNeighbor.length == 0)
    //   bboxNeighbor = [];
    for (var i = 0; i < bboxNeighbor.length; i++) {
      var PtIndex = bboxNeighbor[i];
      //var dist = this.distance(this.dataset[pointId], this.dataset[PtIndex]);
      if (this.isInEllipse(centerPointId, PtIndex)) {
        neighbors.push(PtIndex);
      }
    }

  }
  else
  {
    for (var id = 0; id < this._datasetLength; id++) {
      if (this.isInEllipse(centerPointId, id)) {
        neighbors.push(id);
      }
    }
  }




  

  return neighbors;
};

/**
 * us ethe center point, recalculate the shape of ellipse based on the points in the currentNeighbor, get the ellipse neighbor of the center point
 *
 * @param {Array} currentNeighbor, the array contain the id of the points within the Ellipse neighborhood of center point
 * @param {number} centerPointId, 
 * @returns {Array}
 * @access protected
 */
AEDBSCAN.prototype._ellipseRegionQuery = function(centerPointId) {
  
  // get the circle neiborhod of center point
  var currentNeighbor = [];
  currentNeighbor = this._circleRegionQuery(centerPointId);

  //var neighbors = [];

  // for (var id = 0; id < this._datasetLength; id++) {
  //   var dist = this.distance(this.dataset[centerPointId], this.dataset[id]);
  //   if (dist < this.epsilon) {
  //     currentNeighbor.push(id);
  //   }
  // }

  // calculate the mean center of the neiborhood points of center point (include center point)
  var meanX = 0;
  var meanY = 0;
  for (var i = 0; i < currentNeighbor.length; i++) {
    var currentPtID = currentNeighbor[i];
    meanX += Number(this.dataset[currentPtID][0]);
    meanY += Number(this.dataset[currentPtID][1]);
  }
  // meanX += Number(this.dataset[centerPointId][0]);
  // meanY += Number(this.dataset[centerPointId][1]);
  // meanX = meanX / (currentNeighbor.length+1);
  // meanY = meanY / (currentNeighbor.length+1);
  meanX = meanX / (currentNeighbor.length);
  meanY = meanY / (currentNeighbor.length);

  var normalizedX_Array = [];
  var normalizedY_Array = [];

  // the sum of square of normalized x 
  var sumNormX2 = 0;
  // the sum of square of normalized y
  var sumNormY2 = 0;
  // the sum of product of normalized x and normalized y
  var sumNormXY = 0;

  for (var i = 0; i < currentNeighbor.length; i++) {
    var currentPtID = currentNeighbor[i];
    
    var normalizedX = Number(this.dataset[currentPtID][0]) - meanX;
    var normalizedY = Number(this.dataset[currentPtID][1]) - meanY;
    normalizedX_Array.push(normalizedX);
    normalizedY_Array.push(normalizedY);

    sumNormX2 += normalizedX*normalizedX;
    sumNormY2 += normalizedY*normalizedY;
    sumNormXY += normalizedX*normalizedY;
  }

  // for the center point
  // var normalizedX_cen = Number(this.dataset[centerPointId][0]) - meanX;
  // var normalizedY_cen = Number(this.dataset[centerPointId][1]) - meanY;
  // normalizedX_Array.push(normalizedX_cen);
  // normalizedY_Array.push(normalizedY_cen);

  // sumNormX2 += normalizedX_cen*normalizedX_cen;
  // sumNormY2 += normalizedY_cen*normalizedY_cen;
  // sumNormXY += normalizedX_cen*normalizedY_cen;

  var A = 0;
  var B = 0;
  var C = 0;

  A = sumNormX2 - sumNormY2;
  C = 2 * sumNormXY;
  B = Math.sqrt( Math.pow(A, 2) + Math.pow(C, 2));
  tanTheta = (-A + B)/C;
  if(C === 0)
  {
    if(-A + B ===0)
      this.ellipse.theta = 0;
    else
      this.ellipse.theta = Math.PI/2;
  }
  else
    this.ellipse.theta = Math.atan(tanTheta);

  // the long and short axis for new ellipse
  var a_SDE = 0;
  var b_SDE = 0;

  for (var i = 0; i < normalizedX_Array.length; i++) {
    a_SDE += Math.pow(normalizedX_Array[i] * Math.cos(this.ellipse.theta) + normalizedY_Array[i] * Math.sin(this.ellipse.theta), 2);
    b_SDE += Math.pow(-normalizedX_Array[i] * Math.sin(this.ellipse.theta) + normalizedY_Array[i] * Math.cos(this.ellipse.theta), 2);
  }

  a_SDE = Math.sqrt(a_SDE/normalizedX_Array.length);
  b_SDE = Math.sqrt(b_SDE/normalizedX_Array.length);
  if(a_SDE > b_SDE || a_SDE === b_SDE)
  {
    var a = a_SDE;
    var b = b_SDE;
  }
  else
  {
    var a = b_SDE;
    var b = a_SDE;
  }

  var bNEW = Math.sqrt((b/a) * this.epsilon * this.epsilon);

  if(bNEW === 0)
  {
    this.ellipse.a = Infinity;
    this.ellipse.b = bNEW;
  }
  else
  {
    this.ellipse.a = this.epsilon * this.epsilon / bNEW;
    this.ellipse.b = bNEW;
  }

  // // if(bNEW < 0.05 || bNEW === 0.05)
  // if(bNEW < this.epsilon/4 || bNEW === this.epsilon/4)
  // {
  //   // this.ellipse.a = this.epsilon * this.epsilon / 0.05;
  //   // this.ellipse.b = 0.05;
  //   this.ellipse.a = this.epsilon * 4;
  //   this.ellipse.b = this.epsilon/4;
  // }
  // else
  // {
  //   this.ellipse.a = this.epsilon * this.epsilon / bNEW;
  //   this.ellipse.b = bNEW;
  // }
  // ctx.strokeStyle = '#'+Math.random().toString(16).substr(2,6);
  // ctx.beginPath();
  // ctx.arc(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), this.epsilon, 0, 2*Math.PI);
  // ctx.closePath();
  // ctx.stroke();
  // ctx.beginPath();
  // ctx.ellipse(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), this.ellipse.a, this.ellipse.b, this.ellipse.theta, 0, 2 * Math.PI);
  // ctx.closePath();
  // ctx.stroke();
  // ctx.strokeStyle = "black";

  // if(centerPointId == 20)
  // {
  //   ctx.strokeStyle = "blue";
  //   ctx.fillStyle = "blue";
  //   for(var i = 0; i < currentNeighbor.length; i++)
  //   {
  //     ctx.beginPath();
  //     ctx.arc(Number(this.dataset[currentNeighbor[i]][0]), Number(this.dataset[currentNeighbor[i]][1]), 1.5, 0, 2*Math.PI);
  //     ctx.closePath();
  //     ctx.stroke();
  //     ctx.fill();
  //   }

  //   ctx.strokeStyle = "blue";
  //   ctx.beginPath();
  //   ctx.arc(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), this.epsilon, 0, 2*Math.PI);
  //   ctx.closePath();
  //   ctx.stroke();
    
  //   //ctx.strokeStyle = '#'+Math.random().toString(16).substr(2,6);
  //   // ctx.beginPath();
  //   // ctx.arc(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), this.epsilon, 0, 2*Math.PI);
  //   // ctx.closePath();
  //   // ctx.stroke();
  //   ctx.strokeStyle = "red";
  //   ctx.fillStyle = "red";
  //   ctx.beginPath();
  //   ctx.arc(meanX, meanY, 1.5, 0, 2*Math.PI);
  //   ctx.closePath();
  //   ctx.stroke();
  //   ctx.fill();
  //   ctx.fillStyle = "black";

  //   ctx.beginPath();
  //   ctx.ellipse(meanX, meanY, a, b, this.ellipse.theta, 0, 2 * Math.PI);
  //   ctx.closePath();
  //   ctx.stroke();

  //   ctx.strokeStyle = "green";
  //   ctx.fillStyle = "green";
  //   ctx.beginPath();
  //   ctx.arc(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), 1.5, 0, 2*Math.PI);
  //   ctx.closePath();
  //   ctx.stroke();
  //   ctx.fill();

  //   ctx.beginPath();
  //   ctx.ellipse(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), this.ellipse.a, this.ellipse.b, this.ellipse.theta, 0, 2 * Math.PI);
  //   ctx.closePath();
  //   ctx.stroke();
  //   //ctx.strokeStyle = "black";

  //   ctx.strokeStyle = "black";
  //   ctx.fillStyle = "black";
   
  // }
  var oldTime = Date.now();
  var neighbors = this.ptInEllipse(centerPointId);
  var newTime = Date.now();

  this.computeTime += newTime - oldTime;

  return neighbors;
};

AEDBSCAN.prototype.directionEllipseLoop = function(dataset, epsilon, minPts, distanceFunction) {
  this._init(dataset, epsilon, minPts, distanceFunction);
  for (var id = 0; id < this._datasetLength; id++)
  {
    this.localDirectionEllipse(id);
  }
};
/**
 * using the square of distance as spatial weight, compute the local Ellipse
 *
 * @param {Array} currentNeighbor, the array contain the id of the points within the Ellipse neighborhood of center point
 * @param {number} centerPointId, 
 * @returns {Array}
 * @access protected
 */
AEDBSCAN.prototype.localDirectionEllipse = function(centerPointId) {
  // spatial weight for every point
  var spatial_weight = [];

  // calculate the mean center of the neiborhood points of center point (include center point)
  var meanX = 0;
  var meanY = 0;
  var sum_spatial_weight = 0;
  for (var id = 0; id < this._datasetLength; id++) {
    var dist = this.distance(this.dataset[centerPointId], this.dataset[id]);
    var spatial_w = 1/(dist*dist +1);
    spatial_weight.push(spatial_w);
    meanX += Number(this.dataset[id][0]) * spatial_w;
    meanY += Number(this.dataset[id][1]) * spatial_w;
    sum_spatial_weight += spatial_w;
  }

  meanX = meanX / sum_spatial_weight;
  meanY = meanY / sum_spatial_weight;

  var normalizedX_Array = [];
  var normalizedY_Array = [];

  // the sum of square of normalized x 
  var sumNormX2 = 0;
  // the sum of square of normalized y
  var sumNormY2 = 0;
  // the sum of product of normalized x and normalized y
  var sumNormXY = 0;

  for (var id = 0; id < this._datasetLength; id++) {
    
    var normalizedX = Number(this.dataset[id][0]) - meanX;
    var normalizedY = Number(this.dataset[id][1]) - meanY;
    normalizedX_Array.push(normalizedX);
    normalizedY_Array.push(normalizedY);

    sumNormX2 += normalizedX*normalizedX*spatial_weight[id];
    sumNormY2 += normalizedY*normalizedY*spatial_weight[id];
    sumNormXY += normalizedX*normalizedY*spatial_weight[id];
  }

  var A = 0;
  var B = 0;
  var C = 0;

  A = sumNormX2 - sumNormY2;
  C = 2 * sumNormXY;
  B = Math.sqrt( Math.pow(A, 2) + Math.pow(C, 2));
  tanTheta = (-A + B)/C;
  if(C === 0)
  {
    if(-A + B ===0)
      this.ellipse.theta = 0;
    else
      this.ellipse.theta = Math.PI/2;
  }
  else
    this.ellipse.theta = Math.atan(tanTheta);

  // the long and short axis for new ellipse
  var a_SDE = 0;
  var b_SDE = 0;

  for (var i = 0; i < normalizedX_Array.length; i++) {
    a_SDE += Math.pow( normalizedX_Array[i] * Math.cos(this.ellipse.theta) + normalizedY_Array[i] * Math.sin(this.ellipse.theta), 2) * spatial_weight[i];
    b_SDE += Math.pow(-normalizedX_Array[i] * Math.sin(this.ellipse.theta) + normalizedY_Array[i] * Math.cos(this.ellipse.theta), 2) * spatial_weight[i];
  }

  a_SDE = Math.sqrt(a_SDE/sum_spatial_weight);
  b_SDE = Math.sqrt(b_SDE/sum_spatial_weight);
  if(a_SDE > b_SDE || a_SDE === b_SDE)
  {
    var a = a_SDE;
    var b = b_SDE;
  }
  else
  {
    var a = b_SDE;
    var b = a_SDE;
  }

  var bNEW = Math.sqrt((b/a) * this.epsilon * this.epsilon);

  if(bNEW === 0)
  {
    this.ellipse.a = Infinity;
    this.ellipse.b = bNEW;
  }
  else
  {
    this.ellipse.a = this.epsilon * this.epsilon / bNEW;
    this.ellipse.b = bNEW;
  }

  // // if(bNEW < 0.05 || bNEW === 0.05)
  // if(bNEW < this.epsilon/4 || bNEW === this.epsilon/4)
  // {
  //   // this.ellipse.a = this.epsilon * this.epsilon / 0.05;
  //   // this.ellipse.b = 0.05;
  //   this.ellipse.a = this.epsilon * 4;
  //   this.ellipse.b = this.epsilon/4;
  // }
  // else
  // {
  //   this.ellipse.a = this.epsilon * this.epsilon / bNEW;
  //   this.ellipse.b = bNEW;
  // }
  ctx.strokeStyle = '#'+Math.random().toString(16).substr(2,6);
  // ctx.beginPath();
  // ctx.arc(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), this.epsilon, 0, 2*Math.PI);
  // ctx.closePath();
  // ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), this.ellipse.a, this.ellipse.b, this.ellipse.theta, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = "black";
  var neighbors = this.ptInEllipse(centerPointId);

  //return neighbors;
};

/**
 * Find all neighbors around given point within a circle centered at center point with radius Eps
 *
 * @param {number} pointId,
 * @param {number} epsilon
 * @returns {Array}
 * @access protected
 */
AEDBSCAN.prototype._circleRegionQuery = function(pointId) {
  var neighbors = [];

  if(this.rTree)
  {
    //console.log("ID: " +pointId);
    var x_low = this.dataset[pointId][0] - this.epsilon;
    var y_low = this.dataset[pointId][1] - this.epsilon;
    var length = 2*this.epsilon;
    var bboxNeighbor = rTree.search({x:x_low, y:y_low, w:length, h:length});
    // if(bboxNeighbor.length == 0)
    //   bboxNeighbor = [];
    for (var i = 0; i < bboxNeighbor.length; i++) {
      var PtIndex = bboxNeighbor[i];
      var dist = this.distance(this.dataset[pointId], this.dataset[PtIndex]);
      if (dist < this.epsilon) {
        neighbors.push(PtIndex);
      }
    }

  }
  else
  {
    for (var id = 0; id < this._datasetLength; id++) {
      var dist = this.distance(this.dataset[pointId], this.dataset[id]);
      if (dist < this.epsilon) {
        neighbors.push(id);
      }
    }
  }

  return neighbors;
};

/**
 * Calculate euclidean distance in multidimensional space
 *
 * @param {Array} p
 * @param {Array} q
 * @returns {number}
 * @access protected
 */
AEDBSCAN.prototype._euclideanDistance = function(p, q) {
  var sum = 0;
  var i = Math.min(p.length, q.length);

  while (i--) {
    sum += (p[i] - q[i]) * (p[i] - q[i]);
  }

  return Math.sqrt(sum);
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DBSCAN;
}


/******************************************************************************/
// public functions

/**
 * Start clustering
 *
 * @param {Array} dataset
 * @param {number} epsilon
 * @param {number} minPts
 * @param {function} distanceFunction
 * @returns {undefined}
 * @access public
 */
AEDBSCAN.prototype.run = function(dataset, epsilon, minPts, rTree, distanceFunction) {
  this._init(dataset, epsilon, minPts, rTree, distanceFunction);

  for (var pointId = 0; pointId < this._datasetLength; pointId++) {
    // if point is not visited, check if it forms a cluster
    if (this._visited[pointId] !== 1) {
      this._visited[pointId] = 1;

      // if closest neighborhood is too small to form a cluster, mark as noise 
      //var neighbors = this._circleRegionQuery(pointId);
      var neighbors = this._ellipseRegionQuery(pointId);

      if (neighbors.length < this.minPts) {
        // var neighbors = this._ellipseRegionQuery(pointId);
        // if (neighbors.length < this.minPts){
          this.noise.push(pointId);
        // }
        // else{
        //   // create new cluster and add point
        //   var clusterId = this.clusters.length;
        //   this.clusters.push([]);
        //   this._addToCluster(pointId, clusterId);

        //   this._expandCluster(clusterId, neighbors);
        // }
        
      } else {
        // create new cluster and add point
        var clusterId = this.clusters.length;
        this.clusters.push([]);
        this._addToCluster(pointId, clusterId);

        this._expandCluster(clusterId, neighbors);
      }
    }
  }

  //console.log("Time: " + this.computeTime);

  return this.clusters;
};

/******************************************************************************/
// protected functions

/**
 * Set object properties
 *
 * @param {Array} dataset
 * @param {number} epsilon
 * @param {number} minPts
 * @param {function} distance
 * @returns {undefined}
 * @access protected
 */
AEDBSCAN.prototype._init = function(dataset, epsilon, minPts, rTree, distance) {

  if (dataset) {

    if (!(dataset instanceof Array)) {
      throw Error('Dataset must be of type array, ' +
        typeof dataset + ' given');
    }

    this.dataset = dataset;
    this.clusters = [];
    this.noise = [];

    this._datasetLength = dataset.length;
    this._visited = new Array(this._datasetLength);
    this._assigned = new Array(this._datasetLength);
  }

  if (epsilon) {
    this.epsilon = epsilon;
  }

  if (minPts) {
    this.minPts = minPts;
  }

  if (distance) {
    this.distance = distance;
  }

  if(rTree){
    this.rTree = rTree;
  }
};

/**
 * Expand cluster to closest points of given neighborhood
 *
 * @param {number} clusterId
 * @param {Array} neighbors
 * @returns {undefined}
 * @access protected
 */
AEDBSCAN.prototype._expandCluster = function(clusterId, neighbors) {

  /**
   * It's very important to calculate length of neighbors array each time,
   * as the number of elements changes over time
   */
  for (var i = 0; i < neighbors.length; i++) {
    var pointId2 = neighbors[i];

    if (this._visited[pointId2] !== 1) {
      this._visited[pointId2] = 1;
      
      // var neighbors2 = this._circleRegionQuery(pointId2);
      var neighbors2 = this._ellipseRegionQuery(pointId2);

      if (neighbors2.length >= this.minPts) {
        neighbors = this._mergeArrays(neighbors, neighbors2);
        // add to cluster
        if (this._assigned[pointId2] !== 1) {
          this._addToCluster(pointId2, clusterId);
        }
      }
      // else{
        // var neighbors2 = this._ellipseRegionQuery(pointId2);
        // if (neighbors2.length >= this.minPts) {
          // neighbors = this._mergeArrays(neighbors, neighbors2);
        // }
      // }
    }

    
  }
};

/**
 * Add new point to cluster
 *
 * @param {number} pointId
 * @param {number} clusterId
 */
AEDBSCAN.prototype._addToCluster = function(pointId, clusterId) {
  this.clusters[clusterId].push(pointId);
  this._assigned[pointId] = 1;
};



/******************************************************************************/
// helpers

/**
 * @param {Array} a
 * @param {Array} b
 * @returns {Array}
 * @access protected
 */
AEDBSCAN.prototype._mergeArrays = function(a, b) {
  var len = b.length;

  for (var i = 0; i < len; i++) {
    var P = b[i];
    if (a.indexOf(P) < 0) {
      a.push(P);
    }
  }

  return a;
};

