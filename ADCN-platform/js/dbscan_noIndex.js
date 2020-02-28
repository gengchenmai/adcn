//var DBSCAN = require('../lib/index.js').DBSCAN;


var a_crds = [];//a set of point
var polygons = [];//a set of polygon
var ptCluster = [];//the point cluster which derives from DBSCAN
var polygonCluster = [];//the point cluster which derives from polygon (the point index of a_crds)
var ptsSets = [];//a set of different sets of points saved in different time
var polygonsSets = [];//a set of different sets of polygons saved in different time
var Eps = 5;
var MinPts = 2;
var MaxDirChange = 180;
var MaxEccenChange = 1;
var clusterType = "DBSCAN";
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

var KNN = document.getElementById("KNN");
var KNNctx = KNN.getContext("2d");
var KNNoffset = $("#KNN").offset();
var KthNearArray = [];//the array of the distance between the kth nearest point and point p
var disMetrix = [];//the distance matrix of a_crds

var IsDrawPolygon = false;//whether or not we are drawing polygon
var CurrentPolygonID = -1;
var newPolygon = false;

var a_crds_TW = [];//a set of coordinate from twitter
var trueClassArray = [];
var ptCluster = [];// the clustering result of DBSCAN, AEDBSCAN, ADBSCAN, OPTICS. Two dimentional array. Cluster 1:[]; Cluster 2:[]; Cluster 3:[]...
var clusterClassArray = [];// change ptCluster as a cluster label array for all the point, "0" for noise, "1,2.." for clusters
var GeoScale = 1;// the scale apply to the geotagged data when loading Geotaged data:   graph distance/real distance
var ClusterIndexArray = [];// the reuslt of NMI and Rand, each element: {"clusterType":"DBSCAN", "Eps": 5, "MinPts": 2, "MaxDirChange":180, "MaxEccenChange":0.2, "NMI":1, "Rand": 1}
var ClusterTimeArray = [];// the time spent for running DBSCAN, AEDBSCAN, ANDBSCAN, each element: {"clusterType":"DBSCAN", "Eps": 5, "MinPts": 2, "NumOfPoint":2000, "Time":100ms}

//**********************************************Normalized Mutual Information begin***************************
var computeNMI = function() {
	

	// get the class lable in trueClassArray
	var trueClassIDArray = [];// the label of the class
	var trueClassNum = [];// number of items in this class
	for(var i=0; i<trueClassArray.length; i++)
	{
		var classItem = trueClassArray[i];
		if(i === 0)
		{
			trueClassIDArray.push(classItem);
			trueClassNum.push(1);
			continue;
		}
		var isInTrueCLassID = false;
		for(j=0; j<trueClassIDArray.length; j++)
		{
			if(classItem === trueClassIDArray[j])
			{
				trueClassNum[j]++;
				isInTrueCLassID = true;
				continue;
			}
		}
		if(!isInTrueCLassID)
		{
			trueClassIDArray.push(classItem);
			trueClassNum.push(1);
		}
	}

	// get a matrix for computing NMI, row: TrueClassID, column: ClusterID, each item of matrix means number of pair (TrueClassID, ClusterID) in trueClassArray and clusterClassArray
	var NMIMatrix = new Array(trueClassIDArray.length);
	for(var i=0; i<trueClassIDArray.length; i++)
	{
		NMIMatrix[i] = new Array(ptCluster.length+1);
		for(var j=0; j<ptCluster.length+1; j++)
		{
			NMIMatrix[i][j] = 0;
		}
	}

	for(var i=0; i<trueClassArray.length; i++)
	{
		var trueClassID = trueClassArray[i];
		var trueClassIndex = trueClassIDArray.indexOf(trueClassID);
		var clusterID = clusterClassArray[i];
		NMIMatrix[trueClassIndex][clusterID]++;
		
	}
	var IMutual = 0;
	var HTrue = 0;
	var HCluster = 0;
	var N = trueClassArray.length;

	var noiseClusterNum = N;
	for(var i=0; i<ptCluster.length; i++)
	{
		noiseClusterNum = noiseClusterNum - ptCluster[i].length;
	}

	for(var i=0; i<trueClassIDArray.length; i++)
	{
		var currTrueClassNum = trueClassNum[i];
		HTrue += currTrueClassNum * Math.log(currTrueClassNum/N);
		for(var j=0; j<ptCluster.length+1; j++)
		{
			if(j === 0)
				var currClusterNum = noiseClusterNum;
			else
				var currClusterNum = ptCluster[j-1].length;

			HCluster += currClusterNum*Math.log(currClusterNum/N);
			if(NMIMatrix[i][j] !== 0)
				IMutual += NMIMatrix[i][j] * Math.log(N * NMIMatrix[i][j] / (currTrueClassNum * currClusterNum));
		}
	}
	var NMI = IMutual/Math.sqrt(HTrue * HCluster);
	return NMI;
	

}

var computeRand = function() {

	// N objects, trueWithinClusterMatrix is N * N matrix. Each element (i,j): 1-> they are in the same cluster; 0-> they are not in the same cluster
	var trueWithinClusterMatrix = new Array(trueClassArray.length);
	for(var i=0; i<trueClassArray.length; i++)
	{
		trueWithinClusterMatrix[i] = new Array(trueClassArray.length);
		for(var j=0; j<trueClassArray.length; j++)
		{
			if(i > j || i === j)
				trueWithinClusterMatrix[i][j] = null;
			else
			{
				if(trueClassArray[i] === trueClassArray[j])
					trueWithinClusterMatrix[i][j] = 1;
				else
					trueWithinClusterMatrix[i][j] = 0;
			}

		}
	}

	// N objects, experWithinClusterMatrix is N * N matrix. Each element (i,j): 1-> they are in the same cluster; 0-> they are not in the same cluster
	var experWithinClusterMatrix = new Array(clusterClassArray.length);
	for(var i=0; i<clusterClassArray.length; i++)
	{
		experWithinClusterMatrix[i] = new Array(clusterClassArray.length);
		for(var j=0; j<clusterClassArray.length; j++)
		{
			if(i > j || i === j)
				experWithinClusterMatrix[i][j] = null;
			else
			{
				if(clusterClassArray[i] === clusterClassArray[j])
					experWithinClusterMatrix[i][j] = 1;
				else
					experWithinClusterMatrix[i][j] = 0;
			}

		}
	}

	var A_rand = 0;
	var B_rand = 0;
	var C_rand = 0;
	var D_rand = 0;

	for(var i=0; i<trueClassArray.length; i++)
	{
		for(var j=0; j<trueClassArray.length; j++)
		{
			if(i < j)
			{
				if(trueWithinClusterMatrix[i][j] === 1 && experWithinClusterMatrix[i][j] === 1)
				{
					A_rand++;
				}
				if(trueWithinClusterMatrix[i][j] === 0 && experWithinClusterMatrix[i][j] === 0)
				{
					B_rand++;
				}
				if(trueWithinClusterMatrix[i][j] === 1 && experWithinClusterMatrix[i][j] === 0)
				{
					C_rand++;
				}
				if(trueWithinClusterMatrix[i][j] === 0 && experWithinClusterMatrix[i][j] === 1)
				{
					D_rand++;
				}
			}
		}
	}

	var randIndex = (A_rand + B_rand) / (A_rand + B_rand + C_rand + D_rand);

	return randIndex;
}

