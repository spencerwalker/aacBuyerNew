angular.module('orderCloud')
    .config(checkoutShippingConfig)
    .controller('CheckoutShippingCtrl', CheckoutShippingController);

function checkoutShippingConfig($stateProvider) {
    $stateProvider
        .state('checkout.shipping', {
            url: '/shipping',
            templateUrl: 'checkout/shipping/templates/checkout.shipping.tpl.html',
            controller: 'CheckoutShippingCtrl',
            controllerAs: 'checkoutShipping',
            	  data: {
            	          pageTitle: "Delivery Address"
            	  		},
            	  		resolve: {
            	  		LineItemsList: function($q, $state, toastr, OrderCloud, ocLineItems, CurrentOrder) {
            	  		var dfd = $q.defer();
            	  		OrderCloud.LineItems.List(CurrentOrder.ID)
            	  		.then(function(data) {
            	  			if (!data.Items.length) {
            	  				dfd.resolve(data);
            	  				}
            	  				else {
            	  					ocLineItems.GetProductInfo(data.Items)
            	  					.then(function() {
            	  						dfd.resolve(data);
            	  					});
            	  				}
            	  		})
            	  		.catch(function() {
            	  			toastr.error('Your order does not contain any line items.', 'Error');
            	  			dfd.reject();
            	  		});
            	  		return dfd.promise;
            	  		},
            	  		CurrentPromotions: function(CurrentOrder, OrderCloud) {
            	  			return OrderCloud.Orders.ListPromotions(CurrentOrder.ID);
            	  		},
            	                
            	  		CategoryList: function($stateParams, OrderCloud) {
            	  			var depth = 1;
            	  			return OrderCloud.Me.ListCategories(null, null, null, null, null, {ParentID: $stateParams.categoryid}, depth);
            	  		},
            	  		ProductList: function($stateParams, OrderCloud) {
            	  			return OrderCloud.Me.ListProducts(null, null, null, null, null, null, $stateParams.categoryid);

            	  		}
            	  		}
        });
	}

