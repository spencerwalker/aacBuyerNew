angular.module('orderCloud')
    .factory('ocPunchout', OrderCloudPunchoutService)
    .provider('$ocPunchout', OrderCloudPunchoutProvider)
    .config(OrderCloudPunchoutConfig)
    .filter('punchoutProductName', punchoutProductName)
;

function OrderCloudPunchoutService($q, $resource, $ocPunchout, OrderCloudSDK, punchouturl, buyerid) {
    var service = {
        IsPunchoutCategory: _isPunchoutCategory,
        SetupRequest: _setupRequest
    };

    var punchouts = $ocPunchout.GetPunchouts();

    function _isPunchoutCategory(categoryID) {
        return punchouts[categoryID];
    }

    function _setupRequest(punchoutName, punchoutItemID, orderID) {
        var deferred = $q.defer();

        var shipToID;
        OrderCloudSDK.Me.ListAddresses({page: 1, pageSize: 1})
            .then(function(data) {
                if (data.Items.length) {
                    shipToID = data.Items[0].ID;
                }
                sendSetupRequest();
            })
            .catch(function() {
                sendSetupRequest();
            });

        function sendSetupRequest() {
            var body = {
                punchoutName: punchoutName,
                buyerID: buyerid,
                access_token: OrderCloudSDK.GetToken(),
                currentOrderID: orderID,
                shipToID: shipToID || null,
                selectedItemID: punchoutItemID || null
            };

            $resource(punchouturl + '/OutBoundSetupRequest', {}, {setuprequest: {method: 'POST'}}).setuprequest(body).$promise
                .then(function(data) {
                    deferred.resolve(data);
                })
                .catch(function(ex) {
                    deferred.reject(ex);
                });
        }

        return deferred.promise;
    }

    return service;
}

function OrderCloudPunchoutProvider() {
    var punchouts = {};

    return {
        $get: function() {
            return {
                GetPunchouts: function() {
                    return punchouts;
                }
            }
        },
        AddPunchout: function(punchout) {
            if (!punchout.Name) throw 'ocPunchout: punchout must have a Name';
            if (!punchout.CategoryID) throw 'ocPunchout: punchout must have a CategoryID'

            punchouts[punchout.CategoryID] = punchout;
        }
    };
}

function OrderCloudPunchoutConfig($ocPunchoutProvider) {
    var punchouts = [
        {Name: 'officedepot', CategoryID: 'TopStores_OfficeDepot', SupplierPartID: 'AAA'}
    ];

    angular.forEach(punchouts, function(punchout) {
        $ocPunchoutProvider.AddPunchout(punchout);
    });
}

function punchoutProductName() {
    return function(xp, punchoutName) {
        if (!xp || !punchoutName) return;

        var map = {
            'officedepot': 'Description'
        };

        return xp[map[punchoutName]];
    }
}