var computeClusterIndex = function() {
	var ClusterIndexItem = {"clusterType":clusterType, "Eps": Eps, "MinPts": MinPts, "MaxDirChange":MaxDirChange, "MaxEccenChange":MaxEccenChange, "NMI":1, "Rand": 1};
	ClusterIndexItem.NMI = computeNMI();
	ClusterIndexItem.Rand = computeRand();
	console.log(ClusterIndexItem);

	if(ClusterIndexArray.indexOf(ClusterIndexItem) === -1)
		ClusterIndexArray.push(ClusterIndexItem);


}

var loopAllADParameterSetting = function() {
	for(var eps=5; eps<=100; eps = eps + 5)
	{
		for(var minpts=3; minpts<=7; minpts++)
		{
			for(var maxdir=20; maxdir<=180; maxdir = maxdir + 20)
			{
				for(var maxeccen = 0.1; maxeccen <= 1; maxeccen = maxeccen + 0.1)
				{
					Eps = eps;
					MinPts = minpts;
					MaxDirChange = maxdir;
					MaxEccenChange = maxeccen;

					var adbscan = new ADBSCAN();
					ptCluster = adbscan.run(a_crds, eps* GeoScale, minpts, maxdir, maxeccen);

					clusterType ="ADBSCAN";
					
					//make the cluster result in to array
					clusterClassArray = [];
					for(var i = 0; i < a_crds.length; i++)
					{
						clusterClassArray.push(0);
					}

					for(var i = 0; i < ptCluster.length; i++)
					{
						var classArray = ptCluster[i];
						for(var j = 0; j < classArray.length; j++)
						{
							var item = classArray[j];
							clusterClassArray[item] = i+1;
						}
					}
					computeClusterIndex();
				}
			}
		}
	}

	}

var loopAllDBParameterSetting = function() {
	

	MaxDirChange = 180;
	MaxEccenChange = 1;

	for(var eps=5; eps<=100; eps = eps + 1)
	{
		for(var minpts=2; minpts<=20; minpts++)
		{
			Eps = eps;
			MinPts = minpts;
			

			var dbscan = new DBSCAN();
			ptCluster = dbscan.run(a_crds, eps * GeoScale, minpts);
			
			clusterType ="DBSCAN";

			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}
			computeClusterIndex();

		}
	}

	
}

var loopAllAEParameterSetting = function() {
	

	MaxDirChange = 180;
	MaxEccenChange = 1;

	for(var eps=5; eps<=100; eps = eps + 1)
	{
		for(var minpts=2; minpts<=20; minpts++)
		{
			Eps = eps;
			MinPts = minpts;
			

			var aedbscan = new AEDBSCAN();
			ptCluster = aedbscan.run(a_crds, eps * GeoScale, minpts);
			
			clusterType ="AEDBSCAN";

			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}
			computeClusterIndex();

		}
	}

	
}

var loopAllANParameterSetting = function() {
	

	MaxDirChange = 180;
	MaxEccenChange = 1;

	for(var eps=5; eps<=100; eps = eps + 1)
	{
		for(var minpts=2; minpts<=20; minpts++)
		{
			Eps = eps;
			MinPts = minpts;
			

			var andbscan = new ANDBSCAN();
			ptCluster = andbscan.run(a_crds, eps * GeoScale, minpts);
			
			clusterType ="ANDBSCAN";

			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}
			computeClusterIndex();

		}
	}

	
}


var loopAllOPTICSParameterSetting = function() {
	

	MaxDirChange = 180;
	MaxEccenChange = 1;

	for(var eps=5; eps<=100; eps = eps + 1)
	{
		for(var minpts=2; minpts<=20; minpts++)
		{
			Eps = eps;
			MinPts = minpts;
			

			var optics = new OPTICS();
			ptCluster = optics.run(a_crds, Eps * GeoScale, MinPts);
			
			clusterType ="OPTICS";

			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}
			computeClusterIndex();

		}
	}

	
}

//**********************************************Normalized Mutual Information finished************************


//**********************************************Efficiency ***************************************************
var loopDBTime = function(){
	//ClusterTimeArray = [];
	var aveTime = 0;
	//Eps = Number($("input[name=EpsValue]").val());
	//MinPts = Number($("input[name=MinPtsValue]").val());
	for(var i=0; i< 100; i++)
	{
		//var timeelement = {"clusterType":"DBSCAN", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length, "Time":"100ms"};

		
		console.log("DBSCAN");
	    //console.info('passing coordinates to dbscan: ', a_crds);
		//console.info('Eps: ', Eps);
		//console.info('MinPts: ', MinPts);
		//Eps = Eps * GeoScale;
		//console.log(GeoScale);
		var oldtime = Date.now();
		var dbscan = new DBSCAN();
		ptCluster = dbscan.run(a_crds, Eps * GeoScale, MinPts);
		var newtime = Date.now();
		aveTime += newtime - oldtime;
		//timeelement.Time = newtime - oldtime;
		//ClusterTimeArray.push(newtime - oldtime);
	}
	aveTime = aveTime/100;
	var timeelement = {"Case":$("#PtsNameValue").val(),"clusterType":"DBSCAN", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length,  "Time":aveTime};
	ClusterTimeArray.push(timeelement);
	
}


var loopAETime = function(){
	//ClusterTimeArray = [];
	var aveTime = 0;
	//Eps = Number($("input[name=EpsValue]").val());
	//MinPts = Number($("input[name=MinPtsValue]").val());
	for(var i=0; i< 100; i++)
	{
		//var timeelement = {"clusterType":"DBSCAN", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length, "Time":"100ms"};

		
		console.log("AEDBSCAN");
	    //console.info('passing coordinates to dbscan: ', a_crds);
		//console.info('Eps: ', Eps);
		//console.info('MinPts: ', MinPts);
		//Eps = Eps * GeoScale;
		//console.log(GeoScale);
		var oldtime = Date.now();
		var aedbscan = new AEDBSCAN();
		ptCluster = aedbscan.run(a_crds, Eps * GeoScale, MinPts);
		var newtime = Date.now();
		aveTime += newtime - oldtime;
		//timeelement.Time = newtime - oldtime;
		//ClusterTimeArray.push(newtime - oldtime);
	}
	aveTime = aveTime/100;
	var timeelement = {"Case":$("#PtsNameValue").val(),"clusterType":"AEDBSCAN", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length, "Time":aveTime};
	ClusterTimeArray.push(timeelement);
	
}

var loopANTime = function(){
	//ClusterTimeArray = [];
	var aveTime = 0;
	//Eps = Number($("input[name=EpsValue]").val());
	//MinPts = Number($("input[name=MinPtsValue]").val());
	for(var i=0; i< 100; i++)
	{
		//var timeelement = {"clusterType":"DBSCAN", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length, "Time":"100ms"};

		
		console.log("ANDBSCAN");
	    //console.info('passing coordinates to dbscan: ', a_crds);
		//console.info('Eps: ', Eps);
		//console.info('MinPts: ', MinPts);
		//Eps = Eps * GeoScale;
		//console.log(GeoScale);
		var oldtime = Date.now();
		var andbscan = new ANDBSCAN();
		ptCluster = andbscan.run(a_crds, Eps * GeoScale, MinPts);
		var newtime = Date.now();
		aveTime += newtime - oldtime;
		//timeelement.Time = newtime - oldtime;
		//ClusterTimeArray.push(newtime - oldtime);
	}
	aveTime = aveTime/100;
	var timeelement = {"Case":$("#PtsNameValue").val(),"clusterType":"ANDBSCAN", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length, "Time":aveTime};
	ClusterTimeArray.push(timeelement);
	
}