function CheckoutShippingController($exceptionHandler, $rootScope, $scope, $state,toastr, OrderCloud, MyAddressesModal, AddressSelectModal, ShippingRates, CheckoutConfig, LineItemsList, CurrentPromotions, ocConfirm, CategoryList, ProductList) {
    var vm = this;
    vm.createAddress = createAddress;
    vm.changeShippingAddress = changeShippingAddress;
    vm.saveShipAddress = saveShipAddress;
    vm.shipperSelected = shipperSelected;
    vm.initShippingRates = initShippingRates;
    vm.getShippingRates = getShippingRates;
    vm.analyzeShipments = analyzeShipments;
    
    vm.vendorLineItemsMap = {};
        
    vm.lineItems = LineItemsList;
    console.log('LineItems', vm.lineItems);
    console.log('CategoryList :: ', CategoryList);
    console.log('Products :: ', ProductList);
    console.log('vm.lineItems ::' , JSON.stringify(vm.lineItems));
    
  //BH Dev//
    var xp = {
    		vendorOrderIds: []
    }
    //BH Dev//
    
    // watcher on vm.lineItems
    $scope.$watch(function () {
        	return vm.lineItems;
    	}, function(newVal, oldVal){
    	console.log('New Val:: ', newVal);
    	vm.vendorLineItemsMap = {};
    	angular.forEach(vm.lineItems.Items, function(lineItem){
    		
    		console.log(' vm.lineItems.Items = ', lineItem.ID);
    		var ID = lineItem.ID;    		
    		ID = ID.substring(0, 7);
    		console.log('ID = ', ID);
    		
 	        var productId = lineItem.ProductID;
		       var vendorName = productId.split("_")[0]; 
		
		if(typeof vm.vendorLineItemsMap[vendorName] === 'undefined'){
        		vm.vendorLineItemsMap[vendorName] = [];
        		// BH DEV
        		xp.vendorOrderIds.push(lineItem.ID.substring(0,7));
        		// BH DEV
        		
        	}
        	vm.vendorLineItemsMap[vendorName].push(lineItem);
        	   
        	$('.' + vendorName).val(ID);
        	
        });
    	// BH DEV
    	vm.updateVendorId = function(){
	    	OrderCloud.Orders.Patch(vm.order.ID, {xp :xp})
	    		.then(function(data){
	    		})	    
	    };
	 // BH DEV
    }, true);
    
    console.log('vm.vendorLineItemsMap :: ', vm.vendorLineItemsMap);
    
    vm.promotions = CurrentPromotions.Meta ? CurrentPromotions.Items : CurrentPromotions;
    vm.removeItem = function(order, scope) {
        vm.lineLoading = [];
        vm.lineLoading[scope.$index] = OrderCloud.LineItems.Delete(order.ID, scope.lineItem.ID)
            .then(function () {
                $rootScope.$broadcast('OC:UpdateOrder', order.ID);
                vm.lineItems.Items.splice(scope.$index, 1);
                toastr.success('Line Item Removed');
            });
    };

    //TODO: missing unit tests
    vm.removePromotion = function(order, scope) {
        OrderCloud.Orders.RemovePromotion(order.ID, scope.promotion.Code)
            .then(function() {
                $rootScope.$broadcast('OC:UpdateOrder', order.ID);
                vm.promotions.splice(scope.$index, 1);
            });
    };

    vm.cancelOrder = function(order){
        ocConfirm.Confirm("Are you sure you want cancel this order?")
            .then(function() {
                OrderCloud.Orders.Delete(order.ID)
                    .then(function(){
                        $state.go("productBrowse.products",{}, {reload:'base'})
                    });
            });
    };
    
    vm.getSubTotal = function(lineItemsList){
		var total = 0.0;
		angular.forEach(lineItemsList, function(lineItem){
			total += ( lineItem.UnitPrice * lineItem.Quantity);
		});
		return total;
	}
    //TODO: missing unit tests
    $rootScope.$on('OC:UpdatePromotions', function(event, orderid) {
        OrderCloud.Orders.ListPromotions(orderid)
            .then(function(data) {
                if (data.Meta) {
                    vm.promotions = data.Items;
                } else {
                    vm.promotions = data;
                }
            });
    });

    function createAddress(order) {
        MyAddressesModal.Create()
            .then(function(address) {
                toastr.success('Address Created', 'Success');
                order.ShippingAddressID = address.ID;
                vm.saveShipAddress(order);
            });
    }

    function changeShippingAddress(order) {
        AddressSelectModal.Open('shipping')
            .then(function(address) {
                if (address == 'create') {
                    vm.createAddress(order);
                } else {
                    order.ShippingAddressID = address.ID;
                    vm.saveShipAddress(order);
                }
            })
    }
    
    function saveShipAddress(order) {
        if (order && order.ShippingAddressID) {
            OrderCloud.Orders.Patch(order.ID, {ShippingAddressID: order.ShippingAddressID})
                .then(function(updatedOrder) {
                    $rootScope.$broadcast('OC:OrderShipAddressUpdated', updatedOrder);
                    vm.getShippingRates(order);
                })
                .catch(function(ex){
                    $exceptionHandler(ex);
                });
        }
    }

    function initShippingRates(order) {
        if (CheckoutConfig.ShippingRates && order.ShippingAddressID) vm.getShippingRates(order);
    }

    function getShippingRates(order) {
        vm.shippersAreLoading = true;
        vm.shippersLoading = ShippingRates.GetRates(order)
            .then(function(shipments) {
                vm.shippersAreLoading = false;
                vm.shippingRates = shipments;
                vm.analyzeShipments(order);
            });
    }

    function analyzeShipments(order) {
        vm.shippingRates = ShippingRates.AnalyzeShipments(order, vm.shippingRates);
    }

    function shipperSelected(order) {
        ShippingRates.ManageShipments(order, vm.shippingRates)
            .then(function() {
                $rootScope.$broadcast('OC:UpdateOrder', order.ID);
            });
    }
}