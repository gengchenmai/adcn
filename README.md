# ADCN: An anisotropic density‐based clustering algorithm for discovering spatial point patterns with noise
Code for recreating the results in [our TGIS paper](https://onlinelibrary.wiley.com/doi/full/10.1111/tgis.12313).



### Code
1. `ADCN-platform/` folder contains the Javascript-based interactive user interface for drawing and clustering points. See the figure below for an illustration.
2. `ADCN-testdata/` folder contains the point sets we used in [our TGIS paper](https://onlinelibrary.wiley.com/doi/full/10.1111/tgis.12313) for the evaluation of ADCN.

<p align="center">
  <img src="illu_Image/interface.png" alt="interface" width="1000" />
</p>

### Illustration of the reason why border points are exluded during the clustering process of ADCN-Eps and ADCN-KNN

<p align="center">
  <img src="illu_Image/border-pt-illustration-fl.png" alt="border-pt-illustration-fl" width="1000" />
</p>

The figure above shows the clustering result of ADCN-KNN (Eps = 24, MinPts = 3). Because ADCN uses ellipses instead of circles to get the Eps-ellipse-neighborhood of a point. When the algorithm is expanding one cluster along a zigzag linear feature like the figure shown above, the computed ellipse will be extremely flat like the “red ellipse” shown here. The Eps-ellipse-neighborhood of Point Pi is 4 points within the “red ellipse” including Pi itself. One interesting finding is that the only “black point”, we indicate as Pj, which is within the “red ellipse” should be a “Noise Point” according to both the clustering result and the result from human perception. Notice that Pj is a border point now with respect to Pi. The reason why ADCN-KNN can label Pj as a “Noise Point” is that Pj is only a border point but not a core point according to the current parameter combination (Eps = 24, MinPts = 3). However, if ADCN includes all the border points into the clusters during clustering process, Pj will be always labeled as a “Cluster Point” which contradicts with the result of human perception.

In short, if ADCN includes border points, during the clustering expanding process along a zigzag linear feature, many noise points on the both sides of this linear feature will be included in this cluster. In contrast, by excluding the border points and tuning Eps and MinPts, ADCN can better capture the irregular shapes of the clusters, especially the geographic features with linear or zigzag shapes.


### Reference
If you find our work useful in your research please consider citing our paper.  
```
@inproceedings{mai2016adcn,
  title={ADCN: an anisotropic density-based clustering algorithm},
  author={Mai, Gengchen and Janowicz, Krzysztof and Hu, Yingjie and Gao, Song},
  booktitle={Proceedings of the 24th ACM SIGSPATIAL International Conference on Advances in Geographic Information Systems},
  pages={1--4},
  year={2016}
}

@article{mai2018adcn,
  title={ADCN: An anisotropic density-based clustering algorithm for discovering spatial point patterns with noise},
  author={Mai, Gengchen and Janowicz, Krzysztof and Hu, Yingjie and Gao, Song},
  journal={Transactions in GIS},
  volume={22},
  number={1},
  pages={348--369},
  year={2018},
  publisher={Wiley Online Library}
}
```