var loopOPTICSTime = function(){
	//ClusterTimeArray = [];
	var aveTime = 0;
	//Eps = Number($("input[name=EpsValue]").val());
	//MinPts = Number($("input[name=MinPtsValue]").val());
	for(var i=0; i< 100; i++)
	{
		//var timeelement = {"clusterType":"DBSCAN", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length, "Time":"100ms"};

		
		console.log("OPTICS");
	    //console.info('passing coordinates to dbscan: ', a_crds);
		//console.info('Eps: ', Eps);
		//console.info('MinPts: ', MinPts);
		//Eps = Eps * GeoScale;
		//console.log(GeoScale);
		var oldtime = Date.now();
		var optics = new OPTICS();
		ptCluster = optics.run(a_crds, Eps * GeoScale, MinPts);
		var newtime = Date.now();
		aveTime += newtime - oldtime;
		//timeelement.Time = newtime - oldtime;
		//ClusterTimeArray.push(newtime - oldtime);
	}
	aveTime = aveTime/100;
	var timeelement = {"Case":$("#PtsNameValue").val(),"clusterType":"OPTICS", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length, "Time":aveTime};
	ClusterTimeArray.push(timeelement);
	
}

var loopTime = function(){
	//ClusterTimeArray = [];

	// var parameter = [];
	// parameter.push({"Case":"bridge_pt", "Eps":[], "MinPts":[]});

	
	// Eps = 69;
	// MinPts = 6;
	// loopDBTime();

	// Eps = 42;
	// MinPts = 5;loopAETime();
	// loopAETime();


	Eps = 50;
	MinPts = 5;
	loopDBTime();
	loopAETime();
	loopANTime();
	loopOPTICSTime();


	// Eps = 48;
	// MinPts = 6;
	// loopANTime();

	// Eps = 34;
	// MinPts = 4;
	// loopOPTICSTime();


	// ClusterTimeArray = [];
	// Eps = Number($("input[name=EpsValue]").val());
	// MinPts = Number($("input[name=MinPtsValue]").val());
	// loopANTime();
	// console.log(ClusterTimeArray);


	
	// Eps = 50;
	// MinPts = 10;
	// loopDBTime();
	// loopAETime();
	// loopANTime();
	// loopOPTICSTime();

	// Eps = 100;
	// MinPts = 5;
	// loopDBTime();
	// loopAETime();
	// loopANTime();
	// loopOPTICSTime();

	// Eps = 100;
	// MinPts = 10;
	// loopDBTime();
	// loopAETime();
	// loopANTime();
	// loopOPTICSTime();

	// Eps = 100;
	// MinPts = 20;
	// loopDBTime();
	// loopAETime();
	// loopANTime();
	// loopOPTICSTime();
	console.log($("#PtsNameValue").val() + ": Time finished");
}

//**********************************************Efficiency finished*******************************************



//**********************************************DBSCAN KNN****************************************************

/***********************
find the kth nearest point for every point
return an array of the distance between every point and the kth (k=minPts) nearest point
Gengchen Mai
*/
var kthNearestDisArray = function(dataset, minPts) {
	
	

	if(dataset.length !== 0)
	{
		var kthNearest_Array = new Array(dataset.length);
		distanceMatrix(dataset);
		for (var id = 0; id < dataset.length; id++) 
		{
			kthNearest_Array[id] = kthNearDis_Pt(dataset.length, id, minPts);
		};

		return kthNearest_Array;
	}
	else
	{
		alert("Cannot creat a KNN plot because there is no point in current dataset!");
		return false;
	}
	
};

/***********************
find the kth nearest point for point p with pointId
return the distance between point p and the kth (k=minPts) nearest point
Gengchen Mai
*/
var kthNearDis_Pt = function(distanceArrayLength, pointId, minPts) {
	//save the distance from point with pointId to every point
	var distancePtArray = new Array(distanceArrayLength);

	//calculate the distance from point p to all the points in the dataset
	for (var id = 0; id < distanceArrayLength; id++) 
	{
		//var distance = _euclideanDistance(dataset[pointId], dataset[id]);
		//distancePtArray.push(distance);
		if(pointId <= id)
		{
			distancePtArray[id] = disMetrix[pointId][id];
		}else
		{
			distancePtArray[id] = disMetrix[id][pointId];
		}
	};
	//bubble sorting
	var SortingDisArray = bubbleSorting(distancePtArray);

	return SortingDisArray[minPts-1];
};

/***********************
Given a dataset with n points in it, return a n*n metrix indicate the distance from point i to point j. 
The matrix is symmetric. Only the top half of the matrix will be calculated.
Gengchen Mai
*/
var distanceMatrix = function(dataset){
	//if(dataset === []){return false;}
	disMetrix = new Array(dataset.length);
	for(var i = 0; i < dataset.length; i++)
	{
		var iDisArray = new Array(dataset.length);
		for(var j = 0; j < dataset.length; j++)
		{
			if(i < j)
			{
				iDisArray[j] = _euclideanDistance(dataset[i], dataset[j]);
			}
			else if(i === j)
			{
				iDisArray[j] = 0;
			}else
			{
				iDisArray[j] = -1;
			}
		}
		disMetrix[i] = iDisArray;
	}
	
	return true;
	/*
	if (disMetrix === [])
	{
		disMetrix = new Array(dataset.length);
		for(var i = 0; i < dataset.length; i++)
		{
			var iDisArray = new Array(dataset.length);
			for(var j = 0; j < dataset.length; j++)
			{
				if(i < j)
				{
					iDisArray[j] = _euclideanDistance(dataset[i], dataset[j]);
				}
				else if(i === j)
				{
					iDisArray[j] = 0;
				}else
				{
					iDisArray[j] = -1;
				}
			}
			disMetrix[i] = iDisArray;
		}
	}
	
	else if(disMetrix.length < dataset.length)
	{
		var newDisArray = new Array(dataset.length);
		for(var i = 0; i < dataset.length; i++)
		{
			var iDisArray = new Array(dataset.length);
			for(var j = 0; j < dataset.length; j++)
			{
				if(j <= disMetrix.length-1)
				{
					iDisArray[j] = disMetrix[i][j];
				}
				else
				{
					iDisArray[j] = _euclideanDistance(dataset[i], dataset[j]);
				}
			}
			disMetrix[i] = iDisArray;
		}
	}*/
};

