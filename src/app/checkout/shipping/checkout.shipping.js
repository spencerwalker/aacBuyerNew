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

function CheckoutShippingController($exceptionHandler, $rootScope, $scope, $state, $q, toastr, OrderCloud, MyAddressesModal, AddressSelectModal, ShippingRates, VendorShippingCriteria, CheckoutConfig, LineItemsList, CurrentPromotions, ocConfirm, CategoryList, ProductList, CurrentOrder) {
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

    // watcher on vm.lineItems
    $scope.$watch(function () {
        return vm.lineItems;
    }, function(newVal, oldVal){
        //create a queue to hold all the api calls that will be sent out at once
        var lineItemUpdateQueue = [];
        vm.vendorLineItemsMap = {};
        angular.forEach(vm.lineItems.Items, function(lineItem){
            var xp = {
                vendorOrderId: []
            };
            var ID;
            var productId = lineItem.ProductID;
            var vendorName = productId.split("_")[0];

            if(typeof vm.vendorLineItemsMap[vendorName] === 'undefined') {
                vm.vendorLineItemsMap[vendorName] = [];
                vm.vendorLineItemsMap[vendorName].push(lineItem);
                ID = vm.vendorLineItemsMap[vendorName][0].ID.substring(0, 7);
                xp.vendorOrderId.push(ID);
            }else{
                vm.vendorLineItemsMap[vendorName].push(lineItem);
                ID = vm.vendorLineItemsMap[vendorName][0].ID.substring(0, 7);
                xp.vendorOrderId.push(ID);
            }

            $('.' + vendorName).val(ID);
           //this line pushes all the api calls into a queue that will be sent off once $q.all is invoked with the queue.
            lineItemUpdateQueue.push(OrderCloud.LineItems.Patch(CurrentOrder.ID, lineItem.ID, {'xp' : xp}));
        });
        //this calls runs all the async calls in the queue and waits for them to be returned. This works because each OrderCloud.method returns a promise.
        $q.all(lineItemUpdateQueue)
            .then(function(updatedLineItems){
                //this should have have all the updated line items. Line items should now be updated.
                console.log("updated line items", updatedLineItems);
            })
        
        ShippingRates.SetShippingCost(CurrentOrder.ID, vm.calculateShippingCost());
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
    
    vm.getShippingCostByVendor = function(vendorName){
        var vendorLineItems = vm.vendorLineItemsMap[vendorName];
        var itemCount = 0;
        var amount = 0;
        var state = '';
        angular.forEach(vendorLineItems, function(lineItem){
            amount += ( lineItem.UnitPrice * lineItem.Quantity);
            itemCount += lineItem.Quantity;
            state = lineItem.ShippingAddress.State;
        });

        var vendorShippingCriteria = _.find(VendorShippingCriteria.ByVendor, {name: vendorName}) || _.find(VendorShippingCriteria.ByState, {name: state}) || VendorShippingCriteria.ByDefault;

        var shippingCalculator = vendorShippingCriteria.shippingCostFunc;

        var shippingCost = shippingCalculator({
            amount: amount,
            itemCount: itemCount
        });
        console.log('sc test', vendorName, shippingCost, vm.vendorLineItemsMap[vendorName]);
        return shippingCost;
    };

    vm.calculateShippingCost = function() {
        var vendorNames = Object.keys(vm.vendorLineItemsMap);
        var totalShippingCost = 0;

        angular.forEach(vendorNames, function(vendorName){
            totalShippingCost += vm.getShippingCostByVendor(vendorName);
        });

        return totalShippingCost;
    };
    
    
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