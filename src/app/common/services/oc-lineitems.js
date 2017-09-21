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
        var productIDs = _.uniq(_.pluck(li, 'ProductID')).join('|');
        var dfd = $q.defer();
        var queue = [];

        OrderCloudSDK.Me.ListProducts({ID: productIDs})
            .then(function(products) {
                dfd.resolve(products);
            })
            .catch(function(ex) {
                console.log(ex);
            })
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
            var lineItemsArr = [];
            var patchQueue = [];
            var deleteQueue = [];

            _.each(lineItems, function(lineItem) {
                if (lineItem && lineItem.xp && lineItem.xp.SupplierPartID) {
                    lineItemsArr.push(lineItem); 
                } else {
                    return
                }
            })

            var supplierPartIDGroup = _.groupBy(lineItemsArr, function(line) {
                return line.xp.SupplierPartID;
            })
            
            _.each(supplierPartIDGroup, function(IDGroup) {
                if(IDGroup.length > 1) {
                    var quantities = _.pluck(IDGroup, 'Quantity');
                    var newQuantity = quantities.reduce(function(a, b) {
                        return a + b;
                    })
                    var patchLI = angular.copy(IDGroup[0]);
                    var patchBody = {
                        Quantity: newQuantity
                    };
                    patchQueue.push(OrderCloudSDK.LineItems.Patch('outgoing', orderID, patchLI.ID, patchBody));
                    IDGroup.splice(0, 1);
                    _.each(IDGroup, function(group) {
                        var index = lineItems.indexOf(group);
                        lineItems.splice(index, 1);
                        deleteQueue.push(OrderCloudSDK.LineItems.Delete('outgoing', orderID, group.ID));
                    })
                }
            })
            
            return $q.all(patchQueue)
                .then(function(updatedLineItems) {
                    if (updatedLineItems && updatedLineItems.length) {
                        _.each(updatedLineItems, function(updatedli) {
                            var oldLineItem = _.findWhere(lineItems, {ID: updatedli.ID});
                            lineItems[lineItems.indexOf(oldLineItem)] = updatedli;
                        })
                        return $q.all(deleteQueue)
                            .then(function() {
                                dfd.resolve(lineItems);
                            })
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