//Ascending bubble sorting
var bubbleSorting = function (array1){
	var array = array1;
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



/*************
Calculate the distance between point p and q
*/
var _euclideanDistance = function(p, q) {
  var sum = 0;
  var i = Math.min(p.length, q.length);

  while (i--) {
    sum += (p[i] - q[i]) * (p[i] - q[i]);
  }

  return Math.sqrt(sum);
};

//***************************************************************************************************************

//draw a point(x, y, point color, fill it or not,the radius of point)
function drawPt(x, y, color,isFill,radius) {
    
	ctx.fillStyle = color;
    ctx.beginPath();
    
	ctx.arc(x, y, radius, 0, 2*Math.PI);
    ctx.closePath();
    ctx.stroke();
    if(isFill)
    {
    	ctx.fill();
    }
    ctx.fillStyle = "black";
}

//draw a cross in the point of a polygon
function drawCross(x, y, color){
	ctx.strokeStyle = color;
	ctx.beginPath();
	ctx.moveTo(x,y+4);
	ctx.lineTo(x,y-4);
	ctx.closePath();
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x-4,y);
	ctx.lineTo(x+4,y);
	ctx.closePath();
	ctx.stroke();
	ctx.fillStyle = "black";
	ctx.strokeStyle = "black";
};

//draw a line between two points
function drawLine(point1, point2, color){

	ctx.strokeStyle = color;
	ctx.beginPath();
	ctx.moveTo(point1[0],point1[1]);
	ctx.lineTo(point2[0],point2[1]);
	ctx.closePath();
	ctx.stroke();
	ctx.fillStyle = "black";
	ctx.strokeStyle = "black";
};
/*
function handleMouseUp(e) {
    
    e.preventDefault();
    e.stopPropagation();
	var mouseX = parseInt(e.clientX - offsetX);
    var mouseY = parseInt(e.clientY - offsetY);
    $display.text('x: ' + mouseX + ', y: ' + mouseY);
	console.log('x: ' + mouseX + ', y: ' + mouseY);
	a_crds.push([mouseX, mouseY]);
	drawPt(mouseX, mouseY);
}

$("#convas").mouseup(function (e) {
    	handleMouseUp(e);
});


jQuery(document).ready(function(){
     $("#canvas").click(function(ev){ 

        var $div = $(ev.target);
		var $display = $div.find('.display');
		
		var offset = $div.offset();
		var x = ev.clientX - offset.left;
		var y = ev.clientY - offset.top;
		
		var canvas = document.getElementById("convas");
		var ctx = canvas.getContext("2d");
		ctx.fillStyle = "black";
	    ctx.beginPath();
	    
		ctx.arc(x, y, 1, 0, 2*Math.PI);
	    ctx.closePath();
	    ctx.stroke();
	    $display.text('x: ' + x + ', y: ' + y);
		console.log('x: ' + x + ', y: ' + y);

		a_crds.push([x, y]);
   }); 
})  
*/

//draw the cluster!!!!!!	
function drawCluster(clusters){
	var cluterNum = clusters.length;
	for(var i = 0; i < cluterNum; i++)
	{
		var clusterColor ='#'+Math.random().toString(16).substr(2,6);
		ctx.fillStyle = clusterColor;

		var ptArray = clusters[i];
		var num = ptArray.length;
		for(var j = 0; j < num; j++)
		{
			var pt = a_crds[ptArray[j]];
			drawPt(pt[0], pt[1], clusterColor, true, 3);
			
		}
	}
	ctx.fillStyle = "black";
}

function drawPolygon(polygon, lineColor, lineWidth, fillColor, fillTransparent){
	ctx.globalAlpha = fillTransparent;
			
	ctx.beginPath();
	ctx.moveTo(polygon[0][0], polygon[0][1]);
	for(var i = 1; i < polygon.length; i++)
	{
		var currentPt = polygon[i];
		ctx.lineTo(currentPt[0],currentPt[1]);
	}
	ctx.closePath();
	ctx.fillStyle = fillColor;
	ctx.fill();
	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = lineColor;
	ctx.stroke();
	ctx.globalAlpha = 1;
	ctx.fillStyle = "black";
	ctx.lineWidth = 1;
	ctx.strokeStyle = "black";
}

//point-in-polygon judgement
function ptInPolygon(point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    
    var x = point[0], y = point[1];
    
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];
        
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

//open the file selection dislog and read the txt file you select
function openPtFileFn(event){
	
	var input = event.target;
	
    var reader = new FileReader();
    reader.onload = function()
    {
		var text = reader.result;
		console.log(reader.result.substring(0, 200));
		var array = text.split("|");
		a_crds = [];
		GeoScale = 1;
		for (var i = 0; i < array.length-1; i++) 
		{
			var coordinateArray = array[i].split(",");
			var point = [];
			point.push(coordinateArray[0]);
			point.push(coordinateArray[1]);
			a_crds.push(point);
		};
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (var i = 0; i < a_crds.length; i++) 
		{
			drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
		}
		ptsSets.push(a_crds);// save current set of points 

		var selectPtsList = document.getElementById("slcPtsName");
		var PtsSetName = document.getElementById("PtsNameValue");

		var filename = input.files[0].name;
		var fileNameArray = filename.split(".");
		PtsSetName.value = fileNameArray[0];
		console.log(PtsSetName.value);

		var newOption = document.createElement("option");
		newOption.value = PtsSetName.value;
		newOption.innerHTML = PtsSetName.value;
		selectPtsList.options.add(newOption);
    };
    reader.readAsText(input.files[0]);
    
}



function openTwitterPtFileFn(event){
	
	trueClassArray = [];
	var input = event.target;
	
    var reader = new FileReader();
    reader.onload = function()
    {
		var text = reader.result;
		// console.log(reader.result.substring(0, 200));
		var textlineArray = text.split("\n");
		// console.log(textlineArray);

		a_crds_TW = [];
		a_crds = [];
		var lon_mean = 0;
		var lon_max = -Infinity;
		var lon_min = Infinity;
		var lat_mean = 0;
		var lat_max = -Infinity;
		var lat_min = Infinity;
		for (var i = 1; i < textlineArray.length-1; i++)
		{
			var textline = textlineArray[i];
			var textslice = textline.split(",");
			if(Number(textslice[5]) === 0 || Number(textslice[6])  === 0)
				continue;
			var lon  = Number(textslice[3]);
			var lat  = Number(textslice[4]);
			var trueClass = Number(textslice[2]);
			trueClassArray.push(trueClass);
			var coord = [];
			coord.push(lon);
			coord.push(lat);
			a_crds_TW.push(coord);
			lon_mean += lon;
			lat_mean += lat;
			if(lon > lon_max)
				lon_max = lon;
			if(lon < lon_min)
				lon_min = lon;
			if(lat > lat_max)
				lat_max = lat;
			if(lat < lat_min)
				lat_min = lat;
		}

		lon_mean = lon_mean/a_crds_TW.length;
		lat_mean = lat_mean/a_crds_TW.length;

		X_max = canvas.width;
		Y_max = canvas.height;
		X_scale = X_max/(lon_max - lon_min);
		Y_scale = Y_max/(lat_max - lat_min);

		GeoScale = X_scale > Y_scale? Y_scale : X_scale;


		for (var i = 0; i < a_crds_TW.length-1; i++)
		{
			var x_prj = (a_crds_TW[i][0] - lon_min) * GeoScale;
			var y_prj = canvas.height - (a_crds_TW[i][1] - lat_min) * GeoScale;
			var coord_prj = [];
			coord_prj.push(x_prj);
			coord_prj.push(y_prj);
			a_crds.push(coord_prj);
		}







		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (var i = 0; i < a_crds.length; i++) 
		{
			drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
		}
		ptsSets.push(a_crds);// save current set of points 

		var selectPtsList = document.getElementById("slcPtsName");
		var PtsSetName = document.getElementById("PtsNameValue");

		var filename = input.files[0].name;
		var fileNameArray = filename.split(".");
		PtsSetName.value = fileNameArray[0];
		console.log(PtsSetName.value);

		var newOption = document.createElement("option");
		newOption.value = PtsSetName.value;
		newOption.innerHTML = PtsSetName.value;
		selectPtsList.options.add(newOption);
    };
    reader.readAsText(input.files[0]);
    
}

