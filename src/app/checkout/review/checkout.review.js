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
            resolve: {
                LineItemsList: function ($q, $rootScope, toastr, OrderCloudSDK, ocLineItems, CurrentOrder) {
                    var dfd = $q.defer();
                    ocLineItems.ListAll(CurrentOrder.ID)
                        .then(function (data) {
                            if (!data.length) {
                                $rootScope.$broadcast('OC:UpdateOrder', CurrentOrder.ID);
                                dfd.resolve(data);
                            }
                            else {
                                ocLineItems.GetProductInfo(data)
                                    .then(function () {
                                        $rootScope.$broadcast('OC:UpdateOrder', CurrentOrder.ID);
                                        dfd.resolve(data);
                                    });
                            }
                        })
                        .catch(function () {
                            toastr.error('Your order does not contain any line items.', 'Error');
                            dfd.reject();
                        });
                    return dfd.promise;
                },

                CategoryList: function ($stateParams, OrderCloudSDK) {
                    var depth = 1;
                    return OrderCloudSDK.Me.ListCategories({fitlers:{ParentID: $stateParams.categoryid}, depth:1});
                },

                ProductList: function ($stateParams, OrderCloudSDK) {
                    return OrderCloudSDK.Me.ListProducts({categoryID:$stateParams.categoryid });

                },

                OrderPaymentsDetail: function ($q, OrderCloudSDK, CurrentOrder, $state) {
                    return OrderCloudSDK.Payments.List('outgoing', CurrentOrder.ID)
                        .then(function (data) {
                            //TODO: create a queue that can be resolved
                            var dfd = $q.defer();
                            if (!data.Items.length) {
                                dfd.reject();
                                $state.go('checkout.shipping');
                            }
                            var queue = [];
                            angular.forEach(data.Items, function (payment, index) {
                                if (payment.Type === 'CreditCard' && payment.CreditCardID) {
                                    queue.push((function () {
                                        var d = $q.defer();
                                        OrderCloudSDK.Me.GetCreditCard(payment.CreditCardID)
                                            .then(function (cc) {
                                                data.Items[index].Details = cc;
                                                d.resolve();
                                            });
                                        return d.promise;
                                    })());
                                }
                                if (payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
                                    queue.push((function () {
                                        var d = $q.defer();
                                        OrderCloudSDK.Me.GetSpendingAccount(payment.SpendingAccountID)
                                            .then(function (sa) {
                                                data.Items[index].Details = sa;
                                                d.resolve();
                                            });
                                        return d.resolve();
                                    })());
                                }
                            });
                            $q.all(queue)
                                .then(function () {
                                    dfd.resolve(data);
                                });
                            return dfd.promise;
                        })
                }
            }

        });
}

function CheckoutReviewController($exceptionHandler, $filter, ocConfirm, OrderCloud, $rootScope, LineItemsList, $scope, $state, toastr, OrderPaymentsDetail, CategoryList, ProductList) {
    var vm = this;
    vm.payments = OrderPaymentsDetail;
    vm.vendorLineItemsMap = {};
    vm.lineItems = LineItemsList;
    vm.total = 0.0;

    // watcher on vm.lineItems
    $scope.$watch(function () {
        return vm.lineItems;
    }, function (newVal, oldVal) {
        console.log('New Val:: ', newVal);
        vm.vendorLineItemsMap = {};
        var subTotal = 0.0;
        angular.forEach(vm.lineItems, function (lineItem) {
            var productId = lineItem.ProductID;
            var vendorName = (lineItem.Punchout && lineItem.xp && lineItem.xp.PunchoutName) 
                ? $filter('punchoutLineItemVendor')(lineItem.xp.PunchoutName)
                : productId.split("_")[0]; 
            /*
             if(lineItem.ID.match("^[a-zA-Z\(\)]+$")) {
             } else {
             var number = Math.floor(1000000 + Math.random() * 9000000);
             lineItem.ID = number;
             }

             lineItem.vendorName = vendorName;
             */
            subTotal += lineItem.LineTotal;
            if (typeof vm.vendorLineItemsMap[vendorName] === 'undefined') {
                vm.vendorLineItemsMap[vendorName] = [];
            }
            vm.vendorLineItemsMap[vendorName].push(lineItem);
        });
        if(vm.lineItems[0].ShippingAddress.xp && vm.lineItems[0].ShippingAddress.xp.Taxcost ){
              vm.total = subTotal + (subTotal * vm.lineItems[0].ShippingAddress.xp.Taxcost);
        }else{
            vm.total = subTotal;
        }
        
    }, true);


    vm.getSubTotal = function (lineItemsList) {
        var total = 0.0;
        angular.forEach(lineItemsList, function (lineItem) {
            total += ( lineItem.UnitPrice * lineItem.Quantity);
        });
        return total;
    }
}