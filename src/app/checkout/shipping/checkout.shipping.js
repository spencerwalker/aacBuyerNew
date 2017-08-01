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
                LineItemsList: function($q, $rootScope, toastr, ocLineItems, CurrentOrder) {
                    var dfd = $q.defer();
                    ocLineItems.ListAll(CurrentOrder.ID)
                        .then(function(data) {
                            if (!data.length) {
                                $rootScope.$broadcast('OC:UpdateOrder', CurrentOrder.ID);
                                dfd.resolve(data);
                            }
                            else {
                                ocLineItems.GetProductInfo(data)
                                    .then(function() {
                                        $rootScope.$broadcast('OC:UpdateOrder', CurrentOrder.ID);
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
                CurrentPromotions: function (CurrentOrder, OrderCloudSDK) {
                    return OrderCloudSDK.Orders.ListPromotions('outgoing', CurrentOrder.ID);
                },

                CategoryList: function ($stateParams, OrderCloudSDK) {
                    var opts = {
                        depth: 1,
                        filters: {
                            ParentID: $stateParams.categoryid
                        }
                    }
                    return OrderCloudSDK.Me.ListCategories(opts);
                },
                ProductList: function ($stateParams, OrderCloudSDK) {
                    var opts = {
                        categoryID: $stateParams.categoryid
                    };
                    return OrderCloudSDK.Me.ListProducts(opts);

                }
            }
        });
}

function CheckoutShippingController($exceptionHandler, $rootScope, $scope, $state, $q, $filter, toastr, OrderCloudSDK, MyAddressesModal, AddressSelectModal, ShippingRates, VendorShippingCriteria, CheckoutConfig, LineItemsList, CurrentPromotions, ocConfirm, CategoryList, ProductList, CurrentOrder) {
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

    // watcher on vm.lineItems
    $scope.$watch(function () {
        return vm.lineItems;
    }, function (newVal, oldVal) {
        //create a queue to hold all the api calls that will be sent out at once
        var lineItemUpdateQueue = [];
        vm.vendorLineItemsMap = {};
        angular.forEach(vm.lineItems, function (lineItem) {
            var xp = {
                vendorOrderId: []
            };
            var ID;
            var productId = lineItem.ProductID;
            var vendorName = (lineItem.Punchout && lineItem.xp && lineItem.xp.PunchoutName) 
                ? $filter('punchoutLineItemVendor')(lineItem.xp.PunchoutName)
                : productId.split("_")[0]; 

            if (typeof vm.vendorLineItemsMap[vendorName] === 'undefined') {
                vm.vendorLineItemsMap[vendorName] = [];
                vm.vendorLineItemsMap[vendorName].push(lineItem);
                ID = vm.vendorLineItemsMap[vendorName][0].ID.substring(0, 7);
                xp.vendorOrderId.push(ID);
            } else {
                vm.vendorLineItemsMap[vendorName].push(lineItem);
                ID = vm.vendorLineItemsMap[vendorName][0].ID.substring(0, 7);
                xp.vendorOrderId.push(ID);
            }

            $('.' + vendorName).val(ID);
            //this line pushes all the api calls into a queue that will be sent off once $q.all is invoked with the queue.
            lineItemUpdateQueue.push(OrderCloudSDK.LineItems.Patch('outgoing', CurrentOrder.ID, lineItem.ID, {
                'xp': xp
            }));
        });
        //this calls runs all the async calls in the queue and waits for them to be returned. This works because each OrderCloud.method returns a promise.
        $q.all(lineItemUpdateQueue)
            .then(function (updatedLineItems) {
                //this should have have all the updated line items. Line items should now be updated.
                console.log("updated line items", updatedLineItems);
            })
        $scope.base.currentOrder.TaxCost = vm.calculateTaxCost();
        $scope.base.currentOrder.ShippingCost = vm.calculateShippingCost();
        ShippingRates.SetShippingCost(CurrentOrder.ID, $scope.base.currentOrder.ShippingCost);
        OrderCloudSDK.Orders.Patch('outgoing', CurrentOrder.ID, {
            ShippingCost: $scope.base.currentOrder.ShippingCost.toFixed(2),
            TaxCost: $scope.base.currentOrder.TaxCost.toFixed(2)
        })
    }, true);

    vm.promotions = CurrentPromotions.Meta ? CurrentPromotions.Items : CurrentPromotions;
    vm.removeItem = function (order, scope) {
        vm.lineLoading = [];
        vm.lineLoading[scope.$index] = OrderCloudSDK.LineItems.Delete('outgoing', order.ID, scope.lineItem.ID)
            .then(function () {
                $rootScope.$broadcast('OC:UpdateOrder', order.ID);
                vm.lineItems.splice(scope.$index, 1);
                toastr.success('Line Item Removed');
            });
    };

    //TODO: missing unit tests
    vm.removePromotion = function (order, scope) {
        OrderCloudSDK.Orders.RemovePromotion('outgoing', order.ID, scope.promotion.Code)
            .then(function () {
                $rootScope.$broadcast('OC:UpdateOrder', order.ID);
                vm.promotions.splice(scope.$index, 1);
            });
    };

    vm.cancelOrder = function (order) {
        ocConfirm.Confirm("Are you sure you want cancel this order?")
            .then(function () {
                OrderCloudSDK.Orders.Delete('outgoing', order.ID)
                    .then(function () {
                        $state.go("productBrowse.products", {}, {
                            reload: 'base'
                        })
                    });
            });
    };

    vm.getSubTotal = function (lineItemsList) {
        var total = 0.0;
        angular.forEach(lineItemsList, function (lineItem) {
            total += (lineItem.UnitPrice * lineItem.Quantity);
        });
        return total;
    }

    vm.getShippingCostByVendor = function (vendorName) {
        return VendorShippingCriteria.getShippingCostByVendor(vendorName, vm.vendorLineItemsMap[vendorName]);
    };

    vm.getTaxCostByVendor = function (vendorName) {
        if (!$scope.checkout.shippingAddress.xp && !$scope.checkout.shippingAddress.xpTaxcost) {
            return 0;
        }
        var lineItemsList = vm.vendorLineItemsMap[vendorName]
        return vm.getSubTotal(lineItemsList) * $scope.checkout.shippingAddress.xp.Taxcost;
    };

    vm.calculateShippingCost = function () {
        var vendorNames = Object.keys(vm.vendorLineItemsMap);
        var totalShippingCost = 0;

        angular.forEach(vendorNames, function (vendorName) {
            totalShippingCost += vm.getShippingCostByVendor(vendorName);
        });

        return totalShippingCost;
    };

    vm.calculateTaxCost = function () {
        var vendorNames = Object.keys(vm.vendorLineItemsMap);
        var totaTaxCost = 0;

        angular.forEach(vendorNames, function (vendorName) {
            totaTaxCost += vm.getTaxCostByVendor(vendorName);
        });

        return totaTaxCost;
    };


    //TODO: missing unit tests
    $rootScope.$on('OC:UpdatePromotions', function (event, orderid) {
        OrderCloudSDK.Orders.ListPromotions('outgoing', orderid)
            .then(function (data) {
                if (data.Meta) {
                    vm.promotions = data.Items;
                } else {
                    vm.promotions = data;
                }
            });
    });

    function createAddress(order) {
        MyAddressesModal.Create()
            .then(function (address) {
                toastr.success('Address Created', 'Success');
                order.ShippingAddressID = address.ID;
                vm.saveShipAddress(order);
            });
    }

    function changeShippingAddress(order) {
        AddressSelectModal.Open('shipping')
            .then(function (address) {
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
            OrderCloudSDK.Orders.Patch('outgoing', order.ID, {
                    ShippingAddressID: order.ShippingAddressID
                })
                .then(function (updatedOrder) {
                    $rootScope.$broadcast('OC:OrderShipAddressUpdated', updatedOrder);
                    vm.getShippingRates(order);
                })
                .catch(function (ex) {
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
            .then(function (shipments) {
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
            .then(function () {
                $rootScope.$broadcast('OC:UpdateOrder', order.ID);
            });
    }
}