function openPolygonFileFn(event){
	
	var input = event.target;
	
    var reader = new FileReader();
    reader.onload = function()
    {
		var text = reader.result;
		console.log(reader.result.substring(0, 200));
		var array = text.split("/n");
		polygons = [];
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (var i = 0; i < a_crds.length; i++) 
		{
			drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
		}
		for (var i = 0; i < array.length-1; i++) 
		{
			var polygon = [];
			var pointArray = array[i].split("|");
			for (var j = 0; j < pointArray.length-1; j++) 
			{
				var coordinateArray = pointArray[j].split(",");
				var point = [];
				point.push(coordinateArray[0]);
				point.push(coordinateArray[1]);
				polygon.push(point);
			};
			polygons.push(polygon);
			drawPolygon(polygon, "red", 2, "#88ccff", 0.3);
		};

		polygonsSets.push(polygons);// save current set of polygons 

		var selectPolygonsList = document.getElementById("slcPolygonName");
		var PolygonsSetName = document.getElementById("PolygonNameValue");

		var filename = input.files[0].name;
		var fileNameArray = filename.split(".");
		PolygonsSetName.value = fileNameArray[0];

		var newOption = document.createElement("option");
		newOption.value = PolygonsSetName.value;
		newOption.innerHTML = PolygonsSetName.value;
		selectPolygonsList.options.add(newOption);
		
		
    };
    reader.readAsText(input.files[0]);
    
}

function selectPtsSet(){
	var selectPtsList = document.getElementById("slcPtsName");
	a_crds = ptsSets[selectPtsList.selectedIndex-1];// change the set of points
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	for (var i = 0; i < a_crds.length; i++) 
	{
		drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
	}
	
}

//what happen when click on one element of the polygon drop-down list 
function selectPolygonSet(){
	var selectPolygonsList = document.getElementById("slcPolygonName");
	polygons = polygonsSets[selectPolygonsList.selectedIndex-1];// change the set of points
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	for (var i = 0; i < a_crds.length; i++) 
	{
		drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
	}
	for (var i = 0; i < polygons.length; i++) {
		drawPolygon(polygons[i], "red", 2, "#88ccff", 0.3);
	}
}

function drawKNN(KNNArray){
	if(KNNArray !== [] && KthNearArray !== [])
	{
		
		//the coordinate of the original point of KNN
		var KNNOrignalX = 30;
		var KNNOrignalY = KNN.height - 30;

		//the interval of points in X direction
		var KNNintervalX = (KNN.width - 30*2) / (KNNArray.length + 1);

		//the scale we use to apply to the y of point
		var KNNScaleY =  (KNN.height - 30*2)/ KNNArray[KNNArray.length-1];

		var X_Array = [];
		var Y_Array = [];

		KNNctx.clearRect(0, 0, KNN.width, KNN.height);

		for (var i = 0; i < KNNArray.length; i++) {
			//the offset of ith point according to the original point of KNN
			var KNNPtoffsetX = KNNintervalX * (i+1);
			var KNNPtoffsetY = -KNNArray[i] * KNNScaleY;

			//the coordinate of ith point
			var x = KNNOrignalX + KNNPtoffsetX;
			var y = KNNOrignalY + KNNPtoffsetY;

			X_Array.push(x);
			Y_Array.push(y);
		};
		//console.log(KNNArray);

		//console.log(X_Array);

		KNNctx.font = "bold 20px 'Times New Roman'";
		//KNNctx.font-style = "oblique";
		KNNctx.fillText("points ascending order by k-dis",150,20);

		//console.log(X_Array[3]);
		KNNctx.strokeStyle = "black";
		KNNctx.fillStyle = "black";
		
		//draw points in KNN
		for (var i = 0; i < KNNArray.length; i++) {

			//draw this point on the KNN
			
		    KNNctx.beginPath();
			KNNctx.arc(X_Array[i], Y_Array[i], 2 , 0, 2*Math.PI);
		    KNNctx.closePath();
		    KNNctx.fill();
		    KNNctx.stroke();			    
		};

		//draw line between the points
		KNNctx.lineWidth = 0.2;
		for (var i = 0; i < KNNArray.length; i++) {

		    
		    if(i === 0)
		    {
				KNNctx.beginPath();
				KNNctx.moveTo(X_Array[i], Y_Array[i]);
		    }else{
		    	KNNctx.lineTo(X_Array[i], Y_Array[i]);		    	
		    }	    
		};
		KNNctx.stroke();
		

		//draw x, y axix
		KNNctx.lineWidth = 1;
		KNNctx.strokeStyle = "red";
		KNNctx.beginPath();
		KNNctx.moveTo(KNNOrignalX,KNNOrignalY - KNN.height + 30*2);
		KNNctx.lineTo(KNNOrignalX,KNNOrignalY);
		KNNctx.lineTo(KNNOrignalX + KNN.width - 30*2,KNNOrignalY);
		KNNctx.stroke();
		KNNctx.fillStyle = "black";
		KNNctx.strokeStyle = "black";
		
		
		//draw subline on y axis
		Y_asix_interval = (KNN.height - 30*2)/10;

		//font style for the figure of subline
		KNNctx.font = "oblique 10px 'Times New Roman'";
		//KNNctx.font-style = "normal";

		KNNctx.lineWidth = 0.2;
		for (var i = 1; i < 11; i++) {
			//draw the subline
			KNNctx.strokeStyle = "black";
			KNNctx.beginPath();
			KNNctx.moveTo(KNNOrignalX, KNNOrignalY-i*Y_asix_interval);
			KNNctx.lineTo(KNNOrignalX + KNN.width - 2*30,KNNOrignalY-i*Y_asix_interval);
			KNNctx.stroke();
			
			//the distance of this subline
			var dis = i*Y_asix_interval/KNNScaleY;
			
			KNNctx.fillText(dis.toFixed(2),KNNOrignalX-28, KNNOrignalY-i*Y_asix_interval);

		};
	}
	
}

