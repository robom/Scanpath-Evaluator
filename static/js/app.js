// Created by Baxos on 2.11.2016.

var gazerApp = angular.module("gazerApp", ['ngAnimate', 'ngTouch', 'ui.router', 'ui.bootstrap', 'ncy-angular-breadcrumb']);

gazerApp.controller("defaultCtrl", function($scope, $state, $http, $animate){
    $scope.init = function() {
        $scope.$state = $state;
		$scope.isNavCollapsed = true;
	};

	$scope.init();
});

gazerApp.controller("customCtrl", function($scope, $state, $http){
	$scope.getUserScanpaths = function() {
		$http.get('get_scanpaths').then(
			function(response){
				$scope.dataset.userScanpaths = response.data.userScanpaths;
				$scope.dataset.visualMain = response.data.visualMain
			},
			function(data){
				console.log('Failed to get user scanpaths: ' + data);
			}
		);
    };

    var getAvgSimToCommon = function() {
		var similarity = 0, total = 0;

		for (var scanpath in $scope.dataset.commonScanpath.similarity) {
			similarity += $scope.dataset.commonScanpath.similarity[scanpath];
			total++;
		}

		return similarity / total;
	};

	$scope.getCommonScanpath = function() {
		$http.get('sta').then(
			function(response){
				$scope.dataset.commonScanpath = response.data;
				$scope.dataset.commonScanpath.avgSimToCommon = getAvgSimToCommon();

				var similarities = $scope.dataset.commonScanpath.similarity;
				for (var identifier in similarities) {
					for (var iter in $scope.dataset.userScanpaths) {
						if ($scope.dataset.userScanpaths[iter].identifier == identifier) {
							$scope.dataset.userScanpaths[iter].simToCommon = similarities[identifier];
						}
					}
				}
			},
			function(data){
				console.log('Failed to get common scanpath: ' + data);
			}
		);
    };

    $scope.setSort = function(sortVariable, newValue) {
		if($scope[sortVariable] == newValue) {
			$scope[sortVariable] = '-' + $scope[sortVariable];
		} else {
			$scope[sortVariable] = newValue;
		}
	};

    $scope.init = function() {
		$scope.dataset = {};
		$scope.getUserScanpaths();
		$scope.scanpathSort = 'identifier';
	};

	$scope.init();
});