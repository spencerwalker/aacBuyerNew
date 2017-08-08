angular.module('orderCloud')
    .factory('ocLineItems', LineItemFactory)
;

function LineItemFactory($rootScope, $q, $uibModal, OrderCloudSDK, catalogid, buyerid) {
    return {
        SpecConvert: _specConvert,
        AddItem: _addItem,
        GetProductInfo: _getProductInfo,
        CustomShipping: _customShipping,
        UpdateShipping: _updateShipping,
        ListAll: _listAll
    };

    function _specConvert(specs) {
        var results = [];
        angular.forEach(specs, function (spec) {
            var spec_to_push = {SpecID: spec.ID};
            if (spec.Options.length > 0) {
                if (spec.DefaultOptionID) {
                    spec_to_push.OptionID = spec.DefaultOptionID;
                }
                if (spec.OptionID) {
                    spec_to_push.OptionID = spec.OptionID;
                }
                if (spec.Value) {
                    spec_to_push.Value = spec.Value;
                }
            }
            else {
                spec_to_push.Value = spec.Value || spec.DefaultValue || null;
            }
            results.push(spec_to_push);
        });
        return results;
    }

    function _addItem(order, product, lineItems) {
        var deferred = $q.defer();
        var li = {
            ProductID: product.ID,
            Quantity: product.Quantity,
            Specs: _specConvert(product.Specs)
        };
        if (lineItems && lineItems.Items && lineItems.Items.length) {
            preventDuplicateLineItems(order, product, lineItems.Items)
        } else {
            createLineItem();
        }

        li.ShippingAddressID = isSingleShipping(order) ? getSingleShippingAddressID(order) : order.ShippingAddressID;

        function preventDuplicateLineItems(order, product, lineItems) {
            var existingLI = _.where(lineItems, {ProductID: product.ID});
                if (existingLI && existingLI.length) {
                    var newQty = product.Quantity + existingLI[0].Quantity;
                    OrderCloudSDK.LineItems.Patch('outgoing', order.ID, existingLI[0].ID, {Quantity: newQty})
                        .then(function(lineItem) {
                            $rootScope.$broadcast('OC:UpdateOrder', order.ID);
                            deferred.resolve();
                        })
                        .catch(function(error) {
                            deferred.reject(error);
                        });
                } else {
                    createLineItem();
                }
        }

        function createLineItem() {
            OrderCloudSDK.LineItems.Create('outgoing', order.ID, li)
                .then(function(lineItem) {
                    $rootScope.$broadcast('OC:UpdateOrder', order.ID);
                    lineItems.Items.push(lineItem);
                    deferred.resolve();
                })
                .catch(function(error) {
                    deferred.reject(error);
                });
        }

        function isSingleShipping(order) {
            return _.pluck(order.LineItems, 'ShippingAddressID').length == 1;
        }

        function getSingleShippingAddressID(order) {
            return order.LineItems[0].ShippingAddressID;
        }

        return deferred.promise;
    }

    function _getProductInfo(LineItems) {
        var li = LineItems.Items || LineItems;
        var productIDs = _.uniq(_.pluck(li, 'ProductID'));
        var dfd = $q.defer();
        var queue = [];
        angular.forEach(productIDs, function (productid) {
            queue.push(OrderCloudSDK.Me.GetProduct(productid));
        });
        $q.all(queue)
            .then(function (results) {
                angular.forEach(li, function (item) {
                    item.Product = angular.copy(_.where(results, {ID: item.ProductID})[0]);
                });
                dfd.resolve(li);
            });
        return dfd.promise;
    }

    function _customShipping(Order, LineItem) {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'common/lineitems/templates/shipping.tpl.html',
            controller: 'LineItemModalCtrl',
            controllerAs: 'liModal',
            size: 'lg'
        });

        modalInstance.result
            .then(function (address) {
                address.ID = Math.floor(Math.random() * 1000000).toString();
                OrderCloudSDK.LineItems.SetShippingAddress('outgoing', Order.ID, LineItem.ID, address)
                    .then(function () {
                        $rootScope.$broadcast('LineItemAddressUpdated', LineItem.ID, address);
                    });
            });
    }

    function _updateShipping(Order, LineItem, AddressID) {
        OrderCloudSDK.Addresses.Get(buyerid, AddressID)
            .then(function (address) {
                OrderCloudSDK.LineItems.SetShippingAddress('outgoing', Order.ID, LineItem.ID, address);
                $rootScope.$broadcast('LineItemAddressUpdated', LineItem.ID, address);
            });
    }

    function _listAll(orderID) {
        var li;
        var dfd = $q.defer();
        var queue = [];
        var opts = {
            page: 1,
            pageSize: 100
        };
        OrderCloudSDK.LineItems.List('outgoing', orderID, opts)
            .then(function (lineItems) {
                if (lineItems.Meta.TotalPages > lineItems.Meta.Page) {
                    var page = lineItems.Meta.Page;
                    while (page < lineItems.Meta.TotalPages) {
                        page += 1;
                        opts.page = page;
                        queue.push(OrderCloudSDK.LineItems.List('outgoing', orderID, opts));
                    }
                } else {
                    removeDuplicatePOItems(lineItems.Items)
                }
                $q.all(queue)
                    .then(function (results) {
                        angular.forEach(results, function (result) {
                            lineItems.Items = [].concat(lineItems.Items, result.Items);
                            lineItems.Meta = result.Meta;
                        });
                        removeDuplicatePOItems(lineItems.Items);
                    });
            });

        function removeDuplicatePOItems(lineItems) {
            var queue = [];
            var duplicateArr = [];
            _.each(lineItems, function(lineItem) {
                if (lineItem) {
                    var duplicateCheck = _.where(lineItems, {ProductID: lineItem.ProductID});
                    if (duplicateCheck && duplicateCheck.length > 1) {
                        var quantities = _.pluck(duplicateCheck, 'Quantity');
                        var newQuantity = quantities.reduce(function(a, b) {
                            return a + b;
                        })
                        var patchLineItem = angular.copy(duplicateCheck[0]);
                        duplicateCheck.splice(0, 1);
                        duplicateArr.push(duplicateCheck);
                        _.each(duplicateCheck, function(duplicate) {
                            var index = lineItems.indexOf(duplicate);
                            lineItems.splice(index, 1);
                        });
                        queue.push(OrderCloudSDK.LineItems.Patch('outgoing', orderID, patchLineItem.ID, {Quantity: newQuantity}))
                    } 
                }
            })
            return $q.all(queue)
                .then(function(updatedLineItems) {
                    if (updatedLineItems && updatedLineItems.length) {
                        var newQueue = [];
                        _.each(updatedLineItems, function(li) {
                            var IDs = _.pluck(lineItems, 'ID');
                            var index = IDs.indexOf(li.ID);
                            lineItems[index] = li;
                        })
                        duplicateArr = _.flatten(duplicateArr);
                        if (duplicateArr && duplicateArr.length) {
                            _.each(duplicateArr, function(duplicateLI) {
                                newQueue.push(OrderCloudSDK.LineItems.Delete('outgoing', orderID, duplicateLI.ID))
                            })
                            return $q.all(newQueue)
                                .then(function() {
                                    dfd.resolve(lineItems);
                                })
                        } else {
                            dfd.resolve(lineItems);
                        }
                    } else {
                        dfd.resolve(lineItems);
                    }
                })
        }
        return dfd.promise;
    }

    function preventDuplicateLineItems(order, product, lineItems) {
        var existingLI = _.where(lineItems, {ProductID: product.ID});
            if (existingLI && existingLI.length) {
                var newQty = product.Quantity + existingLI[0].Quantity;
                OrderCloudSDK.LineItems.Patch('outgoing', order.ID, existingLI[0].ID, {Quantity: newQty})
                    .then(function(lineItem) {
                        $rootScope.$broadcast('OC:UpdateOrder', order.ID);
                    })
            }
    }
}