$(function() {
	//change mouse cursor to crosshair
	//document.getElementById("canvas").style.cursor="crosshair";




	//differentiate between sigle click and double click
	$('#canvas').click(function(e) {
	    var that = this;
	    setTimeout(function() {
	        var dblclick = parseInt($(that).data('double'), 10);
	        if (dblclick > 0) {
	            $(that).data('double', dblclick-1);
	        } else {
	            singleClick.call(that, e);
	        }
	    }, 300);
	}).dblclick(function(e) {
	    $(this).data('double', 2);
	    doubleClick.call(this, e);
	});

	function singleClick(ev) {
	    // do something, "this" will be the DOM element
	    var $div = $(ev.target);
		
		var offset = $div.offset();
		var x = ev.clientX - offset.left -2;
		var y = ev.clientY - offset.top -2;
		if(!IsDrawPolygon)
		{
			
			drawPt(x, y, "black", false, 3);
			
		    //$display.text('x: ' + x + ', y: ' + y);
			console.log('x: ' + x + ', y: ' + y);

			a_crds.push([x, y]);
		}
		else
		{
			if(newPolygon)
			{
				drawCross(x, y, "green");
				if(polygons.length === CurrentPolygonID+1)//we are editing a polygon
				{
					polygons[polygons.length-1].push([x, y]);
					var currentPolygon = polygons[polygons.length-1];
					var point1 = currentPolygon[currentPolygon.length-2];
					var point2 = currentPolygon[currentPolygon.length-1];
					drawLine(point1, point2,"red");
				}
				else//we want to creat a polygon
				{
					var polygon = [];
					polygon.push([x, y]);
					polygons.push(polygon);
				}
				
			}
			
		}
	}

	function doubleClick(ev) {
	    // do something, "this" will be the DOM element
	    if(newPolygon && IsDrawPolygon)
		{
			newPolygon = false;
			var $div = $(ev.target);
		
			var offset = $div.offset();
			var x = ev.clientX - offset.left;
			var y = ev.clientY - offset.top;
			drawCross(x, y, "green");
			polygons[polygons.length-1].push([x,y]);
			var polygon = polygons[polygons.length-1];
			var pointLast = [x,y];
			var pointHead = polygon[0];
			
			drawLine(polygon[polygon.length-2], pointLast,"red");
			drawLine(pointLast, pointHead,"red");
			
			drawPolygon(polygon, "red", 2, "#88ccff", 0.3);
			console.log(polygons);
		}
	}

	/*
	$('#canvas').on('click', function (ev) {
	
	});*/

	$('#KNN').click(function(ev) {
	    var $KNN = $(ev.target);
		
		var offset = $KNN.offset();
		var x = ev.clientX - offset.left;
		var y = ev.clientY - offset.top;

		
		KNNctx.clearRect(0, 0, KNN.width, KNN.height);
		var KNNArray = bubbleSorting(KthNearArray);

		drawKNN(KNNArray);

		var KNNScaleY =  (KNN.height - 30*2)/ KNNArray[KNNArray.length-1];
		var dis = (KNN.height - y - 30) / KNNScaleY;

		KNNctx.font = "oblique 15px 'Times New Roman'";
		
		KNNctx.fillText("Eps Candidate: " + dis.toFixed(2),KNN.width - 150, KNN.height - 15);
		//$("#Eps-Candidate").text('Eps Candidate: ' + dis.toFixed(2));

	});

	$("#KNN-btn").click(function(){
		IsDrawPolygon = false;
		if($("input[name=MinPtsValue]").val() !== "")
		{
			/*
			var KNN = document.getElementById("KNN");
			var KNNctx = KNN.getContext("2d");
			var KNNoffset = $("#KNN").offset();
			*/

			var MinPts = $("input[name=MinPtsValue]").val();

			//the kth Nearest distance for every point
			KthNearArray = kthNearestDisArray(a_crds, MinPts);
			//if(KthNearArray === false){return;}

			//bubble sorting for this array
			var KNNArray = bubbleSorting(KthNearArray);

			drawKNN(KNNArray);
			
		}
	    
	});

	$("#OPTICS").click(function(){
		IsDrawPolygon = false;
		if($("input[name=EpsValue]").val() !== "" &&$("input[name=MinPtsValue]").val() !== "")
		{
			
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (var i = 0; i < a_crds.length; i++) 
			{
				drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
			};
			Eps = Number($("input[name=EpsValue]").val());
			MinPts = Number($("input[name=MinPtsValue]").val());
			console.log("OPTICS");
		    //console.info('passing coordinates to OPTICS: ', a_crds);
			//console.info('Eps: ', Eps);
			//console.info('MinPts: ', MinPts);
			console.time("OPTICS");
			var optics = new OPTICS();
			//Eps = Eps * GeoScale;
			ptCluster = optics.run(a_crds, Eps * GeoScale, MinPts);
			console.timeEnd("OPTICS");
			
			clusterType ="OPTICS";
			//Eps = $("input[name=EpsValue]").val();
			MaxDirChange = 180;
			MaxEccenChange = 1;

			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}

			//console.log(a_crds);
			console.log(ptCluster);
			drawCluster(ptCluster);
			computeClusterIndex();
			
		}
	    
	});

	$("#AEDBSCAN").click(function(){
		IsDrawPolygon = false;
		if($("input[name=EpsValue]").val() !== "" &&$("input[name=MinPtsValue]").val() !== "")
		{
			
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (var i = 0; i < a_crds.length; i++) 
			{
				drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
			};
			Eps = Number($("input[name=EpsValue]").val());
			MinPts = Number($("input[name=MinPtsValue]").val());
			console.log("AEDBSCAN");
		    //console.info('passing coordinates to AEDBSCAN: ', a_crds);
			//console.info('Eps: ', Eps);
			//console.info('MinPts: ', MinPts);
			console.time("AEDBSCAN");
			var aedbscan = new AEDBSCAN();
			//Eps = Eps * GeoScale;
			ptCluster = aedbscan.run(a_crds, Eps * GeoScale, MinPts);
			console.timeEnd("AEDBSCAN");
			
			clusterType ="AEDBSCAN";
			//Eps = $("input[name=EpsValue]").val();
			MaxDirChange = 180;
			MaxEccenChange = 1;

			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}

			//console.log(a_crds);
			console.log(ptCluster);
			drawCluster(ptCluster);
			computeClusterIndex();
			
		}
	    
	});

	$("#ANDBSCAN").click(function(){
		IsDrawPolygon = false;
		if($("input[name=EpsValue]").val() !== "" &&$("input[name=MinPtsValue]").val() !== "")
		{
			
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (var i = 0; i < a_crds.length; i++) 
			{
				drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
			};
			Eps = Number($("input[name=EpsValue]").val());
			MinPts = Number($("input[name=MinPtsValue]").val());
			console.log("ANDBSCAN");
		    //console.info('passing coordinates to AEDBSCAN: ', a_crds);
			//console.info('Eps: ', Eps);
			//console.info('MinPts: ', MinPts);
			console.time("ANDBSCAN");
			var andbscan = new ANDBSCAN();
			//Eps = Eps * GeoScale;
			ptCluster = andbscan.run(a_crds, Eps * GeoScale, MinPts);
			console.timeEnd("ANDBSCAN");
			
			clusterType ="ANDBSCAN";
			//Eps = $("input[name=EpsValue]").val();
			MaxDirChange = 180;
			MaxEccenChange = 1;

			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}

			//console.log(a_crds);
			console.log(ptCluster);
			drawCluster(ptCluster);
			computeClusterIndex();
			
		}
	    
	});

	$("#LISD").click(function(){
		IsDrawPolygon = false;
		if($("input[name=EpsValue]").val() !== "" && $("input[name=MinPtsValue]").val() !== "")
		{
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (var i = 0; i < a_crds.length; i++) 
			{
				drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
			};
			Eps = Number($("input[name=EpsValue]").val());
			MinPts = Number($("input[name=MinPtsValue]").val());
			
			// console.log("AEDBSCAN");
		    //console.info('passing coordinates to AEDBSCAN: ', a_crds);
			//console.info('Eps: ', Eps);
			//console.info('MinPts: ', MinPts);
			//Eps = Eps * GeoScale;
			var aedbscan = new AEDBSCAN();
			aedbscan.directionEllipseLoop(a_crds, Eps* GeoScale, MinPts);
			//ptCluster = aedbscan.run(a_crds, Eps, MinPts);
			
			//console.log(a_crds);
			//console.log(ptCluster);
			//drawCluster(ptCluster);
		}
	    
	});

	$("#ADBSCAN").click(function(){
		IsDrawPolygon = false;
		if($("input[name=EpsValue]").val() !== "" && $("input[name=MinPtsValue]").val() !== ""
			&& $("input[name=MaxDirChangeValue]").val() !== "" && $("input[name=MaxEccenChangeValue]").val() !== "")
		{
			
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (var i = 0; i < a_crds.length; i++) 
			{
				drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
			};
			Eps = Number($("input[name=EpsValue]").val());
			MinPts = Number($("input[name=MinPtsValue]").val());
			MaxDirChange = Number($("input[name=MaxDirChangeValue]").val());
			MaxEccenChange = Number($("input[name=MaxEccenChangeValue]").val());
			console.log("ADBSCAN");
		    //console.info('passing coordinates to AEDBSCAN: ', a_crds);
			//console.info('Eps: ', Eps);
			//console.info('MinPts: ', MinPts);
			console.time("ADBSCAN");
			var adbscan = new ADBSCAN();
			//Eps = Eps * GeoScale;
			ptCluster = adbscan.run(a_crds, Eps * GeoScale, MinPts, MaxDirChange, MaxEccenChange);
			console.time("ADBSCAN");

			clusterType ="ADBSCAN";
			//Eps = $("input[name=EpsValue]").val();
			
			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}

			//console.log(a_crds);
			console.log(ptCluster);
			drawCluster(ptCluster);
			computeClusterIndex();
			
		}
	    
	});

	$("#ClusterIndex").click(function(){
		computeClusterIndex();
	});

	$("#LOOPADIndex").click(function(){
		loopAllADParameterSetting();
	});
	$("#LOOPDBIndex").click(function(){
		loopAllDBParameterSetting();
	});
	$("#LOOPAEIndex").click(function(){
		loopAllAEParameterSetting();
	});
	$("#LOOPANIndex").click(function(){
		loopAllANParameterSetting();
	});
	$("#LOOPOPIndex").click(function(){
		loopAllOPTICSParameterSetting();
	});

	


	$("#LOOPTime").click(function(){
		loopTime();
	});
	

	



	$("#run").click(function(){
		IsDrawPolygon = false;
		if($("input[name=EpsValue]").val() !== "" &&$("input[name=MinPtsValue]").val() !== "")
		{
			
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			for (var i = 0; i < a_crds.length; i++) 
			{
				drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
			};
			Eps = Number($("input[name=EpsValue]").val());
			MinPts = Number($("input[name=MinPtsValue]").val());
			console.log("DBSCAN");
		    //console.info('passing coordinates to dbscan: ', a_crds);
			//console.info('Eps: ', Eps);
			//console.info('MinPts: ', MinPts);
			//Eps = Eps * GeoScale;
			console.log(GeoScale);
			console.time("DBSCAN");
			var dbscan = new DBSCAN();
			ptCluster = dbscan.run(a_crds, Eps * GeoScale, MinPts);
			console.timeEnd("DBSCAN");
			
			clusterType ="DBSCAN";
			//Eps = $("input[name=EpsValue]").val();
			MaxDirChange = 180;
			MaxEccenChange = 1;

			//make the cluster result in to array
			clusterClassArray = [];
			for(var i = 0; i < a_crds.length; i++)
			{
				clusterClassArray.push(0);
			}

			for(var i = 0; i < ptCluster.length; i++)
			{
				var classArray = ptCluster[i];
				for(var j = 0; j < classArray.length; j++)
				{
					var item = classArray[j];
					clusterClassArray[item] = i+1;
				}
			}

			//console.log(a_crds);
			console.log(ptCluster);
			drawCluster(ptCluster);
			computeClusterIndex();
			
		}
	    
	});

	$("#polygon").click(function(){
		if(polygons.length === CurrentPolygonID)
		{
			confirm("Please draw a polygon before creating a new one");
			return;
		}
		IsDrawPolygon = true;
		CurrentPolygonID += 1;
		newPolygon = true;
	});

	$("#clear").click(function(){
		Eps = 5;
		MinPts = 2;
		a_crds = [];
		polygons = [];
		ptCluster = [];
		polygonCluster = [];
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		IsDrawPolygon = false;
		CurrentPolygonID = -1;
		newPolygon = false;
		var selectPolygonsList = document.getElementById("slcPolygonName");
		selectPolygonsList.selectedIndex = 0;
		var selectPtsList = document.getElementById("slcPtsName");
		selectPtsList.selectedIndex = 0;// change the set of points
    });

    $("#undo").click(function(){
		if (!IsDrawPolygon) 
		{
			a_crds.pop();

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			for (var i = 0; i < a_crds.length; i++) 
			{
				drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
			}

		};

    });

    $("#savePt").click(function(){
		ptsSets.push(a_crds);// save current set of points 

		var selectPtsList = document.getElementById("slcPtsName");
		var PtsSetName = document.getElementById("PtsNameValue");

		var newOption = document.createElement("option");
		newOption.value = PtsSetName.value;
		newOption.innerHTML = PtsSetName.value;
		selectPtsList.options.add(newOption);
    });

	//click this will make the judgement of point-in-polygon
    $("#ptInPolygon").click(function(){
    	newPolygon = false;
    	IsDrawPolygon = false;
    	for(var i = 0; i < polygons.length; i++)
    	{
    		var ptPolygonCluster = [];//a cluster of point for polygon i
    		polygonCluster.push(ptPolygonCluster);
    		var polygon = polygons[i];
    		for (var j = 0; j < a_crds.length; j++) 
    		{
    			var point = a_crds[j];
    			if(ptInPolygon(point, polygon))
    			{
    				polygonCluster[i].push(j);
    			}

    		}
    	}
    	drawCluster(polygonCluster);

    });

    $("#undoPolygon").click(function(){
		if (IsDrawPolygon) 
		{
			polygons[polygons.length-1].pop();

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			for (var i = 0; i < a_crds.length; i++) 
			{
				drawPt(a_crds[i][0], a_crds[i][1], "black", false, 3);
			};

			for (var i = 0; i < polygons.length; i++) 
			{
				var polygon = polygons[i];
				for (var j = 0; j < polygon.length; j++) 
				{
					var point = polygon[j];
					
					drawCross(point[0], point[1], "green");
					if (j !== 0) 
					{
						drawLine(polygon[j-1], point,"red");
					};
				};

				if (i !== polygons.length-1) 
				{
					drawLine(polygon[polygon.length-1], polygon[0],"red");
					drawPolygon(polygon, "red", 2, "#88ccff", 0.3);
				};
				
			};

		};

    });

    $("#savePolygon").click(function(){
		polygonsSets.push(polygons);// save current set of polygons 

		var selectPolygonsList = document.getElementById("slcPolygonName");
		var PolygonsSetName = document.getElementById("PolygonNameValue");

		var newOption = document.createElement("option");
		newOption.value = PolygonsSetName.value;
		newOption.innerHTML = PolygonsSetName.value;
		selectPolygonsList.options.add(newOption);
    });

    $("#savePtAsFile").click(function(){
		var filename = $("#PtsNameValue").val();

		/*console.log(filename);*/
		var text = "";
		for (var i = 0; i < a_crds.length; i++) 
		{
			text += a_crds[i][0] + "," + a_crds[i][1] + "|";
		};
		
		var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
		saveAs(blob, filename+".txt");
    });

    $("#saveGeoPtAsFile").click(function(){
		var filename = $("#PtsNameValue").val();

		/*console.log(filename);*/
		var text = "";
		text += "ID" + "," + "LON" + "," + "LAT" + "," + "TRUE" + ","+ "TEST" + "\n";
		for (var i = 0; i < a_crds.length; i++) 
		{
			text += i + "," + a_crds_TW[i][0] + "," + a_crds_TW[i][1] + "," + trueClassArray[i] + ","+ clusterClassArray[i] + "\n";
		};
		
		var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
		saveAs(blob, filename+".txt");
    });

    $("#saveTimeAsFile").click(function(){
    	console.log(ClusterTimeArray);
		var filename = $("#PtsNameValue").val() + "_Time";
		//{"Case":$("#PtsNameValue").val(),"clusterType":"AEDBSCAN", "Eps": Eps, "MinPts": MinPts, "NumOfPoint":a_crds.length, "Time":aveTime};

		/*console.log(filename);*/
		var text = "";
		text += "Case" + "," + "clusterType" + "," + "Eps" + "," + "MinPts" + ","+ "NumOfPoint"+ ","+ "Time" + "\n";
		for (var i = 0; i < ClusterTimeArray.length; i++) 
		{
			text += ClusterTimeArray[i].Case + "," + ClusterTimeArray[i].clusterType + "," + ClusterTimeArray[i].Eps + "," + ClusterTimeArray[i].MinPts + ","+ ClusterTimeArray[i].NumOfPoint + ","+ ClusterTimeArray[i].Time + "\n";
		};
		
		var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
		saveAs(blob, filename+".txt");
    });


    $("#saveIndexAsFile").click(function(){
		var filename = $("#PtsNameValue").val() + "_Index";
		//NMIResult = [];// the reuslt of NMI, each element: {"clusterType":"DBSCAN", "Eps": 5, "MinPts": 2, "MaxDirChange":180, "MaxEccenChange":0.2, "NMI":1}

		/*console.log(filename);*/
		var text = "";
		//var maxNMIItem = {"clusterType":clusterType, "Eps": Eps, "MinPts": MinPts, "MaxDirChange":MaxDirChange, "MaxEccenChange":MaxEccenChange, "NMI":0, "Rand": 0};
		//var maxRandItem = {"clusterType":clusterType, "Eps": Eps, "MinPts": MinPts, "MaxDirChange":MaxDirChange, "MaxEccenChange":MaxEccenChange, "NMI":0, "Rand": 0};
		var maxNMIItem = ClusterIndexArray[0];
		var maxRandItem = ClusterIndexArray[0];
		text += "ID" + "," + "clusterType" + "," + "Eps" + "," + "MinPts" + ","+ "NMI" + "," + "Rand" + "\n";
		for (var i = 0; i < ClusterIndexArray.length; i++) 
		{
			text += i + "," + ClusterIndexArray[i].clusterType + "," + ClusterIndexArray[i].Eps + "," + ClusterIndexArray[i].MinPts + ","+ ClusterIndexArray[i].NMI + "," + ClusterIndexArray[i].Rand + "\n";
			if(ClusterIndexArray[i].NMI > maxNMIItem.NMI && ClusterIndexArray[i].NMI !== Infinity)
				maxNMIItem = ClusterIndexArray[i];
			if(ClusterIndexArray[i].Rand > maxRandItem.Rand && ClusterIndexArray[i].Rand !== Infinity)
				maxRandItem = ClusterIndexArray[i];
		};
		text += "MaxNMI" + "," + maxNMIItem.clusterType + "," + maxNMIItem.Eps + "," + maxNMIItem.MinPts + ","+ maxNMIItem.NMI + "," + maxNMIItem.Rand + "\n";
		text += "MaxRand" + "," + maxRandItem.clusterType + "," + maxRandItem.Eps + "," + maxRandItem.MinPts + ","+ maxRandItem.NMI + "," + maxRandItem.Rand + "\n";
		var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
		saveAs(blob, filename+".txt");
    });


    $("#savePolygonAsFile").click(function(){
		var filename = $("#PolygonNameValue").val();

		/*console.log(filename);*/
		var text = "";
		for (var i = 0; i < polygons.length; i++) 
		{
			var polygon = polygons[i];
			for (var j = 0; j < polygon.length; j++) 
			{
				text += polygon[j][0] + "," + polygon[j][1] + "|";

			};
			text += "/n";
			
		};
		
		var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
		saveAs(blob, filename+".txt");
    });

	$('#run').hover(function(){
        $('#run').fadeTo('fast',0.6);
    },function(){
        $('#run').fadeTo('fast',1);
    });

    $('#clear').hover(function(){
        $('#clear').fadeTo('fast',0.6);
    },function(){
        $('#clear').fadeTo('fast',1);
    });

    $('#undo').hover(function(){
        $('#undo').fadeTo('fast',0.6);
    },function(){
        $('#undo').fadeTo('fast',1);
    });

    $('#savePt').hover(function(){
        $('#savePt').fadeTo('fast',0.6);
    },function(){
        $('#savePt').fadeTo('fast',1);
    });

    $('#savePtAsFile').hover(function(){
        $('#savePtAsFile').fadeTo('fast',0.6);
    },function(){
        $('#savePtAsFile').fadeTo('fast',1);
    });

    /*
    $('#openPtFile').hover(function(){
        $('#openPtFile').fadeTo('fast',0.6);
    },function(){
        $('#openPtFile').fadeTo('fast',1);
    });*/

    $('#polygon').hover(function(){
        $('#polygon').fadeTo('fast',0.6);
    },function(){
        $('#polygon').fadeTo('fast',1);
    });

    $('#ptInPolygon').hover(function(){
        $('#ptInPolygon').fadeTo('fast',0.6);
    },function(){
        $('#ptInPolygon').fadeTo('fast',1);
    });

    $('#undoPolygon').hover(function(){
        $('#undoPolygon').fadeTo('fast',0.6);
    },function(){
        $('#undoPolygon').fadeTo('fast',1);
    });

    $('#savePolygon').hover(function(){
        $('#savePolygon').fadeTo('fast',0.6);
    },function(){
        $('#savePolygon').fadeTo('fast',1);
    });
    
    $('#savePolygonAsFile').hover(function(){
        $('#savePolygonAsFile').fadeTo('fast',0.6);
    },function(){
        $('#savePolygonAsFile').fadeTo('fast',1);
    });


	$("input").focus(function(){
        $("input").css("outline-color","#FF0000");
    });
	/*$(document).keydown(function(ev) {
		if(13 === ev.which) {
			console.info('passing coordinates to dbscan: ', a_crds);
			var dbscan = new DBSCAN();
			var clusters = dbscan.run(a_crds, 5, 2);
			console.log(clusters);
		}
	});*/
});


