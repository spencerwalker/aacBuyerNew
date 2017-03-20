angular.module('orderCloud')
	.config(checkoutReviewConfig)
	.controller('CheckoutReviewCtrl', CheckoutReviewController);

function checkoutReviewConfig($stateProvider) {
	$stateProvider
		.state('checkout.review', {
			url: '/review',
			templateUrl: 'checkout/review/templates/checkout.review.tpl.html',
			controller: 'CheckoutReviewCtrl',
			controllerAs: 'checkoutReview',
 			data: {
            	          pageTitle: "Shipping To"
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

	                },
	                
				OrderPaymentsDetail: function($q, OrderCloud, CurrentOrder, $state) {
					return OrderCloud.Payments.List(CurrentOrder.ID)
						.then(function(data) {
							//TODO: create a queue that can be resolved
							var dfd = $q.defer();
							if (!data.Items.length) {
								dfd.reject();
								$state.go('checkout.shipping');
							}
							var queue = [];
							angular.forEach(data.Items, function(payment, index) {
								if (payment.Type === 'CreditCard' && payment.CreditCardID) {
									queue.push((function() {
										var d = $q.defer();
										OrderCloud.Me.GetCreditCard(payment.CreditCardID)
											.then(function(cc) {
												data.Items[index].Details = cc;
												d.resolve();
											});
										return d.promise;
									})());
								}
								if (payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
									queue.push((function() {
										var d = $q.defer();
										OrderCloud.Me.GetSpendingAccount(payment.SpendingAccountID)
											.then(function(sa) {
												data.Items[index].Details = sa;
												d.resolve();
											});
										return d.resolve();
									})());
								}
							});
							$q.all(queue)
								.then(function() {
									dfd.resolve(data);
								});
							return dfd.promise;
						})

				}
			}
		});
}

function CheckoutReviewController($exceptionHandler, $rootScope, $scope,  $state, toastr, OrderCloud, ocConfirm, OrderPaymentsDetail, CategoryList, ProductList, MyAddressesModal, AddressSelectModal, ShippingRates, CheckoutConfig, LineItemsList, CurrentPromotions, ocConfirm) {
	var vm = this;
	vm.vendorLineItemsMap = {};
	
	vm.payments = OrderPaymentsDetail;
	vm.lineItems = LineItemsList;
	
    console.log('LineItems', vm.lineItems);
    console.log('CategoryList :: ', CategoryList);
    console.log('Products :: ', ProductList);
    console.log('vm.lineItems ::' , JSON.stringify(vm.lineItems));
    
 // watcher on vm.lineItems
    $scope.$watch(function () {
        	return vm.lineItems;
    	}, function(newVal, oldVal){
    	console.log('New Val:: ', newVal);
    	vm.vendorLineItemsMap = {};
    	angular.forEach(vm.lineItems.Items, function(lineItem){
        	var productId = lineItem.ProductID;
        	var vendorName = productId.split("_")[0]; 
        	/*
    	    if(lineItem.ID.match("^[a-zA-Z\(\)]+$")) {  
    	      } else {
    	    	 var number = Math.floor(1000000 + Math.random() * 9000000);
    	    	 lineItem.ID = number;
    	      }  
    	    	
        	lineItem.vendorName = vendorName;
        	*/
        	if(typeof vm.vendorLineItemsMap[vendorName] === 'undefined'){
        		vm.vendorLineItemsMap[vendorName] = [];
        	}
        	vm.vendorLineItemsMap[vendorName].push(lineItem);
        });
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
}