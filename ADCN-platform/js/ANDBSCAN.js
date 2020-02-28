
/*****************************************************************************************ANDBSCAN********************************************************************/
/**
 * ADCN-KNN
 * ANDBSCAN - Anisotropic Ellipse  Density based clustering
 *
 *
 * @author Gengchen Mai <gengchen_mai@geog.ucsb.edu>
 * @copyright UCSB
 */

/**
 * ANDBSCAN class construcotr
 * @constructor
 *
 * @param {Array} dataset
 * @param {number} epsilon
 * @param {number} minPts
 * @param {function} distanceFunction
 * @returns {DBSCAN}
 */
function ANDBSCAN(dataset, epsilon, minPts, rTree, distanceFunction) {
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
  // /** @type {Array} */
  // this.distanceMatrix = [];
  // /** @type {Array} */
  // this.sortDistIDArray = [];

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

/***********************
find the kth nearest point for point p with pointId
return the distance between point p and the kth (k=minPts) nearest point
Gengchen Mai
*/
ANDBSCAN.prototype.kthNearestDistance = function(dataset, pointId, minPts) {
  var distancePtArray = [];
  var ascendingOrderPtId = [];
  
  //calculate the distance from point p to all the points in the dataset
  for (var id = 0; id < this._datasetLength; id++) {
    var distance = this.distance(this.dataset[pointId], this.dataset[id]);
    distancePtArray.push(distance);
    ascendingOrderPtId.push(id);
  };
  //bubble sorting
  var ascendingDisArray = this.bubbleSorting(distancePtArray);
  /*
  var swapped;
  do {
      swapped = false;
      for (var i = 0; i < distancePtArray.length-1; i++) {
          if (distancePtArray[i] > distancePtArray[i+1]) {
              var temp = distancePtArray[i];
              distancePtArray[i] = distancePtArray[i+1];
              distancePtArray[i+1] = temp;

              //var temp2 = ascendingOrderPtId[i];
              //ascendingOrderPtId[i] = ascendingOrderPtId[i+1];
              //ascendingOrderPtId[i+1] = temp2; 
              swapped = true;
          }
      }
  } while (swapped);*/

  //var kthNearestdistance = distancePtArray[minPts-1];

  return ascendingDisArray[minPts-1];
};

//Ascending bubble sorting
ANDBSCAN.prototype.bubbleSorting = function (array){
  
  var swapped;
  do {
      swapped = false;
      for (var i = 0; i < array.length-1; i++) {
          if (array[i] > array[i+1]) {
              var temp = array[i];
              array[i] = array[i+1];
              array[i+1] = temp;

              swapped = true;
          }
      }
  } while (swapped);
  
  return array;
}

/***********************
find the kth nearest point for every point
return an array of the distance between every point and the kth (k=minPts) nearest point
Gengchen Mai
*/
ANDBSCAN.prototype.kthNearestArray = function(dataset, minPts) {
  var kthNearest_Array = [];
  for (var id = 0; id < this._datasetLength; id++) {
    var distance = this.kthNearestDistance(dataset, id, minPts);
    kthNearest_Array.push(distance);
  };



  return kthNearest_Array;
};

ANDBSCAN.prototype.distanceMatrixCompute = function(){
  this.distanceMatrix = new Array(this._datasetLength);
  for(var i=0; i < this._datasetLength; i++)
  {
    this.distanceMatrix[i] = new Array(this._datasetLength);
    for(var j=0; j < this._datasetLength; j++)
    {
      this.distanceMatrix[i][j] = this.distance(this.dataset[i], this.dataset[j]);
    }
  }

}

// ANDBSCAN.prototype.initSortDistIDArray = function(){
//   this.sortDistIDArray = new Array(this._datasetLength);
//   var visitedArray = new Array(this._datasetLength);
//   for(var i=0; i < this._datasetLength; i++)
//   {
//     this.sortDistIDArray[i] = new Array(this.minPts);
//     // label the point who has already been searched as the minimum distance point
//     visitedArray[i] = new Array(this._datasetLength);
//     for(var j=0; j < this._datasetLength; j++)
//     {
//       //this.sortDistIDArray[i][j] = { ID: j, dist: this.distanceMatrix[i][j]};
//       // label the diagonal point as visited, so we will not take the point 1 itself in to account when finding the kth nearedt point of point i
//       if(i === j)
//         visitedArray[i][j] = 1;
//       else
//         visitedArray[i][j] = 0;
//     }
//     for(var k=0; k < this.minPts; k++)
//     {
//       var minDistPtID = 0;
//       var minDist = Infinity;
//       for(var j=0; j < this._datasetLength; j++)
//       {
//         if(visitedArray[i][j] === 0)
//         {
//           if(minDist > this.distanceMatrix[i][j])
//           {
//             minDist = this.distanceMatrix[i][j];
//             minDistPtID = j;
//           }
//         }
//       }
//       visitedArray[i][minDistPtID] = 1;
//       this.sortDistIDArray[i][k] = minDistPtID;
//     }
//     // this.sortDistIDArray[i].sort(function (a, b) {
//     //     if (a.dist > b.dist) {
//     //       return 1;
//     //     }
//     //     if (a.dist < b.dist) {
//     //       return -1;
//     //     }
//     //     // a must be equal to b
//     //     return 0;
//     // });
//   }



// }

ANDBSCAN.prototype.sortDistIDArray = function(distArray, centerPtID){
  
  var sortDistIDArray = new Array(this.minPts);
  // label the point who has already been searched as the minimum distance point
  var visitedArray = new Array(this._datasetLength);
  for(var i=0; i < this._datasetLength; i++)
  {
    //this.sortDistIDArray[i][j] = { ID: j, dist: this.distanceMatrix[i][j]};
    // label the diagonal point as visited, so we will not take the point 1 itself in to account when finding the kth nearedt point of point i
    // if(centerPtID === i)
    //   visitedArray[i] = 1;
    // else
      visitedArray[i] = 0;
  }
  for(var k=0; k < this.minPts; k++)
  {
    var minDistPtID = -1;
    var minDist = Infinity;
    for(var i=0; i < this._datasetLength; i++)
    {
      if(visitedArray[i] === 0)
      {
        if(minDist > distArray[i])
        {
          minDist = distArray[i];
          minDistPtID = i;
        }
      }
    }
    visitedArray[minDistPtID] = 1;
    sortDistIDArray[k] = minDistPtID;
  }

  return sortDistIDArray;

}

// when you use RTree you use this function
ANDBSCAN.prototype.sortDistIDShortArray = function(neighbors, centerPtID){
  var distArray = new Array(neighbors.length);
  for(var i = 0; i < neighbors.length; i++)
  {
    var PtIndex = neighbors[i];
    distArray[i] = this.distance(this.dataset[PtIndex], this.dataset[centerPtID]);
  }
  var sortDistIDArray = new Array(this.minPts);
  // label the point who has already been searched as the minimum distance point
  var visitedArray = new Array(neighbors.length);
  for(var i=0; i < neighbors.length; i++)
  {
    //this.sortDistIDArray[i][j] = { ID: j, dist: this.distanceMatrix[i][j]};
    // label the diagonal point as visited, so we will not take the point 1 itself in to account when finding the kth nearedt point of point i
    // if(centerPtID === neighbors[i])
    //   visitedArray[i] = 1;
    // else
      visitedArray[i] = 0;
  }
  for(var k=0; k < this.minPts; k++)
  {
    //var minDistPtID = -1;
    var minDistIndex = -1;
    var minDist = Infinity;
    for(var i=0; i < neighbors.length; i++)
    {
      if(visitedArray[i] === 0)
      {
        if(minDist > distArray[i])
        {
          minDist = distArray[i];
          //minDistPtID = neighbors[i];
          minDistIndex = i;
        }
      }
    }
    visitedArray[minDistIndex] = 1;
    sortDistIDArray[k] = neighbors[minDistIndex];
  }

  return sortDistIDArray;
    



}

// /**
//  * Find all kth nearest points of given point
//  * Return the array of index of the kth nearest points
//  *
//  * @param {number} centerPointId,
//  * @returns {Array}
//  * @access protected
//  */
// ANDBSCAN.prototype.kthNearthPt = function(centerPointId){
//   var kthNearestPtIDArray = this.sortDistIDArray[centerPointId];
//   // for(var i=0; i < this.minPts; i++)
//   // {
//   //   kthNearestPtIDArray[i] = this.sortDistIDArray[centerPointId][i].ID;
//   // }
  
//   return kthNearestPtIDArray;
// }

/**
 * ANDBSCAN isInEllipse
 * decide whether currentPoint in the Ellipse center at centerPoint
 *
 * @param {number} centerPointId - the center of the Ellipse
 * @param {number} currentPointId - current Point need to be decide whether are in this Ellipse
 * @returns {DBSCAN}
 */
ANDBSCAN.prototype.isInEllipse = function(centerPointId, currentPointId) {

  if(this.distance(this.dataset[centerPointId], this.dataset[currentPointId]) > this.ellipse.a)
    return false;
  if(this.distance(this.dataset[centerPointId], this.dataset[currentPointId]) < this.ellipse.b)
    return true;

  // if(this.dataset[currentPointId][0] > this.dataset[centerPointId][0] + this.ellipse.a
  //   || this.dataset[currentPointId][0] < this.dataset[centerPointId][0] - this.ellipse.a)
  //   return false;

  // if(this.dataset[currentPointId][1] > this.dataset[centerPointId][1] + this.ellipse.a
  //   || this.dataset[currentPointId][1] < this.dataset[centerPointId][1] - this.ellipse.a)
  //   return false;
  //if(this.distance(this.dataset[centerPointId], this.dataset[currentPointId]) > this.Eps)
    //return false;
  
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
ANDBSCAN.prototype.ptInEllipse = function(centerPointId) {
  var neighbors = [];

  if(this.rTree && this.ellipse.a !== Infinity)
  {
    //console.log("ID: " +pointId);
    
    var x_low = this.dataset[centerPointId][0] - this.ellipse.a;
    var y_low = this.dataset[centerPointId][1] - this.ellipse.a;
    var length = 2*this.ellipse.a;
    var bboxNeighbor = rTree.search({x:x_low, y:y_low, w:length, h:length});

    // ctx.strokeStyle = "blue";
    // ctx.fillStyle = "blue";
    // for (var i = 0; i < bboxNeighbor.length; i++)
    // {
    //   var PtIndex = bboxNeighbor[i];
    //   ctx.beginPath();
    //   ctx.arc(Number(this.dataset[PtIndex][0]), Number(this.dataset[PtIndex][1]), 1.5, 0, 2*Math.PI);
    //   ctx.closePath();
    //   ctx.stroke();
    //   ctx.fill();
    // }


    // ctx.strokeStyle = "red";
    // ctx.fillStyle = "red";
    // ctx.beginPath();
    // ctx.arc(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), 1.5, 0, 2*Math.PI);
    // ctx.closePath();
    // ctx.stroke();
    // ctx.fill();

    // ctx.beginPath();
    // ctx.rect(x_low, y_low, length, length);
    // //ctx.arc(Number(this.dataset[centerPointId][0]), Number(this.dataset[centerPointId][1]), this.ellipse.a, 0, 2*Math.PI);
    // ctx.closePath();
    // ctx.stroke();

    // ctx.strokeStyle = "black";
    // ctx.fillStyle = "black";
    // ctx.clearRect(0, 0, canvas.width, canvas.height);
    // for (var i = 0; i < a_crds.length; i++) 
    // {
    //   drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
    // };
    
    // if(bboxNeighbor.length == 0)
    //   bboxNeighbor = [];
    for (var i = 0; i < bboxNeighbor.length; i++) {
      var PtIndex = bboxNeighbor[i];
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

ANDBSCAN.prototype.KNN = function(centerPointId){
  var KNNeighbor = [];
  if(this.rTree)
  {
    var radius = this.epsilon;
    do{
      var neighbors = [];
      var x_low = this.dataset[centerPointId][0] - radius;
      var y_low = this.dataset[centerPointId][1] - radius;
      var length = 2*radius;
      var bboxNeighbor = rTree.search({x:x_low, y:y_low, w:length, h:length});
      if(bboxNeighbor.length > this.minPts + 1 || bboxNeighbor.length == this.minPts + 1)
      {
        for (var i = 0; i < bboxNeighbor.length; i++) {
          var PtIndex = bboxNeighbor[i];
          var dist = this.distance(this.dataset[centerPointId], this.dataset[PtIndex]);
          if (dist < radius) {
            neighbors.push(PtIndex);
          }
        }
      }
      // else
      //   neighbors = bboxNeighbor;
      
      radius += this.epsilon;
    }while(neighbors.length < this.minPts + 1)

    KNNeighbor = this.sortDistIDShortArray(neighbors, centerPointId);
  }
  else
  {
    var distArray = new Array(this._datasetLength);
    for(var i=0; i < this._datasetLength; i++)
    {
      distArray[i] = this.distance(this.dataset[i], this.dataset[centerPointId]);
    }
    var KNNeighbor = this.sortDistIDArray(distArray, centerPointId);
  }
  

  return KNNeighbor;
}
/**
 * us ethe center point, recalculate the shape of ellipse based on the points in the currentNeighbor, get the ellipse neighbor of the center point
 *
 * @param {Array} currentNeighbor, the array contain the id of the points within the Ellipse neighborhood of center point
 * @param {number} centerPointId, 
 * @returns {Array}
 * @access protected
 */
ANDBSCAN.prototype._ellipseRegionQuery = function(centerPointId) {
  // get the circle neiborhod of center point
  //var currentNeighbor = [];
  // var distArray = new Array(this._datasetLength);
  // for(var i=0; i < this._datasetLength; i++)
  // {
  //   distArray[i] = this.distance(this.dataset[i], this.dataset[centerPointId]);
  // }

  var currentNeighbor = this.KNN(centerPointId);



  
  //var currentNeighbor = this.sortDistIDArray[centerPointId];
  //currentNeighbor = this._circleRegionQuery(centerPointId);

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

ANDBSCAN.prototype.directionEllipseLoop = function(dataset, epsilon, minPts, distanceFunction) {
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
ANDBSCAN.prototype.localDirectionEllipse = function(centerPointId) {
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
ANDBSCAN.prototype._circleRegionQuery = function(pointId) {
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
ANDBSCAN.prototype._euclideanDistance = function(p, q) {
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
ANDBSCAN.prototype.run = function(dataset, epsilon, minPts, rTree, distanceFunction) {
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

  console.log("Time: " + this.computeTime);

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
ANDBSCAN.prototype._init = function(dataset, epsilon, minPts, rTree, distance) {

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
  //this.distanceMatrixCompute();
  //this.initSortDistIDArray();
};

/**
 * Expand cluster to closest points of given neighborhood
 *
 * @param {number} clusterId
 * @param {Array} neighbors
 * @returns {undefined}
 * @access protected
 */
ANDBSCAN.prototype._expandCluster = function(clusterId, neighbors) {

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
      // add to cluster
        // if (this._assigned[pointId2] !== 1) {
        //   this._addToCluster(pointId2, clusterId);
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
ANDBSCAN.prototype._addToCluster = function(pointId, clusterId) {
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
ANDBSCAN.prototype._mergeArrays = function(a, b) {
  var len = b.length;

  for (var i = 0; i < len; i++) {
    var P = b[i];
    if (a.indexOf(P) < 0) {
      a.push(P);
    }
  }

  return a;
};

