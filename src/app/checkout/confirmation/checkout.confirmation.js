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
				SubmittedOrder: function($stateParams, OrderCloud) {
					return OrderCloud.Me.GetOrder($stateParams.orderid);
				},
				OrderShipAddress: function(SubmittedOrder, OrderCloud){
					return OrderCloud.Me.GetAddress(SubmittedOrder.ShippingAddressID);
				},
				OrderPromotions: function(SubmittedOrder, OrderCloud) {
					return OrderCloud.Orders.ListPromotions(SubmittedOrder.ID);
				},
				OrderBillingAddress: function(SubmittedOrder, OrderCloud){
					return OrderCloud.Me.GetAddress(SubmittedOrder.BillingAddressID);
				},
				OrderPayments: function($q, SubmittedOrder, OrderCloud) {
					var deferred = $q.defer();
					OrderCloud.Payments.List(SubmittedOrder.ID)
						.then(function(data) {
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
								} else if (payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
									queue.push((function() {
										var d = $q.defer();
										OrderCloud.Me.GetSpendingAccount(payment.SpendingAccountID)
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
				LineItemsList: function($q, $state, toastr, ocLineItems, SubmittedOrder, OrderCloud) {
					var dfd = $q.defer();
					OrderCloud.LineItems.List(SubmittedOrder.ID)
						.then(function(data) {
							ocLineItems.GetProductInfo(data.Items)
								.then(function() {
									dfd.resolve(data);
								});
						});
					return dfd.promise;
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

function CheckoutConfirmationController(SubmittedOrder, $scope, OrderShipAddress, OrderPromotions, OrderBillingAddress, OrderPayments, LineItemsList, CategoryList, ProductList) {
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
    
    vm.getSubTotal = function(lineItemsList){
		var total = 0.0;
		angular.forEach(lineItemsList, function(lineItem){
			total += ( lineItem.UnitPrice * lineItem.Quantity);
		});
		return total;
		}
	}