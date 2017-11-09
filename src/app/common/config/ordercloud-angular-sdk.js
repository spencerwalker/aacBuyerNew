angular.module('orderCloud')
    .run(OrderCloudAngularSDKConfig)
    .config(OrderCloudSDKDecorators)
;

function OrderCloudAngularSDKConfig(OrderCloudSDK, appname, apiurl, authurl) {
    var cookiePrefix = appname.replace(/ /g, '_').toLowerCase();
    var apiVersion = 'v1';
    OrderCloudSDK.Config(cookiePrefix, apiurl + '/' + apiVersion, authurl);
}

function OrderCloudSDKDecorators($provide, punchoutproduct) {
    $provide.decorator('OrderCloudSDK', function($delegate, $q) {

        var originalMeListProducts = $delegate.Me.ListProducts;
        function decoratedMeListProducts() {
            var df = $q.defer();

            var originalArguments = arguments[0];
            
            if (!originalArguments) {
                originalArguments = {filters: {ID: '!' + punchoutproduct}}
            } else if(!originalArguments.filters) {
                originalArguments = angular.extend(originalArguments, {filters: {ID: '!' + punchoutproduct}} )
            } else if (!originalArguments.filters.ID) {
                originalArguments = angular.extend(originalArguments, {filters: angular.extend(originalArguments.filters, {ID: '!' + punchoutproduct})})
            } else if(originalArguments.favorites) {
                originalArguments = angular.extend(originalArguments, {filters: {ID: originalArguments.filters.ID}})
            } else {
                originalArguments = angular.extend(originalArguments, {filters: angular.extend(originalArguments.filters, {ID: '!' + punchoutproduct})})
            }

            originalMeListProducts.apply($delegate, [originalArguments])
                .then(function(data) {
                    df.resolve(data);
                })
                .catch(function(ex) {
                    df.reject(ex);
                });

            return df.promise;
        }

        var originalLineItemsList = $delegate.LineItems.List;
        function decoratedLineItemsList() {
            var df = $q.defer();

            originalLineItemsList.apply($delegate, arguments)
                .then(function(data) {
                    angular.forEach(data.Items, function(lineItem) {
                        lineItem.Punchout = (lineItem.ProductID == punchoutproduct);
                    });
                    df.resolve(data);
                })
                .catch(function(ex) {
                    df.reject(ex);
                })

            return df.promise;
        }

        $delegate.Me.ListProducts = decoratedMeListProducts;
        $delegate.LineItems.List = decoratedLineItemsList;

        return $delegate;
    });
}