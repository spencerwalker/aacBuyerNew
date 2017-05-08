angular.module('orderCloud')
	.config(checkoutConfirmationConfig)
	.controller('CheckoutConfirmationCtrl', CheckoutConfirmationController);

function checkoutConfirmationConfig($stateProvider) {
	$stateProvider
		.state('confirmation', {
			parent: 'base',
			url: '/confirmation/:orderid',
			templateUrl: 'checkout/confirmation/templates/checkout.confirmation.tpl.html',
			controller: 'CheckoutConfirmationCtrl',
			controllerAs: 'checkoutConfirmation',
			data: {
  	          pageTitle: "Order Submitted"
  	  		},
			resolve: {
				SubmittedOrder: function($stateParams, OrderCloudSDK) {
					return OrderCloudSDK.Orders.Get('outgoing', $stateParams.orderid);
				},
				OrderShipAddress: function(SubmittedOrder, OrderCloudSDK){
					return OrderCloudSDK.Me.GetAddress(SubmittedOrder.ShippingAddressID);
				},
				OrderPromotions: function(SubmittedOrder, OrderCloudSDK) {
					return OrderCloudSDK.Orders.ListPromotions('outgoing', SubmittedOrder.ID);
				},
				OrderBillingAddress: function(SubmittedOrder, OrderCloudSDK){
					return OrderCloudSDK.Me.GetAddress(SubmittedOrder.BillingAddressID);
				},
				OrderPayments: function($q, SubmittedOrder, OrderCloudSDK) {
					var deferred = $q.defer();
					OrderCloudSDK.Payments.List('outgoing', SubmittedOrder.ID)
						.then(function(data) {
							var queue = [];
							angular.forEach(data.Items, function(payment, index) {
								if (payment.Type === 'CreditCard' && payment.CreditCardID) {
									queue.push((function() {
										var d = $q.defer();
										OrderCloudSDK.Me.GetCreditCard(payment.CreditCardID)
											.then(function(cc) {
												data.Items[index].Details = cc;
												d.resolve();
											});
										return d.promise;
									})());
								} else if (payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
									queue.push((function() {
										var d = $q.defer();
										OrderCloudSDK.Me.GetSpendingAccount(payment.SpendingAccountID)
											.then(function(cc) {
												data.Items[index].Details = cc;
												d.resolve();
											});
										return d.promise;
									})());
								}
							});
							$q.all(queue)
								.then(function() {
									deferred.resolve(data);
								})
						});

					return deferred.promise;
				},
				LineItemsList: function($q, $state, toastr, ocLineItems, SubmittedOrder, OrderCloudSDK) {
					var dfd = $q.defer();
					OrderCloudSDK.LineItems.List('outgoing', SubmittedOrder.ID)
						.then(function(data) {
							ocLineItems.GetProductInfo(data.Items)
								.then(function() {
									dfd.resolve(data);
								});
						});
					return dfd.promise;
				},

                CategoryList: function ($stateParams, OrderCloudSDK) {
                    var opts = {
                        depth: 1,
                        filters: {ParentID: $stateParams.categoryid}
                    };
                    return OrderCloudSDK.Me.ListCategories(opts);
                },
                ProductList: function ($stateParams, OrderCloudSDK) {
					var opts = {
						categoryID:  $stateParams.categoryid
					};
                    return OrderCloudSDK.Me.ListProducts(opts);

                }
			}
		});
}

function CheckoutConfirmationController(SubmittedOrder, $scope, OrderShipAddress, OrderPromotions, OrderBillingAddress, OrderPayments, LineItemsList, CategoryList, ProductList, VendorShippingCriteria) {
	var vm = this;
	vm.order = SubmittedOrder;
	vm.shippingAddress = OrderShipAddress;
	vm.promotions = OrderPromotions.Items;
	vm.billingAddress = OrderBillingAddress;
	vm.payments = OrderPayments.Items;
	vm.lineItems = LineItemsList;
	
	vm.vendorLineItemsMap = {};
    
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
    
    vm.getShippingCostByVendor = function(vendorName){
        return VendorShippingCriteria.getShippingCostByVendor(vendorName, vm.vendorLineItemsMap[vendorName]);
    };
    
    vm.getSubTotal = function(lineItemsList){
		var total = 0.0;
		angular.forEach(lineItemsList, function(lineItem){
			total += ( lineItem.UnitPrice * lineItem.Quantity);
		});
		return total;
		}
	}