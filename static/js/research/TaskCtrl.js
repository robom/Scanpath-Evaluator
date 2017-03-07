// Handles all scanpath data related actions such as AJAX calls etc.
angular.module('gazerApp').controller('TaskCtrl', function($scope, $state, $http, $window, CanvasDrawService) {
	$scope.getTaskScanpaths = function() {
		$http({
			url: 'get_task_data',
			method: 'GET',
			params: {
				taskId: $scope.task.id
			}
		}).then(
			function(response) {
				$scope.task.scanpaths = response.data.scanpaths;
				$scope.task.visuals = response.data.visuals;
				$scope.task.aois = response.data.aois;

				redrawCanvas($scope.canvas, $scope.canvasWrapper, $scope.ctx, $scope.task.visuals.main, 'canvasInfo');
			},
			function(data) {
				console.error('Failed to get task data content.', data);
			}
		);
    };

    // Calculate average similarity in a common scanpath similarity object provided by back-end as response
    var calcAvgSimToCommon = function(commonScanpathSimilarity) {
		var similarity = 0, total = 0;

		// Loop through all similarity values stored in the similarity object
		for (var scanpath in commonScanpathSimilarity) {
			similarity += commonScanpathSimilarity[scanpath];
			// Keep track of the total number of scanpaths as there is no keys.length in dict
			total++;
		}
		return similarity / total;
	};

	var getCommonScanpathDetails = function() {
		$http({
			url: '/sta',
			method: 'POST',
			data: {
				taskId: $scope.task.id,
				excludedScanpaths: $scope.task.excludedScanpaths
			}
		}).then(
			function(response) {
				// Get the common scanpath
				$scope.task.commonScanpath = response.data;
				// Get the similarity object
				var similarities = $scope.task.commonScanpath.similarity;
				// Get the average similarity of user scanpath to the common scanpath
				$scope.task.commonScanpath.avgSimToCommon = calcAvgSimToCommon(similarities);

				// Assign each user scanpath its similarity to the common scanpath
				for (var index in $scope.task.scanpaths) {
					var act_scanpath = $scope.task.scanpaths[index];
					act_scanpath.simToCommon = similarities[act_scanpath.identifier];
				}

				// Draw the common scanpath on the canvas
				drawFixations($scope.ctx, $scope.task.commonScanpath.fixations, $scope.canvasInfo.aois);
			},
			function(data) {
				console.error('Failed to get common scanpath response from the server.', data);
			}
		);
    };

    // Calculate average similarity to a custom scanpath data object provided by back-end as a response
    var calcAvgSimToCustom = function(customScanpathSimilarity) {
		var similarity = 0, total = 0;

		// Loop through all similarity values stored in the similarity object
		for (var scanpath in customScanpathSimilarity) {
			similarity += customScanpathSimilarity[scanpath];
			// Keep track of the total number of scanpaths as there is no keys.length in dict
			total++;
		}
		return similarity / total;
	};

	var getCustomScanpathDetails = function(customScanpathStr) {
		// Remove all whitespaces from the user input by regex
		customScanpathStr = customScanpathStr.replace(/\s/g, "");
		// Regex to normalize the scanpath (remove repeated AOIs: AABC -> ABC)
		// The Regex /(.)\1+/ matches any single char followed by the same char at least once (+)
		customScanpathStr = customScanpathStr.replace(/(.)\1+/g, '$1');

		$http({
			url: '/custom',
			method: 'POST',
			data: {
				customScanpath: customScanpathStr,
				taskId: $scope.task.id,
				excludedScanpaths: $scope.task.excludedScanpaths
			}
		}).then(
			function(response) {
				if(response.data.success == true) {
					// Get the common scanpath
					$scope.task.customScanpath = response.data.load;
					// Get the similarity object
					var similarities = $scope.task.customScanpath.similarity;
					// Get the average similarity of each user scanpath to the common scanpath
					$scope.task.customScanpath.avgSimToCommon = calcAvgSimToCustom(similarities);

					// Assign each user scanpath its similarity to the common scanpath
					for (var index in $scope.task.scanpaths) {
						var act_scanpath = $scope.task.scanpaths[index];
						act_scanpath.simToCommon = similarities[act_scanpath.identifier];
					}

					// Draw the custom scanpath onto the canvas
					drawFixations($scope.ctx, $scope.task.customScanpath.fixations, $scope.canvasInfo.aois);
				}
				else {
					console.error(response.data.message);
				}
			},
			function(data) {
				console.error('Failed to get common scanpath response from the server.', data);
			}
		);
    };

	$scope.fillTableDetails = function() {
		if ($scope.customScanpath && $scope.customScanpathText) {
			getCustomScanpathDetails($scope.customScanpathText);
		}
		else {
			getCommonScanpathDetails();
		}
	};

	// Function changes sorting base or inverts it when it's the same
    $scope.setSort = function(value) {
		if($scope.task.sortBy == value) {
			$scope.task.sortBy = '-' + $scope.task.sortBy;
		} else {
			$scope.task.sortBy = value;
		}
	};

	// Excludes (or includes) the scanpaths from the future dataset computations
	$scope.toggleScanpathExcluded = function(scanpath) {
		scanpath.excluded = !scanpath.excluded;

		if(scanpath.excluded) {
			$scope.task.excludedScanpaths.push(scanpath.identifier)
		}
		else {
			// Remove all ocurrencies of the given scanpath in the array of excluded ones
			for(var i = 0; i < $scope.task.excludedScanpaths.length; i++) {
				if($scope.task.excludedScanpaths[i] == scanpath.identifier) {
					$scope.task.excludedScanpaths.splice(i, 1);
				}
			}
		}
	};

	// Removes excluded flag from all available scanpaths
	$scope.setAllScanpathsValue = function(val) {
		// Re-initialize the excluded scanpaths array
		$scope.task.excludedScanpaths = [];

		// Make sure the value is really a boolean (e.g. not "0" which would be true)
		if(typeof(val) === "boolean") {
			$scope.task.scanpaths.forEach(function(scanpath) {
				scanpath.excluded = val;

				// If the scanpath is about to be excluded
				if(val) {
					$scope.task.excludedScanpaths.push(scanpath.identifier);
				}
			});
		}
	};

	// Inverse function to the one above (since classic toggle is not user friendly)
	$scope.disableAllScanpaths = function() {
		$scope.task.excludedScanpaths = [];
		$scope.task.scanpaths.forEach(function(scanpath) {
			scanpath.excluded = true;
			$scope.task.excludedScanpaths.push(scanpath.id);
		});
	};

	// TODO move following to a separate ctrl/service OR move scanpath handling methods above
	// Utility canvas methods
	var calcWhitespaceToKeep = function(computedStyle) {
		return (
			parseInt(computedStyle.marginRight) +
			parseInt(computedStyle.marginLeft) +
			parseInt(computedStyle.paddingLeft) +
			parseInt(computedStyle.paddingRight)
		);
	};

	// Returns a set of random colors if none has been generated for the basic canvas yet
	var getAoiColors = function() {
		if($scope.canvasInfo.colors) {
			return $scope.canvasInfo.colors;
		}
		else {
			return randomColor({
				luminosity: 'bright',
				count: $scope.task.aois.length
			});
		}
	};

	// Canvas manipulation
	var initCanvas = function(canvasId, canvasWrapperId) {
		// Fetch canvas elements in a non-angular way://
		$scope.canvas = document.getElementById(canvasId);
		$scope.canvasWrapper = document.getElementById(canvasWrapperId);
    	$scope.ctx = $scope.canvas.getContext('2d');

		// Determine how much whitespace do we need to keep around the canvas after scaling
		var whitespaceToKeep = calcWhitespaceToKeep(window.getComputedStyle($scope.canvasWrapper));

		// Basic canvas setup
		$scope.canvasInfo = {
			fontSize: 14,
			whitespaceToKeep: whitespaceToKeep,
			scale: 1,
			offset: 2,
			aois: {} // Serves for accessing the aois after drawing (e.g. for common scanpath displaying)
		};

		$scope.ctx.globalAlpha = 1.0;
		$scope.ctx.beginPath();
	};

	var initCanvasModal = function(canvasId, canvasWrapperId) {
		// Fetch canvas elements in a non-angular way://
		$scope.canvasModal = document.getElementById(canvasId);
		$scope.canvasModalWrapper = document.getElementById(canvasWrapperId);
    	$scope.ctxModal = $scope.canvasModal.getContext('2d');

		// Determine how much whitespace do we need to keep around the canvas after scaling
		var whitespaceToKeep = calcWhitespaceToKeep(window.getComputedStyle($scope.canvasModalWrapper));

		// Basic canvas setup
		$scope.canvasModalInfo = {
			fontSize: 14,
			whitespaceToKeep: whitespaceToKeep,
			scale: 1,
			offset: 2,
			aois: {} // Serves for accessing the aois after drawing (e.g. for common scanpath displaying)
		};

		$scope.ctxModal.globalAlpha = 1.0;
		$scope.ctxModal.beginPath();
	};

	var redrawCanvas = function(canvas, canvasWrapper, ctx, bgImagePath, canvasInfoObj) {
		// Reset background image
		canvas.style.backgroundImage = 'url(' + bgImagePath + ')';

		// Load the canvas background image again to get its natural resolution
		var canvasImage = new Image();
		// Callback that gets triggered once the img has completed loading - it adjusts the canvas to the img
		canvasImage.onload = function() {
			// Determine the scaling based on canvas max width, whitespace and offset compared to image raw resolution
			$scope[canvasInfoObj].scale =
				(canvasWrapper.offsetWidth - $scope[canvasInfoObj].whitespaceToKeep - $scope[canvasInfoObj].offset * 2)
				/ canvasImage.naturalWidth;

			// Set scaled sizes of width/height and the apply the default offset
			canvas.style.width =
				canvasImage.naturalWidth * $scope[canvasInfoObj].scale + ($scope[canvasInfoObj].offset * 2) + 'px';
			canvas.style.height =
				canvasImage.naturalHeight * $scope[canvasInfoObj].scale + ($scope[canvasInfoObj].offset * 2) + 'px';
			// Make canvas resolution match its real size
			canvas.width = canvas.offsetWidth;
			canvas.height = canvas.offsetHeight;

			// Set of colors to be used for drawing AOIs
			$scope[canvasInfoObj].colors = getAoiColors();

			// ctx.drawImage(canvasImage, 0, 0, canvas.width, canvas.height);
			$scope[canvasInfoObj].aois = drawAois(ctx, $scope[canvasInfoObj], $scope.task.aois);
		};
		canvasImage.src = bgImagePath;
	};

	var clearFixations = function() {
		// Erase common scanpath fixation drawing by re-creating the canvas without it
		$scope.ctx.clearRect(0, 0, $scope.canvas.width, $scope.canvas.height);
		$scope.canvasInfo.aois = drawAois($scope.ctx, $scope.canvasInfo, $scope.task.aois);
    };

    var drawAois = function(ctx, canvasInfo, aoiData) {
		// Reset previously drawn AOIs (object will be returned)
		var drawnAois = {};

		// Data from backed is formatted as: ['aoiName', 'xFrom', 'xLen', 'yFrom', 'yLen', 'aoiShortName']
		// Convert from strings to numbers TODO do this at the backend
		for(var j = 0; j < aoiData.length; j++) {
			for(var k = 1; k <= 4; k++) {
				aoiData[j][k] = Number(aoiData[j][k]);
			}
		}

		aoiData.forEach(function(actAoi, index) {
			var aoiBox = {
				x: (actAoi[1] * canvasInfo.scale) + canvasInfo.offset,
				y: (actAoi[3] * canvasInfo.scale) + canvasInfo.offset,
				xLen: actAoi[2] * canvasInfo.scale,
				yLen: actAoi[4] * canvasInfo.scale,
				name: actAoi[5],
				fullName: actAoi[0]
			};

			// Draw the AOI box
			CanvasDrawService.drawRect(ctx, aoiBox, canvasInfo.colors[index], canvasInfo.offset);
			// Draw the AOI label
			CanvasDrawService.drawLabel(ctx, canvasInfo, aoiBox);
			// Remember the current AOI data for later access
			drawnAois[aoiBox.name] = aoiBox;
		});
		// Return the drawn AOI data such as coord, color etc.
		return drawnAois;
	};

	var drawFixations = function(ctx, scanpath, aois) {
		// Clear the canvas from previous fixation drawings first
		clearFixations();

		for(var i = 1; i < scanpath.length; i++) {
			// Fix for user-submitted common scanpath - the AOI might not be in the actual aoi set
			if(CanvasDrawService.drawSaccade(
				ctx, $scope.canvasInfo, aois, scanpath[i - 1], scanpath[i]) === false) {
				// Leave only AOIs drawn on the canvas and return
				clearFixations();
				return;
			}
        }

		scanpath.forEach(function(fixation, index) {
			// Draw a circle in the middle of a corresponding AOI box
			var fixationCircle = {
				x: aois[fixation[0]].x + (aois[fixation[0]].xLen / 2),
				y: aois[fixation[0]].y + (aois[fixation[0]].yLen / 2),
				r: (fixation[1] ? fixation[1] : 400) / 40 // TODO limit the radius of circle to the enclosing AOI
			};

			CanvasDrawService.drawCircle(ctx, fixationCircle, '#000', $scope.canvasInfo.offset, '#44f');

			// Draw a label (centering is based on the fontSize and stroke line width)
			ctx.fillStyle = '#fff';
			ctx.lineWidth = $scope.canvasInfo.offset;
			ctx.fillText(
				(index + 1).toString(),
				fixationCircle.x,
				fixationCircle.y + ($scope.canvasInfo.fontSize / 2) - ctx.lineWidth
			);
		});
    };

	$scope.toggleCanvasModal = function() {
		$scope.showCanvasModal = !$scope.showCanvasModal;

		if($scope.showCanvasModal == true) {
			initCanvasModal('scanpathCanvasModal', 'canvasWrapperModal');
			redrawCanvas($scope.canvasModal, $scope.canvasModalWrapper, $scope.ctxModal, $scope.task.visuals.main, 'canvasModalInfo');
		}
	};

    var initController = function() {
		// Forward declaration of similarity objects to prevent IDE warnings. May be omitted later.
		$scope.task = {
			// Store the actual task ID from URL (ui-router functionality)
			id: $state.params.id,
			scanpaths: [],
			// Scanpaths temporarily excluded from all computations
			excludedScanpaths: [],
			// Sort the data based on a default column
			sortBy: 'identifier'
		};
		// Hide the zoomed in (modal) canvas element
		$scope.showCanvasModal = false;

		// Initialize the canvas element
		initCanvas('scanpathCanvas', 'canvasWrapper');
		// Get the basic scanpath data
		$scope.getTaskScanpaths();
	};
	// Perform view initialization
	initController();
});
