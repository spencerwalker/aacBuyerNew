angular.module('orderCloud')
	.config(checkoutPaymentConfig)
	.controller('CheckoutPaymentCtrl', CheckoutPaymentController)
    .factory('CheckoutPaymentService', CheckoutPaymentService)
;

function checkoutPaymentConfig($stateProvider) {
	$stateProvider
		.state('checkout.payment', {
			url: '/payment',
			templateUrl: 'checkout/payment/templates/checkout.payment.tpl.html',
			controller: 'CheckoutPaymentCtrl',
			controllerAs: 'checkoutPayment'
		})
    ;
}

function CheckoutPaymentController($exceptionHandler, $rootScope, $scope, toastr, OrderCloud, AddressSelectModal, MyAddressesModal) {
	var vm = this;
    vm.createAddress = createAddress;
    vm.changeBillingAddress = changeBillingAddress;
    
    vm.total = 0.0;
    
    // watcher on vm.lineItems
    $scope.$watch(function () {
        	return vm.lineItems;
    	}, function(newVal, oldVal){
    	console.log('New Val:: ', newVal);
    	vm.vendorLineItemsMap = {};
    	var subTotal = 0.0;
    	angular.forEach(vm.lineItems.Items, function(lineItem){

    		var productId = lineItem.ProductID;
		    var vendorName = productId.split("_")[0]; 
		    
		    subTotal += lineItem.LineTotal;
		    	if(typeof vm.vendorLineItemsMap[vendorName] === 'undefined'){
        		vm.vendorLineItemsMap[vendorName] = [];
        	}
        	vm.vendorLineItemsMap[vendorName].push(lineItem);
        	        	
        });
    	
    	//vm.total = subTotal + (subTotal * vm.lineItems.Items[0].ShippingAddress.xp.Taxcost)/100;
    	vm.total = subTotal + (subTotal * vm.lineItems.Items[0].ShippingAddress.xp.Taxcost);
    	
    }, true);

    function createAddress(order){
        return MyAddressesModal.Create()
            .then(function(address) {
                toastr.success('Address Created', 'Success');
                order.BillingAddressID = address.ID;
                saveBillingAddress(order);
            });
    }

    function changeBillingAddress(order) {
        AddressSelectModal.Open('billing')
            .then(function(address) {
                if (address == 'create') {
                    createAddress(order);
                } else {
                    order.BillingAddressID = address.ID;
                    saveBillingAddress(order);
                }
            });
    }

    function saveBillingAddress(order) {
        if (order && order.BillingAddressID) {
            OrderCloud.Orders.Patch(order.ID, {BillingAddressID: order.BillingAddressID})
                .then(function(updatedOrder) {
                    $rootScope.$broadcast('OC:OrderBillAddressUpdated', updatedOrder);
                })
                .catch(function(ex) {
                    $exceptionHandler(ex);
                });
        }
    }
}

function CheckoutPaymentService($q, OrderCloud) {
    var service = {
        PaymentsExceedTotal: _paymentsExceedTotal,
        RemoveAllPayments: _removeAllPayments
    };

    function _paymentsExceedTotal(payments, orderTotal) {
        var paymentTotal = 0;
        angular.forEach(payments.Items, function(payment) {
            paymentTotal += payment.Amount;
        });

        return paymentTotal.toFixed(2) > orderTotal;
    }
    
    vm.getSubTotal = function(lineItemsList){
		var total = 0.0;
		angular.forEach(lineItemsList, function(lineItem){
			total += ( lineItem.UnitPrice * lineItem.Quantity);
		});
		return total;
	}

    function _removeAllPayments(payments, order) {
        var deferred = $q.defer();

        var queue = [];
        angular.forEach(payments.Items, function(payment) {
            queue.push(OrderCloud.Payments.Delete(order.ID, payment.ID));
        });

        $q.all(queue).then(function() {
            deferred.resolve();
        });

        return deferred.promise;
    }

    return service;
}
