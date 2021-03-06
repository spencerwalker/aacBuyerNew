angular.module('orderCloud')
    .config(MyOrdersConfig)
    .controller('MyOrdersCtrl', MyOrdersController)
    .controller('MyOrderDetailCtrl', MyOrderDetailController)

function MyOrdersConfig($stateProvider) {
    $stateProvider
        .state('myOrders', {
            parent: 'account',
            templateUrl: 'myOrders/templates/myOrders.tpl.html',
            controller: 'MyOrdersCtrl',
            controllerAs: 'myOrders',
            data: {
                pageTitle: "Order History"
            },
            url: '/myorders?from&to&search&page&pageSize&searchOn&sortBy&filters?status?favorites',
            resolve: {
                Parameters: function ($stateParams, ocParameters) {
                    return ocParameters.Get($stateParams);
                },
                OrderList: function (OrderCloudSDK, Parameters, CurrentUser) {
                
                    if (Parameters.favorites && CurrentUser.xp.FavoriteOrders) {
                        Parameters.filters ? angular.extend(Parameters.filters, Parameters.filters, {ID: CurrentUser.xp.FavoriteOrders.join('|')}) : Parameters.filters = {ID: CurrentUser.xp.FavoriteOrders.join('|')};
                    } else if (Parameters.filters) {
                        delete Parameters.filters.ID;
                    }
                    
                    Parameters.status = Parameters.status || 'Open|AwaitingApproval|Completed|Canceled|Declined';
                    Parameters.filters ? angular.extend(Parameters.filters, {status: Parameters.status}) : Parameters.filters = {status: Parameters.status}

                    var showSubmittedOnly = angular.extend({}, Parameters.filters, {status: 'Open|AwaitingApproval|Completed|Canceled|Declined'});
                    return OrderCloudSDK.Me.ListOrders({search:Parameters.search, page: Parameters.page || 1, pageSize: Parameters.pageSize || 12, searchOn: Parameters.searchOn, filters: Parameters.filters, sortBy: Parameters.sortBy, from: Parameters.from, to:Parameters.to})
              
                }
            }
        })
        .state('myOrders.detail', {
            url: '/:orderid',
            templateUrl: 'myOrders/templates/myOrders.detail.tpl.html',
            controller: 'MyOrderDetailCtrl',
            controllerAs: 'myOrderDetail',
            resolve: {
                SelectedOrder: function ($stateParams, OrderCloudSDK) {
                    return OrderCloudSDK.Orders.Get('outgoing', $stateParams.orderid);
                },
                SelectedPayments: function ($stateParams, $q, OrderCloudSDK) {
                    var deferred = $q.defer();
                    OrderCloudSDK.Payments.List('outgoing', $stateParams.orderid)
                        .then(function (data) {
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
                                } else if (payment.Type === 'SpendingAccount' && payment.SpendingAccountID) {
                                    queue.push((function () {
                                        var d = $q.defer();
                                        OrderCloudSDK.Me.GetSpendingAccount(payment.SpendingAccountID)
                                            .then(function (cc) {
                                                data.Items[index].Details = cc;
                                                d.resolve();
                                            });
                                        return d.promise;
                                    })());
                                }
                            });
                            $q.all(queue)
                                .then(function () {
                                    deferred.resolve(data);
                                })
                        });

                    return deferred.promise;
                },
                ShippingAddress: function(OrderCloudSDK, SelectedOrder) {
                    return OrderCloudSDK.Me.GetAddress(SelectedOrder.ShippingAddressID)
                        .then(function (address) {
                            return address
                        })
                        .catch(function (ex) {
                            console.log(ex);
                            return {};
                        });
                },
                LineItemList: function ($q, $stateParams, OrderCloudSDK, ocLineItems) {
                    var dfd = $q.defer();
                    var opts = {
                        page: 1,
                        pageSize: 100
                    };
                    OrderCloudSDK.LineItems.List('outgoing', $stateParams.orderid,opts)
                        .then(function (data) {
                            ocLineItems.GetProductInfo(data.Items)
                                .then(function () {
                                    dfd.resolve(data);
                                });
                        });
                    return dfd.promise;
                },

                CurrentPromotions: function (CurrentOrder, OrderCloudSDK) {
                    return OrderCloudSDK.Orders.ListPromotions('outgoing', CurrentOrder.ID);
                },

                CategoryList: function ($stateParams, OrderCloudSDK) {
                    var opts ={
                        depth: 1,
                        filters: {ParentID: $stateParams.categoryID}
                    };
                    return OrderCloudSDK.Me.ListCategories(opts);
                },

                PromotionList: function ($stateParams, OrderCloudSDK) {
                    return OrderCloudSDK.Orders.ListPromotions('outgoing', $stateParams.orderid);
                }
            }
        });
}

function MyOrdersController($state, $ocMedia, OrderCloudSDK, ocParameters, OrderList, Parameters) {
    var vm = this;
    vm.list = OrderList;
    vm.parameters = Parameters;
    vm.sortSelection = Parameters.sortBy ? (Parameters.sortBy.indexOf('!') == 0 ? Parameters.sortBy.split('!')[1] : Parameters.sortBy) : null;

    //Check if filters are applied
    vm.filtersApplied = (vm.parameters.filters.status != 'Open|AwaitingApproval|Completed|Canceled|Declined') ||vm.parameters.filters.ID || vm.parameters.from || vm.parameters.to || ($ocMedia('max-width:767px') && vm.sortSelection); //Sort by is a filter on mobile devices
    vm.showFilters = vm.filtersApplied;

    //Check if search was used
    vm.searchResults = Parameters.search && Parameters.search.length > 0;

    //Reload the state with new parameters
    vm.filter = function (resetPage) {
        if (vm.parameters.filters && vm.parameters.status === null) delete vm.parameters.status;
        $state.go('.', ocParameters.Create(vm.parameters, resetPage));
    };

    vm.toggleFavorites = function () {
        if (vm.parameters.filters && vm.parameters.filters.ID) delete vm.parameters.filters.ID;
        if (vm.parameters.favorites) {
            vm.parameters.favorites = '';
        } else {
            vm.parameters.favorites = true;
            vm.parameters.page = '';
        }
        vm.filter(true);
    };

    //Reload the state with new search parameter & reset the page
    vm.search = function () {
        vm.filter(true);
    };

    //Clear the search parameter, reload the state & reset the page
    vm.clearSearch = function () {
        vm.parameters.search = null;
        vm.filter(true);
    };

    //Clear relevant filters, reload the state & reset the page
    vm.clearFilters = function () {
        vm.parameters.filters = null;
        vm.parameters.status= null;
        vm.parameters.favorites = null;
        vm.parameters.from = null;
        vm.parameters.to = null;
        $ocMedia('max-width:767px') ? vm.parameters.sortBy = null : angular.noop(); //Clear out sort by on mobile devices
        vm.filter(true);
    };

    //Conditionally set, reverse, remove the sortBy parameter & reload the state
    vm.updateSort = function (value) {
        value ? angular.noop() : value = vm.sortSelection;
        switch (vm.parameters.sortBy) {
            case value:
                vm.parameters.sortBy = '!' + value;
                break;
            case '!' + value:
                vm.parameters.sortBy = null;
                break;
            default:
                vm.parameters.sortBy = value;
        }
        vm.filter(false);
    };

    //Used on mobile devices
    vm.reverseSort = function () {
        Parameters.sortBy.indexOf('!') == 0 ? vm.parameters.sortBy = Parameters.sortBy.split('!')[1] : vm.parameters.sortBy = '!' + Parameters.sortBy;
        vm.filter(false);
    };

    //Reload the state with the incremented page parameter
    vm.pageChanged = function (page) {
        $state.go('.', {page: page});
    };

    //Load the next page of results with all of the same parameters
    vm.loadMore = function () {
        var opts = {
            from: Parameters.from,
            to: Parameters.to,
            search: Parameters.search,
            page: vm.list.Meta.Page + 1,
            pageSize: Parameters.pageSize || vm.list.Meta.PageSize,
            searchOn: Parameters.searchOn,
            sortBy: Parameters.sortBy,
            filters: Parameters.filters
        };
        return OrderCloudSDK.Me.ListOrders(opts)
            .then(function (data) {
                vm.list.Items = vm.list.Items.concat(data.Items);
                vm.list.Meta = data.Meta;
            });
    };
}

function MyOrderDetailController($state, $exceptionHandler, $scope, $filter, toastr, OrderCloudSDK, ocConfirm, SelectedOrder, SelectedPayments, 
    LineItemList, PromotionList, CategoryList, VendorShippingCriteria, ShippingAddress) {
    var vm = this;
    vm.order = SelectedOrder;
    vm.list = LineItemList;
    vm.paymentList = SelectedPayments.Items;
    vm.canCancel = SelectedOrder.Status === 'Unsubmitted' || SelectedOrder.Status === 'AwaitingApproval';
    vm.promotionList = PromotionList.Meta ? PromotionList.Items : PromotionList;
    vm.shippingAddress = ShippingAddress;
    vm.vendorLineItemsMap = {};

    angular.forEach(vm.list.Items, function (lineItem) {
        var productId = lineItem.ProductID;
        var vendorName = (lineItem.Punchout && lineItem.xp && lineItem.xp.PunchoutName) 
                ? $filter('punchoutLineItemVendor')(lineItem.xp.PunchoutName)
                : productId.split("_")[0]; 

        if (typeof vm.vendorLineItemsMap[vendorName] === 'undefined') {
            vm.vendorLineItemsMap[vendorName] = [];
        }
        vm.vendorLineItemsMap[vendorName].push(lineItem);
    });

    vm.getShippingCostByVendor = function (vendorName) {
        return VendorShippingCriteria.getShippingCostByVendor(vendorName, vm.vendorLineItemsMap[vendorName]);
    };

    vm.getSubTotal = function (lineItemsList) {
        var total = 0.0;
        angular.forEach(lineItemsList, function (lineItem) {
            total += ( lineItem.UnitPrice * lineItem.Quantity);
        });
        return total;
    }

    vm.cancelOrder = function (orderid) {
        ocConfirm.Confirm('Are you sure you want to cancel this order?')
            .then(function () {
                OrderCloudSDK.Orders.Cancel('outgoing', orderid)
                    .then(function () {
                        $state.go('myOrders', {}, {reload: true});
                        toastr.success('Order Cancelled', 'Success');
                    })
                    .catch(function (ex) {
                        $exceptionHandler(ex);
                    });
            });
    };
}